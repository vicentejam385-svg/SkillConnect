<?php
// api/workers/list.php — list workers (new schema: users WHERE type = 'worker')
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

    // Replaces the old v_workers_full view. Column names are kept
    // (worker_code, full_name, specialization, status) so the frontend keeps working.
    $base = "
        SELECT
            u.id,
            u.user_code,
            u.user_code AS worker_code,
            TRIM(CONCAT(u.first_name, ' ', u.last_name, ' ', COALESCE(u.suffix, ''))) AS full_name,
            u.first_name,
            u.last_name,
            u.suffix,
            u.username,
            u.email,
            u.mobile,
            u.phone,
            u.address,
            u.specialization_id,
            sp.name  AS specialization,
            u.status_id,
            s.label  AS status,
            u.created_at,
            u.updated_at
        FROM users u
        LEFT JOIN statuses        s  ON s.id  = u.status_id
        LEFT JOIN specializations sp ON sp.id = u.specialization_id
        WHERE u.type = 'worker'
    ";

    $where  = ['1=1'];
    $params = [];

    if ($status)         { $where[] = 'status = ?';           $params[] = $status; }
    if ($specialization) { $where[] = 'specialization LIKE ?'; $params[] = "%$specialization%"; }
    if ($search) {
        $like    = "%$search%";
        $where[] = '(full_name LIKE ? OR username LIKE ? OR mobile LIKE ? OR email LIKE ? OR worker_code LIKE ?)';
        $params  = array_merge($params, [$like, $like, $like, $like, $like]);
    }
    $whereStr = implode(' AND ', $where);

    $countStmt = $pdo->prepare("SELECT COUNT(*) FROM ($base) w WHERE $whereStr");
    $countStmt->execute($params);
    $total = (int)$countStmt->fetchColumn();

    // $perPage / $offset are already cast to int, so inlining them is safe.
    // (Bound as strings they break LIMIT when PDO emulated prepares are off.)
    $dataStmt = $pdo->prepare(
        "SELECT * FROM ($base) w WHERE $whereStr ORDER BY id DESC LIMIT $perPage OFFSET $offset"
    );
    $dataStmt->execute($params);

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