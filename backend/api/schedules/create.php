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

$body      = json_decode(file_get_contents('php://input'), true);
$startTime = trim($body['start_time'] ?? '');
$endTime   = trim($body['end_time']   ?? '');

if (!$startTime || !$endTime) {
    http_response_code(422);
    echo json_encode(['success' => false, 'error' => 'start_time and end_time are required.']);
    exit;
}

try {
    $pdo = getDB();

    // Default status = Scheduled
    $stStmt = $pdo->prepare("SELECT id FROM statuses WHERE entity = 'schedule' AND label = 'Scheduled' LIMIT 1");
    $stStmt->execute();
    $statusId = $stStmt->fetchColumn() ?: null;

    $pdo->prepare(
        "INSERT INTO schedules (start_time, end_time, description, worker_contact_id, client_contact_id, status_id)
         VALUES (?, ?, ?, ?, ?, ?)"
    )->execute([
        $startTime, $endTime,
        $body['description']       ?? null,
        $body['worker_contact_id'] ?? null,
        $body['client_contact_id'] ?? null,
        $body['status_id']         ?? $statusId,
    ]);
    $newId = (int)$pdo->lastInsertId();

    $view = $pdo->prepare("SELECT * FROM v_schedules_full WHERE id = ?");
    $view->execute([$newId]);

    http_response_code(201);
    echo json_encode(['success' => true, 'schedule' => $view->fetch()]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Database error.', 'detail' => $e->getMessage()]);
}