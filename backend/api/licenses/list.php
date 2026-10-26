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

try {
    $pdo = getDB();

    // Accept both user_id (new) and contact_id (old) from the frontend
    $userId      = (int)($_GET['user_id'] ?? $_GET['contact_id'] ?? 0);
    $expiredOnly = !empty($_GET['expired_only']);
    $search      = trim($_GET['search'] ?? '');
    $page        = max(1, (int)($_GET['page'] ?? 1));
    $perPage     = min(100, max(1, (int)($_GET['per_page'] ?? 20)));
    $offset      = ($page - 1) * $perPage;

    $where  = ['1=1'];
    $params = [];

    // A plain worker can only ever see their own licenses.
    // Admins (and admin/worker accounts) can see all, or filter by user_id.
    if (($auth['role'] ?? '') === 'worker' && !isAdminUser($auth)) {
        $userId = (int)$auth['sub'];
    }

    if ($userId) { $where[] = 'l.user_id = ?'; $params[] = $userId; }
    if ($expiredOnly) { $where[] = 'l.expiry_date < CURDATE()'; }
    if ($search !== '') {
        $like    = "%$search%";
        $where[] = "(CONCAT(u.first_name,' ',u.last_name) LIKE ? OR l.document_name LIKE ?)";
        array_push($params, $like, $like);
    }

    $whereStr = implode(' AND ', $where);
    $from     = "FROM licenses l JOIN users u ON u.id = l.user_id WHERE $whereStr";
    $orderBy  = $expiredOnly ? 'l.expiry_date ASC' : 'l.expiry_date DESC';

    $countStmt = $pdo->prepare("SELECT COUNT(*) $from");
    $countStmt->execute($params);
    $total = (int)$countStmt->fetchColumn();

    $dataStmt = $pdo->prepare(
        "SELECT l.*,
                l.id AS license_id,
                l.user_id AS contact_id,
                u.user_code AS contact_code,
                CONCAT(u.first_name,' ',u.last_name) AS contact_name,
                u.type AS contact_type,
                u.mobile, u.email,
                DATEDIFF(CURDATE(), l.expiry_date) AS days_expired
         $from
         ORDER BY $orderBy LIMIT $perPage OFFSET $offset"
    );
    $dataStmt->execute($params);

    echo json_encode([
        'success'    => true,
        'licenses'   => $dataStmt->fetchAll(),
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