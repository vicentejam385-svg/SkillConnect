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
    $stmt = $pdo->prepare("SELECT id, password FROM workers WHERE username = ? LIMIT 1");
    $stmt->execute([$username]);
    $raw = $stmt->fetch();

    if (!$raw || !password_verify($password, $raw['password'])) {
        http_response_code(401);
        echo json_encode(['success' => false, 'error' => 'Invalid credentials.']);
        exit;
    }

    $stmt2 = $pdo->prepare("SELECT * FROM v_workers_full WHERE id = ? LIMIT 1");
    $stmt2->execute([$raw['id']]);
    $worker = $stmt2->fetch();

    if (strtolower($worker['status'] ?? '') !== 'active') {
        http_response_code(403);
        echo json_encode(['success' => false, 'error' => 'Account is not active.']);
        exit;
    }

    $token = jwtCreate([
        'sub'         => $worker['id'],
        'name'        => $worker['full_name'],
        'worker_code' => $worker['worker_code'],
        'role'        => 'worker',
    ]);

    echo json_encode([
        'success' => true,
        'token'   => $token,
        'user'    => [
            'id'             => $worker['id'],
            'name'           => $worker['full_name'],
            'username'       => $worker['username'],
            'worker_code'    => $worker['worker_code'],
            'specialization' => $worker['specialization'],
            'status'         => $worker['status'],
        ],
    ]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Database error.', 'detail' => $e->getMessage()]);
}