<?php
// api/users/deactivate.php — change the status of an admin-side user (Super Admin only)
// users statuses (statuses.entity = 'user'): 1 = Active, 2 = Inactive, 3 = Suspended
require_once __DIR__ . '/../../cors.php';
require_once __DIR__ . '/../../config/db.php';
require_once __DIR__ . '/../../middleware/jwt.php';
require_once __DIR__ . '/../../middleware/audit.php';

handleCors();
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method not allowed.']);
    exit;
}

function fail(string $msg, int $code): never {
    http_response_code($code);
    echo json_encode(['success' => false, 'error' => $msg]);
    exit;
}

$auth = requireAuth();
// The token claim is 'role' (it is 'super_admin' with an underscore)
if (($auth['role'] ?? '') !== 'super_admin') {
    auditLog(array_merge(auditActor($auth), [
        'action'      => 'ACCESS_DENIED',
        'module'      => 'Admin Users',
        'description' => 'Attempted to change a user status without Super Admin rights',
        'status'      => 'failed',
    ]));
    fail('Access denied.', 403);
}

$body     = json_decode(file_get_contents('php://input'), true) ?? [];
$id       = (int)($body['id']        ?? 0);
$statusId = (int)($body['status_id'] ?? 0);

if (!$id || !in_array($statusId, [1, 2, 3], true)) {
    fail('Valid id and status_id (1 = Active, 2 = Inactive, 3 = Suspended) are required.', 422);
}

try {
    $pdo = getDB();

    // Target must exist AND be an admin-side user (has a roles row)
    $q = $pdo->prepare("
        SELECT u.id, u.type, u.username, u.status_id, s.label AS status,
               TRIM(CONCAT(u.first_name, ' ', u.last_name)) AS name
        FROM users u
        INNER JOIN roles r ON r.user_id = u.id
        LEFT JOIN statuses s ON s.id = u.status_id
        WHERE u.id = ?
        LIMIT 1
    ");
    $q->execute([$id]);
    $target = $q->fetch();
    if (!$target) fail('User not found.', 404);

    if ($statusId !== 1) {
        if ($id === (int)($auth['sub'] ?? 0)) {
            fail('You cannot deactivate your own account.', 409);
        }
        if ($target['type'] === 'superadmin') {
            $active = (int)$pdo->query(
                "SELECT COUNT(*) FROM users WHERE type = 'superadmin' AND status_id = 1"
            )->fetchColumn();
            if ($active <= 1) fail('Cannot deactivate the only active Super Admin.', 409);
        }
    }

    $labels   = $pdo->query("SELECT id, label FROM statuses WHERE entity = 'user'")->fetchAll(PDO::FETCH_KEY_PAIR);
    $oldLabel = $target['status'] ?? 'Unknown';
    $newLabel = $labels[$statusId] ?? (string)$statusId;

    // Nothing to change → succeed quietly (and don't write a misleading log entry)
    if ((int)$target['status_id'] !== $statusId) {
        $pdo->prepare("UPDATE users SET status_id = ? WHERE id = ?")->execute([$statusId, $id]);

        auditLog(array_merge(auditActor($auth), [
            'action'         => 'STATUS_CHANGE',
            'module'         => 'Admin Users',
            'description'    => 'Changed status of admin "' . ($target['username'] ?: $target['name']) . '" from ' . $oldLabel . ' to ' . $newLabel,
            'target_user_id' => $id,
            'target_type'    => 'users',
            'target_id'      => $id,
            'target_label'   => $target['username'] ?: $target['name'],
            'old_values'     => ['status' => $oldLabel],
            'new_values'     => ['status' => $newLabel],
        ]));
    }

    $stmt = $pdo->prepare("
        SELECT u.id, TRIM(CONCAT(u.first_name, ' ', u.last_name)) AS name,
               u.username, u.type, s.label AS status, u.created_at
        FROM users u
        LEFT JOIN statuses s ON s.id = u.status_id
        WHERE u.id = ?
    ");
    $stmt->execute([$id]);

    echo json_encode(['success' => true, 'user' => $stmt->fetch()]);
} catch (Throwable $e) {
    error_log($e->getMessage());
    fail('Database error.', 500);
}