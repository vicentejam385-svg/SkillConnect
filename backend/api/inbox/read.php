<?php
// backend/api/inbox/read.php
// Mark Inbox messages as read.   POST { id }  or  POST { all: true }
require_once __DIR__ . '/../../cors.php';
require_once __DIR__ . '/../../config/db.php';
require_once __DIR__ . '/../../middleware/jwt.php';
require_once __DIR__ . '/../../helpers/job-offers.php';

handleCors();
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method not allowed.']);
    exit;
}

$auth = requireAuth();
if (($auth['role'] ?? '') !== 'worker') {
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'Only workers have an inbox.']);
    exit;
}
$uid  = (int)($auth['sub'] ?? 0);
$data = json_decode(file_get_contents('php://input'), true) ?? [];

try {
    $pdo = getDB();
    $now = jobOfferNow();

    if (!empty($data['all'])) {
        $st = $pdo->prepare("UPDATE worker_inbox SET read_at = ? WHERE user_id = ? AND read_at IS NULL");
        $st->execute([$now, $uid]);
    } else {
        $id = (int)($data['id'] ?? 0);
        if (!$id) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Message ID is required.']);
            exit;
        }
        $st = $pdo->prepare("UPDATE worker_inbox SET read_at = ? WHERE id = ? AND user_id = ? AND read_at IS NULL");
        $st->execute([$now, $id, $uid]);
    }

    echo json_encode(['success' => true, 'updated' => $st->rowCount()]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Database error.', 'detail' => $e->getMessage()]);
}