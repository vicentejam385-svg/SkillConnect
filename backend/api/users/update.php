<?php
// api/users/update.php — edit an admin-side user (name, username, password)
require_once __DIR__ . '/../../cors.php';
require_once __DIR__ . '/../../config/db.php';
require_once __DIR__ . '/../../middleware/jwt.php';
require_once __DIR__ . '/../../middleware/audit.php';

handleCors();
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'PUT') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method not allowed.']);
    exit;
}

$auth = requireAuth();
// FIX: the token claim is 'role' (was 'type' before, which is never set)
if (($auth['role'] ?? '') !== 'super_admin') {
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'Access denied.']);
    exit;
}

$body     = json_decode(file_get_contents('php://input'), true) ?? [];
$id       = (int)($body['id'] ?? 0);
$name     = trim($body['name'] ?? '');
$first    = trim($body['first_name'] ?? '');
$last     = trim($body['last_name'] ?? '');
$username = trim($body['username'] ?? '');
$password = $body['password'] ?? '';
// NOTE: 'type' is ignored on purpose. Access level lives in the roles table now,
// and promoting someone to superadmin should not be a side effect of an edit form.

$errors = [];
if (!$id)                          $errors[] = 'id is required.';
if (!$first && !$name)             $errors[] = 'name is required.';
if (!$username)                    $errors[] = 'username is required.';
if ($password && strlen($password) < 8) $errors[] = 'password must be at least 8 characters.';
if ($errors) {
    http_response_code(422);
    echo json_encode(['success' => false, 'error' => implode(' ', $errors)]);
    exit;
}

try {
    $pdo = getDB();

    // Target must exist AND be an admin-side user (has a roles row)
    $chk = $pdo->prepare("
        SELECT u.id, u.suffix
        FROM users u INNER JOIN roles r ON r.user_id = u.id
        WHERE u.id = ?
    ");
    $chk->execute([$id]);
    $existing = $chk->fetch();
    if (!$existing) {
        http_response_code(404);
        echo json_encode(['success' => false, 'error' => 'User not found.']);
        exit;
    }

    // Full-name → first/last (split at the last space; drop a trailing suffix first)
    if (!$first) {
        $suffix = $existing['suffix'] ?? '';
        if ($suffix !== '' && str_ends_with($name, ' ' . $suffix)) {
            $name = trim(substr($name, 0, -strlen($suffix)));
        }
        $pos   = strrpos($name, ' ');
        $first = $pos === false ? $name : trim(substr($name, 0, $pos));
        $last  = $pos === false ? ''    : trim(substr($name, $pos + 1));
    }

    $oldQ = $pdo->prepare("SELECT first_name, last_name, username FROM users WHERE id = ?");
    $oldQ->execute([$id]);
    $old = $oldQ->fetch();

    $dup = $pdo->prepare("SELECT id FROM users WHERE username = ? AND id != ?");
    $dup->execute([$username, $id]);
    if ($dup->fetch()) {
        http_response_code(409);
        echo json_encode(['success' => false, 'error' => 'Username already taken.']);
        exit;
    }

    if ($password) {
        $pdo->prepare("UPDATE users SET first_name = ?, last_name = ?, username = ?, password = ? WHERE id = ?")
            ->execute([$first, $last, $username, password_hash($password, PASSWORD_BCRYPT), $id]);
    } else {
        $pdo->prepare("UPDATE users SET first_name = ?, last_name = ?, username = ? WHERE id = ?")
            ->execute([$first, $last, $username, $id]);
    }

    $row = $pdo->prepare("
        SELECT u.id, u.user_code,
               TRIM(CONCAT(u.first_name, ' ', u.last_name, ' ', COALESCE(u.suffix, ''))) AS name,
               u.first_name, u.last_name, u.username, u.type, r.role AS admin_role,
               u.created_at, u.updated_at
        FROM users u LEFT JOIN roles r ON r.user_id = u.id
        WHERE u.id = ?
    ");
    $row->execute([$id]);

    // AUDIT: log only the fields that actually changed (the password value is never stored)
    $oldVals = ['name' => trim($old['first_name'] . ' ' . $old['last_name']), 'username' => $old['username']];
    $newVals = ['name' => trim($first . ' ' . $last),                         'username' => $username];
    $chgOld = []; $chgNew = [];
    foreach ($newVals as $k => $v) {
        if ($v !== $oldVals[$k]) { $chgOld[$k] = $oldVals[$k]; $chgNew[$k] = $v; }
    }
    if ($chgNew) {
        auditLog(array_merge(auditActor($auth), [
            'action'         => 'UPDATE',
            'module'         => 'Admin Users',
            'description'    => 'Updated admin account "' . $old['username'] . '" (' . implode(', ', array_keys($chgNew)) . ')',
            'target_user_id' => $id,
            'target_type'    => 'users',
            'target_id'      => $id,
            'target_label'   => $username,
            'old_values'     => $chgOld,
            'new_values'     => $chgNew,
        ]));
    }
    if ($password) {
        auditLog(array_merge(auditActor($auth), [
            'action'         => 'PASSWORD_RESET',
            'module'         => 'Admin Users',
            'description'    => 'Reset password for admin account "' . $username . '"',
            'target_user_id' => $id,
            'target_type'    => 'users',
            'target_id'      => $id,
            'target_label'   => $username,
        ]));
    }

    echo json_encode(['success' => true, 'user' => $row->fetch()]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Database error.', 'detail' => $e->getMessage()]);
}