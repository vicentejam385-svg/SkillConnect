<?php
// backend/api/job-orders/confirm.php
// The customer (or an admin) answers the worker's "Mark as finished".
//   POST { id, action: 'confirm' | 'issue', note }
//   confirm -> the job becomes Complete
//   issue   -> stays In Progress; the worker sees the note and can mark it finished again
// An admin can also confirm a job that was never reported finished (e.g. past the end date).
require_once __DIR__ . '/../../cors.php';
require_once __DIR__ . '/../../middleware/jwt.php';
require_once __DIR__ . '/../../config/db.php';
require_once __DIR__ . '/../../middleware/audit.php';
require_once __DIR__ . '/../../helpers/job-order-status.php';
require_once __DIR__ . '/../../helpers/job-order-photos.php';

handleCors();
header('Content-Type: application/json');

function confirmFail(string $msg, int $code = 422): never
{
    http_response_code($code);
    echo json_encode(['success' => false, 'error' => $msg]);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') confirmFail('Method not allowed.', 405);

$auth = requireAuth();
$uid  = (int)($auth['sub'] ?? 0);
$data = json_decode(file_get_contents('php://input'), true) ?? [];
$id     = (int)($data['id'] ?? 0);
$action = $data['action'] ?? '';
$note   = trim((string)($data['note'] ?? ''));

if (!$id) confirmFail('Job order ID is required.', 400);
if (!in_array($action, ['confirm', 'issue'], true)) confirmFail('Choose confirm or issue.', 400);
if ($action === 'issue' && $note === '') confirmFail('Tell us what still needs to be done.');
if (mb_strlen($note) > 500) confirmFail('Keep the note under 500 characters.');

$pdo = getDB();
$jo  = jobOrderForPhotos($pdo, $id);
if (!$jo) confirmFail('Job order not found.', 404);

$isClient = ($auth['role'] ?? '') === 'client' && (int)$jo['client_user_id'] === $uid;
$isAdmin  = !$isClient && isAdminUser($auth);
if (!$isClient && !$isAdmin) confirmFail('Not allowed.', 403);

$status = (int)$jo['status_id'];
if (!in_array($status, [JO_STATUS_SCHEDULED, JO_STATUS_IN_PROGRESS], true)) {
    confirmFail('This job is not waiting for confirmation.', 409);
}
// Customers can only answer after the worker reported it finished
if ($isClient && empty($jo['finished_at'])) confirmFail('The worker has not marked this job as finished yet.', 409);
if ($action === 'issue' && empty($jo['finished_at'])) confirmFail('The worker has not marked this job as finished yet.', 409);

$now  = jobOrderNow();
$code = $jo['job_order_code'] ?: ('#' . $id);
$who  = $isClient ? 'customer' : 'admin';

if ($action === 'confirm') {
    $upd = $pdo->prepare(
        "UPDATE job_orders
            SET status_id = ?, completed_at = ?, completed_by = ?, issue_note = NULL, issue_at = NULL,
                started_at = COALESCE(started_at, ?)
          WHERE id = ? AND status_id = ?"
    );
    $upd->execute([JO_STATUS_COMPLETE, $now, $who, $now, $id, $status]);
    if ($upd->rowCount() !== 1) confirmFail('This job was already updated. Refresh and try again.', 409);

    auditLog(array_merge(auditActor($auth), [
        'action'         => 'STATUS_CHANGE',
        'module'         => 'Job Orders',
        'description'    => 'Confirmed job order ' . $code . ' complete (' . $who . ')',
        'target_user_id' => $jo['client_user_id'] ?? null,
        'target_type'    => 'job_order',
        'target_id'      => $id,
        'target_label'   => $code . ' — ' . trim((string)$jo['client_name']),
        'old_values'     => ['status' => $status === JO_STATUS_SCHEDULED ? 'Scheduled' : 'In Progress'],
        'new_values'     => ['status' => 'Complete', 'confirmed_by' => $who],
    ]));

    if (!empty($jo['worker_user_id'])) {
        jobOrderInboxUpdate($pdo, (int)$jo['worker_user_id'], $id, $code . ' is confirmed complete',
            ($isClient ? 'The customer' : 'The admin') . ' confirmed the work is done. Thank you!');
    }
    echo json_encode(['success' => true, 'message' => 'Confirmed. The job is now complete.']);
    exit;
}

// action = issue: not done yet
$upd = $pdo->prepare(
    "UPDATE job_orders
        SET finished_at = NULL, finish_note = NULL, finish_photo_id = NULL, issue_note = ?, issue_at = ?
      WHERE id = ? AND finished_at IS NOT NULL"
);
$upd->execute([$note, $now, $id]);
if ($upd->rowCount() !== 1) confirmFail('This job was already updated. Refresh and try again.', 409);

auditLog(array_merge(auditActor($auth), [
    'action'         => 'UPDATE',
    'module'         => 'Job Orders',
    'description'    => 'Job order ' . $code . ' is not finished yet (' . $who . '): ' . mb_substr($note, 0, 200),
    'target_user_id' => $jo['client_user_id'] ?? null,
    'target_type'    => 'job_order',
    'target_id'      => $id,
    'target_label'   => $code . ' — ' . trim((string)$jo['client_name']),
    'new_values'     => ['issue' => $note],
]));

if (!empty($jo['worker_user_id'])) {
    jobOrderInboxUpdate($pdo, (int)$jo['worker_user_id'], $id, $code . ': not finished yet',
        ($isClient ? 'The customer' : 'The admin') . ' says: ' . $note);
}
echo json_encode(['success' => true, 'message' => 'Thanks. The worker has been told what still needs to be done.']);