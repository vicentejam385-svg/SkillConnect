<?php
require_once __DIR__ . '/../../cors.php';
require_once __DIR__ . '/../../config/db.php';
require_once __DIR__ . '/../../middleware/jwt.php';
require_once __DIR__ . '/../../middleware/audit.php';

handleCors();
header('Content-Type: application/json');

if (!in_array($_SERVER['REQUEST_METHOD'], ['PUT', 'PATCH'])) {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method not allowed.']);
    exit;
}

$auth = requireAdminAccess();

$body = json_decode(file_get_contents('php://input'), true);
$id   = (int)($body['id'] ?? $_GET['id'] ?? 0);

if (!$id) {
    http_response_code(422);
    echo json_encode(['success' => false, 'error' => 'License id is required.']);
    exit;
}

try {
    $pdo      = getDB();
    $existing = $pdo->prepare("SELECT l.*, u.first_name, u.last_name, u.type AS owner_type
                               FROM licenses l JOIN users u ON u.id = l.user_id WHERE l.id = ?");
    $existing->execute([$id]);
    $before = $existing->fetch();
    if (!$before) {
        http_response_code(404);
        echo json_encode(['success' => false, 'error' => 'License not found.']);
        exit;
    }

    $fields = ['expiry_date', 'document_name', 'ai_scan_result'];
    $set = []; $params = [];
    foreach ($fields as $f) {
        if (array_key_exists($f, $body)) { $set[] = "$f = ?"; $params[] = $body[$f]; }
    }
    if (!$set) {
        http_response_code(422);
        echo json_encode(['success' => false, 'error' => 'No fields to update.']);
        exit;
    }

    $params[] = $id;
    $pdo->prepare("UPDATE licenses SET " . implode(', ', $set) . " WHERE id = ?")->execute($params);

    $row = $pdo->prepare(
    "SELECT l.*, l.user_id AS contact_id,
            u.user_code AS contact_code,
            CONCAT(u.first_name,' ',u.last_name) AS contact_name
     FROM licenses l JOIN users u ON u.id = l.user_id WHERE l.id = ?"
);
    $row->execute([$id]);
    $updated = $row->fetch();

    $chgOld = []; $chgNew = [];
    foreach (['expiry_date', 'document_name', 'ai_scan_result'] as $f) {
        if (array_key_exists($f, $body) && (string)($before[$f] ?? '') !== (string)$body[$f]) {
            // the AI scan text is long and may contain personal data, so only note that it changed
            $chgOld[$f] = $f === 'ai_scan_result' ? '[hidden]' : ($before[$f] ?? null);
            $chgNew[$f] = $f === 'ai_scan_result' ? '[hidden]' : $body[$f];
        }
    }
    if ($chgNew) {
        $ownerName = trim($before['first_name'] . ' ' . $before['last_name']);
        auditLog(array_merge(auditActor($auth), [
            'action'         => 'UPDATE',
            'module'         => 'Licenses',
            'description'    => 'Updated license ' . $before['document_name'] . ' of ' . $before['owner_type'] . ' "' . $ownerName . '" (' . implode(', ', array_keys($chgNew)) . ')',
            'target_user_id' => (int)$before['user_id'],
            'target_type'    => 'licenses',
            'target_id'      => $id,
            'target_label'   => $before['document_name'] . ' — ' . $ownerName,
            'old_values'     => $chgOld,
            'new_values'     => $chgNew,
        ]));
    }

    echo json_encode(['success' => true, 'license' => $updated]);
} catch (PDOException $e) {
    http_response_code(500);
    error_log($e->getMessage());
    echo json_encode(['success' => false, 'error' => 'Database error.']);
}
