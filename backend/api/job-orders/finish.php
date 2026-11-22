<?php
// backend/api/job-orders/finish.php
// The assigned worker reports the job as finished, with a final photo and an optional note.
// The customer (or the admin) then confirms it, which marks it Complete.
//   POST multipart: job_order_id, photo, note
require_once __DIR__ . '/../../cors.php';
require_once __DIR__ . '/../../middleware/jwt.php';
require_once __DIR__ . '/../../config/db.php';
require_once __DIR__ . '/../../middleware/audit.php';
require_once __DIR__ . '/../../helpers/job-order-status.php';
require_once __DIR__ . '/../../helpers/job-order-photos.php';
require_once __DIR__ . '/../../helpers/job-offers.php';

handleCors();
header('Content-Type: application/json');

function finishFail(string $msg, int $code = 422): never
{
    http_response_code($code);
    echo json_encode(['success' => false, 'error' => $msg]);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') finishFail('Method not allowed.', 405);

$auth = requireAuth();
$uid  = (int)($auth['sub'] ?? 0);
$pdo  = getDB();

$jobOrderId = (int)($_POST['job_order_id'] ?? 0);
$note       = trim((string)($_POST['note'] ?? ''));
if (!$jobOrderId) finishFail('job_order_id is required.', 400);
if (mb_strlen($note) > 500) finishFail('Keep the note under 500 characters.');

$jo = jobOrderForPhotos($pdo, $jobOrderId);
if (!$jo) finishFail('Job order not found.', 404);
if ((int)$jo['worker_user_id'] !== $uid) finishFail('Only the worker assigned to this job can mark it as finished.', 403);
if ((int)$jo['status_id'] !== JO_STATUS_IN_PROGRESS) finishFail('Only a job that is In Progress can be marked as finished. Upload your first progress photo first.');
if (!empty($jo['finished_at'])) finishFail('You already marked this job as finished.', 409);

$today = jobOrderToday();
$saved = jobOrderSaveUploadedPhoto($jobOrderId, $today, 'final');
if (!$saved['ok']) finishFail($saved['error'] === 'Choose a photo to upload.' ? 'Add a photo of the finished work.' : $saved['error'], $saved['code']);

$now = jobOrderNow();
$pdo->beginTransaction();
$pdo->prepare("INSERT INTO job_order_progress_photos (job_order_id, file_path, upload_date) VALUES (?, ?, ?)")
    ->execute([$jobOrderId, $saved['path'], $today]);
$photoId = (int)$pdo->lastInsertId();
$upd = $pdo->prepare(
    "UPDATE job_orders
        SET finished_at = ?, finish_note = ?, finish_photo_id = ?, issue_note = NULL, issue_at = NULL
      WHERE id = ? AND finished_at IS NULL AND status_id = ?"
);
$upd->execute([$now, $note !== '' ? $note : null, $photoId, $jobOrderId, JO_STATUS_IN_PROGRESS]);
if ($upd->rowCount() !== 1) {
    $pdo->rollBack();
    finishFail('This job could not be marked as finished. Refresh and try again.', 409);
}
$pdo->commit();

$code = $jo['job_order_code'] ?: ('#' . $jobOrderId);
auditLog(array_merge(auditActor($auth), [
    'action'         => 'UPDATE',
    'module'         => 'Job Orders',
    'description'    => trim((string)$jo['worker_name']) . ' marked job order ' . $code . ' as finished'
                        . ($jo['end_date'] && $today < $jo['end_date'] ? ' (before the end date)' : ''),
    'target_user_id' => $jo['client_user_id'] ?? null,
    'target_type'    => 'job_order',
    'target_id'      => $jobOrderId,
    'target_label'   => $code . ' — ' . trim((string)$jo['client_name']),
    'new_values'     => ['finished_at' => $now, 'note' => $note ?: null],
]));

// Ask the customer to confirm
$emailed = false;
if (!empty($jo['client_email'])) {
    $name = trim((string)$jo['client_name']) ?: 'Customer';
    $html = jobOrderMailHtml($name, 'Your job is reported finished', [
        'Our worker reported that job order <strong>' . htmlspecialchars($code, ENT_QUOTES, 'UTF-8') . '</strong> is finished.',
        'Please check the work and the final photo, then confirm it in your account. If something still needs fixing, tell us there.',
    ], 'Review and confirm', JOB_OFFER_APP_URL . '/customer/job-orders');
    $emailed = jobOfferSendMail($jo['client_email'], $name, 'Please confirm: ' . $code . ' is finished', $html);
}

echo json_encode([
    'success'          => true,
    'message'          => 'Marked as finished. The customer will be asked to confirm.',
    'customer_emailed' => $emailed,
]);