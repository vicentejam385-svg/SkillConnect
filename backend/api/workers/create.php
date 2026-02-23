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

requireAuth();

$body             = json_decode(file_get_contents('php://input'), true);
$firstName        = trim($body['first_name']        ?? '');
$lastName         = trim($body['last_name']         ?? '');
$specializationId = (int)($body['specialization_id'] ?? 0);
$username         = trim($body['username']           ?? '');
$password         = $body['password']                ?? '';

$errors = [];
if (!$firstName)           $errors[] = 'first_name is required.';
if (!$lastName)            $errors[] = 'last_name is required.';
if (!$specializationId)    $errors[] = 'specialization_id is required.';
if (!$username)            $errors[] = 'username is required.';
if (strlen($password) < 8) $errors[] = 'password must be at least 8 characters.';

if ($errors) {
    http_response_code(422);
    echo json_encode(['success' => false, 'error' => implode(' ', $errors)]);
    exit;
}

try {
    $pdo = getDB();

    $chk = $pdo->prepare("SELECT id FROM workers WHERE username = ?");
    $chk->execute([$username]);
    if ($chk->fetch()) {
        http_response_code(409);
        echo json_encode(['success' => false, 'error' => 'Username already taken.']);
        exit;
    }

    $pdo->beginTransaction();

    $pdo->prepare(
        "INSERT INTO contacts (first_name, last_name, email, mobile, phone, address, type, status_id)
         VALUES (?, ?, ?, ?, ?, ?, 'worker', ?)"
    )->execute([
        $firstName, $lastName,
        $body['email']   ?? null, $body['mobile']  ?? null,
        $body['phone']   ?? null, $body['address'] ?? null,
        $body['status_id'] ?? 1,
    ]);
    $contactId = (int)$pdo->lastInsertId();

    $pdo->prepare("INSERT INTO contact_workers (contact_id, specialization_id) VALUES (?, ?)")
        ->execute([$contactId, $specializationId]);

    $pdo->prepare("INSERT INTO workers (username, password, contact_id, status_id) VALUES (?, ?, ?, ?)")
        ->execute([$username, password_hash($password, PASSWORD_BCRYPT), $contactId, $body['status_id'] ?? 4]);

    $pdo->commit();

    $view = $pdo->prepare("SELECT * FROM v_workers_full WHERE contact_code = (SELECT contact_code FROM contacts WHERE id = ?)");
    $view->execute([$contactId]);

    http_response_code(201);
    echo json_encode(['success' => true, 'worker' => $view->fetch()]);
} catch (PDOException $e) {
    $pdo->rollBack();
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Database error.', 'detail' => $e->getMessage()]);
}