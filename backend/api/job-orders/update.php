<?php
// backend/api/job-orders/update.php
require_once __DIR__ . '/../../cors.php';
require_once __DIR__ . '/../../middleware/jwt.php';
require_once __DIR__ . '/../../config/db.php';
require_once __DIR__ . '/../../middleware/audit.php';

handleCors();
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'PUT') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method not allowed.']);
    exit;
}

$auth = requireAdminAccess();
$pdo = getDB();

$data = json_decode(file_get_contents('php://input'), true);
$id   = isset($_GET['id']) ? (int)$_GET['id'] : (int)($data['id'] ?? 0);

if (!$id) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Job order ID is required.']);
    exit;
}

// Resolve status: accept both numeric ID and label string
if (isset($data['status_id'])) {
    if (!is_numeric($data['status_id'])) {
        $statusRow = $pdo->prepare("SELECT id FROM statuses WHERE label = ? AND entity = 'job_order' LIMIT 1");
        $statusRow->execute([$data['status_id']]);
        $found = $statusRow->fetchColumn();
        if ($found) {
            $data['status_id'] = (int)$found;
        } else {
            http_response_code(422);
            echo json_encode(['success' => false, 'error' => "Invalid status: {$data['status_id']}"]);
            exit;
        }
        } else {
        $data['status_id'] = (int)$data['status_id'];
        $chk = $pdo->prepare("SELECT 1 FROM statuses WHERE id = ? AND entity = 'job_order'");
        $chk->execute([$data['status_id']]);
        if (!$chk->fetchColumn()) {
            http_response_code(422);
            echo json_encode(['success' => false, 'error' => "Invalid job order status id: {$data['status_id']}"]);
            exit;
        }
    }
}

if (array_key_exists('description', $data) && empty(trim($data['description'] ?? ''))) {
    http_response_code(422);
    echo json_encode(['success' => false, 'error' => 'Description is required.']);
    exit;
}

if (!empty($data['start_date']) && !empty($data['end_date']) && $data['start_date'] >= $data['end_date']) {
    http_response_code(422);
    echo json_encode(['success' => false, 'error' => 'End date must be after start date.']);
    exit;
}

// Accept both old (contact) and new (user) field names from the frontend
if (array_key_exists('worker_contact_id', $data) && !array_key_exists('worker_user_id', $data)) {
    $data['worker_user_id'] = $data['worker_contact_id'];
}
if (array_key_exists('client_contact_id', $data) && !array_key_exists('client_user_id', $data)) {
    $data['client_user_id'] = $data['client_contact_id'];
}

$fields     = ['worker_user_id','client_user_id','inquiry_id','schedule_id','contract_type_id','description','start_date','end_date','status_id'];
$setClauses = [];
$params     = [];

foreach ($fields as $f) {
    if (array_key_exists($f, $data)) {
        $setClauses[]  = "`$f` = :$f";
        $params[":$f"] = ($data[$f] === '' || $data[$f] === null) ? null : $data[$f];
    }
}

if (empty($setClauses)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'No fields provided to update.']);
    exit;
}

$beforeStmt = $pdo->prepare(
    "SELECT jo.*, s.label AS status_label,
            CONCAT(w.first_name,' ',w.last_name) AS worker_name,
            CONCAT(c.first_name,' ',c.last_name) AS client_name
     FROM job_orders jo
     LEFT JOIN statuses s ON s.id = jo.status_id
     LEFT JOIN users w ON w.id = jo.worker_user_id
     LEFT JOIN users c ON c.id = jo.client_user_id
     WHERE jo.id = ?"
);
$beforeStmt->execute([$id]);
$before = $beforeStmt->fetch(PDO::FETCH_ASSOC);
if (!$before) {
    http_response_code(404);
    echo json_encode(['success' => false, 'error' => 'Job order not found.']);
    exit;
}

$params[':id'] = $id;
$pdo->prepare("UPDATE job_orders SET " . implode(', ', $setClauses) . " WHERE id = :id")->execute($params);

$rowStmt = $pdo->prepare(
    "SELECT jo.*,
            jo.worker_user_id AS worker_contact_id,
            jo.client_user_id AS client_contact_id,
            CONCAT(w.first_name,' ',w.last_name) AS worker_name,
            CONCAT(c.first_name,' ',c.last_name) AS client_name,
            s.label AS status,
            ct.name AS contract_type
     FROM job_orders jo
     LEFT JOIN users w ON w.id = jo.worker_user_id
     LEFT JOIN users c ON c.id = jo.client_user_id
     LEFT JOIN statuses s ON s.id = jo.status_id
     LEFT JOIN contract_types ct ON ct.id = jo.contract_type_id
     WHERE jo.id = ?"
);
$rowStmt->execute([$id]);
$row = $rowStmt->fetch(PDO::FETCH_ASSOC);

// Work out which fields really changed
$chgOld = []; $chgNew = [];
foreach ($fields as $f) {
    if (!array_key_exists($f, $data)) continue;
    $new = ($data[$f] === '' || $data[$f] === null) ? null : $data[$f];
    if ((string)($before[$f] ?? '') !== (string)($new ?? '')) {
        $chgOld[$f] = $before[$f] ?? null;
        $chgNew[$f] = $new;
    }
}
// Show readable labels and names instead of ids
if (isset($chgNew['status_id'])) {
    $chgOld['status'] = $before['status_label'] ?? null;
    $chgNew['status'] = $row['status'] ?? null;
    unset($chgOld['status_id'], $chgNew['status_id']);
}
if (isset($chgNew['worker_user_id'])) {
    $chgOld['worker'] = trim($before['worker_name'] ?? '') ?: null;
    $chgNew['worker'] = trim($row['worker_name'] ?? '') ?: null;
    unset($chgOld['worker_user_id'], $chgNew['worker_user_id']);
}
if (isset($chgNew['client_user_id'])) {
    $chgOld['client'] = trim($before['client_name'] ?? '') ?: null;
    $chgNew['client'] = trim($row['client_name'] ?? '') ?: null;
    unset($chgOld['client_user_id'], $chgNew['client_user_id']);
}

if ($chgNew) {
    $statusChanged = isset($chgNew['status']);
    $code = $before['job_order_code'] ?? ('#' . $id);
    auditLog(array_merge(auditActor($auth), [
        'action'         => $statusChanged ? 'STATUS_CHANGE' : 'UPDATE',
        'module'         => 'Job Orders',
        'description'    => $statusChanged
            ? 'Changed job order ' . $code . ' status from "' . ($chgOld['status'] ?? '—') . '" to "' . ($chgNew['status'] ?? '—') . '"'
            : 'Updated job order ' . $code . ' (' . implode(', ', array_keys($chgNew)) . ')',
        'target_user_id' => $before['client_user_id'] ?? null,
        'target_type'    => 'job_order',
        'target_id'      => $id,
        'target_label'   => $code . ' — ' . trim($before['client_name'] ?? ''),
        'old_values'     => $chgOld,
        'new_values'     => $chgNew,
    ]));
}

echo json_encode(['success' => true, 'message' => 'Job order updated.', 'job_order' => $row]);
