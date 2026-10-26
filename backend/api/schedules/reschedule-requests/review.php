<?php
require_once __DIR__ . '/../../../cors.php';
require_once __DIR__ . '/../../../config/db.php';
require_once __DIR__ . '/../../../middleware/jwt.php';

handleCors();
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method not allowed.']);
    exit;
}

requireAuth();

$body       = json_decode(file_get_contents('php://input'), true);
$request_id = isset($body['request_id']) ? (int)$body['request_id'] : 0;
$action     = isset($body['action'])     ? trim($body['action'])     : ''; // 'approve' | 'reject'

if (!$request_id)                              { echo json_encode(['success' => false, 'error' => 'request_id is required']); exit; }
if (!in_array($action, ['approve', 'reject'])) { echo json_encode(['success' => false, 'error' => 'action must be approve or reject']); exit; }

try {
    $pdo = getDB();

    // Fetch the request
    $stmt = $pdo->prepare('SELECT * FROM reschedule_requests WHERE id = ? LIMIT 1');
    $stmt->execute([$request_id]);
    $req = $stmt->fetch();

    if (!$req) { echo json_encode(['success' => false, 'error' => 'Request not found']); exit; }
    if ($req['status'] !== 'pending') {
        echo json_encode(['success' => false, 'error' => 'Request has already been reviewed']); exit;
    }

    $new_status = $action === 'approve' ? 'approved' : 'rejected';

    // Update the reschedule_request status
    $stmt = $pdo->prepare('
        UPDATE reschedule_requests
        SET status = :status, reviewed_at = NOW()
        WHERE id = :id
    ');
    $stmt->execute([':status' => $new_status, ':id' => $request_id]);

    // If approved — update the actual schedule times
    if ($action === 'approve') {
        $stmt = $pdo->prepare('
            UPDATE schedules
            SET start_time = :start_time, end_time = :end_time
            WHERE id = :schedule_id
        ');
        $stmt->execute([
            ':start_time'   => $req['new_start_time'],
            ':end_time'     => $req['new_end_time'],
            ':schedule_id'  => $req['schedule_id'],
        ]);
    }

    echo json_encode([
        'success' => true,
        'message' => $action === 'approve'
            ? 'Schedule updated and request approved.'
            : 'Request rejected.',
        'status'  => $new_status,
    ]);

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}