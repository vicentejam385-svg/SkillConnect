<?php
// api/auth/admin-access.php — Swap a worker's authenticated session into their linked admin session

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

// Must be called with a valid WORKER token
$auth = requireAuth();
if (($auth['role'] ?? '') !== 'worker') {
    http_response_code(403);
    auditLog(array_merge(auditActor($auth), [
        'action'      => 'ACCESS_DENIED',
        'module'      => 'Auth',
        'description' => 'Admin access switch denied: only worker accounts can request it',
        'status'      => 'failed',
    ]));
    echo json_encode(['success' => false, 'error' => 'Only worker accounts can request admin access.']);
    exit;
}

try {
    $pdo = getDB();

    // Re-verify server-side — never trust the token's has_admin_access flag alone
       $stmt = $pdo->prepare(
        "SELECT u.id, u.user_code, u.first_name, u.last_name, u.suffix, u.username,
                u.status_id, s.label AS status, r.role AS admin_role
         FROM users u
         JOIN roles r ON r.user_id = u.id AND r.role = 'admin/worker'
         LEFT JOIN statuses s ON s.id = u.status_id AND s.entity = 'user'
         WHERE u.id = ? AND u.type = 'worker'
         LIMIT 1"
    );
    $stmt->execute([$auth['sub']]);
    $admin = $stmt->fetch();

    if (!$admin) {
        http_response_code(403);
        auditLog(array_merge(auditActor($auth), [
            'action'         => 'ACCESS_DENIED',
            'module'         => 'Auth',
            'description'    => 'Admin access switch denied: no linked admin role for this worker',
            'target_user_id' => $auth['sub'] ?? null,
            'target_type'    => 'users',
            'target_id'      => $auth['sub'] ?? null,
            'status'         => 'failed',
        ]));
        echo json_encode(['success' => false, 'error' => 'No linked admin account found.']);
        exit;
    }

    if (strtolower($admin['status'] ?? '') !== 'active') {
        http_response_code(403);
        auditLog(array_merge(auditActor($auth), [
            'action'         => 'ACCESS_DENIED',
            'module'         => 'Auth',
            'description'    => 'Admin access switch denied: account status is "' . ($admin['status'] ?? 'unknown') . '"',
            'target_user_id' => $admin['id'],
            'target_type'    => 'users',
            'target_id'      => $admin['id'],
            'target_label'   => $admin['username'],
            'status'         => 'failed',
        ]));
        echo json_encode(['success' => false, 'error' => 'Linked admin account is not active.']);
        exit;
    }

        $fullName = trim($admin['first_name'] . ' ' . $admin['last_name'] . ' ' . ($admin['suffix'] ?? ''));

    auditLog(array_merge(auditActor($auth), [
        'action'         => 'LOGIN',
        'module'         => 'Auth',
        'description'    => 'Worker "' . $admin['username'] . '" switched to admin access (' . $admin['admin_role'] . ')',
        'target_user_id' => $admin['id'],
        'target_type'    => 'users',
        'target_id'      => $admin['id'],
        'target_label'   => $admin['username'],
        'status'         => 'success',
    ]));

    $token = jwtCreate([
        'sub'              => $admin['id'],
        'name'             => $fullName,
        'role'             => 'admin',
        'user_code'        => $admin['user_code'],
        'admin_role'       => $admin['admin_role'],
        'has_admin_access' => true,
    ]);

    echo json_encode([
        'success' => true,
        'token'   => $token,
                'user'    => [
            'id'               => $admin['id'],
            'contact_id'       => $admin['id'],   // old key, kept for compatibility
            'user_code'        => $admin['user_code'],
            'name'             => $fullName,
            'username'         => $admin['username'],
            'type'             => 'admin',
            'admin_role'       => $admin['admin_role'],
            'has_admin_access' => true,
            'status_id'        => $admin['status_id'],
        ],
    ]);
} catch (PDOException $e) {
    http_response_code(500);
        error_log($e->getMessage());
    echo json_encode(['success' => false, 'error' => 'Database error.']);
}