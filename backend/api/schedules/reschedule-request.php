<?php
// backend/api/schedules/reschedule-request.php
// The worker on a site visit asks to move it.
//   POST { schedule_id, new_start_time, new_end_time, reason }
require_once __DIR__ . '/../../cors.php';
require_once __DIR__ . '/../../config/db.php';
require_once __DIR__ . '/../../middleware/jwt.php';
require_once __DIR__ . '/../../middleware/audit.php';
require_once __DIR__ . '/../../helpers/site-visits.php';

handleCors();
header('Content-Type: application/json');

function rrFail(string $msg, int $code = 422): never
{
    http_response_code($code);
    echo json_encode(['success' => false, 'error' => $msg]);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') rrFail('Method not allowed.', 405);

$auth = requireAuth();
$uid  = (int)($auth['sub'] ?? 0);
$body = json_decode(file_get_contents('php://input'), true) ?? [];

$scheduleId = (int)($body['schedule_id'] ?? 0);
$start      = svNormalizeTime($body['new_start_time'] ?? '');
$end        = svNormalizeTime($body['new_end_time'] ?? '');
$reason     = trim((string)($body['reason'] ?? ''));

if (!$scheduleId) rrFail('schedule_id is required.', 400);
if ($reason === '') rrFail('Add a reason so the admin can review the request.');
if (mb_strlen($reason) > 1000) rrFail('Keep the reason under 1000 characters.');
if ($err = svCheckSlot($start, $end)) rrFail($err);

try {
    $pdo = getDB();
    $v   = svLoad($pdo, $scheduleId);
    if (!$v) rrFail('Schedule not found.', 404);
    if ((int)$v['worker_user_id'] !== $uid) rrFail('You can only ask to move your own site visits.', 403);
    if (!in_array((int)$v['status_id'], svOpenStatuses(), true)) rrFail('This visit is no longer open.');
    if ($v['start_time'] <= jobOrderNow()) rrFail('This visit has already started.');

    $dup = $pdo->prepare("SELECT 1 FROM reschedule_requests WHERE schedule_id = ? AND status = 'pending' LIMIT 1");
    $dup->execute([$scheduleId]);
    if ($dup->fetchColumn()) rrFail('You already have a request waiting for this visit.', 409);

    if ($clash = svWorkerClash($pdo, $uid, $start, $end, $scheduleId)) rrFail('You already have visit ' . $clash . ' at that time.');

    $pdo->prepare(
        "INSERT INTO reschedule_requests (schedule_id, requested_by_user_id, new_start_time, new_end_time, reason, status)
         VALUES (?, ?, ?, ?, ?, 'pending')"
    )->execute([$scheduleId, $uid, $start, $end, $reason]);
    $requestId = (int)$pdo->lastInsertId();

    $code = $v['schedule_code'] ?: ('#' . $scheduleId);
    auditLog(array_merge(auditActor($auth), [
        'action'       => 'CREATE',
        'module'       => 'Schedules',
        'description'  => trim((string)$v['worker_name']) . ' asked to move site visit ' . $code,
        'target_type'  => 'reschedule_request',
        'target_id'    => $requestId,
        'target_label' => $code,
        'old_values'   => ['time' => $v['start_time'] . ' – ' . $v['end_time']],
        'new_values'   => ['time' => $start . ' – ' . $end, 'reason' => $reason],
    ]));

    echo json_encode(['success' => true, 'message' => 'Request sent. You will get an Inbox message when the admin answers.', 'request_id' => $requestId]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Database error.', 'detail' => $e->getMessage()]);
}