<?php
// backend/api/schedules/create.php
// Admin plans a site visit for a job order.
//   POST { job_order_id, visit_type: ocular|progress|other, worker_user_id, start_time, end_time, description }
require_once __DIR__ . '/../../cors.php';
require_once __DIR__ . '/../../middleware/jwt.php';
require_once __DIR__ . '/../../config/db.php';
require_once __DIR__ . '/../../middleware/audit.php';
require_once __DIR__ . '/../../helpers/site-visits.php';

handleCors();
header('Content-Type: application/json');

function svFail(string $msg, int $code = 422): never
{
    http_response_code($code);
    echo json_encode(['success' => false, 'error' => $msg]);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') svFail('Method not allowed.', 405);

$auth = requireAdminAccess();
$pdo  = getDB();
$data = json_decode(file_get_contents('php://input'), true) ?? [];

$jobId    = (int)($data['job_order_id'] ?? 0);
$type     = $data['visit_type'] ?? '';
$workerId = (int)($data['worker_user_id'] ?? $data['worker_contact_id'] ?? 0);
$start    = svNormalizeTime($data['start_time'] ?? '');
$end      = svNormalizeTime($data['end_time'] ?? '');
$descr    = trim((string)($data['description'] ?? ''));

if (!$jobId) svFail('Choose the job order for this visit.');
if (!in_array($type, ['ocular', 'progress', 'other'], true)) svFail('Choose the type of visit.');
if (!$workerId) svFail('Choose who goes on the visit.');
if ($err = svCheckSlot($start, $end)) svFail($err);
if (mb_strlen($descr) > 1000) svFail('Keep the notes under 1000 characters.');

try {
    $jo = svLoadJob($pdo, $jobId);
    if (!$jo) svFail('Job order not found.', 404);

    if (svNoVisits($jo)) svFail(SV_NO_VISITS_MSG);

    $allowed = svAllowedTypes((int)$jo['status_id']);
    if (!$allowed) svFail('Site visits can be planned when the job order is Under Review, Scheduled or In Progress.');
    if (!in_array($type, $allowed, true)) {
        svFail($type === 'ocular'
            ? 'An ocular inspection is only for job orders that are Under Review or Scheduled.'
            : 'A progress inspection is only for job orders that are Scheduled or In Progress.');
    }
    if ($type === 'ocular') {
        // One ocular visit per job order (the system usually plans it already)
        $ex = $pdo->prepare("SELECT COALESCE(schedule_code, CONCAT('#', id)) FROM schedules
                             WHERE job_order_id = ? AND visit_type = 'ocular' AND status_id IN (?, ?, ?)");
        $ex->execute([$jobId, SV_PENDING, SV_SCHEDULED, SV_IN_PROGRESS]);
        if ($dup = $ex->fetchColumn()) svFail('This job order already has an ocular visit (' . $dup . '). Open it instead.');
    }
    if ($err = svCheckWorker($pdo, $jo, $type, $workerId)) svFail($err);
    if ($clash = svWorkerClash($pdo, $workerId, $start, $end)) svFail('This worker already has visit ' . $clash . ' at that time.');

    // schedule_code (SCHED0001...) is set automatically by the database trigger
    $pdo->prepare(
        "INSERT INTO schedules (worker_user_id, client_user_id, job_order_id, visit_type, start_time, end_time, description, status_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
    )->execute([$workerId, $jo['client_user_id'] ?: null, $jobId, $type, $start, $end, $descr !== '' ? $descr : null, SV_SCHEDULED]);
    $newId = (int)$pdo->lastInsertId();

    $v = svLoad($pdo, $newId);
    $code = $v['schedule_code'] ?? ('#' . $newId);

    auditLog(array_merge(auditActor($auth), [
        'action'         => 'CREATE',
        'module'         => 'Schedules',
        'description'    => 'Planned ' . strtolower(svTypeLabel($type)) . ' ' . $code . ' for job order '
                            . ($jo['job_order_code'] ?: '#' . $jobId) . ' with ' . trim((string)$v['worker_name']),
        'target_user_id' => $jo['client_user_id'] ?? null,
        'target_type'    => 'schedule',
        'target_id'      => $newId,
        'target_label'   => $code . ' — ' . trim((string)$v['worker_name']),
        'new_values'     => ['type' => svTypeLabel($type), 'worker' => $v['worker_name'], 'start_time' => $start, 'end_time' => $end],
    ]));

    svNotify($pdo, $newId, 'site_visit',
        'Site visit: ' . svTypeLabel($type) . ' on ' . (new DateTime($start, jobOrderTz()))->format('M j'),
        $descr !== '' ? $descr : 'You are scheduled to visit this site.');

    http_response_code(201);
    echo json_encode(['success' => true, 'message' => 'Site visit planned. The worker has been notified.', 'schedule' => svLoad($pdo, $newId)]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Database error.', 'detail' => $e->getMessage()]);
}