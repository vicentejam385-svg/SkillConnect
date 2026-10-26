<?php
// backend/api/config/statuses.php
require_once __DIR__ . '/../../cors.php';
require_once __DIR__ . '/../../middleware/jwt.php';
require_once __DIR__ . '/../../config/db.php';

handleCors();
header('Content-Type: application/json');

$auth = requireAdminAccess();
$pdo  = getDB();

$entity = isset($_GET['entity']) ? $_GET['entity'] : null;

if ($entity) {
    $allowed = ['contact','worker','user','job_order','schedule','inquiry'];
    if (!in_array($entity, $allowed)) {
        http_response_code(422);
        echo json_encode(['error' => 'Invalid entity type.']);
        exit;
    }
    $stmt = $pdo->prepare("SELECT id, entity, label FROM statuses WHERE entity = ? ORDER BY id");
    $stmt->execute([$entity]);
} else {
    $stmt = $pdo->query("SELECT id, entity, label FROM statuses ORDER BY entity, id");
}

$statuses = $stmt->fetchAll(PDO::FETCH_ASSOC);
echo json_encode(['success' => true, 'statuses' => $statuses]);
