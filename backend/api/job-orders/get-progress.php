<?php
// backend/api/job-orders/get-progress.php
require_once __DIR__ . '/../../cors.php';
require_once __DIR__ . '/../../middleware/jwt.php';
require_once __DIR__ . '/../../config/db.php';

handleCors();
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method not allowed.']);
    exit;
}

requireAuth();
$pdo = getDB();

$jobOrderId = isset($_GET['job_order_id']) ? (int)$_GET['job_order_id'] : 0;

if (!$jobOrderId) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'job_order_id is required.']);
    exit;
}

$stmt = $pdo->prepare("
    SELECT id, file_path, upload_date, created_at
    FROM job_order_progress_photos
    WHERE job_order_id = ?
    ORDER BY upload_date DESC
");
$stmt->execute([$jobOrderId]);
$photos = $stmt->fetchAll(PDO::FETCH_ASSOC);

echo json_encode([
    'success' => true,
    'photos'  => $photos,
]);