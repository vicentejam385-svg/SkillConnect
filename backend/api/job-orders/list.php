<?php
require_once __DIR__ . '/../../cors.php';
require_once __DIR__ . '/../../config/db.php';
require_once __DIR__ . '/../../middleware/jwt.php';

handleCors();
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method not allowed.']);
    exit;
}

requireAuth();

try {
    $pdo = getDB();

    $search  = trim($_GET['search'] ?? '');
    $status  = trim($_GET['status'] ?? '');
    $page    = max(1, (int)($_GET['page'] ?? 1));
    $perPage = min(100, max(1, (int)($_GET['per_page'] ?? 20)));
    $offset  = ($page - 1) * $perPage;

    $where  = ['1=1'];
    $params = [];

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
                CONCAT(c.first_name,' ',c.last_name) AS client_name,
                c.user_code AS client_code,
                s.label AS status,
                ct.name AS contract_type,
                i.inquiry_code,
                sc.schedule_code
         $from
         ORDER BY jo.id DESC LIMIT $perPage OFFSET $offset"
    );
    $dataStmt->execute($params);

    echo json_encode([
        'success'    => true,
        'job_orders' => $dataStmt->fetchAll(),
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