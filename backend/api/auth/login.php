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

$body     = json_decode(file_get_contents('php://input'), true);
$username = trim($body['username'] ?? '');
$password = $body['password'] ?? '';

if (!$username || !$password) {
    http_response_code(422);
    echo json_encode(['success' => false, 'error' => 'Username and password are required.']);
    exit;
}

try {
    $pdo  = getDB();
    $stmt = $pdo->prepare("SELECT id, name, username, password, type FROM users WHERE username = ? LIMIT 1");
    $stmt->execute([$username]);
    $user = $stmt->fetch();

    if (!$user || !password_verify($password, $user['password'])) {
        http_response_code(401);
        echo json_encode(['success' => false, 'error' => 'Invalid credentials.']);
        exit;
    }
    $requestedRole = trim($body['role'] ?? '');
if ($requestedRole && $user['type'] !== $requestedRole) {
    http_response_code(401);
    echo json_encode(['success' => false, 'error' => 'Invalid credentials.']);
    exit;
    }
    $token = jwtCreate([
        'sub'  => $user['id'],
        'name' => $user['name'],
        'type' => $user['type'],
        'role' => $user['type'],
    ]);

    echo json_encode([
        'success' => true,
        'token'   => $token,
        'user'    => [
            'id'       => $user['id'],
            'name'     => $user['name'],
            'username' => $user['username'],
            'type'     => $user['type'],
        ],
    ]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Database error.', 'detail' => $e->getMessage()]);
}