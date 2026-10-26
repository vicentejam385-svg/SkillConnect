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

$user = requireAuth();

$body           = json_decode(file_get_contents('php://input'), true);
$schedule_id    = isset($body['schedule_id'])    ? (int)$body['schedule_id']    : 0;
$schedule_code  = isset($body['schedule_code'])  ? trim($body['schedule_code']) : '';
$new_start_time = isset($body['new_start_time']) ? trim($body['new_start_time']): '';
$new_end_time   = isset($body['new_end_time'])   ? trim($body['new_end_time'])  : '';
$reason         = isset($body['reason'])         ? trim($body['reason'])        : '';

if (!$schedule_id)    { echo json_encode(['success' => false, 'error' => 'schedule_id is required']);    exit; }
if (!$new_start_time) { echo json_encode(['success' => false, 'error' => 'new_start_time is required']); exit; }
if (!$new_end_time)   { echo json_encode(['success' => false, 'error' => 'new_end_time is required']);   exit; }
if (!$reason)         { echo json_encode(['success' => false, 'error' => 'reason is required']);         exit; }

$new_start_time = str_replace('T', ' ', $new_start_time);
$new_end_time   = str_replace('T', ' ', $new_end_time);

if (strtotime($new_start_time) === false) { echo json_encode(['success' => false, 'error' => 'Invalid new_start_time']); exit; }
if (strtotime($new_end_time)   === false) { echo json_encode(['success' => false, 'error' => 'Invalid new_end_time']);   exit; }
if (strtotime($new_end_time) <= strtotime($new_start_time)) {
    echo json_encode(['success' => false, 'error' => 'End time must be after start time']); exit;
}

try {
    $pdo = getDB();

    // Verify schedule exists
    $stmt = $pdo->prepare('SELECT id FROM schedules WHERE id = ? LIMIT 1');
    $stmt->execute([$schedule_id]);
    if (!$stmt->fetch()) {
        echo json_encode(['success' => false, 'error' => 'Schedule not found']); exit;
    }

    // Get worker name — try contacts table directly
    $worker_name = $user['name'] ?? null;
    if (!$worker_name) {
        $stmt = $pdo->prepare("
            SELECT CONCAT(first_name, ' ', last_name) AS full_name 
            FROM contacts 
            WHERE id = ? LIMIT 1
        ");
        $stmt->execute([$user['sub']]);
        $w = $stmt->fetch();
        $worker_name = $w['full_name'] ?? ('Worker #' . ($user['sub'] ?? '?'));
    }

    $stmt = $pdo->prepare('
        INSERT INTO reschedule_requests
            (schedule_id, schedule_code, requested_by_contact_id, worker_name, new_start_time, new_end_time, reason, status)
        VALUES
            (:schedule_id, :schedule_code, :contact_id, :worker_name, :new_start_time, :new_end_time, :reason, "pending")
    ');
    $stmt->execute([
        ':schedule_id'    => $schedule_id,
        ':schedule_code'  => $schedule_code,
        ':contact_id'     => $user['sub'] ?? null,
        ':worker_name'    => $worker_name,
        ':new_start_time' => $new_start_time,
        ':new_end_time'   => $new_end_time,
        ':reason'         => $reason,
    ]);

    echo json_encode([
        'success'    => true,
        'message'    => 'Reschedule request submitted successfully',
        'request_id' => (int)$pdo->lastInsertId(),
    ]);

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Database error: ' . $e->getMessage()]);
}