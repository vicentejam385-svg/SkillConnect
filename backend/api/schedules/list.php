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
        if (ctype_digit($status)) { $where[] = 'sc.status_id = ?'; }
        else                      { $where[] = 's.label = ?'; }
        $params[] = $status;
    }
    if ($search !== '') {
        $like    = "%$search%";
        $where[] = "(CONCAT(w.first_name,' ',w.last_name) LIKE ?
                     OR CONCAT(c.first_name,' ',c.last_name) LIKE ?
                     OR sc.schedule_code LIKE ?
                     OR sc.description LIKE ?)";
        array_push($params, $like, $like, $like, $like);
    }

    $whereStr = implode(' AND ', $where);

    $from = "FROM schedules sc
             LEFT JOIN users w ON w.id = sc.worker_user_id
             LEFT JOIN users c ON c.id = sc.client_user_id
             LEFT JOIN statuses s ON s.id = sc.status_id
             WHERE $whereStr";

    $countStmt = $pdo->prepare("SELECT COUNT(*) $from");
    $countStmt->execute($params);
    $total = (int)$countStmt->fetchColumn();

    $dataStmt = $pdo->prepare(
        "SELECT sc.*,
                sc.worker_user_id AS worker_contact_id,
                sc.client_user_id AS client_contact_id,
                CONCAT(w.first_name,' ',w.last_name) AS worker_name,
                CONCAT(c.first_name,' ',c.last_name) AS client_name,
                s.label AS status
         $from
         ORDER BY sc.id DESC LIMIT $perPage OFFSET $offset"
    );
    $dataStmt->execute($params);

    echo json_encode([
        'success'    => true,
        'schedules'  => $dataStmt->fetchAll(),
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