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

$body = json_decode(file_get_contents('php://input'), true);

try {
    $pdo = getDB();

    // Default status = Pending
    $stStmt = $pdo->prepare("SELECT id FROM statuses WHERE entity = 'job_order' AND label = 'Pending' LIMIT 1");
    $stStmt->execute();
    $statusId = $stStmt->fetchColumn() ?: null;

    // If inquiry_id given, auto-populate client and description
    $clientContactId = $body['client_contact_id'] ?? null;
    $description     = $body['description']        ?? null;

    if (!empty($body['inquiry_id'])) {
        $inqStmt = $pdo->prepare("SELECT * FROM inquiries WHERE id = ?");
        $inqStmt->execute([(int)$body['inquiry_id']]);
        $inq = $inqStmt->fetch();
        if ($inq) {
            if (!$clientContactId) $clientContactId = $inq['contact_id'];
            if (!$description)     $description     = $inq['description'];
        }
    }

    $pdo->prepare(
        "INSERT INTO job_orders
         (worker_contact_id, client_contact_id, inquiry_id, schedule_id, contract_type_id, description, start_date, end_date, status_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
    )->execute([
        $body['worker_contact_id'] ?? null,
        $clientContactId,
        $body['inquiry_id']        ?? null,
        $body['schedule_id']       ?? null,
        $body['contract_type_id']  ?? null,
        $description,
        $body['start_date']        ?? null,
        $body['end_date']          ?? null,
        $body['status_id']         ?? $statusId,
    ]);
    $newId = (int)$pdo->lastInsertId();

    $view = $pdo->prepare("SELECT * FROM v_job_orders_full WHERE id = ?");
    $view->execute([$newId]);

    http_response_code(201);
    echo json_encode(['success' => true, 'job_order' => $view->fetch()]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Database error.', 'detail' => $e->getMessage()]);
}