<?php
require_once __DIR__ . '/../../cors.php';
require_once __DIR__ . '/../../config/db.php';

handleCors();
header('Content-Type: application/json');

$pdo = getDB();

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    try {
        $stmt = $pdo->query("SELECT id, name FROM contract_types ORDER BY id ASC");
        echo json_encode(['success' => true, 'data' => $stmt->fetchAll()]);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'Database error.', 'detail' => $e->getMessage()]);
    }

} elseif ($_SERVER['REQUEST_METHOD'] === 'POST') {
    require_once __DIR__ . '/../../middleware/jwt.php';
    requireAdminAccess();
    $body = json_decode(file_get_contents('php://input'), true);
    $name = trim($body['name'] ?? '');

    if (!$name) {
        http_response_code(422);
        echo json_encode(['success' => false, 'error' => 'Name is required.']);
        exit;
    }

    try {
        $stmt = $pdo->prepare("INSERT INTO contract_types (name) VALUES (?)");
        $stmt->execute([$name]);
        $id = $pdo->lastInsertId();
        echo json_encode(['success' => true, 'data' => ['id' => $id, 'name' => $name]]);
    } catch (PDOException $e) {
        http_response_code(500);
        error_log($e->getMessage()); echo json_encode(['success' => false, 'error' => 'Database error.']);
    }

} else {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method not allowed.']);
}