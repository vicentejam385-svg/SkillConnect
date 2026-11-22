<?php
// backend/api/job-orders/upload-progress.php
// The assigned worker uploads one progress photo per day.
// The first photo on a Scheduled job moves it to In Progress.
require_once __DIR__ . '/../../cors.php';
require_once __DIR__ . '/../../middleware/jwt.php';
require_once __DIR__ . '/../../config/db.php';
require_once __DIR__ . '/../../middleware/audit.php';
require_once __DIR__ . '/../../helpers/job-order-status.php';
require_once __DIR__ . '/../../helpers/job-order-photos.php';

handleCors();
header('Content-Type: application/json');

function uploadFail(string $msg, int $code = 422): never
{
    http_response_code($code);
    echo json_encode(['success' => false, 'error' => $msg]);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') uploadFail('Method not allowed.', 405);

$auth = requireAuth();
$uid  = (int)($auth['sub'] ?? 0);
$pdo  = getDB();

$jobOrderId = (int)($_POST['job_order_id'] ?? 0);
if (!$jobOrderId) uploadFail('job_order_id is required.', 400);

$jo = jobOrderForPhotos($pdo, $jobOrderId);
if (!$jo) uploadFail('Job order not found.', 404);

// Only the worker assigned to this job can upload
if ((int)$jo['worker_user_id'] !== $uid) uploadFail('Only the worker assigned to this job can upload photos.', 403);

$status = (int)$jo['status_id'];
if (!in_array($status, [JO_STATUS_SCHEDULED, JO_STATUS_IN_PROGRESS], true)) {
    uploadFail('Photos can only be uploaded while the job is Scheduled or In Progress.');
}
if (!empty($jo['finished_at'])) {
    uploadFail('You already reported this job as finished. Wait for the confirmation.');
}

// Server date in the Philippines, not the phone's date
$today = jobOrderToday();
if (empty($jo['start_date']) || $today < $jo['start_date']) {
    uploadFail('Uploads start on the start date (' . date('M j, Y', strtotime((string)$jo['start_date'])) . ').');
}

// One photo per day
$check = $pdo->prepare("SELECT COUNT(*) FROM job_order_progress_photos WHERE job_order_id = ? AND upload_date = ?");
$check->execute([$jobOrderId, $today]);
if ((int)$check->fetchColumn() > 0) uploadFail('A photo has already been uploaded today for this job order.');

$saved = jobOrderSaveUploadedPhoto($jobOrderId, $today);
if (!$saved['ok']) uploadFail($saved['error'], $saved['code']);

$pdo->prepare("INSERT INTO job_order_progress_photos (job_order_id, file_path, upload_date) VALUES (?, ?, ?)")
    ->execute([$jobOrderId, $saved['path'], $today]);

$code = $jo['job_order_code'] ?: ('#' . $jobOrderId);
auditLog(array_merge(auditActor($auth), [
    'action'       => 'CREATE',
    'module'       => 'Job Orders',
    'description'  => 'Uploaded a progress photo for job order ' . $code . ' (' . $today . ')',
    'target_type'  => 'job_order',
    'target_id'    => $jobOrderId,
    'target_label' => $code,
]));

// First photo on a Scheduled job: work has started
$started = false;
if ($status === JO_STATUS_SCHEDULED) {
    $upd = $pdo->prepare("UPDATE job_orders SET status_id = ?, started_at = COALESCE(started_at, ?) WHERE id = ? AND status_id = ?");
    $upd->execute([JO_STATUS_IN_PROGRESS, jobOrderNow(), $jobOrderId, JO_STATUS_SCHEDULED]);
    if ($upd->rowCount() === 1) {
        $started = true;
        jobOrderSystemLog($pdo, $jo, 'Job order ' . $code . ' moved to "In Progress" (first progress photo)',
            ['status' => 'Scheduled'], ['status' => 'In Progress']);
    }
}

echo json_encode([
    'success'   => true,
    'message'   => $started ? 'Photo uploaded. The job is now In Progress.' : 'Progress photo uploaded.',
    'file_path' => $saved['path'],
    'started'   => $started,
]);