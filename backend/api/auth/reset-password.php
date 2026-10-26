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
$body = json_decode(file_get_contents('php://input'), true);

$currentPass = $body['current_password'] ?? '';
$newPass     = $body['new_password']     ?? '';
$confirmPass = $body['confirm_password'] ?? '';

if (!$currentPass || !$newPass || !$confirmPass) {
    http_response_code(422);
    echo json_encode(['success' => false, 'error' => 'All password fields are required.']);
    exit;
}
if ($newPass !== $confirmPass) {
    http_response_code(422);
    echo json_encode(['success' => false, 'error' => 'New passwords do not match.']);
    exit;
}
if (strlen($newPass) < 8) {
    http_response_code(422);
    echo json_encode(['success' => false, 'error' => 'New password must be at least 8 characters.']);
    exit;
}

try {
    $pdo   = getDB();
        $stmt  = $pdo->prepare("SELECT password FROM users WHERE id = ?");
    $stmt->execute([$auth['sub']]);
    $row = $stmt->fetch();

    if (!$row || !password_verify($currentPass, $row['password'])) {
        http_response_code(401);
        echo json_encode(['success' => false, 'error' => 'Current password is incorrect.']);
        exit;
    }

    $pdo->prepare("UPDATE users SET password = ? WHERE id = ?")
        ->execute([password_hash($newPass, PASSWORD_BCRYPT), $auth['sub']]);

    echo json_encode(['success' => true, 'message' => 'Password changed successfully.']);
} catch (PDOException $e) {
    http_response_code(500);
        error_log($e->getMessage());
    echo json_encode(['success' => false, 'error' => 'Database error.']);
}
