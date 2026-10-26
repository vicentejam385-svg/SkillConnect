<?php
// backend/api/contacts/create.php
require_once __DIR__ . '/../../cors.php';
require_once __DIR__ . '/../../middleware/jwt.php';
require_once __DIR__ . '/../../config/db.php';
require_once __DIR__ . '/../../middleware/audit.php';

handleCors();
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method not allowed.']);
    exit;
}

$auth = requireAdminAccess();
$data = json_decode(file_get_contents('php://input'), true) ?? [];

foreach (['first_name' => 'First name', 'last_name' => 'Last name'] as $field => $label) {
    if (empty(trim($data[$field] ?? ''))) {
        http_response_code(422);
        echo json_encode(['success' => false, 'error' => "$label is required."]);
        exit;
    }
}

// users.type enum: superadmin, admin, worker, client  ('organisation' → client)
$type = $data['type'] ?? 'client';
if ($type === 'organisation') $type = 'client';
if (!in_array($type, ['worker', 'client'])) $type = 'client';

$email     = trim($data['email'] ?? '') ?: null;
$status_id = !empty($data['status_id']) ? (int)$data['status_id'] : 1; // users → Active

try {
    $pdo = getDB();

    // email is UNIQUE in users: reuse the existing account instead of failing
    if ($email) {
        $chk = $pdo->prepare("SELECT * FROM users WHERE email = ?");
        $chk->execute([$email]);
        if ($u = $chk->fetch(PDO::FETCH_ASSOC)) {
            unset($u['password']);
            echo json_encode(['success' => true, 'message' => 'Existing account reused.',
                              'contact' => $u, 'user' => $u, 'existing' => true]);
            exit;
        }
    }

    $stmt = $pdo->prepare("
        INSERT INTO users
            (type, first_name, last_name, suffix, email, mobile, phone, address, status_id)
        VALUES
            (:type, :first, :last, :suffix, :email, :mobile, :phone, :address, :status)
    ");
    $stmt->execute([
        ':type'    => $type,
        ':first'   => trim($data['first_name']),
        ':last'    => trim($data['last_name']),
        ':suffix'  => trim($data['suffix']  ?? '') ?: null,
        ':email'   => $email,
        ':mobile'  => trim($data['mobile']  ?? '') ?: null,
        ':phone'   => trim($data['phone']   ?? '') ?: null,
        ':address' => trim($data['address'] ?? '') ?: null,
        ':status'  => $status_id,
    ]);

    $sel = $pdo->prepare("SELECT * FROM users WHERE id = ?");
    $sel->execute([(int)$pdo->lastInsertId()]);
    $row = $sel->fetch(PDO::FETCH_ASSOC);
    unset($row['password']);

    $newId = (int)$row['id'];
    $who   = trim($row['first_name'] . ' ' . $row['last_name']);
    $stLbl = $pdo->query("SELECT label FROM statuses WHERE id = " . (int)$status_id)->fetchColumn();
    auditLog(array_merge(auditActor($auth), [
        'action'         => 'CREATE',
        'module'         => $type === 'client' ? 'Client Access' : 'Workers Access',
        'description'    => 'Created ' . $type . ' record "' . $who . '"',
        'target_user_id' => $newId,
        'target_type'    => 'users',
        'target_id'      => $newId,
        'target_label'   => $who,
        'new_values'     => ['name' => $who, 'type' => $type, 'status' => $stLbl ?: $status_id],
    ]));

    // Both keys so existing React code (step2.contact.id) keeps working
    echo json_encode(['success' => true, 'message' => 'Contact created.',
                      'contact' => $row, 'user' => $row]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Database error.', 'detail' => $e->getMessage()]);
}