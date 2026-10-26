<?php
// api/auth/login.php — Unified login for skillconnect_new_db
// One users table (superadmin / admin / worker / client) + roles table for admin access.
// Server-side brute-force protection is unchanged.

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

// ══════════════════════════════════════════════════════════════
// RATE LIMIT HELPERS (unchanged)
// ══════════════════════════════════════════════════════════════
define('MAX_ATTEMPTS',     5);
define('LOCKOUT_SECONDS',  15 * 60); // 15 minutes

function rl_file(string $credential): string {
    $ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
    return sys_get_temp_dir() . '/sc_lock_' . md5(strtolower(trim($credential)) . $ip) . '.json';
}

function rl_get(string $credential): array {
    $f = rl_file($credential);
    if (!file_exists($f)) return ['attempts' => 0, 'locked_until' => null];
    return json_decode(file_get_contents($f), true) ?: ['attempts' => 0, 'locked_until' => null];
}

function rl_set(string $credential, array $state): void {
    file_put_contents(rl_file($credential), json_encode($state), LOCK_EX);
}

function rl_clear(string $credential): void {
    $f = rl_file($credential);
    if (file_exists($f)) unlink($f);
}

function rl_check(string $credential): void {
    $state = rl_get($credential);
    $now   = time();

    if (!empty($state['locked_until'])) {
        if ($now < $state['locked_until']) {
            $remaining = $state['locked_until'] - $now;
            $mins      = ceil($remaining / 60);

            auditLog([
                'actor_name'  => mb_substr($credential, 0, 100),
                'actor_type'  => 'guest',
                'action'      => 'ACCESS_DENIED',
                'module'      => 'Auth',
                'description' => 'Login blocked: too many failed attempts for "' . mb_substr($credential, 0, 100) . '" (locked)',
                'status'      => 'failed',
            ]);

            http_response_code(429);
            echo json_encode([
                'success'      => false,
                'error'        => "Too many failed attempts. Try again in {$mins} minute(s).",
                'locked_until' => $state['locked_until'],
                'retry_after'  => $remaining,
            ]);
            exit;
        }
        rl_clear($credential);
    }
}

// ── Returns how many attempts are left after this failure ─────
function rl_fail(string $credential): int {
    $state     = rl_get($credential);
    $attempts  = ($state['attempts'] ?? 0) + 1;
    $remaining = MAX_ATTEMPTS - $attempts;

    if ($attempts >= MAX_ATTEMPTS) {
        rl_set($credential, [
            'attempts'     => $attempts,
            'locked_until' => time() + LOCKOUT_SECONDS,
        ]);
        return 0;
    }

    rl_set($credential, [
        'attempts'     => $attempts,
        'locked_until' => null,
    ]);

    return max(0, $remaining);
}

function rl_success(string $credential): void {
    rl_clear($credential);
}

// ══════════════════════════════════════════════════════════════
// GENERAL HELPERS
// ══════════════════════════════════════════════════════════════
function jsonError(string $msg, int $code = 401, array $extra = []): never {
    http_response_code($code);
    echo json_encode(array_merge(['success' => false, 'error' => $msg], $extra));
    exit;
}

function checkPassword(string $input, ?string $hash): bool {
    if ($hash === null || $hash === '') {
        return false; // no password set — treat as invalid credentials
    }
    return password_verify($input, $hash);
}

// ══════════════════════════════════════════════════════════════
// READ INPUT
// ══════════════════════════════════════════════════════════════
$body       = json_decode(file_get_contents('php://input'), true) ?? [];
$credential = trim($body['username'] ?? '');
$password   = trim($body['password'] ?? '');

if (!$credential || !$password) {
    http_response_code(422);
    echo json_encode(['success' => false, 'error' => 'Username/email and password are required.']);
    exit;
}

rl_check($credential);

// ══════════════════════════════════════════════════════════════
// AUTH LOGIC — one lookup in users, whatever the type
// ══════════════════════════════════════════════════════════════
try {
    $pdo     = getDB();
    $isEmail = str_contains($credential, '@');

    // Email → clients usually log in this way. Username → admins and workers.
    $where = $isEmail ? 'u.email = ?' : 'u.username = ?';

    $stmt = $pdo->prepare(
        "SELECT u.id, u.user_code, u.type, u.first_name, u.last_name, u.suffix,
                u.username, u.email, u.mobile, u.address, u.password AS pw_hash, u.status_id,
                s.label  AS status,
                sp.name  AS specialization,
                r.role   AS admin_role
         FROM users u
                  LEFT JOIN statuses        s  ON s.id  = u.status_id AND s.entity = 'user'
         LEFT JOIN specializations sp ON sp.id = u.specialization_id
         LEFT JOIN roles           r  ON r.user_id = u.id
         WHERE {$where}
         LIMIT 1"
    );
    $stmt->execute([$credential]);
    $row = $stmt->fetch();

    // ── Unknown user or wrong password → same generic error ───
    $fullName = $row
        ? trim($row['first_name'] . ' ' . $row['last_name'] . ' ' . ($row['suffix'] ?? ''))
        : '';

    if (!$row || !checkPassword($password, $row['pw_hash'])) {
        $left  = rl_fail($credential);
        $shown = mb_substr($credential, 0, 100);
        $desc  = $row
            ? 'Failed login: incorrect password for "' . $shown . '"'
            : 'Failed login: no account matches "' . $shown . '"';
        if ($left === 0) $desc .= ' — account locked for 15 minutes';

        auditLog([
            'actor_user_id'  => $row['id'] ?? null,
            'actor_name'     => $row ? $fullName : $shown,
            'actor_type'     => $row['type'] ?? 'guest',
            'action'         => 'LOGIN_FAILED',
            'module'         => 'Auth',
            'description'    => $desc,
            'target_user_id' => $row['id'] ?? null,
            'target_type'    => $row ? 'users' : null,
            'target_id'      => $row['id'] ?? null,
            'target_label'   => $shown,
            'status'         => 'failed',
        ]);

        jsonError('Invalid credentials. Please try again.', 401, [
            'attempts_left' => $left,
        ]);
    }

    // ── Password is correct, now check the account status ─────
    // (not counted as a brute-force attempt)
    $statusLabel = strtolower($row['status'] ?? '');
    if ($statusLabel !== 'active') {
        $msg = match ($statusLabel) {
            'pending'   => 'Your account is not yet active. Please wait for approval.',
            'suspended' => 'Your account has been suspended. Please contact the administrator.',
            'inactive'  => 'Your account is inactive. Please contact the administrator.',
            default     => 'Your account is not active. Please contact the administrator.',
        };
        auditLog([
            'actor_user_id'  => $row['id'],
            'actor_name'     => $fullName,
            'actor_type'     => $row['type'],
            'action'         => 'LOGIN_FAILED',
            'module'         => 'Auth',
            'description'    => 'Login denied: account status is "' . ($row['status'] ?? 'unknown') . '"',
            'target_user_id' => $row['id'],
            'target_type'    => 'users',
            'target_id'      => $row['id'],
            'target_label'   => $row['username'] ?? $row['email'],
            'status'         => 'failed',
        ]);

        jsonError($msg, 403);
    }

    rl_success($credential);

    // ── Build the user info ───────────────────────────────────
    $fullName = trim($row['first_name'] . ' ' . $row['last_name'] . ' ' . ($row['suffix'] ?? ''));
    $type     = $row['type'];        // superadmin | admin | worker | client
    $adminRole = $row['admin_role']; // NULL | superadmin | admin | admin/worker | admin/client

    // Anyone with a row in roles can open the admin side
    $hasAdminAccess = ($adminRole !== null);

    // Your old code used 'super_admin' (with underscore) as the role name.
    // Keep that value in the token so the rest of your system keeps working.
    $tokenRole = ($type === 'superadmin') ? 'super_admin' : $type;

    $claims = [
        'sub'              => $row['id'],
        'name'             => $fullName,
        'role'             => $tokenRole,
        'user_code'        => $row['user_code'],
        'admin_role'       => $adminRole,
        'has_admin_access' => $hasAdminAccess,
    ];
    if ($type === 'client') $claims['contact_code'] = $row['user_code']; // old key, kept for compatibility
    if ($type === 'worker') $claims['worker_code']  = $row['user_code']; // old key, kept for compatibility

    $token = jwtCreate($claims);

    auditLog([
        'actor_user_id'  => $row['id'],
        'actor_name'     => $fullName,
        'actor_type'     => $type,
        'action'         => 'LOGIN',
        'module'         => 'Auth',
        'description'    => ucfirst($type) . ' "' . ($row['username'] ?? $row['email']) . '" logged in',
        'target_user_id' => $row['id'],
        'target_type'    => 'users',
        'target_id'      => $row['id'],
        'target_label'   => $row['username'] ?? $row['email'],
        'status'         => 'success',
    ]);

    echo json_encode([
        'success' => true,
        'token'   => $token,
        'user'    => [
            'id'               => $row['id'],
            'contact_id'       => $row['id'],          // old key, kept for compatibility
            'user_code'        => $row['user_code'],
            'contact_code'     => $row['user_code'],   // old key, kept for compatibility
            'worker_code'      => $row['user_code'],   // old key, kept for compatibility
            'name'             => $fullName,
            'username'         => $row['username'],
            'email'            => $row['email'],
            'mobile'           => $row['mobile'],
            'address'          => $row['address'],
            'specialization'   => $row['specialization'],
            'type'             => $tokenRole,
            'admin_role'       => $adminRole,
            'has_admin_access' => $hasAdminAccess,
            'status'           => $row['status'],
            'status_id'        => $row['status_id'],
        ],
    ]);

} catch (PDOException $e) {
    http_response_code(500);
        error_log($e->getMessage());
    echo json_encode(['success' => false, 'error' => 'Database error.']);
}