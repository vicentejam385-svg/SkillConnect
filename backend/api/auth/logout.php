<?php
// api/auth/logout.php — Records the logout in the audit log.
// JWT is stateless, so the frontend must still delete the token after calling this.

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

auditLog(array_merge(auditActor($auth), [
    'action'         => 'LOGOUT',
    'module'         => 'Auth',
    'description'    => ($auth['name'] ?? 'User') . ' logged out',
    'target_user_id' => $auth['sub'] ?? null,
    'target_type'    => 'users',
    'target_id'      => $auth['sub'] ?? null,
    'status'         => 'success',
]));

echo json_encode(['success' => true]);