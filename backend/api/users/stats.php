<?php
// api/users/stats.php — dashboard counts (new schema: everything lives in users)
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
    $pdo = getDB();

    $countType = $pdo->prepare("SELECT COUNT(*) FROM users WHERE type = ?");

    // Admin users = anyone with admin access (roles row), excluding the superadmin
    $adminCount = (int)$pdo->query(
        "SELECT COUNT(*) FROM roles WHERE role <> 'superadmin'"
    )->fetchColumn();

    $countType->execute(['worker']);
    $workerCount = (int)$countType->fetchColumn();

    $countType->execute(['client']);
    $contactCount = (int)$countType->fetchColumn();

    // Licenses table replaces the old v_expired_licenses view
    $expiredCount = (int)$pdo->query(
        "SELECT COUNT(*) FROM licenses WHERE expiry_date < CURDATE()"
    )->fetchColumn();

    echo json_encode([
        'success'          => true,
        'admin_users'      => $adminCount,
        'workers'          => $workerCount,
        'contacts'         => $contactCount,
        'expired_licenses' => $expiredCount,
    ]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Database error.', 'detail' => $e->getMessage()]);
}