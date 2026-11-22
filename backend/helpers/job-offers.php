<?php
// backend/helpers/job-offers.php
//
// Job offers: "first worker to accept gets the job".
//
//  * When a job order has no worker yet and the admin has set the contract type,
//    the start date and the end date, the job is sent to every eligible worker
//    (Inbox message + email).
//  * A worker is eligible when:
//      - their specialization is the job's service (inquiry reason = specializations.name)
//      - their account is Active (status_id 1)
//      - they have at least one license that has not expired
//      - they have no other open job order (Pending, Under Review, Active,
//        Scheduled, In Progress) whose dates overlap this one
//      - they have not already said "Not interested" to this job
//  * The admin can only pick a worker directly once the offer is over
//    (24 hours passed, no eligible worker, or everyone declined), or with "Assign now anyway".
//
// All times are Asia/Manila (the DB session runs in UTC, so times are made in PHP).

require_once __DIR__ . '/../config/brevo.php';

if (!defined('JOB_OFFER_HOURS')) {
    define('JOB_OFFER_HOURS', 24);
    define('JOB_OFFER_FROM_EMAIL', 'luzongabril@gmail.com');
    define('JOB_OFFER_FROM_NAME', 'SkillConnect – Emerald Builders');
    define('JOB_OFFER_APP_URL', 'https://emerald-skillconnect.com');
    // Job order statuses that keep a worker busy for their dates
    define('JOB_OFFER_BUSY_STATUSES', '16,17,20,21,22'); // Pending, Under Review, Active, Scheduled, In Progress
    define('JOB_OFFER_WORKER_ACTIVE', 1);
    // Offers are only sent while the job order is Under Review
    // (the admin agrees the dates with the customer during this stage)
    define('JOB_OFFER_REVIEW_STATUS', 20);
}

/** Job order statuses where the job is over and no offer should stay open. */
function jobOfferClosedStatuses(): array
{
    return [18, 23]; // Complete, Cancelled
}

function jobOfferTz(): DateTimeZone
{
    return new DateTimeZone('Asia/Manila');
}

/** Now in Manila as 'Y-m-d H:i:s'. */
function jobOfferNow(): string
{
    return (new DateTime('now', jobOfferTz()))->format('Y-m-d H:i:s');
}

/** Today in Manila as 'Y-m-d'. */
function jobOfferToday(): string
{
    return (new DateTime('now', jobOfferTz()))->format('Y-m-d');
}

/** Name of the column in `licenses` that points to the worker (user_id in the new schema). */
function jobOfferLicenseOwnerColumn(PDO $pdo): string
{
    static $col = null;
    if ($col !== null) return $col;
    $col = 'user_id';
    try {
        $has = $pdo->query("SHOW COLUMNS FROM licenses LIKE 'user_id'")->fetch();
        if (!$has) {
            $old = $pdo->query("SHOW COLUMNS FROM licenses LIKE 'contact_id'")->fetch();
            if ($old) $col = 'contact_id';
        }
    } catch (Throwable $e) {
        // keep the default
    }
    return $col;
}

/** A job order with its service, contract, status and client details. */
function jobOfferLoad(PDO $pdo, int $jobOrderId): ?array
{
    $st = $pdo->prepare(
        "SELECT jo.*,
                sp.id   AS service_id,
                sp.name AS service,
                ct.name AS contract_type,
                s.label AS status,
                COALESCE(NULLIF(c.address, ''), i.address) AS client_address,
                TRIM(CONCAT(COALESCE(c.first_name,''),' ',COALESCE(c.last_name,''))) AS client_name
         FROM job_orders jo
         LEFT JOIN inquiries i        ON i.id  = jo.inquiry_id
         LEFT JOIN users c            ON c.id  = jo.client_user_id
         LEFT JOIN statuses s         ON s.id  = jo.status_id
         LEFT JOIN contract_types ct  ON ct.id = jo.contract_type_id
         LEFT JOIN specializations sp ON sp.name = COALESCE(NULLIF(i.reason, ''), jo.description)
         WHERE jo.id = ?"
    );
    $st->execute([$jobOrderId]);
    $row = $st->fetch(PDO::FETCH_ASSOC);
    return $row ?: null;
}

/** Only the general area of an address (last two parts, e.g. "Quezon City, Metro Manila"). */
function jobOfferArea(?string $address): string
{
    $address = trim((string)$address);
    if ($address === '') return '';
    $parts = array_values(array_filter(array_map('trim', explode(',', $address)), 'strlen'));
    if (count($parts) <= 2) return implode(', ', $parts);
    return implode(', ', array_slice($parts, -2));
}

/**
 * Workers who can take this job right now.
 *
 * @param int|null $onlyWorkerId  Check just this worker (used when a worker presses Accept).
 * @return array  [['id','first_name','last_name','email'], ...]
 */
function jobOfferEligibleWorkers(PDO $pdo, array $jo, ?int $onlyWorkerId = null): array
{
    if (empty($jo['service_id']) || empty($jo['start_date']) || empty($jo['end_date'])) return [];

    $licCol = jobOfferLicenseOwnerColumn($pdo);
    $busy   = JOB_OFFER_BUSY_STATUSES;

    $sql = "SELECT u.id, u.first_name, u.last_name, u.email
            FROM users u
            WHERE u.type = 'worker'
              AND u.status_id = :active
              AND u.specialization_id = :service
              -- at least one license that has not expired
              AND EXISTS (
                    SELECT 1 FROM licenses l
                    WHERE l.`$licCol` = u.id
                      AND l.expiry_date IS NOT NULL
                      AND l.expiry_date >= :today
              )
              -- no other open job order on the same dates
              AND NOT EXISTS (
                    SELECT 1 FROM job_orders o
                    WHERE o.worker_user_id = u.id
                      AND o.id <> :jo1
                      AND o.status_id IN ($busy)
                      AND o.start_date IS NOT NULL AND o.end_date IS NOT NULL
                      AND o.start_date <= :end_date
                      AND o.end_date   >= :start_date
              )
              -- has not said Not interested to this job
              AND NOT EXISTS (
                    SELECT 1 FROM worker_inbox m
                    WHERE m.user_id = u.id
                      AND m.job_order_id = :jo2
                      AND m.type = 'job_offer'
                      AND m.response = 'declined'
              )";
    $params = [
        ':active'     => JOB_OFFER_WORKER_ACTIVE,
        ':service'    => (int)$jo['service_id'],
        ':today'      => jobOfferToday(),
        ':jo1'        => (int)$jo['id'],
        ':jo2'        => (int)$jo['id'],
        ':start_date' => $jo['start_date'],
        ':end_date'   => $jo['end_date'],
    ];
    if ($onlyWorkerId) {
        $sql .= " AND u.id = :only";
        $params[':only'] = $onlyWorkerId;
    }
    $sql .= " ORDER BY u.first_name, u.last_name";

    $st = $pdo->prepare($sql);
    $st->execute($params);
    return $st->fetchAll(PDO::FETCH_ASSOC);
}

/**
 * Send (or re-send) the job to every eligible worker.
 * Old offers for this job are replaced, so "Not interested" answers are reset
 * when the admin changes the terms (dates / contract).
 *
 * @return array ['sent' => int, 'emailed' => int]
 */
function jobOfferSend(PDO $pdo, int $jobOrderId, bool $resetDeclines = true): array
{
    $jo = jobOfferLoad($pdo, $jobOrderId);
    if (!$jo || !empty($jo['worker_user_id'])) return ['sent' => 0, 'emailed' => 0];

    $now = jobOfferNow();

    if ($resetDeclines) {
        $pdo->prepare("DELETE FROM worker_inbox WHERE job_order_id = ? AND type = 'job_offer'")
            ->execute([$jobOrderId]);
    } else {
        $pdo->prepare("DELETE FROM worker_inbox WHERE job_order_id = ? AND type = 'job_offer' AND response IS NULL")
            ->execute([$jobOrderId]);
    }

    // Start the 24-hour window (also when nobody matches, so the admin can assign right away)
    $pdo->prepare("UPDATE job_orders SET offered_at = ?, accepted_at = NULL, assigned_by = NULL WHERE id = ?")
        ->execute([$now, $jobOrderId]);

    $workers = jobOfferEligibleWorkers($pdo, $jo);
    if (!$workers) return ['sent' => 0, 'emailed' => 0];

    $code  = $jo['job_order_code'] ?: ('#' . $jobOrderId);
    $title = 'New job offer: ' . ($jo['service'] ?: 'Job') . ' (' . $code . ')';
    $body  = jobOfferSummary($jo);

    $ins = $pdo->prepare(
        "INSERT INTO worker_inbox (user_id, job_order_id, type, title, body, created_at)
         VALUES (?, ?, 'job_offer', ?, ?, ?)"
    );

    $sent = 0; $emailed = 0;
    foreach ($workers as $w) {
        $ins->execute([(int)$w['id'], $jobOrderId, $title, $body, $now]);
        $sent++;
        if (!empty($w['email'])) {
            $name = trim($w['first_name'] . ' ' . $w['last_name']);
            $html = jobOfferMailHtml($name, 'You have a new job offer', [
                'A new <strong>' . htmlspecialchars($jo['service'] ?: 'job', ENT_QUOTES, 'UTF-8') . '</strong> job matches your specialization.',
                'The first worker to accept gets the job, so open your Inbox soon. The offer is open for ' . JOB_OFFER_HOURS . ' hours.',
            ], $jo, false);
            if (jobOfferSendMail($w['email'], $name, $title, $html)) $emailed++;
        }
    }
    return ['sent' => $sent, 'emailed' => $emailed];
}

/** Tell a worker that the admin assigned them directly (Inbox + email). */
function jobOfferNotifyAssigned(PDO $pdo, int $jobOrderId, int $workerId): void
{
    $jo = jobOfferLoad($pdo, $jobOrderId);
    if (!$jo) return;

    $w = $pdo->prepare("SELECT id, first_name, last_name, email FROM users WHERE id = ? AND type = 'worker'");
    $w->execute([$workerId]);
    $worker = $w->fetch(PDO::FETCH_ASSOC);
    if (!$worker) return;

    $code  = $jo['job_order_code'] ?: ('#' . $jobOrderId);
    $title = 'You were assigned to ' . $code . ($jo['service'] ? ' (' . $jo['service'] . ')' : '');
    $body  = jobOfferSummary($jo);

    $pdo->prepare(
        "INSERT INTO worker_inbox (user_id, job_order_id, type, title, body, created_at)
         VALUES (?, ?, 'job_assigned', ?, ?, ?)"
    )->execute([$workerId, $jobOrderId, $title, $body, jobOfferNow()]);

    if (!empty($worker['email'])) {
        $name = trim($worker['first_name'] . ' ' . $worker['last_name']);
        $html = jobOfferMailHtml($name, 'You have a new job assignment', [
            'The admin assigned you to job order <strong>' . htmlspecialchars($code, ENT_QUOTES, 'UTF-8') . '</strong>.',
            'You can see the full details in your Inbox and under My Job Orders.',
        ], $jo, true);
        jobOfferSendMail($worker['email'], $name, $title, $html);
    }
}

/** One short line used as the Inbox message body. */
function jobOfferSummary(array $jo): string
{
    $parts = [];
    if (!empty($jo['contract_type'])) $parts[] = $jo['contract_type'];
    if (!empty($jo['start_date']) && !empty($jo['end_date'])) {
        $parts[] = jobOfferDate($jo['start_date']) . ' – ' . jobOfferDate($jo['end_date']);
    }
    $area = jobOfferArea($jo['client_address'] ?? '');
    if ($area !== '') $parts[] = $area;
    return mb_substr(implode(' · ', $parts), 0, 500);
}

function jobOfferDate(?string $d): string
{
    if (!$d) return '';
    $t = strtotime($d);
    return $t ? date('M j, Y', $t) : $d;
}

/** Email HTML in the same style as the welcome email. */
function jobOfferMailHtml(string $name, string $heading, array $lines, array $jo, bool $fullAddress): string
{
    $e = fn($v) => htmlspecialchars((string)$v, ENT_QUOTES, 'UTF-8');

    $rows = [
        'Job order' => $jo['job_order_code'] ?? '',
        'Service'   => $jo['service'] ?? '',
        'Contract'  => $jo['contract_type'] ?? '',
        'Dates'     => (!empty($jo['start_date']) && !empty($jo['end_date']))
                        ? jobOfferDate($jo['start_date']) . ' – ' . jobOfferDate($jo['end_date']) : '',
        'Location'  => $fullAddress ? ($jo['client_address'] ?? '') : jobOfferArea($jo['client_address'] ?? ''),
    ];
    $rowsHtml = '';
    foreach ($rows as $label => $value) {
        if (trim((string)$value) === '') continue;
        $rowsHtml .= "<tr><td style='padding:8px 0;color:#6b7280;font-size:13px;font-weight:600;width:110px;vertical-align:top'>{$e($label)}</td>"
                   . "<td style='padding:8px 0;color:#065f46;font-size:14px;font-weight:600'>{$e($value)}</td></tr>";
    }
    $para = '';
    foreach ($lines as $l) {
        $para .= "<p style='color:#374151;font-size:15px;line-height:1.6;margin:0 0 14px'>{$l}</p>";
    }
    $url  = JOB_OFFER_APP_URL . '/worker/inbox';
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
      <div style='background:#f0fdf4;border:1px solid #a7f3d0;border-radius:10px;padding:12px 18px;margin:20px 0'>
        <table style='width:100%;border-collapse:collapse'>{$rowsHtml}</table>
      </div>
      <p style='text-align:center;margin:24px 0 8px'>
        <a href='{$e($url)}' style='display:inline-block;background:#059669;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 24px;border-radius:8px'>Open my Inbox</a>
      </p>
    </div>
    <div style='background:#f3f4f6;padding:18px 40px;text-align:center;color:#9ca3af;font-size:12px'>
      &copy; {$year} Emerald Builders &amp; Construction. All rights reserved.
    </div>
  </div>
</body></html>";
}

/** Send one email through Brevo. Never throws; returns true when Brevo accepted it. */
function jobOfferSendMail(string $email, string $name, string $subject, string $html): bool
{
    if (!defined('BREVO_API_KEY') || BREVO_API_KEY === '') {
        error_log("[SkillConnect DEV] Job email to {$email} skipped (no Brevo key): {$subject}");
        return false;
    }
    try {
        $ch = curl_init('https://api.brevo.com/v3/smtp/email');
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST           => true,
            CURLOPT_TIMEOUT        => 8,
            CURLOPT_CONNECTTIMEOUT => 5,
            CURLOPT_POSTFIELDS     => json_encode([
                'sender'      => ['name' => JOB_OFFER_FROM_NAME, 'email' => JOB_OFFER_FROM_EMAIL],
                'to'          => [['email' => $email, 'name' => $name ?: $email]],
                'subject'     => $subject,
                'htmlContent' => $html,
            ]),
            CURLOPT_HTTPHEADER     => [
                'accept: application/json',
                'api-key: ' . BREVO_API_KEY,
                'content-type: application/json',
            ],
        ]);
        $response   = curl_exec($ch);
        $httpStatus = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $curlError  = curl_error($ch);
        curl_close($ch);
        if ($httpStatus < 200 || $httpStatus >= 300) {
            error_log("[SkillConnect] Job email failed. HTTP {$httpStatus} | curl: {$curlError} | response: {$response}");
            return false;
        }
        return true;
    } catch (Throwable $e) {
        error_log('[SkillConnect] Job email error: ' . $e->getMessage());
        return false;
    }
}

/** How many workers got this offer and how many said Not interested. */
function jobOfferCounts(PDO $pdo, int $jobOrderId): array
{
    $st = $pdo->prepare(
        "SELECT COUNT(*) AS sent, COALESCE(SUM(response = 'declined'), 0) AS declined
         FROM worker_inbox WHERE job_order_id = ? AND type = 'job_offer'"
    );
    $st->execute([$jobOrderId]);
    $r = $st->fetch(PDO::FETCH_ASSOC) ?: ['sent' => 0, 'declined' => 0];
    return ['sent' => (int)$r['sent'], 'declined' => (int)$r['declined']];
}

/**
 * Offer state of a job order row (needs offered_at, worker_user_id, status_id,
 * offers_sent, offers_declined).
 *
 *   assigned      a worker has the job
 *   closed        Complete / Cancelled
 *   not_sent      not sent (not Under Review yet, or contract type / dates missing)
 *   no_match      sent, but no worker qualified        -> admin can assign
 *   all_declined  every worker said Not interested      -> admin can assign
 *   expired       24 hours passed with no accept        -> admin can assign
 *   waiting       workers still have time to accept     -> admin is locked
 *
 * @return array ['state' => string, 'expires_at' => ?string, 'can_assign' => bool]
 */
function jobOfferState(array $row): array
{
    $expires = null;
    if (!empty($row['offered_at'])) {
        $dt = new DateTime($row['offered_at'], jobOfferTz());
        $dt->modify('+' . JOB_OFFER_HOURS . ' hours');
        $expires = $dt->format('Y-m-d H:i:s');
    }
    $sent     = (int)($row['offers_sent'] ?? 0);
    $declined = (int)($row['offers_declined'] ?? 0);

    if (!empty($row['worker_user_id']))                                   $state = 'assigned';
    elseif (in_array((int)($row['status_id'] ?? 0), jobOfferClosedStatuses(), true)) $state = 'closed';
    elseif ((int)($row['status_id'] ?? 0) !== JOB_OFFER_REVIEW_STATUS)    $state = 'not_sent';
    elseif (empty($row['offered_at']))                                    $state = 'not_sent';
    elseif ($sent === 0)                                                  $state = 'no_match';
    elseif ($declined >= $sent)                                           $state = 'all_declined';
    elseif ($expires && $expires <= jobOfferNow())                        $state = 'expired';
    else                                                                  $state = 'waiting';

    return [
        'state'      => $state,
        'expires_at' => $expires,
        'can_assign' => $state !== 'waiting',
    ];
}