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

    $status         = $_GET['status']         ?? '';
    $specialization = $_GET['specialization'] ?? '';
    $search         = $_GET['search']         ?? '';
    $page           = max(1, (int)($_GET['page']     ?? 1));
    $perPage        = min(100, max(1, (int)($_GET['per_page'] ?? 20)));
    $offset         = ($page - 1) * $perPage;

    $where  = ['1=1'];
    $params = [];

    if ($status) { $where[] = 'status = ?'; $params[] = $status; }
    if ($specialization) { $where[] = 'specialization LIKE ?'; $params[] = "%$specialization%"; }
    if ($search) {
        $like    = "%$search%";
        $where[] = '(full_name LIKE ? OR username LIKE ? OR mobile LIKE ? OR email LIKE ? OR worker_code LIKE ?)';
        $params  = array_merge($params, [$like, $like, $like, $like, $like]);
    }

    $whereStr  = implode(' AND ', $where);

    $countStmt = $pdo->prepare("SELECT COUNT(*) FROM v_workers_full WHERE $whereStr");
    $countStmt->execute($params);
    $total = (int)$countStmt->fetchColumn();

    $dataStmt = $pdo->prepare("SELECT * FROM v_workers_full WHERE $whereStr ORDER BY id DESC LIMIT ? OFFSET ?");
    $dataStmt->execute(array_merge($params, [$perPage, $offset]));

    echo json_encode([
        'success'    => true,
        'workers'    => $dataStmt->fetchAll(),
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