<?php
require_once __DIR__ . '/../../cors.php';
require_once __DIR__ . '/../../config/db.php';
require_once __DIR__ . '/../../middleware/jwt.php';

handleCors();
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'PUT') {
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
$id         = (int)($body['id']         ?? 0);
$first_name = trim($body['first_name']  ?? '');
$last_name  = trim($body['last_name']   ?? '');
$address    = trim($body['address']     ?? '');
$phone      = trim($body['phone']       ?? '');
$mobile     = trim($body['mobile']      ?? '');
$email      = trim($body['email']       ?? '');
$type       = $body['type']             ?? 'client';
$is_admin   = (int)($body['is_admin']   ?? 0);
$status_id  = (int)($body['status_id']  ?? 1);
$org_type   = (int)($body['organisation_type_id'] ?? 0);
$spec_id    = (int)($body['specialization_id']    ?? 0);

$errors = [];
if (!$id)         $errors[] = 'id is required.';
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

    // Check exists
    $chk = $pdo->prepare("SELECT id FROM contacts WHERE id = ?");
    $chk->execute([$id]);
    if (!$chk->fetch()) {
        http_response_code(404);
        echo json_encode(['success' => false, 'error' => 'Contact not found.']);
        exit;
    }

    $pdo->beginTransaction();

    // Update contact
    $pdo->prepare("
        UPDATE contacts
        SET first_name = ?, last_name = ?, address = ?, phone = ?,
            mobile = ?, email = ?, type = ?, is_admin = ?, status_id = ?
        WHERE id = ?
    ")->execute([
        $first_name, $last_name,
        $address ?: null, $phone ?: null,
        $mobile && $mobile !== '+63' ? $mobile : null,
        $email ?: null,
        $type, $is_admin, $status_id ?: 1,
        $id,
    ]);

    // Update organisation type — delete old, insert new if provided
    $pdo->prepare("DELETE FROM contact_organisations WHERE contact_id = ?")->execute([$id]);
    if ($type === 'organisation' && $org_type) {
        $pdo->prepare("INSERT INTO contact_organisations (contact_id, organisation_type_id) VALUES (?, ?)")
            ->execute([$id, $org_type]);
    }

    // Update worker specialization — delete old, insert new if provided
    $pdo->prepare("DELETE FROM contact_workers WHERE contact_id = ?")->execute([$id]);
    if ($type === 'worker' && $spec_id) {
        $pdo->prepare("INSERT INTO contact_workers (contact_id, specialization_id) VALUES (?, ?)")
            ->execute([$id, $spec_id]);
    }

    $pdo->commit();

    // Return fresh record from view
    $row = $pdo->prepare("SELECT * FROM v_contacts_full WHERE id = ?");
    $row->execute([$id]);

    echo json_encode(['success' => true, 'contact' => $row->fetch()]);
} catch (PDOException $e) {
    $pdo->rollBack();
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Database error.', 'detail' => $e->getMessage()]);
}