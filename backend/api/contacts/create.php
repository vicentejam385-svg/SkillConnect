<?php
require_once __DIR__ . '/../../cors.php';
require_once __DIR__ . '/../../config/db.php';
require_once __DIR__ . '/../../middleware/jwt.php';

handleCors();
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method not allowed.']);
    exit;
}

$auth = requireAuth();
if (!in_array($auth['type'] ?? '', ['super_admin', 'admin'])) {
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'Access denied.']);
    exit;
}

$body       = json_decode(file_get_contents('php://input'), true);
$first_name = trim($body['first_name'] ?? '');
$last_name  = trim($body['last_name']  ?? '');
$address    = trim($body['address']    ?? '');
$phone      = trim($body['phone']      ?? '');
$mobile     = trim($body['mobile']     ?? '');
$email      = trim($body['email']      ?? '');
$type       = $body['type']            ?? 'client';
$is_admin   = (int)($body['is_admin']  ?? 0);
$status_id  = (int)($body['status_id'] ?? 1);
$org_type   = (int)($body['organisation_type_id'] ?? 0);
$spec_id    = (int)($body['specialization_id']    ?? 0);

$errors = [];
if (!$first_name) $errors[] = 'first_name is required.';
if (!$last_name)  $errors[] = 'last_name is required.';
if (!in_array($type, ['client', 'organisation', 'worker'])) $errors[] = 'Invalid type.';

if ($errors) {
    http_response_code(422);
    echo json_encode(['success' => false, 'error' => implode(' ', $errors)]);
    exit;
}

try {
    $pdo = getDB();
    $pdo->beginTransaction();

    // Insert contact
    $pdo->prepare("
        INSERT INTO contacts (first_name, last_name, address, phone, mobile, email, type, is_admin, status_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ")->execute([
        $first_name, $last_name,
        $address ?: null, $phone ?: null,
        $mobile && $mobile !== '+63' ? $mobile : null,
        $email ?: null,
        $type, $is_admin,
        $status_id ?: 1,
    ]);

    $newId = (int)$pdo->lastInsertId();

    // Organisation type link
    if ($type === 'organisation' && $org_type) {
        $pdo->prepare("INSERT INTO contact_organisations (contact_id, organisation_type_id) VALUES (?, ?)")
            ->execute([$newId, $org_type]);
    }

    // Worker specialization link
    if ($type === 'worker' && $spec_id) {
        $pdo->prepare("INSERT INTO contact_workers (contact_id, specialization_id) VALUES (?, ?)")
            ->execute([$newId, $spec_id]);
    }

    $pdo->commit();

    // Return fresh record from view
    $row = $pdo->prepare("SELECT * FROM v_contacts_full WHERE id = ?");
    $row->execute([$newId]);

    http_response_code(201);
    echo json_encode(['success' => true, 'contact' => $row->fetch()]);
} catch (PDOException $e) {
    $pdo->rollBack();
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Database error.', 'detail' => $e->getMessage()]);
}