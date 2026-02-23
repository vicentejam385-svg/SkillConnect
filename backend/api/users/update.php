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
if (($auth['type'] ?? '') !== 'super_admin') {
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'Access denied.']);
    exit;
}

$body     = json_decode(file_get_contents('php://input'), true);
$id       = (int)($body['id']       ?? 0);
$name     = trim($body['name']     ?? '');
$username = trim($body['username'] ?? '');
$type     = $body['type']          ?? 'admin';
$password = $body['password']      ?? '';

$errors = [];
if (!$id)       $errors[] = 'id is required.';
if (!$name)     $errors[] = 'name is required.';
if (!$username) $errors[] = 'username is required.';
if (!in_array($type, ['super_admin', 'admin'])) $errors[] = 'type must be super_admin or admin.';
if ($password && strlen($password) < 8) $errors[] = 'password must be at least 8 characters.';

if ($errors) {
    http_response_code(422);
    echo json_encode(['success' => false, 'error' => implode(' ', $errors)]);
    exit;
}

try {
    $pdo = getDB();

    // Check user exists
    $chk = $pdo->prepare("SELECT id FROM users WHERE id = ?");
    $chk->execute([$id]);
    if (!$chk->fetch()) {
        http_response_code(404);
        echo json_encode(['success' => false, 'error' => 'User not found.']);
        exit;
    }

    // Check username not taken by another user
    $dup = $pdo->prepare("SELECT id FROM users WHERE username = ? AND id != ?");
    $dup->execute([$username, $id]);
    if ($dup->fetch()) {
        http_response_code(409);
        echo json_encode(['success' => false, 'error' => 'Username already taken.']);
        exit;
    }

    if ($password) {
        $pdo->prepare("UPDATE users SET name = ?, username = ?, type = ?, password = ? WHERE id = ?")
            ->execute([$name, $username, $type, password_hash($password, PASSWORD_BCRYPT), $id]);
    } else {
        $pdo->prepare("UPDATE users SET name = ?, username = ?, type = ? WHERE id = ?")
            ->execute([$name, $username, $type, $id]);
    }

    $row = $pdo->prepare("SELECT id, name, username, type, created_at, updated_at FROM users WHERE id = ?");
    $row->execute([$id]);

    echo json_encode(['success' => true, 'user' => $row->fetch()]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Database error.', 'detail' => $e->getMessage()]);
}