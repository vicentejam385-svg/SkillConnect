<?php
// backend/helpers/job-order-status.php
//
// Job order flow (Asia/Manila time):
//
//   Pending       new job from a Won inquiry
//   Under Review  admin talks to the customer, ocular visit, sets the dates, offers go out
//   Scheduled     AUTOMATIC as soon as a worker is set (accepted or assigned) and the dates are set
//   In Progress   AUTOMATIC on the worker's first progress photo (or set by the admin)
//   Complete      when the customer (or the admin) confirms the worker's "Mark as finished"
//   On Hold / Cancelled   set by the admin
//   Active        old status, kept only for existing job orders
//
// Dates no longer change the status by themselves. Instead, flags tell the admin
// what needs attention: no photo yet, past the end date, waiting for the customer.

if (!defined('JO_STATUS_PENDING')) {
    define('JO_STATUS_PENDING', 16);
    define('JO_STATUS_ACTIVE', 17);
    define('JO_STATUS_COMPLETE', 18);
    define('JO_STATUS_ON_HOLD', 19);
    define('JO_STATUS_UNDER_REVIEW', 20);
    define('JO_STATUS_SCHEDULED', 21);
    define('JO_STATUS_IN_PROGRESS', 22);
    define('JO_STATUS_CANCELLED', 23);
    define('JO_CUSTOMER_WAIT_DAYS', 3);
}

function jobOrderTz(): DateTimeZone
{
    return new DateTimeZone('Asia/Manila');
}

/** Today in the Philippines (YYYY-MM-DD). Done in PHP because the DB session runs in UTC. */
function jobOrderToday(): string
{
    return (new DateTime('now', jobOrderTz()))->format('Y-m-d');
}

/** Now in the Philippines (Y-m-d H:i:s). */
function jobOrderNow(): string
{
    return (new DateTime('now', jobOrderTz()))->format('Y-m-d H:i:s');
}

/**
 * Kept for older callers. Dates no longer move the status, so this does nothing.
 * @return array
 */
function syncJobOrderStatuses(PDO $pdo, $jobOrderId = null)
{
    return [];
}

/** Write an audit log line as "System". Never throws. */
function jobOrderSystemLog(PDO $pdo, array $jo, string $description, ?array $old = null, ?array $new = null): void
{
    try {
        $code = $jo['job_order_code'] ?? ('#' . ($jo['id'] ?? '?'));
        $pdo->prepare(
            "INSERT INTO audit_logs
                (actor_user_id, actor_name, actor_type, action, module, description,
                 target_user_id, target_type, target_id, target_label,
                 old_values, new_values, ip_address, user_agent, status)
             VALUES
                (NULL, 'System', 'guest', 'STATUS_CHANGE', 'Job Orders', ?,
                 ?, 'job_order', ?, ?, ?, ?, NULL, 'job order flow', 'success')"
        )->execute([
            mb_substr($description, 0, 500),
            !empty($jo['client_user_id']) ? (int)$jo['client_user_id'] : null,
            (int)($jo['id'] ?? 0),
            $code,
            $old ? json_encode($old) : null,
            $new ? json_encode($new) : null,
        ]);
    } catch (Throwable $e) {
        error_log('[job-order-status] audit log failed: ' . $e->getMessage());
    }
}

/**
 * A job order with a worker and agreed dates moves to Scheduled.
 * Only from Pending, Under Review or the old Active status.
 * @return bool true when the status was changed
 */
function jobOrderAutoSchedule(PDO $pdo, int $jobOrderId): bool
{
    try {
        $st = $pdo->prepare("SELECT id, job_order_code, client_user_id, worker_user_id, status_id, start_date, end_date
                             FROM job_orders WHERE id = ?");
        $st->execute([$jobOrderId]);
        $jo = $st->fetch(PDO::FETCH_ASSOC);
        if (!$jo || empty($jo['worker_user_id']) || empty($jo['start_date']) || empty($jo['end_date'])) return false;

        $from = (int)$jo['status_id'];
        if (!in_array($from, [JO_STATUS_PENDING, JO_STATUS_UNDER_REVIEW, JO_STATUS_ACTIVE], true)) return false;

        $upd = $pdo->prepare("UPDATE job_orders SET status_id = ? WHERE id = ? AND status_id = ?");
        $upd->execute([JO_STATUS_SCHEDULED, $jobOrderId, $from]);
        if ($upd->rowCount() !== 1) return false;

        $labels = [JO_STATUS_PENDING => 'Pending', JO_STATUS_UNDER_REVIEW => 'Under Review', JO_STATUS_ACTIVE => 'Active'];
        jobOrderSystemLog($pdo, $jo,
            'Job order ' . ($jo['job_order_code'] ?: '#' . $jobOrderId) . ' moved to "Scheduled" because a worker is assigned',
            ['status' => $labels[$from] ?? (string)$from], ['status' => 'Scheduled']);
        return true;
    } catch (Throwable $e) {
        error_log('[job-order-status] auto schedule failed: ' . $e->getMessage());
        return false;
    }
}

/**
 * What needs attention on this job order (for badges). Row needs status_id,
 * start_date, end_date, started_at, finished_at, issue_note, photos_count.
 *
 *   no_photo_yet        Scheduled, start date has passed, no photo
 *   past_end            Scheduled / In Progress, end date has passed, not reported finished
 *   awaiting_confirm    worker reported finished, waiting for the customer / admin
 *   customer_slow       ...for more than 3 days
 *   issue               the customer or admin said it is not done yet
 */
function jobOrderFlags(array $row, ?string $today = null): array
{
    $today  = $today ?: jobOrderToday();
    $status = (int)($row['status_id'] ?? 0);
    $flags  = [];
    $open   = in_array($status, [JO_STATUS_SCHEDULED, JO_STATUS_IN_PROGRESS], true);

    if ($status === JO_STATUS_SCHEDULED && !empty($row['start_date']) && $row['start_date'] < $today
        && (int)($row['photos_count'] ?? 0) === 0) {
        $flags[] = 'no_photo_yet';
    }
    if ($open && empty($row['finished_at']) && !empty($row['end_date']) && $row['end_date'] < $today) {
        $flags[] = 'past_end';
    }
    if ($open && !empty($row['finished_at'])) {
        $flags[] = 'awaiting_confirm';
        $since = (new DateTime($row['finished_at'], jobOrderTz()))->modify('+' . JO_CUSTOMER_WAIT_DAYS . ' days');
        if ($since->format('Y-m-d H:i:s') <= jobOrderNow()) $flags[] = 'customer_slow';
    }
    if ($open && empty($row['finished_at']) && !empty($row['issue_note'])) {
        $flags[] = 'issue';
    }
    return $flags;
}

/** Add a "job_update" message to a worker's Inbox. Never throws. */
function jobOrderInboxUpdate(PDO $pdo, int $workerId, int $jobOrderId, string $title, ?string $body = null): void
{
    try {
        $pdo->prepare(
            "INSERT INTO worker_inbox (user_id, job_order_id, type, title, body, created_at)
             VALUES (?, ?, 'job_update', ?, ?, ?)"
        )->execute([$workerId, $jobOrderId, mb_substr($title, 0, 200), $body !== null ? mb_substr($body, 0, 500) : null, jobOrderNow()]);
    } catch (Throwable $e) {
        error_log('[job-order-status] inbox update failed: ' . $e->getMessage());
    }
}

/** Simple email in the SkillConnect style (green header, one button). */
function jobOrderMailHtml(string $name, string $heading, array $lines, string $buttonText, string $url): string
{
    $e = fn($v) => htmlspecialchars((string)$v, ENT_QUOTES, 'UTF-8');
    $para = '';
    foreach ($lines as $l) {
        $para .= "<p style='color:#374151;font-size:15px;line-height:1.6;margin:0 0 14px'>{$l}</p>";
    }
    $year = date('Y');
    return "<!DOCTYPE html><html><head><meta charset='UTF-8'></head>
<body style=\"font-family:'Helvetica Neue',Arial,sans-serif;background:#f9fafb;margin:0;padding:0\">
  <div style='max-width:480px;margin:40px auto;background:#ffffff;border-radius:12px;box-shadow:0 2px 12px rgba(0,0,0,0.08);overflow:hidden'>
    <div style='background:#059669;padding:28px 40px;text-align:center'>
      <h1 style='color:#ffffff;margin:0;font-size:20px;font-weight:700'>{$e($heading)}</h1>
      <p style='color:#a7f3d0;margin:4px 0 0;font-size:13px'>SkillConnect · Emerald Builders and Construction</p>
    </div>
    <div style='padding:32px 40px'>
      <p style='color:#374151;font-size:15px;line-height:1.6;margin:0 0 14px'>Hi <strong>{$e($name)}</strong>,</p>
      {$para}
      <p style='text-align:center;margin:24px 0 8px'>
        <a href='{$e($url)}' style='display:inline-block;background:#059669;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 24px;border-radius:8px'>{$e($buttonText)}</a>
      </p>
    </div>
    <div style='background:#f3f4f6;padding:18px 40px;text-align:center;color:#9ca3af;font-size:12px'>
      &copy; {$year} Emerald Builders &amp; Construction. All rights reserved.
    </div>
  </div>
</body></html>";
}