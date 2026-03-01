<?php
require_once __DIR__ . '/../../cors.php';
require_once __DIR__ . '/../../config/db.php';

handleCors();
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method not allowed.']);
    exit;
}

$body      = json_decode(file_get_contents('php://input'), true);
$firstName = trim($body['first_name'] ?? '');
$lastName  = trim($body['last_name']  ?? '');

if (!$firstName || !$lastName) {
    http_response_code(422);
    echo json_encode(['success' => false, 'error' => 'first_name and last_name are required.']);
    exit;
}

try {
    $pdo = getDB();

    // Get default "New" inquiry status
    $stStmt = $pdo->prepare("SELECT id FROM statuses WHERE entity = 'inquiry' AND label = 'New' LIMIT 1");
    $stStmt->execute();
    $statusId = $stStmt->fetchColumn() ?: null;

    $pdo->beginTransaction();

    // Insert inquiry
    $pdo->prepare(
        "INSERT INTO inquiries (first_name, last_name, email, address, phone, mobile, description, reason, status_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
    )->execute([
        $firstName, $lastName,
        $body['email']       ?? null,
        $body['address']     ?? null,
        $body['phone']       ?? null,
        $body['mobile']      ?? null,
        $body['description'] ?? null,
        $body['reason']      ?? null,
        $statusId,
    ]);
    $inquiryId = (int)$pdo->lastInsertId();

    // Auto-create a contact record (client type)
    $ctStmt = $pdo->prepare("SELECT id FROM statuses WHERE entity = 'contact' AND label = 'Active' LIMIT 1");
    $ctStmt->execute();
    $contactStatusId = $ctStmt->fetchColumn() ?: null;

    $pdo->prepare(
        "INSERT INTO contacts (first_name, last_name, email, address, phone, mobile, type, status_id)
         VALUES (?, ?, ?, ?, ?, ?, 'client', ?)"
    )->execute([
        $firstName, $lastName,
        $body['email']   ?? null,
        $body['address'] ?? null,
        $body['phone']   ?? null,
        $body['mobile']  ?? null,
        $contactStatusId,
    ]);
    $contactId = (int)$pdo->lastInsertId();

    // Link contact to inquiry
    $pdo->prepare("UPDATE inquiries SET contact_id = ? WHERE id = ?")->execute([$contactId, $inquiryId]);

    $pdo->commit();

    $view = $pdo->prepare("SELECT * FROM v_inquiries_full WHERE id = ?");
    $view->execute([$inquiryId]);

    http_response_code(201);
    echo json_encode(['success' => true, 'inquiry' => $view->fetch()]);
} catch (PDOException $e) {
    $pdo->rollBack();
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Database error.', 'detail' => $e->getMessage()]);
}