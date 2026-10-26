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

$auth = requireAuth();
$authUser = $auth;

try {
    $pdo = getDB();

    $search  = trim($_GET['search'] ?? '');
    $status  = trim($_GET['status'] ?? '');
    $page    = max(1, (int)($_GET['page'] ?? 1));
    $perPage = min(100, max(1, (int)($_GET['per_page'] ?? 20)));
    $offset  = ($page - 1) * $perPage;

    $where  = ['1=1'];
    $params = [];

    // Admins see ALL inquiries. Clients only see their own.
    $isAdmin = isAdminUser($authUser);

    if (!$isAdmin) {
        $scopeUserId = 0;
        if (!empty($authUser['sub']))            $scopeUserId = (int)$authUser['sub'];
        elseif (!empty($authUser['user_id']))    $scopeUserId = (int)$authUser['user_id'];
        elseif (!empty($authUser['contact_id'])) $scopeUserId = (int)$authUser['contact_id'];

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
                s.label AS status
         $from
         ORDER BY i.id DESC LIMIT $perPage OFFSET $offset"
    );
    $dataStmt->execute($params);

    echo json_encode([
        'success'    => true,
        'inquiries'  => $dataStmt->fetchAll(),
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