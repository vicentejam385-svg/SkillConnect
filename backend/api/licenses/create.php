<?php
require_once __DIR__ . '/../../cors.php';
require_once __DIR__ . '/../../config/db.php';
require_once __DIR__ . '/../../middleware/jwt.php';
require_once __DIR__ . '/../../middleware/audit.php';

handleCors();
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
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

$isMultipart = str_contains($_SERVER['CONTENT_TYPE'] ?? '', 'multipart/form-data');

// Accept both user_id (new) and contact_id (old) from the frontend
if ($isMultipart) {
    $userId     = (int)($_POST['user_id'] ?? $_POST['contact_id'] ?? 0);
    $expiryDate = trim($_POST['expiry_date'] ?? '');
} else {
    $body       = json_decode(file_get_contents('php://input'), true) ?? [];
    $userId     = (int)($body['user_id'] ?? $body['contact_id'] ?? 0);
    $expiryDate = trim($body['expiry_date'] ?? '');
}

if ($role === 'worker') $userId = (int)$auth['sub'];

if (!$userId || !$expiryDate) {
    http_response_code(422);
    echo json_encode(['success' => false, 'error' => 'user_id and expiry_date are required.']);
    exit;
}

try {
    $pdo = getDB();
    $chk = $pdo->prepare("SELECT id, type, user_code, first_name, last_name FROM users WHERE id = ?");
    $chk->execute([$userId]);
    $owner = $chk->fetch();
    if (!$owner) {
        http_response_code(404);
        echo json_encode(['success' => false, 'error' => 'User not found.']);
        exit;
    }

    if ($isMultipart) {
        if (empty($_FILES['document']) || $_FILES['document']['error'] !== UPLOAD_ERR_OK) {
            http_response_code(422);
            echo json_encode(['success' => false, 'error' => 'Document file is required.']);
            exit;
        }
        $file  = $_FILES['document'];
        $finfo = new finfo(FILEINFO_MIME_TYPE);
        $mime  = $finfo->file($file['tmp_name']);

        // Extension comes from the real file type, not from the uploaded filename
        $allowed = ['application/pdf' => 'pdf', 'image/jpeg' => 'jpg', 'image/png' => 'png'];
        if (!isset($allowed[$mime])) {
            http_response_code(422);
            echo json_encode(['success' => false, 'error' => 'Only PDF, JPG, and PNG files are allowed.']);
            exit;
        }
        $uploadDir = __DIR__ . '/../../../uploads/licenses/';
        if (!is_dir($uploadDir)) mkdir($uploadDir, 0755, true);
        $storedName = uniqid('lic_', true) . '.' . $allowed[$mime];
        if (!move_uploaded_file($file['tmp_name'], $uploadDir . $storedName)) {
            http_response_code(500);
            echo json_encode(['success' => false, 'error' => 'Failed to save uploaded file.']);
            exit;
        }

        // Auto-increment document name: LIC0001, LIC0002...
        $countStmt = $pdo->prepare("SELECT COUNT(*) FROM licenses WHERE user_id = ?");
        $countStmt->execute([$userId]);
        $licCount     = (int)$countStmt->fetchColumn() + 1;
        $documentName = 'LIC' . str_pad($licCount, 4, '0', STR_PAD_LEFT);
        $filePath     = 'uploads/licenses/' . $storedName;
    } else {
        $documentName = $body['document_name'] ?? 'document';
        $filePath     = $body['file_path'] ?? '';
        if (!preg_match('#^uploads/licenses/[A-Za-z0-9._-]+$#', $filePath)) {
    http_response_code(422);
    echo json_encode(['success' => false, 'error' => 'Invalid file_path.']);
    exit;
}
        if (!$filePath) {
            http_response_code(422);
            echo json_encode(['success' => false, 'error' => 'file_path is required.']);
            exit;
        }
    }

    $pdo->prepare("INSERT INTO licenses (user_id, document_name, file_path, expiry_date) VALUES (?, ?, ?, ?)")
        ->execute([$userId, $documentName, $filePath, $expiryDate]);
    $licenseId = (int)$pdo->lastInsertId();

    $row = $pdo->prepare(
        "SELECT l.*, l.user_id AS contact_id,
                u.user_code AS contact_code,
                CONCAT(u.first_name,' ',u.last_name) AS contact_name
         FROM licenses l JOIN users u ON u.id = l.user_id WHERE l.id = ?"
    );
    $row->execute([$licenseId]);

    $ownerName = trim($owner['first_name'] . ' ' . $owner['last_name']);
    auditLog(array_merge(auditActor($auth), [
        'action'         => 'CREATE',
        'module'         => 'Licenses',
        'description'    => 'Uploaded license ' . $documentName . ' for ' . $owner['type'] . ' "' . $ownerName . '" (expires ' . $expiryDate . ')',
        'target_user_id' => $userId,
        'target_type'    => 'licenses',
        'target_id'      => $licenseId,
        'target_label'   => $documentName . ' — ' . $ownerName,
        'new_values'     => ['document' => $documentName, 'expiry_date' => $expiryDate],
    ]));

    http_response_code(201);
    echo json_encode(['success' => true, 'license' => $row->fetch()]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Database error.', 'detail' => $e->getMessage()]);
}