<?php
// backend/api/schedules/list.php
// Site visits. Admins see all; workers only their own (also with ?mine=1).
require_once __DIR__ . '/../../cors.php';
require_once __DIR__ . '/../../config/db.php';
require_once __DIR__ . '/../../middleware/jwt.php';
require_once __DIR__ . '/../../helpers/site-visits.php';

handleCors();
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method not allowed.']);
    exit;
}

$auth = requireAuth();
$role = $auth['role'] ?? '';
$uid  = (int)($auth['sub'] ?? 0);

try {
    $pdo = getDB();

    $search   = trim($_GET['search'] ?? '');
    $status   = trim($_GET['status'] ?? '');
    $jobOrder = (int)($_GET['job_order_id'] ?? 0);
    $page     = max(1, (int)($_GET['page'] ?? 1));
    $perPage  = min(500, max(1, (int)($_GET['per_page'] ?? 20)));
    $offset   = ($page - 1) * $perPage;
    $mine     = !empty($_GET['mine']);

    $where  = ['1=1'];
    $params = [];

    $isAdmin = isAdminUser($auth);
    if ($mine || !$isAdmin) {
        if ($role === 'worker') { $where[] = 'sc.worker_user_id = ?'; $params[] = $uid; }
        else {
            http_response_code(403);
            echo json_encode(['success' => false, 'error' => 'Not allowed.']);
            exit;
        }
    }

    if ($status !== '') {
        if (ctype_digit($status)) { $where[] = 'sc.status_id = ?'; }
        else                      { $where[] = 's.label = ?'; }
        $params[] = $status;
    }
    if ($jobOrder) { $where[] = 'sc.job_order_id = ?'; $params[] = $jobOrder; }
    if ($search !== '') {
        $like    = "%$search%";
        $where[] = "(CONCAT(w.first_name,' ',w.last_name) LIKE ?
                     OR CONCAT(c.first_name,' ',c.last_name) LIKE ?
                     OR sc.schedule_code LIKE ?
                     OR jo.job_order_code LIKE ?
                     OR sc.description LIKE ?)";
        array_push($params, $like, $like, $like, $like, $like);
    }

    $whereStr = implode(' AND ', $where);

    $from = "FROM schedules sc
             LEFT JOIN users w       ON w.id  = sc.worker_user_id
             LEFT JOIN job_orders jo ON jo.id = sc.job_order_id
             LEFT JOIN users c       ON c.id  = COALESCE(sc.client_user_id, jo.client_user_id)
             LEFT JOIN statuses s    ON s.id  = sc.status_id
             LEFT JOIN statuses js   ON js.id = jo.status_id
             LEFT JOIN inquiries i   ON i.id  = jo.inquiry_id
             LEFT JOIN specializations sp ON sp.name = COALESCE(NULLIF(i.reason, ''), jo.description)
             WHERE $whereStr";

    $countStmt = $pdo->prepare("SELECT COUNT(*) $from");
    $countStmt->execute($params);
    $total = (int)$countStmt->fetchColumn();

    $dataStmt = $pdo->prepare(
        "SELECT sc.*,
                sc.worker_user_id AS worker_contact_id,
                COALESCE(sc.client_user_id, jo.client_user_id) AS client_contact_id,
                TRIM(CONCAT(COALESCE(w.first_name,''),' ',COALESCE(w.last_name,''))) AS worker_name,
                TRIM(CONCAT(COALESCE(c.first_name,''),' ',COALESCE(c.last_name,''))) AS client_name,
                c.mobile AS client_mobile,
                COALESCE(NULLIF(c.address, ''), i.address) AS address,
                s.label  AS status,
                jo.job_order_code,
                jo.status_id AS job_status_id,
                js.label AS job_status,
                sp.name  AS service,
                (SELECT COUNT(*) FROM reschedule_requests rr
                  WHERE rr.schedule_id = sc.id AND rr.status = 'pending') AS pending_requests
         $from
         ORDER BY sc.start_time DESC, sc.id DESC LIMIT $perPage OFFSET $offset"
    );
    $dataStmt->execute($params);
    $rows = $dataStmt->fetchAll(PDO::FETCH_ASSOC);
    foreach ($rows as &$r) {
        $r['visit_label'] = svTypeLabel($r['visit_type']);
    }
    unset($r);

    echo json_encode([
        'success'    => true,
        'schedules'  => $rows,
        'server_now' => jobOrderNow(),
        'pagination' => [
            'total'    => $total,
            'page'     => $page,
            'per_page' => $perPage,
            'pages'    => (int)ceil($total / $perPage),
        ],
    ]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Database error.', 'detail' => $e->getMessage()]);
}