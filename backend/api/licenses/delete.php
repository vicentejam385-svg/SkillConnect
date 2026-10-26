<?php
// backend/api/licenses/delete.php
require_once __DIR__ . '/../../cors.php';
require_once __DIR__ . '/../../config/db.php';
require_once __DIR__ . '/../../middleware/jwt.php';
require_once __DIR__ . '/../../middleware/audit.php';

handleCors();
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'DELETE') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method not allowed.']);
    exit;
}

$auth = requireAuth();
$role = $auth['role'] ?? '';
if (!in_array($role, ['admin', 'super_admin', 'worker'], true)) {
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'Not allowed.']);
    exit;
}

$body = json_decode(file_get_contents('php://input'), true);
$id   = (int)($body['id'] ?? $_GET['id'] ?? 0);

if (!$id) {
    http_response_code(422);
    echo json_encode(['success' => false, 'error' => 'License id is required.']);
    exit;
}

try {
    $pdo = getDB();

    $chk = $pdo->prepare("SELECT l.id, l.user_id, l.file_path, l.document_name, l.expiry_date,
                                 u.first_name, u.last_name, u.type AS owner_type
                          FROM licenses l JOIN users u ON u.id = l.user_id WHERE l.id = ?");
    $chk->execute([$id]);
    $license = $chk->fetch();

    if (!$license) {
        http_response_code(404);
        echo json_encode(['success' => false, 'error' => 'License not found.']);
        exit;
    }

    if ($role === 'worker' && (int)$license['user_id'] !== (int)$auth['sub']) {
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'Not your license.']);
    exit;
}

// Delete physical file only if it really lives inside uploads/licenses
if (!empty($license['file_path'])) {
    $baseDir  = realpath(__DIR__ . '/../../../uploads/licenses');
    $fullPath = realpath(__DIR__ . '/../../../' . $license['file_path']);
    if ($baseDir !== false && $fullPath !== false
        && strpos($fullPath, $baseDir . DIRECTORY_SEPARATOR) === 0
        && is_file($fullPath)) {
        @unlink($fullPath);
    }
}

    $pdo->prepare("DELETE FROM licenses WHERE id = ?")->execute([$id]);

    $ownerName = trim($license['first_name'] . ' ' . $license['last_name']);
    auditLog(array_merge(auditActor($auth), [
        'action'         => 'DELETE',
        'module'         => 'Licenses',
        'description'    => 'Deleted license ' . $license['document_name'] . ' of ' . $license['owner_type'] . ' "' . $ownerName . '"',
        'target_user_id' => (int)$license['user_id'],
        'target_type'    => 'licenses',
        'target_id'      => $id,
        'target_label'   => $license['document_name'] . ' — ' . $ownerName,
        'old_values'     => ['document' => $license['document_name'], 'expiry_date' => $license['expiry_date']],
    ]));

    echo json_encode(['success' => true, 'message' => 'License deleted.']);
} catch (PDOException $e) {
    http_response_code(500);
    error_log($e->getMessage());
    echo json_encode(['success' => false, 'error' => 'Database error.']);
}
