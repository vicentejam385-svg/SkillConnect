<?php
// backend/api/job-orders/update.php
require_once __DIR__ . '/../../cors.php';
require_once __DIR__ . '/../../middleware/jwt.php';
require_once __DIR__ . '/../../config/db.php';

handleCors();
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'PUT') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method not allowed.']);
    exit;
}

requireAdminAccess();
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
echo json_encode(['success' => true, 'message' => 'Job order updated.', 'job_order' => $row]);
