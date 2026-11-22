<?php
// backend/helpers/job-order-photos.php
// Shared checks and saving for progress photos (upload-progress.php and finish.php).

if (!defined('JO_PHOTO_MAX_BYTES')) {
    define('JO_PHOTO_MAX_BYTES', 1 * 1024 * 1024); // 1MB, must match MAX_SIZE_MB in MyJobOrders.jsx
}

/** Load a job order with the fields the photo endpoints need. */
function jobOrderForPhotos(PDO $pdo, int $id): ?array
{
    $st = $pdo->prepare(
        "SELECT jo.*, CONCAT(w.first_name,' ',w.last_name) AS worker_name,
                CONCAT(c.first_name,' ',c.last_name) AS client_name,
                c.email AS client_email
         FROM job_orders jo
         LEFT JOIN users w ON w.id = jo.worker_user_id
         LEFT JOIN users c ON c.id = jo.client_user_id
         WHERE jo.id = ?"
    );
    $st->execute([$id]);
    $row = $st->fetch(PDO::FETCH_ASSOC);
    return $row ?: null;
}

/**
 * Check and save an uploaded photo ($_FILES['photo']).
 * @return array ['ok' => true, 'path' => 'uploads/...'] or ['ok' => false, 'error' => '...', 'code' => 422]
 */
function jobOrderSaveUploadedPhoto(int $jobOrderId, string $date, string $prefix = 'progress'): array
{
    if (!isset($_FILES['photo']) || $_FILES['photo']['error'] !== UPLOAD_ERR_OK) {
        return ['ok' => false, 'error' => 'Choose a photo to upload.', 'code' => 400];
    }
    if ($_FILES['photo']['size'] > JO_PHOTO_MAX_BYTES) {
        return ['ok' => false, 'error' => 'File size exceeds the limit of 1MB.', 'code' => 422];
    }
    $mime = mime_content_type($_FILES['photo']['tmp_name']);
    $ext  = ['image/jpeg' => 'jpg', 'image/jpg' => 'jpg', 'image/png' => 'png'][$mime] ?? null;
    if (!$ext) {
        return ['ok' => false, 'error' => 'Only JPG and PNG files are allowed.', 'code' => 422];
    }

    $dir = __DIR__ . '/../../uploads/progress_photos/';
    if (!is_dir($dir)) mkdir($dir, 0755, true);

    $name = $prefix . '_' . $jobOrderId . '_' . $date . '_' . uniqid() . '.' . $ext;
    if (!move_uploaded_file($_FILES['photo']['tmp_name'], $dir . $name)) {
        return ['ok' => false, 'error' => 'Failed to save photo.', 'code' => 500];
    }
    return ['ok' => true, 'path' => 'uploads/progress_photos/' . $name];
}