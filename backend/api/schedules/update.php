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
$id   = (int)($body['id'] ?? 0);

if (!$id) {
    http_response_code(422);
    echo json_encode(['success' => false, 'error' => 'Schedule id is required.']);
    exit;
}

try {
    $pdo = getDB();

    $existing = $pdo->prepare("SELECT id FROM schedules WHERE id = ?");
    $existing->execute([$id]);
    if (!$existing->fetch()) {
        http_response_code(404);
        echo json_encode(['success' => false, 'error' => 'Schedule not found.']);
        exit;
    }
        // Allow status update by label name
    if (!empty($body['status_id']) && !is_numeric($body['status_id'])) {
        $labelStmt = $pdo->prepare("SELECT id FROM statuses WHERE entity = 'schedule' AND label = ? LIMIT 1");
        $labelStmt->execute([$body['status_id']]);
        $body['status_id'] = $labelStmt->fetchColumn() ?: null;
    }
    $fields = ['start_time', 'end_time', 'description', 'worker_contact_id', 'client_contact_id', 'status_id'];
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
    $pdo->prepare("UPDATE schedules SET " . implode(', ', $set) . " WHERE id = ?")->execute($params);

    $view = $pdo->prepare("SELECT * FROM v_schedules_full WHERE id = ?");
    $view->execute([$id]);
    echo json_encode(['success' => true, 'schedule' => $view->fetch()]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Database error.', 'detail' => $e->getMessage()]);
}