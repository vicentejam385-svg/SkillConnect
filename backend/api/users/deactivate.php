<?php
require_once __DIR__ . '/../../cors.php';
require_once __DIR__ . '/../../config/db.php';
require_once __DIR__ . '/../../middleware/jwt.php';

handleCors();
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method not allowed.']);
    exit;
}

$auth = requireAuth();
if (($auth['type'] ?? '') !== 'super_admin') {
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'Access denied.']);
    exit;
}

$body      = json_decode(file_get_contents('php://input'), true);
$id        = (int)($body['id']        ?? 0);
$status_id = (int)($body['status_id'] ?? 0);

// status_id: 7 = Active, 8 = Inactive, 9 = Suspended
if (!$id || !in_array($status_id, [7, 8, 9])) {
    http_response_code(422);
    echo json_encode(['success' => false, 'error' => 'Valid id and status_id (7/8/9) are required.']);
    exit;
}

try {
    $pdo = getDB();

    // Prevent deactivating the only super_admin
    if ($status_id !== 7) {
        $activeSA = (int)$pdo->query(
            "SELECT COUNT(*) FROM users WHERE type = 'super_admin' AND (status_id = 7 OR status_id IS NULL)"
        )->fetchColumn();

        $targetType = $pdo->prepare("SELECT type FROM users WHERE id = ?");
        $targetType->execute([$id]);
        $row = $targetType->fetch();

        if (!$row) {
            http_response_code(404);
            echo json_encode(['success' => false, 'error' => 'User not found.']);
            exit;
        }

        if ($row['type'] === 'super_admin' && $activeSA <= 1) {
            http_response_code(409);
            echo json_encode(['success' => false, 'error' => 'Cannot deactivate the only active Super Admin.']);
            exit;
        }
    }

    $pdo->prepare("UPDATE users SET status_id = ? WHERE id = ?")
        ->execute([$status_id, $id]);

    // Return updated user
    $stmt = $pdo->prepare("
        SELECT u.id, u.name, u.username, u.type, s.label AS status, u.created_at
        FROM users u
        LEFT JOIN statuses s ON s.id = u.status_id
        WHERE u.id = ?
    ");
    $stmt->execute([$id]);

    echo json_encode(['success' => true, 'user' => $stmt->fetch()]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Database error.', 'detail' => $e->getMessage()]);
}