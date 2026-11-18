<?php
// backend/helpers/job-order-status.php
//
// Auto-advances job order status based on the contract dates (Asia/Manila time):
//   Scheduled                -> In Progress  once start_date has arrived
//   Scheduled / In Progress  -> Complete     once end_date has passed
//
// Only job orders that are already "Scheduled" (or "In Progress") are touched.
// Pending, Under Review, Active, On Hold and Cancelled are left alone.
// Every automatic change is written to audit_logs as actor "System".

if (!defined('JO_STATUS_COMPLETE')) {
    define('JO_STATUS_COMPLETE', 18);
    define('JO_STATUS_SCHEDULED', 21);
    define('JO_STATUS_IN_PROGRESS', 22);
}

/**
 * Today's date in the Philippines (YYYY-MM-DD).
 * Done in PHP because the DB session runs in UTC.
 */
function jobOrderToday()
{
    $now = new DateTime('now', new DateTimeZone('Asia/Manila'));
    return $now->format('Y-m-d');
}

/**
 * Which status a job order should have today, or null if it should not change.
 */
function jobOrderTargetStatus($currentStatusId, $startDate, $endDate, $today)
{
    $current = (int)$currentStatusId;
    if (!$startDate || !$endDate) return null;
    if ($current !== JO_STATUS_SCHEDULED && $current !== JO_STATUS_IN_PROGRESS) return null;

    // Contract already ended (the day after end_date) -> Complete
    if ($endDate < $today) {
        return JO_STATUS_COMPLETE;
    }
    // Contract has started -> In Progress
    if ($current === JO_STATUS_SCHEDULED && $startDate <= $today) {
        return JO_STATUS_IN_PROGRESS;
    }
    return null;
}

/**
 * Bring job order statuses up to date.
 *
 * @param PDO      $pdo
 * @param int|null $jobOrderId  Only check this job order; null = check all.
 * @return array   List of changes made: [['id','code','from','to'], ...]
 */
function syncJobOrderStatuses(PDO $pdo, $jobOrderId = null)
{
    $labels = [
        JO_STATUS_SCHEDULED   => 'Scheduled',
        JO_STATUS_IN_PROGRESS => 'In Progress',
        JO_STATUS_COMPLETE    => 'Complete',
    ];
    $today   = jobOrderToday();
    $changes = [];

    try {
        $sql = "SELECT jo.id, jo.job_order_code, jo.client_user_id, jo.status_id,
                       jo.start_date, jo.end_date,
                       CONCAT(c.first_name, ' ', c.last_name) AS client_name
                FROM job_orders jo
                LEFT JOIN users c ON c.id = jo.client_user_id
                WHERE jo.start_date IS NOT NULL
                  AND jo.end_date IS NOT NULL
                  AND (
                        (jo.status_id = ? AND jo.start_date <= ?)
                     OR (jo.status_id = ? AND jo.end_date < ?)
                  )";
        $params = [JO_STATUS_SCHEDULED, $today, JO_STATUS_IN_PROGRESS, $today];

        if ($jobOrderId) {
            $sql     .= " AND jo.id = ?";
            $params[] = (int)$jobOrderId;
        }

        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
        if (!$rows) return [];

        // "AND status_id = ?" makes this safe if two requests run at the same time:
        // only one of them will actually change the row and write the audit log.
        $upd = $pdo->prepare("UPDATE job_orders SET status_id = ? WHERE id = ? AND status_id = ?");

        $log = $pdo->prepare(
            "INSERT INTO audit_logs
                (actor_user_id, actor_name, actor_type, action, module, description,
                 target_user_id, target_type, target_id, target_label,
                 old_values, new_values, ip_address, user_agent, status)
             VALUES
                (NULL, 'System', 'guest', 'STATUS_CHANGE', 'Job Orders', ?,
                 ?, 'job_order', ?, ?,
                 ?, ?, NULL, 'auto-status (contract dates)', 'success')"
        );

        foreach ($rows as $r) {
            $from = (int)$r['status_id'];
            $to   = jobOrderTargetStatus($from, $r['start_date'], $r['end_date'], $today);
            if ($to === null || $to === $from) continue;

            $upd->execute([$to, (int)$r['id'], $from]);
            if ($upd->rowCount() !== 1) continue; // someone else already changed it

            $code = $r['job_order_code'] ?: ('#' . $r['id']);
            $changes[] = [
                'id'   => (int)$r['id'],
                'code' => $code,
                'from' => $labels[$from],
                'to'   => $labels[$to],
            ];

            try {
                $log->execute([
                    'Automatically changed job order ' . $code . ' status from "' . $labels[$from]
                        . '" to "' . $labels[$to] . '" (contract ' . $r['start_date'] . ' to ' . $r['end_date'] . ')',
                    $r['client_user_id'] ? (int)$r['client_user_id'] : null,
                    (int)$r['id'],
                    $code . ' — ' . trim((string)$r['client_name']),
                    json_encode(['status' => $labels[$from]]),
                    json_encode(['status' => $labels[$to]]),
                ]);
            } catch (PDOException $e) {
                error_log('[job-order-status] audit log failed for ' . $code . ': ' . $e->getMessage());
            }
        }
    } catch (PDOException $e) {
        // Never break the page because of the auto-update
        error_log('[job-order-status] sync failed: ' . $e->getMessage());
    }

    return $changes;
}