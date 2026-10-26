<?php
// api/users/create.php — give someone admin access (new schema: roles table)
//
// Mode A (old "Admin Access" flow): send worker_id (or user_id) = users.id of an
//   existing worker/client. They get a row in `roles` and can open the admin side
//   with their OWN login. No new account is created.
// Mode B: no worker_id → create a standalone admin user (needs name, username, password).
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
    echo json_encode(['success' => false, 'error' => 'Access denied.']);
    exit;
}

function fail(string $msg, int $code): never {
    http_response_code($code);
    echo json_encode(['success' => false, 'error' => $msg]);
    exit;
}

function fetchAdminRow(PDO $pdo, int $id): array|false {
    $q = $pdo->prepare("
        SELECT u.id, u.user_code, u.user_code AS admin_code,
               TRIM(CONCAT(u.first_name, ' ', u.last_name, ' ', COALESCE(u.suffix, ''))) AS name,
               u.first_name, u.last_name, u.username, u.email, u.mobile, u.type,
               r.role AS admin_role, u.status_id, s.label AS status, u.created_at
        FROM users u
        LEFT JOIN roles    r ON r.user_id = u.id
        LEFT JOIN statuses s ON s.id = u.status_id
        WHERE u.id = ?
    ");
    $q->execute([$id]);
    return $q->fetch(PDO::FETCH_ASSOC);
}

$body     = json_decode(file_get_contents('php://input'), true) ?? [];
$targetId = (int)($body['worker_id'] ?? $body['user_id'] ?? 0);
$grantedBy = (int)($auth['sub'] ?? 0);

try {
    $pdo = getDB();

    // ── Mode A: grant admin access to an existing worker/client ──
    if ($targetId) {
        $t = $pdo->prepare("SELECT id, type FROM users WHERE id = ?");
        $t->execute([$targetId]);
        $target = $t->fetch();
        if (!$target) fail('User not found.', 404);

        $roleByType = ['worker' => 'admin/worker', 'client' => 'admin/client', 'admin' => 'admin'];
        if (!isset($roleByType[$target['type']])) {
            fail('This account type cannot be granted admin access.', 422);
        }

        $dup = $pdo->prepare("SELECT id FROM roles WHERE user_id = ?");
        $dup->execute([$targetId]);
        if ($dup->fetch()) fail('This user already has admin access.', 409);

        $pdo->prepare("INSERT INTO roles (user_id, role, granted_by) VALUES (?, ?, ?)")
            ->execute([$targetId, $roleByType[$target['type']], $grantedBy ?: null]);

        http_response_code(201);
        $newRow = fetchAdminRow($pdo, $targetId);
        $label  = $newRow['username'] ?? $newRow['name'] ?? 'user';
        auditLog(array_merge(auditActor($auth), [
            'action'         => 'ROLE_CHANGE',
            'module'         => 'Admin Users',
            'description'    => 'Granted admin access (' . $roleByType[$target['type']] . ') to ' . $target['type'] . ' "' . $label . '"',
            'target_user_id' => $targetId,
            'target_type'    => 'users',
            'target_id'      => $targetId,
            'target_label'   => $label,
            'old_values'     => ['admin_role' => null],
            'new_values'     => ['admin_role' => $roleByType[$target['type']]],
        ]));
        echo json_encode(['success' => true, 'user' => $newRow]);
        exit;
    }

    // ── Mode B: standalone admin user ────────────────────────────
    $name     = trim($body['name'] ?? '');
    $first    = trim($body['first_name'] ?? '');
    $last     = trim($body['last_name'] ?? '');
    $username = trim($body['username'] ?? '');
    $password = $body['password'] ?? '';

    if (!$first && $name) {
        $pos   = strrpos($name, ' ');
        $first = $pos === false ? $name : trim(substr($name, 0, $pos));
        $last  = $pos === false ? ''    : trim(substr($name, $pos + 1));
    }

    $errors = [];
    if (!$first)    $errors[] = 'name is required.';
    if (!$username) $errors[] = 'username is required.';
    if (strlen($password) < 8) $errors[] = 'password must be at least 8 characters (or send worker_id to grant access to an existing worker).';
    if ($errors) fail(implode(' ', $errors), 422);

    $chk = $pdo->prepare("SELECT id FROM users WHERE username = ?");
    $chk->execute([$username]);
    if ($chk->fetch()) fail('Username already taken.', 409);

    $pdo->beginTransaction();

    $pdo->prepare("
        INSERT INTO users (type, first_name, last_name, username, password, status_id)
        VALUES ('admin', ?, ?, ?, ?, 1)
    ")->execute([$first, $last, $username, password_hash($password, PASSWORD_BCRYPT)]);
    $newId = (int)$pdo->lastInsertId();

    $pdo->prepare("INSERT INTO roles (user_id, role, granted_by) VALUES (?, 'admin', ?)")
        ->execute([$newId, $grantedBy ?: null]);

    $pdo->commit();

    http_response_code(201);
    auditLog(array_merge(auditActor($auth), [
        'action'         => 'CREATE',
        'module'         => 'Admin Users',
        'description'    => 'Created admin account "' . $username . '"',
        'target_user_id' => $newId,
        'target_type'    => 'users',
        'target_id'      => $newId,
        'target_label'   => $username,
        'new_values'     => ['name' => trim($first . ' ' . $last), 'username' => $username, 'role' => 'admin', 'status' => 'Active'],
    ]));
    echo json_encode(['success' => true, 'user' => fetchAdminRow($pdo, $newId)]);
} catch (\Throwable $e) {
    if (isset($pdo) && $pdo->inTransaction()) $pdo->rollBack();
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Database error.', 'detail' => $e->getMessage()]);
}