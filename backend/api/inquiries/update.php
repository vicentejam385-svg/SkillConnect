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

requireAdminAccess();

$body = json_decode(file_get_contents('php://input'), true) ?? [];
$id   = (int)($body['id'] ?? 0);

if (!$id) {
    http_response_code(422);
    echo json_encode(['success' => false, 'error' => 'Inquiry id is required.']);
    exit;
}

try {
    $pdo = getDB();

    $existing = $pdo->prepare("SELECT id FROM inquiries WHERE id = ?");
    $existing->execute([$id]);
    if (!$existing->fetch()) {
        http_response_code(404);
        echo json_encode(['success' => false, 'error' => 'Inquiry not found.']);
        exit;
    }

    // contact_id -> user_id in the new schema
    $fields = ['first_name', 'last_name', 'email', 'address', 'phone', 'mobile',
               'description', 'reason', 'status_id', 'user_id'];

    // Optional: allow the frontend to send a status label ("Won", "Lost", "New")
    if (!array_key_exists('status_id', $body) && !empty($body['status'])) {
        $s = $pdo->prepare("SELECT id FROM statuses WHERE entity = 'inquiry' AND label = ?");
        $s->execute([$body['status']]);
        $sid = $s->fetchColumn();
        if ($sid) $body['status_id'] = (int)$sid;
    }

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
    $pdo->prepare("UPDATE inquiries SET " . implode(', ', $set) . " WHERE id = ?")->execute($params);

    // Replaces the missing v_inquiries_full view
    $view = $pdo->prepare("
        SELECT i.*,
               CONCAT(i.first_name, ' ', i.last_name) AS full_name,
               s.label AS status
        FROM inquiries i
        LEFT JOIN statuses s ON s.id = i.status_id
        WHERE i.id = ?
    ");
    $view->execute([$id]);
    echo json_encode(['success' => true, 'inquiry' => $view->fetch(PDO::FETCH_ASSOC)]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Database error.', 'detail' => $e->getMessage()]);
}