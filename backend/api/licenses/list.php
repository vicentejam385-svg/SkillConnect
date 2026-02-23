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

    $contactId   = (int)($_GET['contact_id']   ?? 0);
    $expiredOnly = !empty($_GET['expired_only']);
    $search      = $_GET['search']  ?? '';
    $page        = max(1, (int)($_GET['page']     ?? 1));
    $perPage     = min(100, max(1, (int)($_GET['per_page'] ?? 20)));
    $offset      = ($page - 1) * $perPage;

    if ($expiredOnly) {
        $where = ['1=1']; $params = [];
        if ($contactId) { $where[] = 'license_id IN (SELECT id FROM licenses WHERE contact_id = ?)'; $params[] = $contactId; }
        if ($search) {
            $like = "%$search%"; $where[] = '(contact_name LIKE ? OR document_name LIKE ?)';
            $params = array_merge($params, [$like, $like]);
        }
        $whereStr  = implode(' AND ', $where);
        $countStmt = $pdo->prepare("SELECT COUNT(*) FROM v_expired_licenses WHERE $whereStr");
        $countStmt->execute($params);
        $total    = (int)$countStmt->fetchColumn();
        $dataStmt = $pdo->prepare("SELECT * FROM v_expired_licenses WHERE $whereStr ORDER BY expiry_date ASC LIMIT ? OFFSET ?");
        $dataStmt->execute(array_merge($params, [$perPage, $offset]));
    } else {
        $where = ['1=1']; $params = [];
        if ($contactId) { $where[] = 'l.contact_id = ?'; $params[] = $contactId; }
        if ($search) {
            $like = "%$search%";
            $where[] = "(CONCAT(c.first_name,' ',c.last_name) LIKE ? OR l.document_name LIKE ?)";
            $params  = array_merge($params, [$like, $like]);
        }
        $whereStr  = implode(' AND ', $where);
        $base      = "FROM licenses l JOIN contacts c ON c.id = l.contact_id WHERE $whereStr";
        $countStmt = $pdo->prepare("SELECT COUNT(*) $base");
        $countStmt->execute($params);
        $total    = (int)$countStmt->fetchColumn();
        $dataStmt = $pdo->prepare(
            "SELECT l.*, c.contact_code, CONCAT(c.first_name,' ',c.last_name) AS contact_name,
                    c.type AS contact_type, c.mobile, c.email $base ORDER BY l.expiry_date DESC LIMIT ? OFFSET ?"
        );
        $dataStmt->execute(array_merge($params, [$perPage, $offset]));
    }

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