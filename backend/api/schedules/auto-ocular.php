<?php
// backend/api/schedules/auto-ocular.php
// Admin starts the automatic ocular visit date for a Scheduled job order
// (for jobs that were already Scheduled before the date agreement existed).
//   POST { job_order_id }
// A random free weekday inside the job dates (9:00–11:00 AM) is sent to the customer to accept or change.
require_once __DIR__ . '/../../cors.php';
require_once __DIR__ . '/../../config/db.php';
require_once __DIR__ . '/../../middleware/jwt.php';
require_once __DIR__ . '/../../middleware/audit.php';
require_once __DIR__ . '/../../helpers/site-visits.php';

handleCors();
header('Content-Type: application/json');

function aoFail(string $msg, int $code = 422): never
{
    http_response_code($code);
    echo json_encode(['success' => false, 'error' => $msg]);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') aoFail('Method not allowed.', 405);

$auth  = requireAdminAccess();
$body  = json_decode(file_get_contents('php://input'), true) ?? [];
$jobId = (int)($body['job_order_id'] ?? 0);
if (!$jobId) aoFail('Choose the job order.', 400);

try {
    $pdo = getDB();
    $jo  = svLoadJob($pdo, $jobId);
    if (!$jo) aoFail('Job order not found.', 404);
    if ((int)$jo['status_id'] !== JO_STATUS_SCHEDULED) aoFail('The automatic date is only for job orders that are Scheduled.');
    if (empty($jo['worker_user_id'])) aoFail('Assign a worker to this job order first.');
    if (empty($jo['start_date']) || empty($jo['end_date'])) aoFail('Set the start and end dates of the job order first.');

    $res = svAutoOcular($pdo, $jobId);
    if (!$res['ok']) {
        aoFail([
            'exists'      => 'This job order already has an ocular visit.',
            'no_free_day' => 'No free weekday left between the job dates (from tomorrow). Please set the date yourself.',
        ][$res['reason']] ?? 'Could not create the visit. Please try again.');
    }

    $v = svLoad($pdo, (int)$res['id']);
    auditLog(array_merge(auditActor($auth), [
        'action'         => 'CREATE',
        'module'         => 'Schedules',
        'description'    => 'Sent an ocular visit date for job order ' . ($jo['job_order_code'] ?: '#' . $jobId) . ' to the customer',
        'target_user_id' => $jo['client_user_id'] ?? null,
        'target_type'    => 'schedule',
        'target_id'      => (int)$res['id'],
        'target_label'   => ($v['schedule_code'] ?? '#' . $res['id']) . ' — ' . trim((string)($v['worker_name'] ?? '')),
        'new_values'     => ['proposed_date' => $res['date']],
    ]));

    echo json_encode([
        'success' => true,
        'message' => 'Date sent: ' . svFmtDay($res['date']) . ', 9:00–11:00 AM. Waiting for the '
                     . (!empty($jo['client_user_id']) ? 'customer' : 'worker') . ' to answer.',
        'date'    => $res['date'],
    ]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Database error.', 'detail' => $e->getMessage()]);
}