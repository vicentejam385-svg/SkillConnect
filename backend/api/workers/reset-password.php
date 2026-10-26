<?php
require_once __DIR__ . '/../../cors.php';
require_once __DIR__ . '/../../config/db.php';
require_once __DIR__ . '/../../middleware/jwt.php';
require_once __DIR__ . '/../../middleware/audit.php';

handleCors();
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method not allowed.']);
    exit;
}

$auth = requireAuth();

if (($auth['role'] ?? '') !== 'super_admin') {
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'Only Super Admin can reset worker passwords.']);
    exit;
}

$body     = json_decode(file_get_contents('php://input'), true);
$workerId = (int)($body['worker_id'] ?? 0);
$password = $body['password'] ?? '';

if (!$workerId) {
    http_response_code(422);
    echo json_encode(['success' => false, 'error' => 'worker_id is required.']);
    exit;
}
if (strlen($password) < 8) {
    http_response_code(422);
    echo json_encode(['success' => false, 'error' => 'Password must be at least 8 characters.']);
    exit;
}

try {
    $pdo = getDB();

    $chk = $pdo->prepare("SELECT id, username FROM users WHERE id = ? AND type = 'worker'");
    $chk->execute([$workerId]);
    $w = $chk->fetch();
    if (!$w) {
        http_response_code(404);
        echo json_encode(['success' => false, 'error' => 'Worker not found.']);
        exit;
    }

    $pdo->prepare("UPDATE users SET password = ? WHERE id = ? AND type = 'worker'")
        ->execute([password_hash($password, PASSWORD_BCRYPT), $workerId]);

    auditLog(array_merge(auditActor($auth), [
        'action'         => 'PASSWORD_RESET',
        'module'         => 'Workers Access',
        'description'    => 'Reset password for worker "' . $w['username'] . '"',
        'target_user_id' => $workerId,
        'target_type'    => 'users',
        'target_id'      => $workerId,
        'target_label'   => $w['username'],
    ]));

    echo json_encode(['success' => true, 'message' => 'Password reset successfully.']);
} catch (PDOException $e) {
    http_response_code(500);
    error_log($e->getMessage()); echo json_encode(['success' => false, 'error' => 'Database error.']);
}
