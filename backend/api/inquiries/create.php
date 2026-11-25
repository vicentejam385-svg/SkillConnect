<?php
// backend/api/inquiries/create.php
// Inquiries sent by the customer (website or customer account) need an email and a mobile number:
// the customer gets a "we received your inquiry" SMS and an email with Yes, proceed / No, cancel buttons.
require_once __DIR__ . '/../../cors.php';
require_once __DIR__ . '/../../middleware/jwt.php';
require_once __DIR__ . '/../../config/db.php';
require_once __DIR__ . '/../../middleware/audit.php';
require_once __DIR__ . '/../../helpers/inquiry-confirm.php';

handleCors();
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method not allowed.']);
    exit;
}

$pdo  = getDB();
$data = json_decode(file_get_contents('php://input'), true) ?? [];

// If a logged-in client is submitting, link the inquiry to their account
$linkedUserId = null;
$hdr = $_SERVER['HTTP_AUTHORIZATION']
    ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION']
    ?? (function_exists('apache_request_headers') ? (apache_request_headers()['Authorization'] ?? '') : '');
$adminTok = null;
if (str_starts_with($hdr, 'Bearer ')) {
    $tok = jwtVerify(substr($hdr, 7));
    if ($tok && ($tok['role'] ?? '') === 'client') $linkedUserId = (int)$tok['sub'];
    if ($tok && isAdminUser($tok)) $adminTok = $tok;
}

// Online (website / customer account) or walk-in (entered by the admin)
$source = ($adminTok && ($data['source'] ?? '') === 'walk_in') ? 'walk_in' : 'online';

// Use given status only if it is a real status for this entity, else use the default
function resolveStatus(PDO $pdo, $given, string $entity, int $default): int {
    if (empty($given)) return $default;
    $s = $pdo->prepare('SELECT id FROM statuses WHERE id = ? AND entity = ?');
    $s->execute([(int)$given, $entity]);
    return $s->fetchColumn() ? (int)$given : $default;
}

// ── 1. Required fields ────────────────────────────────────────────────────────
if (empty(trim($data['first_name'] ?? ''))) {
    http_response_code(422);
    echo json_encode(['success' => false, 'error' => 'First name is required.']);
    exit;
}
if (empty(trim($data['last_name'] ?? ''))) {
    http_response_code(422);
    echo json_encode(['success' => false, 'error' => 'Last name is required.']);
    exit;
}
if (empty(trim($data['reason'] ?? ''))) {
    http_response_code(422);
    echo json_encode(['success' => false, 'error' => 'Please choose a service.']);
    exit;
}
// The service must be one of the specializations (no more "Other")
$svc = $pdo->prepare('SELECT name FROM specializations WHERE name = ? LIMIT 1');
$svc->execute([trim($data['reason'])]);
$svcName = $svc->fetchColumn();
if (!$svcName) {
    http_response_code(422);
    echo json_encode(['success' => false, 'error' => 'Please choose a service from the list.']);
    exit;
}
$data['reason'] = $svcName; // same spelling as the specialization, so job offers match

// Sent by the customer (website or customer account): email and mobile are required,
// because we send the "inquiry received" SMS and email there. Inquiries the admin types in are not affected.
$customerSent = ($source === 'online' && !$adminTok);
if ($customerSent) {
    if (empty(trim($data['email'] ?? ''))) {
        http_response_code(422);
        echo json_encode(['success' => false, 'error' => 'Email address is required.']);
        exit;
    }
    if (empty(trim($data['mobile'] ?? ''))) {
        http_response_code(422);
        echo json_encode(['success' => false, 'error' => 'Mobile number is required.']);
        exit;
    }
}

// ── 2. RegEx validation ───────────────────────────────────────────────────────
$nameRegex   = '/^[A-Za-zÀ-ÖØ-öø-ÿ\s\'\-\.]{1,100}$/u';
$mobileRegex = '/^(\+639\d{9}|09\d{9})$/';
$emailRegex  = '/^[^\s@]+@[^\s@]+\.[^\s@]+$/';

if (!preg_match($nameRegex, trim($data['first_name']))) {
    http_response_code(422);
    echo json_encode(['success' => false, 'error' => 'First name contains invalid characters.']);
    exit;
}
if (!preg_match($nameRegex, trim($data['last_name']))) {
    http_response_code(422);
    echo json_encode(['success' => false, 'error' => 'Last name contains invalid characters.']);
    exit;
}
if (!empty($data['mobile'])) $data['mobile'] = preg_replace('/[\s\-]+/', '', trim($data['mobile']));
if (!empty($data['mobile']) && !preg_match($mobileRegex, $data['mobile'])) {
    http_response_code(422);
    echo json_encode(['success' => false, 'error' => 'Enter a valid PH mobile number (e.g. +639XXXXXXXXX or 09XXXXXXXXX).']);
    exit;
}
if (!empty($data['email']) && !preg_match($emailRegex, $data['email'])) {
    http_response_code(422);
    echo json_encode(['success' => false, 'error' => 'Invalid email format.']);
    exit;
}

// ── Insert (inquiry_code is set automatically by the database trigger) ───────
try {
    $stmt = $pdo->prepare("
        INSERT INTO inquiries
            (user_id, first_name, last_name, email, address, phone, mobile, description, reason, status_id, source)
        VALUES
            (:user_id, :first_name, :last_name, :email, :address, :phone, :mobile, :description, :reason, :status_id, :source)
    ");

    $stmt->execute([
        ':first_name'  => trim($data['first_name']),
        ':last_name'   => trim($data['last_name']),
        ':email'       => !empty($data['email'])       ? trim($data['email'])       : null,
        ':address'     => !empty($data['address'])     ? trim($data['address'])     : null,
        ':phone'       => !empty($data['phone'])       ? trim($data['phone'])       : null,
        ':mobile'      => !empty($data['mobile'])      ? trim($data['mobile'])      : null,
        ':description' => !empty($data['description']) ? trim($data['description']) : null,
        ':reason'      => trim($data['reason']),
        ':status_id'   => resolveStatus($pdo, $data['status_id'] ?? null, 'inquiry', 8), // 8 = New
        ':user_id'     => $linkedUserId,
        ':source'      => $source,
    ]);

    $inqId = (int)$pdo->lastInsertId();

    $rowStmt = $pdo->prepare(
        "SELECT i.*, i.user_id AS contact_id,
                CONCAT(i.first_name,' ',i.last_name) AS full_name,
                s.label AS status
         FROM inquiries i LEFT JOIN statuses s ON s.id = i.status_id
         WHERE i.id = ?"
    );
    $rowStmt->execute([$inqId]);

    $inquiry = $rowStmt->fetch();

    $who = trim($data['first_name']) . ' ' . trim($data['last_name']);
    $entry = [
        'action'        => 'CREATE',
        'module'        => 'Inquiries',
        'description'   => ($source === 'walk_in' ? 'Added a walk-in inquiry for ' . $who : 'Submitted a new inquiry')
                           . ' (' . trim($data['reason']) . ')',
        'target_type'   => 'inquiry',
        'target_id'     => $inqId,
        'target_label'  => $inquiry['inquiry_code'] ?? ('Inquiry #' . $inqId),
        'status'        => 'success',
    ];
    auditLog($adminTok
        ? array_merge(auditActor($adminTok), $entry)
        : array_merge([
            'actor_user_id' => $linkedUserId,
            'actor_name'    => $who,
            'actor_type'    => $linkedUserId ? 'client' : 'guest',
          ], $entry));

    // Sent by the customer: "we received your inquiry" SMS + email with the Proceed / Cancel buttons
    $notify = null;
    if ($customerSent) {
        $notify = inquiryNotifyReceived($pdo, $inqId);
    }
    unset($inquiry['respond_token_hash']);

    http_response_code(201);
    echo json_encode([
        'success' => true,
        'message' => $notify && $notify['email'] === 'sent'
            ? 'Inquiry submitted. We sent a confirmation to your email and mobile number.'
            : 'Inquiry submitted successfully.',
        'inquiry' => $inquiry,
        'notify'  => $notify,
    ]);

} catch (PDOException $e) {
    error_log('Inquiry create failed: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Database error.']);
}