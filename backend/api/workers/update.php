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

$body     = json_decode(file_get_contents('php://input'), true);
$workerId = (int)($body['id'] ?? $_GET['id'] ?? 0);

if (!$workerId) {
    http_response_code(422);
    echo json_encode(['success' => false, 'error' => 'Worker id is required.']);
    exit;
}

try {
    $pdo = getDB();

    $wRow = $pdo->prepare("SELECT * FROM workers WHERE id = ?");
    $wRow->execute([$workerId]);
    $worker = $wRow->fetch();

    if (!$worker) {
        http_response_code(404);
        echo json_encode(['success' => false, 'error' => 'Worker not found.']);
        exit;
    }

    $contactId = (int)$worker['contact_id'];
    $pdo->beginTransaction();

    $contactFields = ['first_name', 'last_name', 'email', 'mobile', 'phone', 'address'];
    $set = []; $params = [];
    foreach ($contactFields as $f) {
        if (array_key_exists($f, $body)) { $set[] = "$f = ?"; $params[] = $body[$f]; }
    }
    if ($set) {
        $params[] = $contactId;
        $pdo->prepare("UPDATE contacts SET " . implode(', ', $set) . " WHERE id = ?")->execute($params);
    }

    if (isset($body['specialization_id'])) {
        $pdo->prepare(
            "INSERT INTO contact_workers (contact_id, specialization_id) VALUES (?, ?)
             ON DUPLICATE KEY UPDATE specialization_id = VALUES(specialization_id)"
        )->execute([$contactId, (int)$body['specialization_id']]);
    }

    if (isset($body['username'])) {
        $newUsername = trim($body['username']);
        $chk = $pdo->prepare("SELECT id FROM workers WHERE username = ? AND id != ?");
        $chk->execute([$newUsername, $workerId]);
        if ($chk->fetch()) {
            $pdo->rollBack();
            http_response_code(409);
            echo json_encode(['success' => false, 'error' => 'Username already taken.']);
            exit;
        }
        $pdo->prepare("UPDATE workers SET username = ? WHERE id = ?")->execute([$newUsername, $workerId]);
    }

    if (isset($body['status_id'])) {
        $pdo->prepare("UPDATE workers SET status_id = ? WHERE id = ?")->execute([(int)$body['status_id'], $workerId]);
    }

    $pdo->commit();

    $view = $pdo->prepare("SELECT * FROM v_workers_full WHERE id = ?");
    $view->execute([$workerId]);
    echo json_encode(['success' => true, 'worker' => $view->fetch()]);
} catch (PDOException $e) {
    $pdo->rollBack();
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Database error.', 'detail' => $e->getMessage()]);
}