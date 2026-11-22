<?php
// backend/api/inquiries/list.php
// Admins see all inquiries; clients only their own.   ?source=online|walk_in to filter.
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

$auth = requireAuth();

try {
    $pdo = getDB();

    $search  = trim($_GET['search'] ?? '');
    $status  = trim($_GET['status'] ?? '');
    $source  = trim($_GET['source'] ?? '');
    $page    = max(1, (int)($_GET['page'] ?? 1));
    $perPage = min(500, max(1, (int)($_GET['per_page'] ?? 20)));
    $offset  = ($page - 1) * $perPage;

    $where  = ['1=1'];
    $params = [];

    // Admins see ALL inquiries. Clients only see their own.
    if (!isAdminUser($auth)) {
        $scopeUserId = (int)($auth['sub'] ?? 0);
        if (!$scopeUserId) {
            echo json_encode([
                'success'    => true,
                'inquiries'  => [],
                'pagination' => ['total' => 0, 'page' => 1, 'per_page' => $perPage, 'pages' => 0],
            ]);
            exit;
        }
        $where[]  = 'i.user_id = ?';
        $params[] = $scopeUserId;
    }

    if ($status !== '') {
        if (ctype_digit($status)) { $where[] = 'i.status_id = ?'; }
        else                      { $where[] = 's.label = ?'; }
        $params[] = $status;
    }
    if (in_array($source, ['online', 'walk_in'], true)) {
        $where[]  = 'i.source = ?';
        $params[] = $source;
    }
    if ($search !== '') {
        $like    = "%$search%";
        $where[] = "(CONCAT(i.first_name,' ',i.last_name) LIKE ? OR i.email LIKE ? OR i.mobile LIKE ? OR i.inquiry_code LIKE ?)";
        array_push($params, $like, $like, $like, $like);
    }

    $whereStr = implode(' AND ', $where);
    $from     = "FROM inquiries i LEFT JOIN statuses s ON s.id = i.status_id WHERE $whereStr";

    $countStmt = $pdo->prepare("SELECT COUNT(*) $from");
    $countStmt->execute($params);
    $total = (int)$countStmt->fetchColumn();

    // $perPage and $offset are already clamped to ints above, safe to inline.
    $dataStmt = $pdo->prepare(
        "SELECT i.*,
                i.user_id AS contact_id,
                CONCAT(i.first_name,' ',i.last_name) AS full_name,
                s.label AS status,
                (SELECT jo.job_order_code FROM job_orders jo WHERE jo.inquiry_id = i.id LIMIT 1) AS job_order_code
         $from
         ORDER BY i.id DESC LIMIT $perPage OFFSET $offset"
    );
    $dataStmt->execute($params);

    echo json_encode([
        'success'    => true,
        'inquiries'  => $dataStmt->fetchAll(PDO::FETCH_ASSOC),
        'pagination' => [
            'total'    => $total,
            'page'     => $page,
            'per_page' => $perPage,
            'pages'    => (int)ceil($total / $perPage),
        ],
    ]);
} catch (PDOException $e) {
    http_response_code(500);
    error_log($e->getMessage());
    echo json_encode(['success' => false, 'error' => 'Database error.']);
}