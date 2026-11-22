<?php
// backend/api/schedules/reschedule-requests/review.php
// Admin approves or rejects a worker's request to move a site visit.
//   POST { request_id, action: 'approve' | 'reject', note? }
require_once __DIR__ . '/../../../cors.php';
require_once __DIR__ . '/../../../config/db.php';
require_once __DIR__ . '/../../../middleware/jwt.php';
require_once __DIR__ . '/../../../middleware/audit.php';
require_once __DIR__ . '/../../../helpers/site-visits.php';

handleCors();
header('Content-Type: application/json');

function rvFail(string $msg, int $code = 422): never
{
    http_response_code($code);
    echo json_encode(['success' => false, 'error' => $msg]);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') rvFail('Method not allowed.', 405);

$auth = requireAdminAccess();
$body = json_decode(file_get_contents('php://input'), true) ?? [];
$requestId = (int)($body['request_id'] ?? 0);
$action    = $body['action'] ?? '';
$note      = trim((string)($body['note'] ?? ''));

if (!$requestId) rvFail('request_id is required.', 400);
if (!in_array($action, ['approve', 'reject'], true)) rvFail('Choose approve or reject.', 400);

try {
    $pdo = getDB();
    $st  = $pdo->prepare('SELECT * FROM reschedule_requests WHERE id = ? LIMIT 1');
    $st->execute([$requestId]);
    $req = $st->fetch(PDO::FETCH_ASSOC);
    if (!$req) rvFail('Request not found.', 404);
    if ($req['status'] !== 'pending') rvFail('This request was already answered.', 409);

    $v = svLoad($pdo, (int)$req['schedule_id']);
    if (!$v) rvFail('The site visit no longer exists.', 404);
    $code  = $v['schedule_code'] ?: ('#' . $v['id']);
    $label = svTypeLabel($v['visit_type']);
    $now   = jobOrderNow();

    if ($action === 'approve') {
        if (!in_array((int)$v['status_id'], svOpenStatuses(), true)) rvFail('This visit is no longer open.');
        if ($err = svCheckSlot($req['new_start_time'], $req['new_end_time'])) rvFail('Can’t approve: ' . lcfirst($err));
        if ($v['worker_user_id'] && ($clash = svWorkerClash($pdo, (int)$v['worker_user_id'], $req['new_start_time'], $req['new_end_time'], (int)$v['id']))) {
            rvFail('Can’t approve: the worker already has visit ' . $clash . ' at that time.');
        }
        $pdo->beginTransaction();
        $pdo->prepare("UPDATE schedules SET start_time = ?, end_time = ? WHERE id = ?")
            ->execute([$req['new_start_time'], $req['new_end_time'], $v['id']]);
        $pdo->prepare("UPDATE reschedule_requests SET status = 'approved', reviewed_at = ? WHERE id = ?")
            ->execute([$now, $requestId]);
        $pdo->commit();
    } else {
        $pdo->prepare("UPDATE reschedule_requests SET status = 'rejected', reviewed_at = ? WHERE id = ?")
            ->execute([$now, $requestId]);
    }

    auditLog(array_merge(auditActor($auth), [
        'action'       => 'UPDATE',
        'module'       => 'Schedules',
        'description'  => ($action === 'approve' ? 'Approved' : 'Rejected') . ' the request to move site visit ' . $code,
        'target_type'  => 'reschedule_request',
        'target_id'    => $requestId,
        'target_label' => $code . ' — ' . trim((string)$v['worker_name']),
        'old_values'   => ['time' => $v['start_time'] . ' – ' . $v['end_time']],
        'new_values'   => ['requested' => $req['new_start_time'] . ' – ' . $req['new_end_time'], 'answer' => $action, 'note' => $note ?: null],
    ]));

    $when = (new DateTime($req['new_start_time'], jobOrderTz()))->format('M j, g:i A');
    if ($action === 'approve') {
        svNotify($pdo, (int)$v['id'], 'visit_update', 'Reschedule approved: ' . $label . ' moved to ' . $when,
            $note !== '' ? $note : 'Your request was approved.', (int)$req['requested_by_user_id']);
    } else {
        svNotify($pdo, (int)$v['id'], 'visit_update', 'Reschedule not approved: ' . $label . ' stays as planned',
            $note !== '' ? $note : 'Please go at the original time, or contact the admin.', (int)$req['requested_by_user_id']);
    }

    echo json_encode([
        'success' => true,
        'message' => $action === 'approve' ? 'Visit moved and the worker has been told.' : 'Request rejected. The worker has been told.',
        'status'  => $action === 'approve' ? 'approved' : 'rejected',
    ]);
} catch (PDOException $e) {
    if (isset($pdo) && $pdo->inTransaction()) $pdo->rollBack();
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Database error.', 'detail' => $e->getMessage()]);
}