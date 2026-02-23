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
if (($auth['type'] ?? '') !== 'super_admin') {
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'Access denied.']);
    exit;
}

$body     = json_decode(file_get_contents('php://input'), true);
$name     = trim($body['name']     ?? '');
$username = trim($body['username'] ?? '');
$password = $body['password']      ?? '';
$type     = $body['type']          ?? 'admin';

$errors = [];
if (!$name)                $errors[] = 'name is required.';
if (!$username)            $errors[] = 'username is required.';
if (strlen($password) < 8) $errors[] = 'password must be at least 8 characters.';
if (!in_array($type, ['super_admin', 'admin'])) $errors[] = 'type must be super_admin or admin.';

if ($errors) {
    http_response_code(422);
    echo json_encode(['success' => false, 'error' => implode(' ', $errors)]);
    exit;
}

try {
    $pdo = getDB();

    $chk = $pdo->prepare("SELECT id FROM users WHERE username = ?");
    $chk->execute([$username]);
    if ($chk->fetch()) {
        http_response_code(409);
        echo json_encode(['success' => false, 'error' => 'Username already taken.']);
        exit;
    }

    $pdo->prepare("INSERT INTO users (name, username, password, type) VALUES (?, ?, ?, ?)")
        ->execute([$name, $username, password_hash($password, PASSWORD_BCRYPT), $type]);

    $newId = (int)$pdo->lastInsertId();
    $row   = $pdo->prepare("SELECT id, name, username, type, created_at FROM users WHERE id = ?");
    $row->execute([$newId]);

    http_response_code(201);
    echo json_encode(['success' => true, 'user' => $row->fetch()]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Database error.', 'detail' => $e->getMessage()]);
}