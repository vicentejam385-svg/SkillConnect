<?php
require_once __DIR__ . '/../../cors.php';
require_once __DIR__ . '/../../config/db.php';
require_once __DIR__ . '/../../middleware/jwt.php';

handleCors();
header('Content-Type: application/json');

if (!in_array($_SERVER['REQUEST_METHOD'], ['PUT', 'PATCH'])) {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method not allowed.']);
    exit;
}

requireAuth();

$body = json_decode(file_get_contents('php://input'), true);
$id   = (int)($body['id'] ?? $_GET['id'] ?? 0);

if (!$id) {
    http_response_code(422);
    echo json_encode(['success' => false, 'error' => 'License id is required.']);
    exit;
}

try {
    $pdo      = getDB();
    $existing = $pdo->prepare("SELECT id FROM licenses WHERE id = ?");
    $existing->execute([$id]);
    if (!$existing->fetch()) {
        http_response_code(404);
        echo json_encode(['success' => false, 'error' => 'License not found.']);
        exit;
    }

    $fields = ['expiry_date', 'document_name', 'file_path', 'ai_scan_result'];
    $set = []; $params = [];
    foreach ($fields as $f) {
        if (array_key_exists($f, $body)) { $set[] = "$f = ?"; $params[] = $body[$f]; }
    }
    if (!$set) {
        http_response_code(422);
        echo json_encode(['success' => false, 'error' => 'No fields to update.']);
        exit;
    }

    $params[] = $id;
    $pdo->prepare("UPDATE licenses SET " . implode(', ', $set) . " WHERE id = ?")->execute($params);

    $row = $pdo->prepare(
        "SELECT l.*, c.contact_code, CONCAT(c.first_name,' ',c.last_name) AS contact_name
         FROM licenses l JOIN contacts c ON c.id = l.contact_id WHERE l.id = ?"
    );
    $row->execute([$id]);
    echo json_encode(['success' => true, 'license' => $row->fetch()]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Database error.', 'detail' => $e->getMessage()]);
}