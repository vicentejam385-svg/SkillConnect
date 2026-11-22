<?php
// backend/api/job-orders/get-progress.php
// Progress photos of one job order. Admins, the assigned worker and the job's client can see them.
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

$auth = requireAuth();
$uid  = (int)($auth['sub'] ?? 0);
$pdo  = getDB();

$jobOrderId = isset($_GET['job_order_id']) ? (int)$_GET['job_order_id'] : 0;
if (!$jobOrderId) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'job_order_id is required.']);
    exit;
}

$jo = $pdo->prepare("SELECT worker_user_id, client_user_id, finish_photo_id FROM job_orders WHERE id = ?");
$jo->execute([$jobOrderId]);
$job = $jo->fetch(PDO::FETCH_ASSOC);
if (!$job) {
    http_response_code(404);
    echo json_encode(['success' => false, 'error' => 'Job order not found.']);
    exit;
}

$allowed = (int)$job['worker_user_id'] === $uid || (int)$job['client_user_id'] === $uid || isAdminUser($auth);
if (!$allowed) {
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'Not allowed.']);
    exit;
}

$stmt = $pdo->prepare("
    SELECT id, file_path, upload_date, created_at
    FROM job_order_progress_photos
    WHERE job_order_id = ?
    ORDER BY upload_date DESC, id DESC
");
$stmt->execute([$jobOrderId]);
$photos = $stmt->fetchAll(PDO::FETCH_ASSOC);
foreach ($photos as &$p) {
    $p['is_final'] = (int)$p['id'] === (int)$job['finish_photo_id'];
}
unset($p);

echo json_encode([
    'success' => true,
    'photos'  => $photos,
]);