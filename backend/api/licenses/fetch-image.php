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

// Uploads may live in different places depending on which page uploaded them
$candidates = array_unique(array_filter(array_map('realpath', [
    __DIR__ . '/../../../uploads',                      // public_html/uploads
    __DIR__ . '/../../uploads',                         // public_html/backend/uploads
    rtrim($_SERVER['DOCUMENT_ROOT'] ?? '', '/') . '/uploads',
])));

if (!$candidates) fail(500, 'Uploads folder not found.');

$fullPath = null;
foreach ($candidates as $baseDir) {
    $try = realpath($baseDir . DIRECTORY_SEPARATOR . $path);
    // Must be a real file AND stay inside that uploads folder
    if ($try && is_file($try) && strpos($try, $baseDir . DIRECTORY_SEPARATOR) === 0) {
        $fullPath = $try;
        break;
    }
}

if (!$fullPath) fail(404, 'File not found.');

$mime = mime_content_type($fullPath);
if (!in_array($mime, ['image/jpeg', 'image/png', 'application/pdf'], true)) {
    fail(415, 'Unsupported file type.');
}

echo json_encode([
    'success'    => true,
    'base64'     => base64_encode(file_get_contents($fullPath)),
    'media_type' => $mime,
]);