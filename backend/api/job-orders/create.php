<?php
// backend/api/job-orders/create.php
require_once __DIR__ . '/../../cors.php';
require_once __DIR__ . '/../../middleware/jwt.php';
require_once __DIR__ . '/../../config/db.php';

handleCors();
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method not allowed.']);
    exit;
}

requireAdminAccess();
$pdo  = getDB();
$data = json_decode(file_get_contents('php://input'), true) ?? [];

// Use given status only if it is a real status for this entity, else use the default
function resolveStatus(PDO $pdo, $given, string $entity, int $default): int {
    if (empty($given)) return $default;
    $s = $pdo->prepare('SELECT id FROM statuses WHERE id = ? AND entity = ?');
    $s->execute([(int)$given, $entity]);
    return $s->fetchColumn() ? (int)$given : $default;
}

// Accept both the new (user) and old (contact) field names from the frontend
$clientId = !empty($data['client_user_id']) ? (int)$data['client_user_id']
          : (!empty($data['client_contact_id']) ? (int)$data['client_contact_id'] : null);
$workerId = !empty($data['worker_user_id']) ? (int)$data['worker_user_id']
          : (!empty($data['worker_contact_id']) ? (int)$data['worker_contact_id'] : null);
$inquiryId = !empty($data['inquiry_id']) ? (int)$data['inquiry_id'] : null;

// Fallback: if no client was sent, take it from the inquiry's linked user
if (!$clientId && $inquiryId) {
    $q = $pdo->prepare('SELECT user_id FROM inquiries WHERE id = ?');
    $q->execute([$inquiryId]);
    $uid = $q->fetchColumn();
    if ($uid) $clientId = (int)$uid;
}

// Auto-created from Won inquiry (minimal payload, no worker/dates required)
$isAutoCreated = $inquiryId && !$workerId;

if (!$isAutoCreated) {
    $required = [
        'contract_type_id' => 'Contract type',
        'start_date'       => 'Start date',
        'end_date'         => 'End date',
        'description'      => 'Description',
    ];
    if (!$workerId) {
        http_response_code(422);
        echo json_encode(['success' => false, 'error' => 'Worker is required.']);
        exit;
    }
    foreach ($required as $field => $label) {
        if (empty(trim((string)($data[$field] ?? '')))) {
            http_response_code(422);
            echo json_encode(['success' => false, 'error' => "$label is required."]);
            exit;
        }
    }
    if ($data['start_date'] >= $data['end_date']) {
        http_response_code(422);
        echo json_encode(['success' => false, 'error' => 'End date must be after start date.']);
        exit;
    }
}

try {
    // Duplicate guard: one job order per inquiry
    if ($inquiryId) {
            $dupCheck = $pdo->prepare("SELECT id FROM job_orders WHERE inquiry_id = ? LIMIT 1");
        $dupCheck->execute([$inquiryId]);
        $existingId = $dupCheck->fetchColumn();
        if ($existingId) {
            echo json_encode([
                'success'        => true,
                'already_exists' => true,
                'message'        => 'Job order already exists for this inquiry.',
                'job_order'      => ['id' => (int)$existingId],
            ]);
            exit;
        }
    }

    // Client is always required
    if (!$clientId) {
        http_response_code(422);
        echo json_encode(['success' => false, 'error' => 'Client is required.']);
        exit;
    }
    $clientCheck = $pdo->prepare("SELECT id FROM users WHERE id = ? AND type = 'client'");
    $clientCheck->execute([$clientId]);
    if (!$clientCheck->fetch()) {
        http_response_code(422);
        echo json_encode(['success' => false, 'error' => 'Client not found.']);
        exit;
    }

    // Verify worker if provided
    if ($workerId) {
        $workerCheck = $pdo->prepare("SELECT id FROM users WHERE id = ? AND type = 'worker'");
        $workerCheck->execute([$workerId]);
        if (!$workerCheck->fetch()) {
            http_response_code(422);
            echo json_encode(['success' => false, 'error' => 'Worker not found.']);
            exit;
        }
    }

    // Insert (job_order_code is set automatically by the database trigger)
    $pdo->prepare("
        INSERT INTO job_orders
            (worker_user_id, client_user_id, inquiry_id, schedule_id,
             contract_type_id, description, start_date, end_date, status_id)
        VALUES
            (:worker, :client, :inquiry, :schedule,
             :contract, :description, :start, :end, :status)
    ")->execute([
        ':worker'      => $workerId,
        ':client'      => $clientId,
        ':inquiry'     => $inquiryId,
        ':schedule'    => !empty($data['schedule_id'])      ? (int)$data['schedule_id']      : null,
        ':contract'    => !empty($data['contract_type_id']) ? (int)$data['contract_type_id'] : null,
        ':description' => !empty($data['description'])      ? trim($data['description'])     : null,
        ':start'       => !empty($data['start_date'])       ? $data['start_date']            : null,
        ':end'         => !empty($data['end_date'])         ? $data['end_date']              : null,
        ':status'      => resolveStatus($pdo, $data['status_id'] ?? null, 'job_order', 16), // 16 = Pending
    ]);

    $joId = (int)$pdo->lastInsertId();

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
    $rowStmt->execute([$joId]);

    http_response_code(201);
    echo json_encode([
        'success'   => true,
        'message'   => $isAutoCreated ? 'Job order auto-created from Won inquiry.' : 'Job order created.',
        'job_order' => $rowStmt->fetch(),
    ]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Database error.', 'detail' => $e->getMessage()]);
}