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
if (($auth['type'] ?? '') !== 'super_admin') {
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'Access denied.']);
    exit;
}

try {
    $pdo = getDB();

    // Total active admin users (status_id = 7 = Active, or NULL treated as active for backward compat)
    $adminCount = (int)$pdo->query(
        "SELECT COUNT(*) FROM users WHERE status_id = 7 OR status_id IS NULL"
    )->fetchColumn();

    // Total workers
    $workerCount = (int)$pdo->query(
        "SELECT COUNT(*) FROM workers"
    )->fetchColumn();

    // Total contacts
    $contactCount = (int)$pdo->query(
        "SELECT COUNT(*) FROM contacts"
    )->fetchColumn();

    // Expired licenses (uses the view)
    $expiredCount = (int)$pdo->query(
        "SELECT COUNT(*) FROM v_expired_licenses"
    )->fetchColumn();

    echo json_encode([
        'success'       => true,
        'admin_users'   => $adminCount,
        'workers'       => $workerCount,
        'contacts'      => $contactCount,
        'expired_licenses' => $expiredCount,
    ]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Database error.', 'detail' => $e->getMessage()]);
}