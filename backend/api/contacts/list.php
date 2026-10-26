<?php
// api/contacts/list.php — "contacts" are now users of type worker/client
require_once __DIR__ . '/../../cors.php';
require_once __DIR__ . '/../../middleware/jwt.php';
require_once __DIR__ . '/../../config/db.php';

handleCors();
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method not allowed.']);
    exit;
}

$auth    = requireAuth();
$isAdmin = isAdminUser($auth);

try {
    $pdo = getDB();

    $type    = $_GET['type']   ?? '';
    $search  = $_GET['search'] ?? '';
    $page    = max(1, (int)($_GET['page']     ?? 1));
    $perPage = min(200, max(1, (int)($_GET['per_page'] ?? 100)));
    $offset  = ($page - 1) * $perPage;

    // Replaces the old v_contacts_full view. Same column names as before where possible.
    // organisation_type has no equivalent in the new schema, so it is returned as NULL.
    $base = "
        SELECT
            u.id,
            u.user_code,
            u.user_code AS contact_code,
            TRIM(CONCAT(u.first_name, ' ', u.last_name, ' ', COALESCE(u.suffix, ''))) AS full_name,
            u.first_name, u.last_name, u.suffix,
            u.address, u.phone, u.mobile, u.email,
            u.type,
            IF(r.id IS NULL, 0, 1) AS is_admin,
            NULL                   AS organisation_type,
            sp.name                AS specialization,
            u.status_id,
            s.label                AS status,
            lic.latest_license_expiry,
            CASE
                WHEN lic.latest_license_expiry IS NULL THEN 'No License'
                WHEN lic.latest_license_expiry < CURDATE() THEN 'Expired'
                WHEN lic.latest_license_expiry <= DATE_ADD(CURDATE(), INTERVAL 30 DAY) THEN 'Expiring Soon'
                ELSE 'Valid'
            END AS license_status
        FROM users u
        LEFT JOIN statuses        s   ON s.id  = u.status_id
        LEFT JOIN specializations sp  ON sp.id = u.specialization_id
        LEFT JOIN roles           r   ON r.user_id = u.id
        LEFT JOIN (
            SELECT user_id, MAX(expiry_date) AS latest_license_expiry
            FROM licenses GROUP BY user_id
        ) lic ON lic.user_id = u.id
        WHERE u.type IN ('worker', 'client')
    ";

    $where  = ['1=1'];
    $params = [];

    // Non-admins (clients/workers) can only see their own record
    if (!$isAdmin) {
        $where[]  = 'id = ?';
        $params[] = (int)($auth['sub'] ?? 0);
    }

    if (in_array($type, ['worker', 'client'], true)) {
        $where[]  = 'type = ?';
        $params[] = $type;
    }

    if ($search) {
        $like    = "%$search%";
        $where[] = '(full_name LIKE ? OR email LIKE ? OR mobile LIKE ? OR contact_code LIKE ?)';
        $params  = array_merge($params, [$like, $like, $like, $like]);
    }
    $whereStr = implode(' AND ', $where);

    $countStmt = $pdo->prepare("SELECT COUNT(*) FROM ($base) c WHERE $whereStr");
    $countStmt->execute($params);
    $total = (int)$countStmt->fetchColumn();

    // ints are already sanitised above, safe to inline (bound strings break LIMIT with native prepares)
    $stmt = $pdo->prepare("SELECT * FROM ($base) c WHERE $whereStr ORDER BY id ASC LIMIT $perPage OFFSET $offset");
    $stmt->execute($params);

    echo json_encode([
        'success'    => true,
        'contacts'   => $stmt->fetchAll(),
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