<?php
// backend/api/job-orders/upload-progress.php
require_once __DIR__ . '/../../cors.php';
require_once __DIR__ . '/../../middleware/jwt.php';
require_once __DIR__ . '/../../config/db.php';

handleCors();
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method not allowed.']);
    exit;
}

requireAuth();
$pdo = getDB();

$jobOrderId  = isset($_POST['job_order_id'])  ? (int)$_POST['job_order_id']  : 0;
$uploadDate  = isset($_POST['upload_date'])   ? $_POST['upload_date']         : date('Y-m-d');

if (!$jobOrderId) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'job_order_id is required.']);
    exit;
}

if (!isset($_FILES['photo']) || $_FILES['photo']['error'] !== UPLOAD_ERR_OK) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'No valid photo uploaded.']);
    exit;
}
$maxFileSize = 1 * 1024 * 1024; 

if ($_FILES['photo']['size'] > $maxFileSize) {
    http_response_code(422);
    echo json_encode(['success' => false, 'error' => 'File size exceeds the limit of 50MB.']);
    exit;
}
// Check one upload per day per job order
$check = $pdo->prepare("SELECT COUNT(*) FROM job_order_progress_photos WHERE job_order_id = ? AND upload_date = ?");
$check->execute([$jobOrderId, $uploadDate]);
if ((int)$check->fetchColumn() > 0) {
    http_response_code(422);
    echo json_encode(['success' => false, 'error' => 'A photo has already been uploaded today for this job order.']);
    exit;
}

// Validate file type
$allowed   = ['image/jpeg', 'image/png', 'image/jpg'];
$mimeType  = mime_content_type($_FILES['photo']['tmp_name']);
if (!in_array($mimeType, $allowed)) {
    http_response_code(422);
    echo json_encode(['success' => false, 'error' => 'Only JPG and PNG files are allowed.']);
    exit;
}

// Save file
$uploadDir = __DIR__ . '/../../../uploads/progress_photos/';
if (!is_dir($uploadDir)) {
    mkdir($uploadDir, 0755, true);
}

$ext      = pathinfo($_FILES['photo']['name'], PATHINFO_EXTENSION);
$filename = 'progress_' . $jobOrderId . '_' . $uploadDate . '_' . uniqid() . '.' . $ext;
$destPath = $uploadDir . $filename;

if (!move_uploaded_file($_FILES['photo']['tmp_name'], $destPath)) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Failed to save photo.']);
    exit;
}

$filePath = 'uploads/progress_photos/' . $filename;

// Insert record
$stmt = $pdo->prepare("INSERT INTO job_order_progress_photos (job_order_id, file_path, upload_date) VALUES (?, ?, ?)");
$stmt->execute([$jobOrderId, $filePath, $uploadDate]);

echo json_encode([
    'success'   => true,
    'message'   => 'Progress photo uploaded.',
    'file_path' => $filePath,
]);