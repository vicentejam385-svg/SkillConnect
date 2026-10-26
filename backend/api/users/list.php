<?php
// api/users/list.php — list admin users (new schema: users + roles + statuses)
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
if (($auth['role'] ?? '') !== 'super_admin') {
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'Access denied.']);
    exit;
}

try {
    $pdo  = getDB();
    $stmt = $pdo->query("
        SELECT
            u.id,
            u.user_code,
            u.user_code AS admin_code,
            TRIM(CONCAT(u.first_name, ' ', u.last_name, ' ', COALESCE(u.suffix, ''))) AS name,
            u.first_name,
            u.last_name,
            u.username,
            u.email,
            u.mobile,
            u.type,
            r.role AS admin_role,
            u.status_id,
            s.label AS status,
            u.created_at,
            u.updated_at
        FROM users u
        LEFT JOIN statuses s ON s.id = u.status_id
        INNER JOIN roles   r ON r.user_id = u.id
        WHERE r.role <> 'superadmin'
        ORDER BY u.id ASC
    ");
    echo json_encode(['success' => true, 'users' => $stmt->fetchAll(PDO::FETCH_ASSOC)]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Database error.', 'detail' => $e->getMessage()]);
}