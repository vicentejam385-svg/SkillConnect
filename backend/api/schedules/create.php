<?php
// backend/api/schedules/create.php
require_once __DIR__ . '/../../cors.php';
require_once __DIR__ . '/../../middleware/jwt.php';
require_once __DIR__ . '/../../config/db.php';

handleCors();
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method not allowed.']);
    exit;
}

$auth = requireAuth();
$pdo  = getDB();
$data = json_decode(file_get_contents('php://input'), true) ?? [];

// Use given status only if it is a real status for this entity, else use the default
function resolveStatus(PDO $pdo, $given, string $entity, int $default): int {
    if (empty($given)) return $default;
    $s = $pdo->prepare('SELECT id FROM statuses WHERE id = ? AND entity = ?');
    $s->execute([(int)$given, $entity]);
    return $s->fetchColumn() ? (int)$given : $default;
}

$required = [
    'start_time' => 'Start time',
    'end_time'   => 'End time',
];
foreach ($required as $field => $label) {
    if (empty(trim($data[$field] ?? ''))) {
        http_response_code(422);
        echo json_encode(['success' => false, 'error' => "$label is required."]);
        exit;
    }
}

if ($data['start_time'] >= $data['end_time']) {
    http_response_code(422);
    echo json_encode(['success' => false, 'error' => 'End time must be after start time.']);
    exit;
}

// Accept both the new (user) and old (contact) field names from the frontend
$workerId = !empty($data['worker_user_id']) ? (int)$data['worker_user_id']
          : (!empty($data['worker_contact_id']) ? (int)$data['worker_contact_id'] : null);
$clientId = !empty($data['client_user_id']) ? (int)$data['client_user_id']
          : (!empty($data['client_contact_id']) ? (int)$data['client_contact_id'] : null);

try {
    // schedule_code (SCHED0001...) is set automatically by the database trigger
    $stmt = $pdo->prepare("
        INSERT INTO schedules (worker_user_id, client_user_id, start_time, end_time, description, status_id)
        VALUES (:worker, :client, :start, :end, :descr, :status)
    ");
    $stmt->execute([
        ':worker' => $workerId,
        ':client' => $clientId,
        ':start'  => $data['start_time'],
        ':end'    => $data['end_time'],
        ':descr'  => trim($data['description'] ?? ''),
        ':status' => resolveStatus($pdo, $data['status_id'] ?? null, 'schedule', 11), // 11 = Pending
    ]);

    $newId = (int)$pdo->lastInsertId();

    $rowStmt = $pdo->prepare(
        "SELECT sc.*,
                sc.worker_user_id AS worker_contact_id,
                sc.client_user_id AS client_contact_id,
                CONCAT(w.first_name,' ',w.last_name) AS worker_name,
                CONCAT(c.first_name,' ',c.last_name) AS client_name,
                s.label AS status
         FROM schedules sc
         LEFT JOIN users w ON w.id = sc.worker_user_id
         LEFT JOIN users c ON c.id = sc.client_user_id
         LEFT JOIN statuses s ON s.id = sc.status_id
         WHERE sc.id = ?"
    );
    $rowStmt->execute([$newId]);

    http_response_code(201);
    echo json_encode([
        'success'  => true,
        'message'  => 'Schedule created.',
        'schedule' => $rowStmt->fetch(),
    ]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Database error.', 'detail' => $e->getMessage()]);
}