<?php
// backend/api/job-orders/list.php
//
// Admins see every job order.
// Workers see only the job orders assigned to them; clients only their own.
// Add ?mine=1 to always get only your own (used by the worker and customer pages,
// also for workers who have admin access).
require_once __DIR__ . '/../../cors.php';
require_once __DIR__ . '/../../config/db.php';
require_once __DIR__ . '/../../middleware/jwt.php';
require_once __DIR__ . '/../../helpers/job-order-status.php';
require_once __DIR__ . '/../../helpers/job-offers.php';

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

    $search  = trim($_GET['search'] ?? '');
    $status  = trim($_GET['status'] ?? '');
    $page    = max(1, (int)($_GET['page'] ?? 1));
    $perPage = min(500, max(1, (int)($_GET['per_page'] ?? 20)));
    $offset  = ($page - 1) * $perPage;
    $mine    = !empty($_GET['mine']);

    $where  = ['1=1'];
    $params = [];

    // ── Who can see what
    $isAdmin = isAdminUser($auth);
    if ($mine || !$isAdmin) {
        if ($role === 'worker') {
            $where[] = 'jo.worker_user_id = ?'; $params[] = $uid;
        } elseif ($role === 'client') {
            $where[] = 'jo.client_user_id = ?'; $params[] = $uid;
        } elseif (!$isAdmin) {
            http_response_code(403);
            echo json_encode(['success' => false, 'error' => 'Not allowed.']);
            exit;
        }
    }

    if ($status !== '') {
        if (ctype_digit($status)) { $where[] = 'jo.status_id = ?'; }
        else                      { $where[] = 's.label = ?'; }
        $params[] = $status;
    }
    if ($search !== '') {
        $like    = "%$search%";
        $where[] = "(jo.job_order_code LIKE ?
                     OR CONCAT(w.first_name,' ',w.last_name) LIKE ?
                     OR CONCAT(c.first_name,' ',c.last_name) LIKE ?
                     OR jo.description LIKE ?)";
        array_push($params, $like, $like, $like, $like);
    }

    $whereStr = implode(' AND ', $where);

    $from = "FROM job_orders jo
             LEFT JOIN users w  ON w.id  = jo.worker_user_id
             LEFT JOIN users c  ON c.id  = jo.client_user_id
             LEFT JOIN statuses s ON s.id = jo.status_id
             LEFT JOIN contract_types ct ON ct.id = jo.contract_type_id
             LEFT JOIN inquiries i ON i.id = jo.inquiry_id
             LEFT JOIN schedules sc ON sc.id = jo.schedule_id
             LEFT JOIN job_order_progress_photos fp ON fp.id = jo.finish_photo_id
             -- Service of the job order (from the inquiry, else the description)
             -- and its suggested contract
             LEFT JOIN specializations sp ON sp.name = COALESCE(NULLIF(i.reason, ''), jo.description)
             LEFT JOIN contract_types dct ON dct.id = sp.default_contract_type_id
             WHERE $whereStr";

    $countStmt = $pdo->prepare("SELECT COUNT(*) $from");
    $countStmt->execute($params);
    $total = (int)$countStmt->fetchColumn();

    $dataStmt = $pdo->prepare(
        "SELECT jo.*,
                jo.worker_user_id AS worker_contact_id,
                jo.client_user_id AS client_contact_id,
                CONCAT(w.first_name,' ',w.last_name) AS worker_name,
                w.user_code AS worker_code,
                w.mobile AS worker_mobile,
                CONCAT(c.first_name,' ',c.last_name) AS client_name,
                c.user_code AS client_code,
                c.mobile AS client_mobile,
                COALESCE(NULLIF(c.address, ''), i.address) AS client_address,
                s.label AS status,
                ct.name AS contract_type,
                i.inquiry_code,
                sc.schedule_code,
                sp.name AS service,
                sp.default_contract_type_id,
                dct.name AS default_contract_type,
                fp.file_path AS finish_photo_path,
                (SELECT COUNT(*) FROM job_order_progress_photos p WHERE p.job_order_id = jo.id) AS photos_count,
                (SELECT MAX(p.upload_date) FROM job_order_progress_photos p WHERE p.job_order_id = jo.id) AS last_photo_date,
                -- Ocular visit: '' = none, else '<status id>:<whose turn to answer the date>'
                COALESCE((SELECT CONCAT(v.status_id, ':', COALESCE(v.prop_turn, ''))
                            FROM schedules v
                           WHERE v.job_order_id = jo.id AND v.visit_type = 'ocular' AND v.status_id IN (11, 12, 13, 14)
                           ORDER BY v.id DESC LIMIT 1), '') AS ocular_state,
                -- Job offers: how many workers got it and how many said Not interested
                (SELECT COUNT(*) FROM worker_inbox m
                  WHERE m.job_order_id = jo.id AND m.type = 'job_offer') AS offers_sent,
                (SELECT COUNT(*) FROM worker_inbox m
                  WHERE m.job_order_id = jo.id AND m.type = 'job_offer' AND m.response = 'declined') AS offers_declined
         $from
         ORDER BY jo.id DESC LIMIT $perPage OFFSET $offset"
    );
    $dataStmt->execute($params);
    $jobOrders = $dataStmt->fetchAll(PDO::FETCH_ASSOC);

    $today = jobOrderToday();
    foreach ($jobOrders as &$jo) {
        $st = jobOfferState($jo);
        $jo['offer_state']      = $st['state'];
        $jo['offer_expires_at'] = $st['expires_at'];
        $jo['offer_can_assign'] = $st['can_assign'];
        $jo['flags']            = jobOrderFlags($jo, $today);

        // Offers are only the admin's business
        if (!$isAdmin || $mine) {
            unset($jo['offers_sent'], $jo['offers_declined'], $jo['offer_state'],
                  $jo['offer_expires_at'], $jo['offer_can_assign']);
        }
    }
    unset($jo);

    // Suggested contract for every service (used by the New job order form)
    $serviceDefaults = $isAdmin ? $pdo->query(
        "SELECT sp.name AS service, sp.default_contract_type_id, ct.name AS default_contract_type
         FROM specializations sp
         LEFT JOIN contract_types ct ON ct.id = sp.default_contract_type_id
         ORDER BY sp.name"
    )->fetchAll(PDO::FETCH_ASSOC) : [];

    echo json_encode([
        'success'          => true,
        'service_defaults' => $serviceDefaults,
        'job_orders'       => $jobOrders,
        'server_now'       => jobOfferNow(),
        'today'            => $today,
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