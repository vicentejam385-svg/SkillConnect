<?php
// api/audit-logs/index.php — READ-ONLY audit log API (Super Admin only)
//
// GET params (all optional):
//   group     = all | admin | worker | client      (tab)
//   q         = search text (name, description, target, IP, log code)
//   action    = LOGIN | LOGIN_FAILED | CREATE | UPDATE | DELETE | ...
//   module    = Auth | Admin Users | Workers Access | Client Access | ...
//   status    = success | failed
//   date_from = YYYY-MM-DD      date_to = YYYY-MM-DD
//   page, per_page (max 100)
//   export    = csv   (downloads up to 5000 matching rows)

require_once __DIR__ . '/../../cors.php';
require_once __DIR__ . '/../../config/db.php';
require_once __DIR__ . '/../../middleware/jwt.php';
require_once __DIR__ . '/../../middleware/audit.php';

handleCors();

function out(array $payload, int $code = 200): never {
    header('Content-Type: application/json');
    http_response_code($code);
    echo json_encode($payload);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    out(['success' => false, 'error' => 'Method not allowed.'], 405);
}

// ── Super Admin only ──────────────────────────────────────────
$auth = requireAuth();
if (!in_array($auth['role'] ?? '', ['super_admin', 'superadmin'], true)) {
    auditLog(array_merge(auditActor($auth), [
        'action'      => 'ACCESS_DENIED',
        'module'      => 'System',
        'description' => 'Attempted to open Audit Logs without Super Admin rights',
        'status'      => 'failed',
    ]));
    out(['success' => false, 'error' => 'Super Admin access required.'], 403);
}

// ── Build filters ─────────────────────────────────────────────
function buildFilters(array $q): array {
    $where  = [];
    $params = [];

    switch ($q['group'] ?? 'all') {
        case 'admin':
            $where[] = "(actor_type IN ('superadmin','admin') OR module = 'Admin Users')";
            break;
        case 'worker':
            $where[] = "(actor_type = 'worker' OR module = 'Workers Access')";
            break;
        case 'client':
            $where[] = "(actor_type = 'client' OR module = 'Client Access')";
            break;
    }

    $search = trim($q['q'] ?? '');
    if ($search !== '') {
        $like    = '%' . $search . '%';
        $where[] = "(actor_name LIKE ? OR description LIKE ? OR target_label LIKE ? OR ip_address LIKE ? OR log_code LIKE ?)";
        array_push($params, $like, $like, $like, $like, $like);
    }

    // Enum filters are validated against a whitelist
    $actions = ['LOGIN','LOGOUT','LOGIN_FAILED','PASSWORD_CHANGE','PASSWORD_RESET','CREATE','UPDATE',
                'DELETE','STATUS_CHANGE','ROLE_CHANGE','ACCESS_DENIED','EXPORT'];
    $modules = ['Auth','Admin Users','Workers Access','Client Access','Inquiries',
                'Job Orders','Schedules','Licenses','System'];

    if (!empty($q['action']) && in_array($q['action'], $actions, true)) {
        $where[] = 'action = ?';  $params[] = $q['action'];
    }
    if (!empty($q['module']) && in_array($q['module'], $modules, true)) {
        $where[] = 'module = ?';  $params[] = $q['module'];
    }
    if (!empty($q['status']) && in_array($q['status'], ['success','failed'], true)) {
        $where[] = 'status = ?';  $params[] = $q['status'];
    }

    $isDate = fn($d) => is_string($d) && preg_match('/^\d{4}-\d{2}-\d{2}$/', $d);
    if ($isDate($q['date_from'] ?? null)) {
        $where[] = 'created_at >= ?';  $params[] = $q['date_from'] . ' 00:00:00';
    }
    if ($isDate($q['date_to'] ?? null)) {
        $where[] = 'created_at < DATE_ADD(?, INTERVAL 1 DAY)';  $params[] = $q['date_to'];
    }

    return [$where ? 'WHERE ' . implode(' AND ', $where) : '', $params];
}

try {
    $pdo = getDB();
    [$whereSql, $params] = buildFilters($_GET);

    // ── CSV export ────────────────────────────────────────────
    if (($_GET['export'] ?? '') === 'csv') {
        auditLog(array_merge(auditActor($auth), [
            'action'      => 'EXPORT',
            'module'      => 'System',
            'description' => 'Exported audit logs to CSV',
            'status'      => 'success',
        ]));

        $stmt = $pdo->prepare(
            "SELECT log_code, created_at, actor_name, actor_type, action, module, description,
                    target_label, ip_address, status
             FROM audit_logs $whereSql ORDER BY id DESC LIMIT 5000"
        );
        $stmt->execute($params);

        header('Content-Type: text/csv; charset=utf-8');
        header('Content-Disposition: attachment; filename="audit_logs_' . date('Ymd_His') . '.csv"');

        // Stops spreadsheet formula injection (cells starting with = + - @)
        $safe = fn($v) => (is_string($v) && preg_match('/^[=+\-@]/', $v)) ? "'" . $v : $v;

        $fh = fopen('php://output', 'w');
        fputcsv($fh, ['Log Code','Timestamp','User','Role','Action','Module','Description','Target','IP Address','Status']);
        while ($r = $stmt->fetch()) {
            fputcsv($fh, array_map($safe, array_values($r)));
        }
        fclose($fh);
        exit;
    }

    // ── Paged list ────────────────────────────────────────────
    $page = max(1, (int)($_GET['page'] ?? 1));
    $per  = min(100, max(5, (int)($_GET['per_page'] ?? 20)));
    $off  = ($page - 1) * $per;

    $cnt = $pdo->prepare("SELECT COUNT(*) FROM audit_logs $whereSql");
    $cnt->execute($params);
    $total = (int)$cnt->fetchColumn();

    $stmt = $pdo->prepare(
        "SELECT id, log_code, actor_user_id, actor_name, actor_type, action, module, description,
                target_user_id, target_type, target_id, target_label,
                old_values, new_values, ip_address, user_agent, status, created_at
         FROM audit_logs $whereSql ORDER BY id DESC LIMIT ? OFFSET ?"
    );
    $i = 1;
    foreach ($params as $p) { $stmt->bindValue($i++, $p); }
    $stmt->bindValue($i++, $per, PDO::PARAM_INT);
    $stmt->bindValue($i,   $off, PDO::PARAM_INT);
    $stmt->execute();

    $rows = $stmt->fetchAll();
    foreach ($rows as &$r) {
        $r['old_values'] = $r['old_values'] ? json_decode($r['old_values'], true) : null;
        $r['new_values'] = $r['new_values'] ? json_decode($r['new_values'], true) : null;
    }
    unset($r);

    // ── Summary cards (always "today", ignores filters) ───────
    $summary = $pdo->query(
        "SELECT
           COUNT(*)                                                        AS logs_today,
           SUM(action = 'LOGIN')                                           AS logins_today,
           SUM(action = 'LOGIN_FAILED')                                    AS failed_logins_today,
           SUM(action IN ('CREATE','UPDATE','DELETE','STATUS_CHANGE','ROLE_CHANGE',
                          'PASSWORD_CHANGE','PASSWORD_RESET')
               AND module IN ('Admin Users','Workers Access','Client Access')) AS account_changes_today
         FROM audit_logs WHERE created_at >= CURDATE()"
    )->fetch();

    out([
        'success' => true,
        'data'    => [
            'rows'       => $rows,
            'pagination' => [
                'page'     => $page,
                'per_page' => $per,
                'total'    => $total,
                'pages'    => (int)ceil($total / $per),
            ],
            'summary'    => array_map('intval', $summary),
        ],
    ]);

} catch (PDOException $e) {
    error_log($e->getMessage());
    out(['success' => false, 'error' => 'Database error.'], 500);
}