<?php
// api/workers/create.php — create a worker (new schema: one row in users, type = 'worker')
require_once __DIR__ . '/../../cors.php';
require_once __DIR__ . '/../../middleware/jwt.php';
require_once __DIR__ . '/../../middleware/audit.php';
require_once __DIR__ . '/../../config/db.php';

handleCors();
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method not allowed.']);
    exit;
}

$auth = requireAdminAccess();
$pdo  = getDB();
$data = json_decode(file_get_contents('php://input'), true) ?? [];

// ── 1. Required fields ───────────────────────────────────────
$required = ['first_name', 'last_name', 'username', 'mobile', 'email', 'specialization_id'];
foreach ($required as $field) {
    if (empty(trim((string)($data[$field] ?? '')))) {
        http_response_code(422);
        echo json_encode(['error' => "Field '$field' is required."]);
        exit;
    }
}

// ── 2. Validation ────────────────────────────────────────────
$nameRegex     = '/^[A-Za-zÀ-ÖØ-öø-ÿ\s\'\-\.]{1,100}$/u';
$mobileRegex   = '/^(\+639\d{9}|09\d{9})$/';
$emailRegex    = '/^[^\s@]+@[^\s@]+\.[^\s@]+$/';
$usernameRegex = '/^[a-zA-Z0-9_]{4,100}$/';

$first    = trim($data['first_name']);
$last     = trim($data['last_name']);
$username = trim($data['username']);
$mobile   = trim($data['mobile']);
$email    = trim($data['email']);

if (!preg_match($nameRegex, $first))       { http_response_code(422); echo json_encode(['error' => 'First name invalid.']); exit; }
if (!preg_match($nameRegex, $last))        { http_response_code(422); echo json_encode(['error' => 'Last name invalid.']);  exit; }
if (!preg_match($mobileRegex, $mobile))    { http_response_code(422); echo json_encode(['error' => 'Mobile invalid.']);     exit; }
if (!preg_match($emailRegex, $email))      { http_response_code(422); echo json_encode(['error' => 'Email invalid.']);      exit; }
if (!preg_match($usernameRegex, $username)){ http_response_code(422); echo json_encode(['error' => 'Username invalid.']);   exit; }

try {
    // ── 3. Uniqueness (username + email are unique across ALL users) ──
    $check = $pdo->prepare("SELECT id FROM users WHERE username = ?");
    $check->execute([$username]);
    if ($check->fetch()) { http_response_code(409); echo json_encode(['error' => 'Username already exists.']); exit; }

    $eCheck = $pdo->prepare("SELECT id FROM users WHERE email = ?");
    $eCheck->execute([$email]);
    if ($eCheck->fetch()) { http_response_code(409); echo json_encode(['error' => 'Email already used by another account.']); exit; }

    // ── 4. Mobile uniqueness among workers ───────────────────
    $mCheck = $pdo->prepare("SELECT id FROM users WHERE mobile = ? AND type = 'worker'");
    $mCheck->execute([$mobile]);
    if ($mCheck->fetch()) { http_response_code(409); echo json_encode(['error' => 'Mobile number already used by another worker.']); exit; }

    // ── 5. Specialization must exist ─────────────────────────
    $spCheck = $pdo->prepare("SELECT id FROM specializations WHERE id = ?");
    $spCheck->execute([(int)$data['specialization_id']]);
    if (!$spCheck->fetch()) { http_response_code(422); echo json_encode(['error' => 'Specialization not found.']); exit; }

    // ── 6. Password ──────────────────────────────────────────
    $plainPassword  = !empty(trim($data['password'] ?? '')) ? trim($data['password']) : 'Worker@123';
    $hashedPassword = password_hash($plainPassword, PASSWORD_BCRYPT);

    // ── 7. Insert (user_code is set by the DB trigger) ───────
    $stmt = $pdo->prepare("
        INSERT INTO users
            (type, first_name, last_name, suffix, username, email, password,
             mobile, phone, address, specialization_id, status_id)
        VALUES
            ('worker', :first_name, :last_name, :suffix, :username, :email, :password,
             :mobile, :phone, :address, :specialization_id, :status_id)
    ");
    $stmt->execute([
        ':first_name'        => $first,
        ':last_name'         => $last,
        ':suffix'            => !empty(trim($data['suffix']  ?? '')) ? trim($data['suffix'])  : null,
        ':username'          => $username,
        ':email'             => $email,
        ':password'          => $hashedPassword,
        ':mobile'            => $mobile,
        ':phone'             => !empty(trim($data['phone']   ?? '')) ? trim($data['phone'])   : null,
        ':address'           => !empty(trim($data['address'] ?? '')) ? trim($data['address']) : null,
        ':specialization_id' => (int)$data['specialization_id'],
        ':status_id'         => (in_array((int)($data['status_id'] ?? 0), [1, 2, 7], true) ? (int)$data['status_id'] : 1), // Active / Inactive / On Leave, default Active
    ]);
    $workerId = (int)$pdo->lastInsertId();

    $stmt2 = $pdo->prepare("
        SELECT u.id, u.user_code, u.user_code AS worker_code,
               TRIM(CONCAT(u.first_name, ' ', u.last_name, ' ', COALESCE(u.suffix, ''))) AS full_name,
               u.first_name, u.last_name, u.suffix, u.username, u.email, u.mobile, u.phone, u.address,
               u.specialization_id, sp.name AS specialization,
               u.status_id, s.label AS status, u.created_at, u.updated_at
        FROM users u
        LEFT JOIN statuses        s  ON s.id  = u.status_id
        LEFT JOIN specializations sp ON sp.id = u.specialization_id
        WHERE u.id = ?
    ");
    $stmt2->execute([$workerId]);

    auditLog(array_merge(auditActor($auth), [
        'action'         => 'CREATE',
        'module'         => 'Workers Access',
        'description'    => 'Created worker account "' . $username . '"',
        'target_user_id' => $workerId,
        'target_type'    => 'users',
        'target_id'      => $workerId,
        'target_label'   => $username,
        'new_values'     => [
            'name'              => trim($first . ' ' . $last),
            'username'          => $username,
            'specialization_id' => (int)$data['specialization_id'],
            'status_id'         => (in_array((int)($data['status_id'] ?? 0), [1, 2, 7], true) ? (int)$data['status_id'] : 1),
        ],
    ]));

    http_response_code(201);
    echo json_encode([
        'success' => true,
        'message' => 'Worker created successfully.',
        'worker'  => $stmt2->fetch(PDO::FETCH_ASSOC),
    ]);

} catch (\Throwable $e) {
    http_response_code(500);
    echo json_encode([
        'error' => $e->getMessage(),
        'code'  => $e->getCode(),
        'file'  => basename($e->getFile()) . ':' . $e->getLine(),
    ]);
}