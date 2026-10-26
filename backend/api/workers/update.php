<?php
// backend/api/workers/update.php — update a worker (new schema: users WHERE type = 'worker')
require_once __DIR__ . '/../../cors.php';
require_once __DIR__ . '/../../middleware/jwt.php';
require_once __DIR__ . '/../../middleware/audit.php';
require_once __DIR__ . '/../../config/db.php';

handleCors();
header('Content-Type: application/json');

function fail(string $msg, int $code): never {
    http_response_code($code);
    echo json_encode(['success' => false, 'error' => $msg]);
    exit;
}

$auth = requireAuth();

$data = json_decode(file_get_contents('php://input'), true) ?? [];
$id   = isset($_GET['id']) ? (int)$_GET['id'] : (int)($data['id'] ?? 0);

if (!$id) fail('Worker ID is required.', 400);

// ── Who is allowed? The worker themself, or someone with admin access ─────────
$isSelf  = ((int)($auth['sub'] ?? 0) === $id);
$isAdmin = in_array($auth['role'] ?? '', ['super_admin', 'admin'], true)
           || !empty($auth['has_admin_access']);

if (!$isSelf && !$isAdmin) fail('Access denied.', 403);

try {
    $pdo = getDB();

    // ── The target must exist and be a worker ─────────────────────────────────
    $find = $pdo->prepare("SELECT id, username, first_name, last_name, suffix, address, phone, mobile, email, status_id, specialization_id
                           FROM users WHERE id = ? AND type = 'worker' LIMIT 1");
    $find->execute([$id]);
    $before = $find->fetch();
    if (!$before) fail('Worker not found.', 404);

    // ── RegEx validation (unchanged) ──────────────────────────────────────────
    $nameRegex   = '/^[A-Za-zÀ-ÖØ-öø-ÿ\s\'\-\.]{1,100}$/u';
    $mobileRegex = '/^(\+639\d{9}|09\d{9})$/';   // same rule as workers/create.php    $mobileRegex = '/^(\+639\d{9}|09\d{9})$/';   // same rule as workers/create.php
    $emailRegex  = '/^[^\s@]+@[^\s@]+\.[^\s@]+$/';

    if (!empty($data['first_name']) && !preg_match($nameRegex, $data['first_name']))
        fail('First name contains invalid characters.', 422);
    if (!empty($data['last_name']) && !preg_match($nameRegex, $data['last_name']))
        fail('Last name contains invalid characters.', 422);
    if (!empty($data['mobile']) && !preg_match($mobileRegex, $data['mobile']))
        fail('Enter a valid PH mobile number (+639XXXXXXXXX or 09XXXXXXXXX).', 422);
    if (!empty($data['email']) && !preg_match($emailRegex, $data['email']))
        fail('Invalid email format.', 422);

    // ── Email must not belong to another account (users.email is unique) ──────
    if (!empty($data['email'])) {
        $dup = $pdo->prepare("SELECT id FROM users WHERE LOWER(email) = LOWER(?) AND id <> ? LIMIT 1");
        $dup->execute([trim($data['email']), $id]);
        if ($dup->fetch()) fail('That email is already used by another account.', 409);
    }

    // ── Build the UPDATE from the allowed fields only ─────────────────────────
    $fields = ['first_name', 'last_name', 'suffix', 'address', 'phone', 'mobile', 'email'];
    $set = []; $params = [];

    foreach ($fields as $f) {
        if (array_key_exists($f, $data)) {
            $value = is_string($data[$f]) ? trim($data[$f]) : $data[$f];
            $set[]         = "`$f` = :$f";
            $params[":$f"] = ($value === '' || $value === null) ? null : $value;
        }
    }

    // Status can only be changed by someone with admin access (not by the worker)
    if ($isAdmin && !empty($data['status_id'])) {
        $chk = $pdo->prepare("SELECT id FROM statuses WHERE id = ? AND entity = 'user'");
        $chk->execute([(int)$data['status_id']]);
        if (!$chk->fetch()) fail('Invalid status.', 422);
        $set[]                = "`status_id` = :status_id";
        $params[':status_id'] = (int)$data['status_id'];
    }

    // Specialization: a worker now has ONE specialization (users.specialization_id).
    // Empty / "Keep current" leaves it unchanged.
    if (!empty($data['specialization_id'])) {
        $chk = $pdo->prepare("SELECT id FROM specializations WHERE id = ?");
        $chk->execute([(int)$data['specialization_id']]);
        if (!$chk->fetch()) fail('Invalid specialization.', 422);
        $set[]                       = "`specialization_id` = :specialization_id";
        $params[':specialization_id'] = (int)$data['specialization_id'];
    }

    if (!empty($set)) {
        $params[':id'] = $id;
        $pdo->prepare("UPDATE users SET " . implode(', ', $set) . " WHERE id = :id AND type = 'worker'")
            ->execute($params);
    }

    // ── Return the updated worker (same shape as workers/list.php) ────────────
    $stmt = $pdo->prepare("
        SELECT
            u.id,
            u.user_code,
            u.user_code AS worker_code,
            TRIM(CONCAT(u.first_name, ' ', u.last_name, ' ', COALESCE(u.suffix, ''))) AS full_name,
            u.first_name, u.last_name, u.suffix, u.username, u.email,
            u.mobile, u.phone, u.address,
            u.specialization_id, sp.name AS specialization,
            u.status_id, s.label AS status,
            u.created_at, u.updated_at
        FROM users u
        LEFT JOIN statuses        s  ON s.id  = u.status_id
        LEFT JOIN specializations sp ON sp.id = u.specialization_id
        WHERE u.id = ?
    ");
    $stmt->execute([$id]);

    // AUDIT: compare old vs new and log only the fields that actually changed
    $chgOld = []; $chgNew = [];
    foreach ($params as $k => $v) {
        $col = ltrim($k, ':');
        if ($col === 'id') continue;
        $o = $before[$col] ?? null;
        if ((string)$o !== (string)$v) { $chgOld[$col] = $o; $chgNew[$col] = $v; }
    }
    // Show readable names instead of ids
    if (isset($chgNew['status_id'])) {
        $lab = $pdo->query("SELECT id, label FROM statuses")->fetchAll(PDO::FETCH_KEY_PAIR);
        $chgOld['status'] = $lab[$chgOld['status_id']] ?? $chgOld['status_id'];
        $chgNew['status'] = $lab[$chgNew['status_id']] ?? $chgNew['status_id'];
        unset($chgOld['status_id'], $chgNew['status_id']);
    }
    if (isset($chgNew['specialization_id'])) {
        $lab = $pdo->query("SELECT id, name FROM specializations")->fetchAll(PDO::FETCH_KEY_PAIR);
        $chgOld['specialization'] = $lab[$chgOld['specialization_id']] ?? $chgOld['specialization_id'];
        $chgNew['specialization'] = $lab[$chgNew['specialization_id']] ?? $chgNew['specialization_id'];
        unset($chgOld['specialization_id'], $chgNew['specialization_id']);
    }
    [$chgOld, $chgNew] = auditMaskSensitive($chgOld, $chgNew);
    if ($chgNew) {
        $statusOnly = (array_keys($chgNew) === ['status']);
        auditLog(array_merge(auditActor($auth), [
            'action'         => $statusOnly ? 'STATUS_CHANGE' : 'UPDATE',
            'module'         => 'Workers Access',
            'description'    => $statusOnly
                ? 'Changed status of worker "' . $before['username'] . '" from ' . $chgOld['status'] . ' to ' . $chgNew['status']
                : ($isSelf ? 'Worker "' . $before['username'] . '" updated own profile'
                           : 'Updated worker "' . $before['username'] . '" (' . implode(', ', array_keys($chgNew)) . ')'),
            'target_user_id' => $id,
            'target_type'    => 'users',
            'target_id'      => $id,
            'target_label'   => $before['username'],
            'old_values'     => $chgOld,
            'new_values'     => $chgNew,
        ]));
    }

    echo json_encode(['success' => true, 'message' => 'Worker updated.', 'worker' => $stmt->fetch()]);

} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Server error.', 'detail' => $e->getMessage()]);
}