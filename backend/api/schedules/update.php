<?php
require_once __DIR__ . '/../../cors.php';
require_once __DIR__ . '/../../config/db.php';
require_once __DIR__ . '/../../middleware/audit.php';
require_once __DIR__ . '/../../middleware/jwt.php';

handleCors();
header('Content-Type: application/json');

if (!in_array($_SERVER['REQUEST_METHOD'], ['PUT', 'PATCH'])) {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method not allowed.']);
    exit;
}

$auth = requireAuth();

$body = json_decode(file_get_contents('php://input'), true);
$id   = (int)($body['id'] ?? 0);

if (!$id) {
    http_response_code(422);
    echo json_encode(['success' => false, 'error' => 'Schedule id is required.']);
    exit;
}

try {
    $pdo = getDB();

    $existing = $pdo->prepare(
        "SELECT sc.*, s.label AS status_label,
                CONCAT(w.first_name,' ',w.last_name) AS worker_name,
                CONCAT(c.first_name,' ',c.last_name) AS client_name
         FROM schedules sc
         LEFT JOIN statuses s ON s.id = sc.status_id
         LEFT JOIN users w ON w.id = sc.worker_user_id
         LEFT JOIN users c ON c.id = sc.client_user_id
         WHERE sc.id = ?"
    );
    $existing->execute([$id]);
    $before = $existing->fetch(PDO::FETCH_ASSOC);
    if (!$before) {
        http_response_code(404);
        echo json_encode(['success' => false, 'error' => 'Schedule not found.']);
        exit;
    }
        // Allow status update by label name
    if (!empty($body['status_id']) && !is_numeric($body['status_id'])) {
        $labelStmt = $pdo->prepare("SELECT id FROM statuses WHERE entity = 'schedule' AND label = ? LIMIT 1");
        $labelStmt->execute([$body['status_id']]);
        $body['status_id'] = $labelStmt->fetchColumn() ?: null;
    }
    // Accept old (contact) names from the frontend and map them to the real columns
    if (array_key_exists('worker_contact_id', $body) && !array_key_exists('worker_user_id', $body)) {
        $body['worker_user_id'] = $body['worker_contact_id'];
    }
    if (array_key_exists('client_contact_id', $body) && !array_key_exists('client_user_id', $body)) {
        $body['client_user_id'] = $body['client_contact_id'];
    }
    $fields = ['start_time', 'end_time', 'description', 'worker_user_id', 'client_user_id', 'status_id'];
    $set = []; $params = [];
    foreach ($fields as $f) {
        if (array_key_exists($f, $body)) {
            $set[] = "`$f` = ?";
            $params[] = ($body[$f] === '' ? null : $body[$f]);
        }
    }

    if (!$set) {
        http_response_code(422);
        echo json_encode(['success' => false, 'error' => 'No fields to update.']);
        exit;
    }

    $params[] = $id;
    $pdo->prepare("UPDATE schedules SET " . implode(', ', $set) . " WHERE id = ?")->execute($params);

    $view = $pdo->prepare(
        "SELECT sc.*,
                sc.worker_user_id AS worker_contact_id,
                sc.client_user_id AS client_contact_id,
                CONCAT(w.first_name,' ',w.last_name) AS worker_name,
                CONCAT(c.first_name,' ',c.last_name) AS client_name,
                s.label AS status
         FROM schedules sc
         LEFT JOIN users w ON w.id = sc.worker_user_id
         LEFT JOIN users c ON c.id = sc.client_user_id
         LEFT JOIN statuses s ON s.id = sc.status_id
         WHERE sc.id = ?"
    );
    $view->execute([$id]);
    $updated = $view->fetch();

    // Work out which fields really changed
    $chgOld = []; $chgNew = [];
    foreach ($fields as $f) {
        if (!array_key_exists($f, $body)) continue;
        $new = ($body[$f] === '' ? null : $body[$f]);
        if ((string)($before[$f] ?? '') !== (string)($new ?? '')) {
            $chgOld[$f] = $before[$f] ?? null;
            $chgNew[$f] = $new;
        }
    }
    // Readable labels and names instead of ids
    if (array_key_exists('status_id', $chgNew)) {
        $chgOld['status'] = $before['status_label'] ?? null;
        $chgNew['status'] = $updated['status'] ?? null;
        unset($chgOld['status_id'], $chgNew['status_id']);
    }
    if (array_key_exists('worker_user_id', $chgNew)) {
        $chgOld['worker'] = trim($before['worker_name'] ?? '') ?: null;
        $chgNew['worker'] = trim($updated['worker_name'] ?? '') ?: null;
        unset($chgOld['worker_user_id'], $chgNew['worker_user_id']);
    }
    if (array_key_exists('client_user_id', $chgNew)) {
        $chgOld['client'] = trim($before['client_name'] ?? '') ?: null;
        $chgNew['client'] = trim($updated['client_name'] ?? '') ?: null;
        unset($chgOld['client_user_id'], $chgNew['client_user_id']);
    }

    if ($chgNew) {
        $statusChanged = array_key_exists('status', $chgNew);
        $code = $before['schedule_code'] ?? ('#' . $id);
        auditLog(array_merge(auditActor($auth), [
            'action'         => $statusChanged ? 'STATUS_CHANGE' : 'UPDATE',
            'module'         => 'Schedules',
            'description'    => $statusChanged
                ? 'Changed schedule ' . $code . ' status from "' . ($chgOld['status'] ?? '—') . '" to "' . ($chgNew['status'] ?? '—') . '"'
                : 'Updated schedule ' . $code . ' (' . implode(', ', array_keys($chgNew)) . ')',
            'target_user_id' => $before['client_user_id'] ?? null,
            'target_type'    => 'schedule',
            'target_id'      => $id,
            'target_label'   => $code . ' — ' . trim($before['worker_name'] ?? ''),
            'old_values'     => $chgOld,
            'new_values'     => $chgNew,
        ]));
    }

    echo json_encode(['success' => true, 'schedule' => $updated]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Database error.', 'detail' => $e->getMessage()]);
}
