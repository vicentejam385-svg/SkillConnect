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
if (!in_array($auth['type'] ?? '', ['super_admin', 'admin'])) {
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'Access denied.']);
    exit;
}

try {
    $pdo  = getDB();
    $stmt = $pdo->query("
        SELECT id, contact_code, full_name, first_name, last_name,
               address, phone, mobile, email, type, is_admin,
               organisation_type, specialization, status,
               latest_license_expiry, license_status
        FROM v_contacts_full
        ORDER BY id ASC
    ");
    echo json_encode(['success' => true, 'contacts' => $stmt->fetchAll()]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Database error.', 'detail' => $e->getMessage()]);
}