<?php
require_once __DIR__ . '/../../middleware/jwt.php';
requireAdminAccess();

header('Access-Control-Allow-Origin: *');
header('Content-Type: application/json');

$file_path = $_GET['path'] ?? '';
if (!$file_path) {
    echo json_encode(['success' => false, 'error' => 'No path provided']);
    exit;
}

// Resolve against the real uploads directory and reject anything that
// escapes it, instead of trying to filter ".." out of the string.
$baseDir  = realpath(__DIR__ . '/../../../uploads');
$fullPath = realpath($baseDir . '/' . $file_path);

if ($fullPath === false || strpos($fullPath, $baseDir) !== 0) {
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'Invalid path.']);
    exit;
}

if (!file_exists($fullPath)) {
    echo json_encode(['success' => false, 'error' => 'File not found']);
    exit;
}

$mime = mime_content_type($fullPath);
$data = base64_encode(file_get_contents($fullPath));

echo json_encode([
    'success'    => true,
    'base64'     => $data,
    'media_type' => $mime,
]);