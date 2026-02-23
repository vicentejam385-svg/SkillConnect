<?php
require_once __DIR__ . '/../../cors.php';
require_once __DIR__ . '/../../config/db.php';
require_once __DIR__ . '/../../middleware/jwt.php';

handleCors();
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'DELETE') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method not allowed.']);
    exit;
}

requireAuth();

$body = json_decode(file_get_contents('php://input'), true);
$id   = (int)($body['id'] ?? $_GET['id'] ?? 0);

if (!$id) {
    http_response_code(422);
    echo json_encode(['success' => false, 'error' => 'License id is required.']);
    exit;
}

try {
    $pdo = getDB();

    $chk = $pdo->prepare("SELECT id, file_path FROM licenses WHERE id = ?");
    $chk->execute([$id]);
    $license = $chk->fetch();

    if (!$license) {
        http_response_code(404);
        echo json_encode(['success' => false, 'error' => 'License not found.']);
        exit;
    }

    // Delete physical file if it exists
    if ($license['file_path']) {
        $fullPath = __DIR__ . '/../../../' . $license['file_path'];
        if (file_exists($fullPath)) @unlink($fullPath);
    }

    $pdo->prepare("DELETE FROM licenses WHERE id = ?")->execute([$id]);

    echo json_encode(['success' => true, 'message' => 'License deleted.']);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Database error.', 'detail' => $e->getMessage()]);
}