<?php
// backend/api/contacts/update.php — update a client/worker contact.
// New schema: everything lives in `users`. The old contacts / v_contacts_full /
// contact_organisations / contact_workers tables no longer exist.
// 'type' and 'is_admin' can NOT be changed from here (privilege changes go through roles).
require_once __DIR__ . '/../../cors.php';
require_once __DIR__ . '/../../middleware/jwt.php';
require_once __DIR__ . '/../../config/db.php';
require_once __DIR__ . '/../../middleware/audit.php';

handleCors();
header('Content-Type: application/json');

function fail(string $msg, int $code): never {
    http_response_code($code);
    echo json_encode(['success' => false, 'error' => $msg]);
    exit;
}

$auth = requireAdminAccess();

$data = json_decode(file_get_contents('php://input'), true) ?? [];
$id   = isset($_GET['id']) ? (int)$_GET['id'] : (int)($data['id'] ?? 0);

if (!$id) fail('Contact ID is required.', 400);

try {
    $pdo = getDB();

    // ── Target must exist and be a client or worker ───────────────────────────
    $find = $pdo->prepare("
        SELECT id, type, first_name, last_name, suffix, address, phone, mobile, email, status_id
        FROM users WHERE id = ? AND type IN ('client','worker') LIMIT 1
    ");
    $find->execute([$id]);
    $before = $find->fetch();
    if (!$before) fail('Contact not found.', 404);

    // ── Validation (only for fields that were sent) ───────────────────────────
    $nameRegex   = '/^[A-Za-zÀ-ÖØ-öø-ÿ\s\'\-\.]{1,100}$/u';
    $mobileRegex = '/^(\+639\d{9}|09\d{9})$/';
    $emailRegex  = '/^[^\s@]+@[^\s@]+\.[^\s@]+$/';

    if (!empty($data['first_name']) && !preg_match($nameRegex, $data['first_name']))
        fail('First name contains invalid characters.', 422);
    if (!empty($data['last_name']) && !preg_match($nameRegex, $data['last_name']))
        fail('Last name contains invalid characters.', 422);
    if (!empty($data['mobile']) && !preg_match($mobileRegex, $data['mobile']))
        fail('Enter a valid PH mobile number (+639XXXXXXXXX or 09XXXXXXXXX).', 422);
    if (!empty($data['email']) && !preg_match($emailRegex, $data['email']))
        fail('Invalid email format.', 422);

    if (!empty($data['email'])) {
        $dup = $pdo->prepare("SELECT id FROM users WHERE LOWER(email) = LOWER(?) AND id <> ? LIMIT 1");
        $dup->execute([trim($data['email']), $id]);
        if ($dup->fetch()) fail('That email is already used by another account.', 409);
    }

    // ── Build the UPDATE from allowed fields only ─────────────────────────────
    $fields = ['first_name', 'last_name', 'suffix', 'address', 'phone', 'mobile', 'email'];
    $set = []; $params = [];

    foreach ($fields as $f) {
        if (array_key_exists($f, $data)) {
            $value = is_string($data[$f]) ? trim($data[$f]) : $data[$f];
            $set[]         = "`$f` = :$f";
            $params[":$f"] = ($value === '' || $value === null) ? null : $value;
        }
    }

    if (!empty($data['status_id'])) {
        $chk = $pdo->prepare("SELECT id FROM statuses WHERE id = ? AND entity = 'user'");
        $chk->execute([(int)$data['status_id']]);
        if (!$chk->fetch()) fail('Invalid status.', 422);
        $set[]                = "`status_id` = :status_id";
        $params[':status_id'] = (int)$data['status_id'];
    }

    if (empty($set)) fail('No fields provided to update.', 400);

    $upd = $params;
    $upd[':id'] = $id;
    $pdo->prepare("UPDATE users SET " . implode(', ', $set) . " WHERE id = :id AND type IN ('client','worker')")
        ->execute($upd);

    // ── AUDIT: log only the fields that actually changed ──────────────────────
    $chgOld = []; $chgNew = [];
    foreach ($params as $k => $v) {
        $col = ltrim($k, ':');
        $o   = $before[$col] ?? null;
        if ((string)$o !== (string)$v) { $chgOld[$col] = $o; $chgNew[$col] = $v; }
    }
    if (isset($chgNew['status_id'])) {
        $lab = $pdo->query("SELECT id, label FROM statuses")->fetchAll(PDO::FETCH_KEY_PAIR);
        $chgOld['status'] = $lab[$chgOld['status_id']] ?? $chgOld['status_id'];
        $chgNew['status'] = $lab[$chgNew['status_id']] ?? $chgNew['status_id'];
        unset($chgOld['status_id'], $chgNew['status_id']);
    }
    [$chgOld, $chgNew] = auditMaskSensitive($chgOld, $chgNew);

    if ($chgNew) {
        $who        = trim($before['first_name'] . ' ' . $before['last_name']);
        $statusOnly = (array_keys($chgNew) === ['status']);
        auditLog(array_merge(auditActor($auth), [
            'action'         => $statusOnly ? 'STATUS_CHANGE' : 'UPDATE',
            'module'         => $before['type'] === 'client' ? 'Client Access' : 'Workers Access',
            'description'    => $statusOnly
                ? 'Changed status of ' . $before['type'] . ' "' . $who . '" from ' . $chgOld['status'] . ' to ' . $chgNew['status']
                : 'Updated ' . $before['type'] . ' "' . $who . '" (' . implode(', ', array_keys($chgNew)) . ')',
            'target_user_id' => $id,
            'target_type'    => 'users',
            'target_id'      => $id,
            'target_label'   => $who,
            'old_values'     => $chgOld,
            'new_values'     => $chgNew,
        ]));
    }

    // ── Return the updated contact (same shape as contacts/list.php) ──────────
    $stmt = $pdo->prepare("
        SELECT
            u.id, u.user_code, u.user_code AS contact_code,
            TRIM(CONCAT(u.first_name, ' ', u.last_name, ' ', COALESCE(u.suffix, ''))) AS full_name,
            u.first_name, u.last_name, u.suffix,
            u.address, u.phone, u.mobile, u.email, u.type,
            IF(r.id IS NULL, 0, 1) AS is_admin,
            NULL AS organisation_type,
            sp.name AS specialization,
            u.status_id, s.label AS status,
            lic.latest_license_expiry,
            CASE
                WHEN lic.latest_license_expiry IS NULL THEN 'No License'
                WHEN lic.latest_license_expiry < CURDATE() THEN 'Expired'
                WHEN lic.latest_license_expiry <= DATE_ADD(CURDATE(), INTERVAL 30 DAY) THEN 'Expiring Soon'
                ELSE 'Valid'
            END AS license_status
        FROM users u
        LEFT JOIN statuses        s  ON s.id  = u.status_id
        LEFT JOIN specializations sp ON sp.id = u.specialization_id
        LEFT JOIN roles           r  ON r.user_id = u.id
        LEFT JOIN (
            SELECT user_id, MAX(expiry_date) AS latest_license_expiry
            FROM licenses GROUP BY user_id
        ) lic ON lic.user_id = u.id
        WHERE u.id = ?
    ");
    $stmt->execute([$id]);

    echo json_encode(['success' => true, 'message' => 'Contact updated.', 'contact' => $stmt->fetch(PDO::FETCH_ASSOC)]);

} catch (Throwable $e) {
    error_log($e->getMessage());
    fail('Server error.', 500);
}