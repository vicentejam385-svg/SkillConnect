<?php
// api/auth/change-password.php — client changes their own password (users table)
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

// ── Verify JWT token ──────────────────────────────────────────
$payload = requireAuth();

$role = $payload['role'] ?? $payload['type'] ?? '';
if (!in_array($role, ['client', 'customer'], true)) {
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'Unauthorized.']);
    exit;
}

$userId = (int)($payload['sub'] ?? 0);
if (!$userId) {
    http_response_code(401);
    echo json_encode(['success' => false, 'error' => 'Invalid token.']);
    exit;
}

// ── Validate request body ─────────────────────────────────────
$body        = json_decode(file_get_contents('php://input'), true) ?? [];
$currentPass = (string)($body['current_password'] ?? '');
$newPass     = (string)($body['new_password']     ?? '');
$confirmPass = (string)($body['confirm_password'] ?? '');

if ($currentPass === '' || $newPass === '' || $confirmPass === '') {
    http_response_code(422);
    echo json_encode(['success' => false, 'error' => 'All fields are required.']);
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

if ($newPass === $currentPass) {
    http_response_code(422);
    echo json_encode(['success' => false, 'error' => 'New password must be different from the current password.']);
    exit;
}

try {
    $pdo = getDB();

    // ── Fetch the logged-in client ────────────────────────────
    $stmt = $pdo->prepare("SELECT id, password FROM users WHERE id = ? AND type = 'client' LIMIT 1");
    $stmt->execute([$userId]);
    $user = $stmt->fetch();

    if (!$user) {
        http_response_code(404);
        echo json_encode(['success' => false, 'error' => 'Client account not found.']);
        exit;
    }

    // ── Verify current password ───────────────────────────────
    if (empty($user['password']) || !password_verify($currentPass, $user['password'])) {
        auditLog(array_merge(auditActor($payload), [
            'action'         => 'PASSWORD_CHANGE',
            'module'         => 'Auth',
            'description'    => 'Failed password change: current password was incorrect',
            'target_user_id' => $userId,
            'target_type'    => 'users',
            'target_id'      => $userId,
            'status'         => 'failed',
        ]));
        http_response_code(422); // 422, not 401, so the frontend doesn't treat it as an expired login
        echo json_encode(['success' => false, 'error' => 'Current password is incorrect.']);
        exit;
    }

    // ── Hash and save the new password ────────────────────────
    $hashed = password_hash($newPass, PASSWORD_BCRYPT);
    $update = $pdo->prepare('UPDATE users SET password = ? WHERE id = ?');
    $update->execute([$hashed, $userId]);

    auditLog(array_merge(auditActor($payload), [
        'action'         => 'PASSWORD_CHANGE',
        'module'         => 'Auth',
        'description'    => 'Client changed their own password',
        'target_user_id' => $userId,
        'target_type'    => 'users',
        'target_id'      => $userId,
        'status'         => 'success',
    ]));

    echo json_encode(['success' => true, 'message' => 'Password changed successfully.']);

} catch (PDOException $e) {
    http_response_code(500);
    error_log($e->getMessage());
    echo json_encode(['success' => false, 'error' => 'Database error.']);
}