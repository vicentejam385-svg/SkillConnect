<?php
require_once __DIR__ . '/../../cors.php';
require_once __DIR__ . '/../../config/db.php';
require_once __DIR__ . '/../../middleware/jwt.php';

handleCors();
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method not allowed.']);
    exit;
}

requireAuth();

$isMultipart = str_contains($_SERVER['CONTENT_TYPE'] ?? '', 'multipart/form-data');

if ($isMultipart) {
    $contactId  = (int)($_POST['contact_id']  ?? 0);
    $expiryDate = trim($_POST['expiry_date'] ?? '');
} else {
    $body       = json_decode(file_get_contents('php://input'), true);
    $contactId  = (int)($body['contact_id']  ?? 0);
    $expiryDate = trim($body['expiry_date'] ?? '');
}

if (!$contactId || !$expiryDate) {
    http_response_code(422);
    echo json_encode(['success' => false, 'error' => 'contact_id and expiry_date are required.']);
    exit;
}

try {
    $pdo = getDB();
    $chk = $pdo->prepare("SELECT id FROM contacts WHERE id = ?");
    $chk->execute([$contactId]);
    if (!$chk->fetch()) {
        http_response_code(404);
        echo json_encode(['success' => false, 'error' => 'Contact not found.']);
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
        if (!in_array($mime, ['application/pdf', 'image/jpeg', 'image/png'])) {
            http_response_code(422);
            echo json_encode(['success' => false, 'error' => 'Only PDF, JPG, and PNG files are allowed.']);
            exit;
        }
        $uploadDir = __DIR__ . '/../../../uploads/licenses/';
        if (!is_dir($uploadDir)) mkdir($uploadDir, 0755, true);
        $ext        = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
        $storedName = uniqid('lic_', true) . '.' . $ext;
        if (!move_uploaded_file($file['tmp_name'], $uploadDir . $storedName)) {
            http_response_code(500);
            echo json_encode(['success' => false, 'error' => 'Failed to save uploaded file.']);
            exit;
        }
        $documentName = $file['name'];
        $filePath     = 'uploads/licenses/' . $storedName;
    } else {
        $documentName = $body['document_name'] ?? 'document';
        $filePath     = $body['file_path'] ?? '';
        if (!$filePath) {
            http_response_code(422);
            echo json_encode(['success' => false, 'error' => 'file_path is required.']);
            exit;
        }
    }

    $pdo->prepare("INSERT INTO licenses (contact_id, document_name, file_path, expiry_date) VALUES (?, ?, ?, ?)")
        ->execute([$contactId, $documentName, $filePath, $expiryDate]);
    $licenseId = (int)$pdo->lastInsertId();

    $row = $pdo->prepare(
        "SELECT l.*, c.contact_code, CONCAT(c.first_name,' ',c.last_name) AS contact_name
         FROM licenses l JOIN contacts c ON c.id = l.contact_id WHERE l.id = ?"
    );
    $row->execute([$licenseId]);

    http_response_code(201);
    echo json_encode(['success' => true, 'license' => $row->fetch()]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Database error.', 'detail' => $e->getMessage()]);
}