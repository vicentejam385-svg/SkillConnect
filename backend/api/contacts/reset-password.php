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

$auth = requireAdminAccess();

if (!in_array($auth['role'] ?? '', ['superadmin', 'super_admin'], true)) {
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'Only Super Admin can reset client passwords.']);
    exit;
}

$body      = json_decode(file_get_contents('php://input'), true);
$contactId = (int)($body['contact_id'] ?? 0);
$password  = $body['password'] ?? '';

if (!$contactId) {
    http_response_code(422);
    echo json_encode(['success' => false, 'error' => 'contact_id is required.']);
    exit;
}
if (strlen($password) < 8) {
    http_response_code(422);
    echo json_encode(['success' => false, 'error' => 'Password must be at least 8 characters.']);
    exit;
}

try {
    $pdo = getDB();

    $chk = $pdo->prepare("SELECT id, user_code, first_name, last_name FROM users WHERE id = ? AND type = 'client'");
    $chk->execute([$contactId]);
    $client = $chk->fetch();
    if (!$client) {
        http_response_code(404);
        echo json_encode(['success' => false, 'error' => 'Client not found.']);
        exit;
    }

    $pdo->prepare("UPDATE users SET password = ? WHERE id = ? AND type = 'client'")
        ->execute([password_hash($password, PASSWORD_BCRYPT), $contactId]);

    $cName = trim($client['first_name'] . ' ' . $client['last_name']);
    auditLog(array_merge(auditActor($auth), [
        'action'         => 'PASSWORD_RESET',
        'module'         => 'Client Access',
        'description'    => 'Reset password for client "' . $cName . '" (' . $client['user_code'] . ')',
        'target_user_id' => $contactId,
        'target_type'    => 'users',
        'target_id'      => $contactId,
        'target_label'   => $cName,
    ]));

    echo json_encode(['success' => true, 'message' => 'Password reset successfully.']);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Server error.']);
}