<?php
// middleware/audit.php — Central audit logging helper.
// Usage anywhere in your API:  auditLog([...]);
// Logging NEVER breaks the main request: any error is written to the PHP error log only.

require_once __DIR__ . '/../config/db.php';

const AUDIT_ACTOR_TYPES = ['superadmin', 'admin', 'worker', 'client', 'guest'];

// Only REMOTE_ADDR is trusted. X-Forwarded-For can be faked by the client.
function auditIp(): string {
    return substr($_SERVER['REMOTE_ADDR'] ?? 'unknown', 0, 45);
}

// Removes anything that looks like a secret before it reaches the log.
function auditScrub($data) {
    if (!is_array($data)) return $data;
    foreach ($data as $k => $v) {
        if (is_string($k) && preg_match('/pass|token|secret|hash|otp/i', $k)) {
            unset($data[$k]);
            continue;
        }
        $data[$k] = auditScrub($v);
    }
    return $data;
}

// Builds the "who" fields from a verified JWT payload (the array requireAuth() returns).
function auditActor(array $auth): array {
    $role = $auth['role'] ?? 'guest';
    if ($role === 'super_admin') $role = 'superadmin';
    return [
        'actor_user_id' => $auth['sub']  ?? null,
        'actor_name'    => $auth['name'] ?? 'Unknown',
        'actor_type'    => $role,
    ];
}

/**
 * Keys: actor_user_id, actor_name, actor_type, action, module, description,
 *       target_user_id, target_type, target_id, target_label,
 *       old_values (array), new_values (array), status ('success'|'failed')
 */
function auditLog(array $e): void {
    try {
        $type = $e['actor_type'] ?? 'guest';
        if ($type === 'super_admin') $type = 'superadmin';
        if (!in_array($type, AUDIT_ACTOR_TYPES, true)) $type = 'guest';

        $old = isset($e['old_values']) ? json_encode(auditScrub($e['old_values']), JSON_UNESCAPED_UNICODE) : null;
        $new = isset($e['new_values']) ? json_encode(auditScrub($e['new_values']), JSON_UNESCAPED_UNICODE) : null;

        $stmt = getDB()->prepare(
            "INSERT INTO audit_logs
               (actor_user_id, actor_name, actor_type, action, module, description,
                target_user_id, target_type, target_id, target_label,
                old_values, new_values, ip_address, user_agent, status)
             VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)"
        );
        $stmt->execute([
            $e['actor_user_id'] ?? null,
            mb_substr((string)($e['actor_name'] ?? 'Unknown'), 0, 201),
            $type,
            $e['action'],
            $e['module'],
            mb_substr((string)($e['description'] ?? ''), 0, 500),
            $e['target_user_id'] ?? null,
            $e['target_type']    ?? null,
            $e['target_id']      ?? null,
            isset($e['target_label']) ? mb_substr((string)$e['target_label'], 0, 200) : null,
            $old,
            $new,
            auditIp(),
            substr($_SERVER['HTTP_USER_AGENT'] ?? '', 0, 255),
            $e['status'] ?? 'success',
        ]);
    } catch (Throwable $ex) {
        error_log('[audit] ' . $ex->getMessage());
    }
}

// Keeps personal data out of the log: for these fields we record THAT they changed, not the values.
function auditMaskSensitive(array $old, array $new): array {
    foreach (['email', 'mobile', 'phone', 'address'] as $k) {
        if (array_key_exists($k, $new)) { $old[$k] = '[hidden]'; $new[$k] = '[hidden]'; }
    }
    return [$old, $new];
}