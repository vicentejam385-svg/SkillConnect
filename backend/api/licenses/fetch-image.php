<?php
require_once __DIR__ . '/../../cors.php';
require_once __DIR__ . '/../../middleware/jwt.php';

handleCors();
header('Content-Type: application/json');
requireAdminAccess();

function fail(int $code, string $msg): never {
    http_response_code($code);
    echo json_encode(['success' => false, 'error' => $msg]);
    exit;
}

$path = trim($_GET['path'] ?? '');
if ($path === '') fail(422, 'No path provided.');

// file_path is saved as "uploads/licenses/xxx.jpg", so drop the leading "uploads/"
$path = preg_replace('#^/?uploads/#', '', $path);

$baseDir = realpath(__DIR__ . '/../../../uploads');
if ($baseDir === false) fail(500, 'Uploads folder not found.');

$fullPath = realpath($baseDir . DIRECTORY_SEPARATOR . $path);
if ($fullPath === false || !is_file($fullPath)) fail(404, 'File not found.');

// Block anything outside the uploads folder
if (strpos($fullPath, $baseDir . DIRECTORY_SEPARATOR) !== 0) fail(403, 'Invalid path.');

$mime = mime_content_type($fullPath);
if (!in_array($mime, ['image/jpeg', 'image/png', 'application/pdf'], true)) {
    fail(415, 'Unsupported file type.');
}

echo json_encode([
    'success'    => true,
    'base64'     => base64_encode(file_get_contents($fullPath)),
    'media_type' => $mime,
]);