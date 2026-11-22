<?php
// backend/api/schedules/reschedule-requests/list.php
// Admin: workers' requests to move a site visit.   GET ?status=pending|approved|rejected|all
require_once __DIR__ . '/../../../cors.php';
require_once __DIR__ . '/../../../config/db.php';
require_once __DIR__ . '/../../../middleware/jwt.php';
require_once __DIR__ . '/../../../helpers/site-visits.php';

handleCors();
header('Content-Type: application/json');

requireAdminAccess();

try {
    $pdo    = getDB();
    $status = $_GET['status'] ?? 'pending';
    if (!in_array($status, ['pending', 'approved', 'rejected', 'all'], true)) $status = 'pending';

    $where  = $status !== 'all' ? 'WHERE rr.status = ?' : '';
    $params = $status !== 'all' ? [$status] : [];

    $stmt = $pdo->prepare("
        SELECT rr.id, rr.schedule_id, rr.requested_by_user_id,
               rr.requested_by_user_id AS requested_by_contact_id,
               TRIM(CONCAT(COALESCE(u.first_name,''),' ',COALESCE(u.last_name,''))) AS worker_name,
               rr.new_start_time, rr.new_end_time, rr.reason, rr.status, rr.reviewed_at, rr.created_at,
               s.schedule_code, s.visit_type,
               s.start_time  AS current_start_time,
               s.end_time    AS current_end_time,
               s.description AS schedule_description,
               jo.job_order_code,
               TRIM(CONCAT(COALESCE(c.first_name,''),' ',COALESCE(c.last_name,''))) AS client_name
        FROM reschedule_requests rr
        LEFT JOIN schedules  s  ON s.id  = rr.schedule_id
        LEFT JOIN users      u  ON u.id  = rr.requested_by_user_id
        LEFT JOIN job_orders jo ON jo.id = s.job_order_id
        LEFT JOIN users      c  ON c.id  = COALESCE(s.client_user_id, jo.client_user_id)
        $where
        ORDER BY rr.created_at DESC
        LIMIT 200
    ");
    $stmt->execute($params);
    $requests = $stmt->fetchAll(PDO::FETCH_ASSOC);
    foreach ($requests as &$r) $r['visit_label'] = svTypeLabel($r['visit_type']);
    unset($r);

    echo json_encode(['success' => true, 'requests' => $requests]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Database error.', 'detail' => $e->getMessage()]);
}