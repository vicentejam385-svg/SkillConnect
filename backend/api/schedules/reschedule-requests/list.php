<?php
require_once __DIR__ . '/../../../cors.php';
require_once __DIR__ . '/../../../config/db.php';
require_once __DIR__ . '/../../../middleware/jwt.php';

handleCors();
header('Content-Type: application/json');

$auth = requireAuth();

try {
    $pdo = getDB();
    $status = $_GET['status'] ?? 'pending';

    $where  = $status !== 'all' ? 'WHERE rr.status = :status' : '';
    $params = $status !== 'all' ? [':status' => $status] : [];

    $stmt = $pdo->prepare("
        SELECT
            rr.id,
            rr.schedule_id,
            s.schedule_code,
            rr.requested_by_user_id,
            rr.requested_by_user_id AS requested_by_contact_id,
            CONCAT(u.first_name, ' ', u.last_name) AS worker_name,
            rr.new_start_time,
            rr.new_end_time,
            rr.reason,
            rr.status,
            rr.reviewed_at,
            rr.created_at,
            s.start_time  AS current_start_time,
            s.end_time    AS current_end_time,
            s.description AS schedule_description
        FROM reschedule_requests rr
        LEFT JOIN schedules s ON s.id = rr.schedule_id
        LEFT JOIN users     u ON u.id = rr.requested_by_user_id
        $where
        ORDER BY rr.created_at DESC
    ");
    $stmt->execute($params);
    $requests = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode(['success' => true, 'requests' => $requests]);

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}