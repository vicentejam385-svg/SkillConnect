<?php
// backend/helpers/site-visits.php
//
// Site visits (the `schedules` table):
//   ocular    inspection while the job order is Under Review (before the dates are agreed)
//   progress  inspection while the job is Scheduled / In Progress
//   other     anything else
// Visits are Monday to Friday only, one day each, and a worker can't have two visits at the same time.
// The worker gets an Inbox message and an email for every new or changed visit.
//
// Ocular date agreement (automatic):
//   When a job order becomes Scheduled, the system picks a random free weekday between the job's
//   start and end dates (9:00–11:00 AM) and asks the CUSTOMER first. The customer accepts or suggests
//   another date, then the WORKER accepts or suggests another date, and so on. When both agree the
//   visit is Planned. After 3 suggestions the last answer can only be "accept" or "let the admin decide".
//   The admin can set the final date at any time.

require_once __DIR__ . '/job-order-status.php';
require_once __DIR__ . '/job-offers.php';   // email sending + license column helper

if (!defined('SV_PENDING')) {
    define('SV_PENDING', 11);
    define('SV_SCHEDULED', 12);
    define('SV_IN_PROGRESS', 13);
    define('SV_COMPLETE', 14);
    define('SV_CANCELLED', 15);
    define('SV_DAY_START', '09:00:00');   // proposed visits are always 9:00–11:00 AM
    define('SV_DAY_END', '11:00:00');
    define('SV_MAX_ROUNDS', 3);           // "suggest another date" at most 3 times
    define('SV_ANSWER_DAYS', 2);          // flag for the admin after 2 days without an answer
}

function svOpenStatuses(): array { return [SV_PENDING, SV_SCHEDULED, SV_IN_PROGRESS]; }

function svTypeLabel(?string $type): string
{
    return ['ocular' => 'Ocular inspection', 'progress' => 'Progress inspection', 'other' => 'Site visit'][$type ?? ''] ?? 'Site visit';
}

/** One visit with its job order, worker, client and address. */
function svLoad(PDO $pdo, int $id): ?array
{
    $st = $pdo->prepare(
        "SELECT sc.*, s.label AS status,
                TRIM(CONCAT(COALESCE(w.first_name,''),' ',COALESCE(w.last_name,''))) AS worker_name,
                w.email AS worker_email,
                TRIM(CONCAT(COALESCE(c.first_name,''),' ',COALESCE(c.last_name,''))) AS client_name,
                c.mobile AS client_mobile,
                c.email AS client_email,
                jo.job_order_code, jo.status_id AS job_status_id, jo.worker_user_id AS job_worker_id,
                jo.client_user_id AS job_client_id, jo.start_date AS job_start_date, jo.end_date AS job_end_date,
                COALESCE(NULLIF(c.address, ''), i.address) AS address,
                sp.name AS service
         FROM schedules sc
         LEFT JOIN statuses s   ON s.id  = sc.status_id
         LEFT JOIN users w      ON w.id  = sc.worker_user_id
         LEFT JOIN job_orders jo ON jo.id = sc.job_order_id
         LEFT JOIN users c      ON c.id  = COALESCE(sc.client_user_id, jo.client_user_id)
         LEFT JOIN inquiries i  ON i.id  = jo.inquiry_id
         LEFT JOIN specializations sp ON sp.name = COALESCE(NULLIF(i.reason, ''), jo.description)
         WHERE sc.id = ?"
    );
    $st->execute([$id]);
    $row = $st->fetch(PDO::FETCH_ASSOC);
    return $row ?: null;
}

/** A job order with what a site visit needs. */
function svLoadJob(PDO $pdo, int $id): ?array
{
    $st = $pdo->prepare(
        "SELECT jo.*, sp.id AS service_id, sp.name AS service,
                COALESCE(NULLIF(c.address, ''), i.address) AS address,
                TRIM(CONCAT(COALESCE(c.first_name,''),' ',COALESCE(c.last_name,''))) AS client_name
         FROM job_orders jo
         LEFT JOIN inquiries i ON i.id = jo.inquiry_id
         LEFT JOIN users c     ON c.id = jo.client_user_id
         LEFT JOIN specializations sp ON sp.name = COALESCE(NULLIF(i.reason, ''), jo.description)
         WHERE jo.id = ?"
    );
    $st->execute([$id]);
    $row = $st->fetch(PDO::FETCH_ASSOC);
    return $row ?: null;
}

/** "2026-12-01T09:00" or "2026-12-01 09:00:00" -> "2026-12-01 09:00:00", or null. */
function svNormalizeTime($value): ?string
{
    $v = trim(str_replace('T', ' ', (string)$value));
    if ($v === '') return null;
    $dt = DateTime::createFromFormat('Y-m-d H:i:s', strlen($v) === 16 ? $v . ':00' : $v, jobOrderTz());
    return $dt ? $dt->format('Y-m-d H:i:s') : null;
}

/** Monday–Friday, same day, end after start, not in the past. Returns an error or null. */
function svCheckSlot(?string $start, ?string $end, bool $allowPast = false): ?string
{
    if (!$start || !$end) return 'Pick the date, start time and end time.';
    if ($end <= $start) return 'The end time must be after the start time.';
    if (substr($start, 0, 10) !== substr($end, 0, 10)) return 'A site visit must start and end on the same day.';
    $dow = (int)(new DateTime($start, jobOrderTz()))->format('N'); // 1 = Monday ... 7 = Sunday
    if ($dow >= 6) return 'Site visits are Monday to Friday only.';
    if (!$allowPast && $start <= jobOrderNow()) return 'Pick a time later than now.';
    return null;
}

/** Code of another open visit of this worker that overlaps, or null. */
function svWorkerClash(PDO $pdo, int $workerId, string $start, string $end, ?int $excludeId = null): ?string
{
    $open = implode(',', svOpenStatuses());
    $st = $pdo->prepare(
        "SELECT COALESCE(schedule_code, CONCAT('#', id)) FROM schedules
         WHERE worker_user_id = ? AND status_id IN ($open)
           AND start_time < ? AND end_time > ? AND id <> ?
         LIMIT 1"
    );
    $st->execute([$workerId, $end, $start, $excludeId ?? 0]);
    $code = $st->fetchColumn();
    return $code ?: null;
}

/**
 * Workers who could go on a visit for this job, with notes for the picker.
 * Ocular visits need the job's specialization and a valid license.
 */
function svWorkerOptions(PDO $pdo, array $jo, ?string $start, ?string $end, ?int $excludeVisitId = null): array
{
    $licCol = jobOfferLicenseOwnerColumn($pdo);
    $st = $pdo->prepare(
        "SELECT u.id, TRIM(CONCAT(u.first_name,' ',u.last_name)) AS full_name, u.specialization_id,
                sp.name AS specialization,
                EXISTS (SELECT 1 FROM licenses l WHERE l.`$licCol` = u.id
                          AND l.expiry_date IS NOT NULL AND l.expiry_date >= ?) AS license_ok
         FROM users u
         LEFT JOIN specializations sp ON sp.id = u.specialization_id
         WHERE u.type = 'worker' AND u.status_id = 1
         ORDER BY u.first_name, u.last_name"
    );
    $st->execute([jobOrderToday()]);
    $out = [];
    foreach ($st->fetchAll(PDO::FETCH_ASSOC) as $w) {
        $wid = (int)$w['id'];
        $out[] = [
            'id'             => $wid,
            'full_name'      => $w['full_name'],
            'specialization' => $w['specialization'],
            'matches'        => !empty($jo['service_id']) && (int)$w['specialization_id'] === (int)$jo['service_id'],
            'license_ok'     => (bool)$w['license_ok'],
            'is_assigned'    => !empty($jo['worker_user_id']) && (int)$jo['worker_user_id'] === $wid,
            'busy_with'      => ($start && $end) ? svWorkerClash($pdo, $wid, $start, $end, $excludeVisitId) : null,
        ];
    }
    return $out;
}

/** Which visit types are allowed for this job order status. */
function svAllowedTypes(int $jobStatus): array
{
    if ($jobStatus === JO_STATUS_UNDER_REVIEW) return ['ocular', 'other'];
    // Scheduled: the ocular visit normally comes automatically, but the admin can still plan one by hand
    if ($jobStatus === JO_STATUS_SCHEDULED) return ['ocular', 'progress', 'other'];
    if (in_array($jobStatus, [JO_STATUS_IN_PROGRESS, JO_STATUS_ACTIVE], true)) return ['progress', 'other'];
    return [];
}

/** Check that a worker can go on this visit. Returns an error or null. */
function svCheckWorker(PDO $pdo, array $jo, string $type, int $workerId): ?string
{
    $opts = svWorkerOptions($pdo, $jo, null, null);
    foreach ($opts as $o) {
        if ($o['id'] !== $workerId) continue;
        if ($type === 'ocular') {
            if (!$o['matches']) return $o['full_name'] . ' does not specialise in ' . ($jo['service'] ?: 'this service') . '.';
            if (!$o['license_ok']) return $o['full_name'] . ' has no valid license.';
        }
        return null;
    }
    return 'Choose an active worker.';
}

function svFmtSlot(string $start, string $end): string
{
    $s = new DateTime($start, jobOrderTz());
    $e = new DateTime($end, jobOrderTz());
    return $s->format('D, M j, Y · g:i A') . ' – ' . $e->format('g:i A');
}

/**
 * Inbox message (+ email) to the visit's worker.
 * $type: 'site_visit' for a new visit, 'visit_update' for changes / cancellations / reschedule answers.
 */
function svNotify(PDO $pdo, int $visitId, string $type, string $title, ?string $body = null, ?int $workerId = null, bool $email = true): void
{
    try {
        $v = svLoad($pdo, $visitId);
        if (!$v) return;
        $wid = $workerId ?? (int)$v['worker_user_id'];
        if (!$wid) return;

        $pdo->prepare(
            "INSERT INTO worker_inbox (user_id, job_order_id, schedule_id, type, title, body, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?)"
        )->execute([$wid, $v['job_order_id'] ?: null, $visitId, $type, mb_substr($title, 0, 200),
                    $body !== null ? mb_substr($body, 0, 500) : null, jobOrderNow()]);

        if (!$email) return;
        $w = $pdo->prepare("SELECT TRIM(CONCAT(first_name,' ',last_name)) AS n, email FROM users WHERE id = ?");
        $w->execute([$wid]);
        $worker = $w->fetch(PDO::FETCH_ASSOC);
        if (!$worker || empty($worker['email'])) return;

        $e = fn($x) => htmlspecialchars((string)$x, ENT_QUOTES, 'UTF-8');
        $lines = [];
        if ($body) $lines[] = $e($body);
        $lines[] = '<strong>' . $e(svTypeLabel($v['visit_type'])) . '</strong> · ' . $e(svFmtSlot($v['start_time'], $v['end_time']));
        if (!empty($v['address'])) $lines[] = 'Address: ' . $e($v['address']);
        if (!empty($v['job_order_code'])) $lines[] = 'Job order: ' . $e($v['job_order_code']) . ($v['service'] ? ' (' . $e($v['service']) . ')' : '');
        $html = jobOrderMailHtml($worker['n'] ?: 'Worker', $title, $lines, 'Open my schedule', JOB_OFFER_APP_URL . '/worker/schedules');
        jobOfferSendMail($worker['email'], $worker['n'] ?: '', $title, $html);
    } catch (Throwable $e) {
        error_log('[site-visits] notify failed for visit ' . $visitId . ': ' . $e->getMessage());
    }
}


// ═════════════════════════════════════════════════════════════════════════════
// Ocular date agreement
// ═════════════════════════════════════════════════════════════════════════════

/** Tomorrow in the Philippines (YYYY-MM-DD). */
function svTomorrow(): string
{
    return (new DateTime('tomorrow', jobOrderTz()))->format('Y-m-d');
}

/** "2026-12-02" -> ["2026-12-02 09:00:00", "2026-12-02 11:00:00"] */
function svDaySlot(string $date): array
{
    return [$date . ' ' . SV_DAY_START, $date . ' ' . SV_DAY_END];
}

/** Code of another open visit this worker has on that day, or null. */
function svWorkerBusyDay(PDO $pdo, int $workerId, string $date, ?int $excludeId = null): ?string
{
    $open = implode(',', svOpenStatuses());
    $st = $pdo->prepare(
        "SELECT COALESCE(schedule_code, CONCAT('#', id)) FROM schedules
         WHERE worker_user_id = ? AND status_id IN ($open)
           AND start_time >= ? AND start_time < ? AND id <> ?
         LIMIT 1"
    );
    $next = (new DateTime($date, jobOrderTz()))->modify('+1 day')->format('Y-m-d');
    $st->execute([$workerId, $date . ' 00:00:00', $next . ' 00:00:00', $excludeId ?? 0]);
    $code = $st->fetchColumn();
    return $code ?: null;
}

/**
 * Can this date be used for the visit? Returns an error or null.
 * Weekday, from tomorrow, inside the job order dates, and the worker has no other visit that day.
 */
function svCheckProposedDate(PDO $pdo, string $date, ?string $jobStart, ?string $jobEnd, ?int $workerId, ?int $excludeId = null): ?string
{
    $d = DateTime::createFromFormat('!Y-m-d', $date, jobOrderTz());
    if (!$d || $d->format('Y-m-d') !== $date) return 'Pick a valid date.';
    if ((int)$d->format('N') >= 6) return 'Site visits are Monday to Friday only.';
    if ($date < svTomorrow()) return 'Pick a date from tomorrow onwards.';
    if ($jobStart && $date < substr($jobStart, 0, 10)) return 'Pick a date on or after the job start date (' . svFmtDay($jobStart) . ').';
    if ($jobEnd && $date > substr($jobEnd, 0, 10)) return 'Pick a date on or before the job end date (' . svFmtDay($jobEnd) . ').';
    if ($workerId && svWorkerBusyDay($pdo, $workerId, $date, $excludeId)) return 'The worker already has another site visit on that day. Please pick another date.';
    return null;
}

function svFmtDay(string $date): string
{
    return (new DateTime(substr($date, 0, 10), jobOrderTz()))->format('D, M j, Y');
}

/** A random free weekday for the worker inside the job dates (from tomorrow), or null. */
function svPickRandomDay(PDO $pdo, array $jo, int $workerId): ?string
{
    if (empty($jo['start_date']) || empty($jo['end_date'])) return null;
    $from = max(substr($jo['start_date'], 0, 10), svTomorrow());
    $to   = substr($jo['end_date'], 0, 10);
    $days = [];
    $d    = new DateTime($from, jobOrderTz());
    for ($i = 0; $i < 366 && $d->format('Y-m-d') <= $to; $i++, $d->modify('+1 day')) {
        if ((int)$d->format('N') >= 6) continue;
        $days[] = $d->format('Y-m-d');
    }
    // Try the days in random order; the first one without another visit wins
    for ($n = count($days); $n > 0; $n--) {
        $k   = random_int(0, $n - 1);
        $day = $days[$k];
        $days[$k] = $days[$n - 1];
        if (!svWorkerBusyDay($pdo, $workerId, $day)) return $day;
    }
    return null;
}

/** Does the worker see this visit yet? Not while only the customer has the first proposal. */
function svWorkerCanSee(array $v): bool
{
    return !(($v['prop_turn'] ?? null) === 'customer' && empty($v['prop_worker_ok']));
}

/**
 * The agreement rules, without the database (easy to test).
 * $s = ['turn' => customer|worker|admin|null, 'round' => int, 'customer_ok' => 0|1, 'worker_ok' => 0|1]
 * $who = customer | worker | admin,  $action = accept | counter | escalate | final
 * Returns [new state, outcome] where outcome is 'final', 'customer', 'worker' or 'admin' (whose turn is next),
 * or [null, error message].
 */
function svAgreementStep(array $s, string $who, string $action): array
{
    $turn = $s['turn'] ?? null;
    if ($turn === null) return [null, 'This date is already settled.'];
    if ($action === 'final') {
        if ($who !== 'admin') return [null, 'Only the admin can set the final date.'];
        return [array_merge($s, ['turn' => null, 'customer_ok' => 1, 'worker_ok' => 1]), 'final'];
    }
    if ($who !== $turn) {
        return [null, $turn === 'admin' ? 'The admin will set the date.' : 'Waiting for the ' . $turn . ' to answer.'];
    }
    $other = $who === 'customer' ? 'worker' : 'customer';
    switch ($action) {
        case 'accept':
            if ($who === 'admin') return [null, 'Use "Set final date".'];
            $s[$who . '_ok'] = 1;
            if (!empty($s['customer_ok']) && !empty($s['worker_ok'])) {
                $s['turn'] = null;
                return [$s, 'final'];
            }
            $s['turn'] = $other;
            return [$s, $other];
        case 'counter':
            if ($who === 'admin') return [null, 'Use "Set final date".'];
            if ((int)$s['round'] >= SV_MAX_ROUNDS) {
                return [null, 'Another date was already suggested ' . SV_MAX_ROUNDS . ' times. Accept this date or let the admin decide.'];
            }
            $s['round'] = (int)$s['round'] + 1;
            $s[$who . '_ok']   = 1;
            $s[$other . '_ok'] = 0;
            $s['turn'] = $other;
            return [$s, $other];
        case 'escalate':
            if ($who === 'admin') return [null, 'Use "Set final date".'];
            $s['turn'] = 'admin';
            return [$s, 'admin'];
    }
    return [null, 'Unknown action.'];
}

/** Save one line of the agreement history. Never throws. */
function svLogProposal(PDO $pdo, int $visitId, string $by, string $action, ?string $start, ?string $end, ?int $userId = null): void
{
    try {
        $pdo->prepare(
            "INSERT INTO visit_proposals (schedule_id, proposed_by, user_id, action, start_time, end_time, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?)"
        )->execute([$visitId, $by, $userId, $action, $start, $end, jobOrderNow()]);
    } catch (Throwable $e) {
        error_log('[site-visits] proposal log failed: ' . $e->getMessage());
    }
}

/** History per visit id: [visit_id => [ {by, action, start_time, end_time, created_at}, ... ]] */
function svProposalHistory(PDO $pdo, array $visitIds): array
{
    $ids = array_values(array_unique(array_filter(array_map('intval', $visitIds))));
    if (!$ids) return [];
    try {
        $in = implode(',', array_fill(0, count($ids), '?'));
        $st = $pdo->prepare(
            "SELECT schedule_id, proposed_by AS `by`, action, start_time, end_time, created_at
             FROM visit_proposals WHERE schedule_id IN ($in) ORDER BY id"
        );
        $st->execute($ids);
        $out = [];
        foreach ($st->fetchAll(PDO::FETCH_ASSOC) as $r) {
            $sid = (int)$r['schedule_id'];
            unset($r['schedule_id']);
            $out[$sid][] = $r;
        }
        return $out;
    } catch (Throwable $e) {
        return [];
    }
}

/** Email the customer of a visit. Never throws. */
function svMailCustomer(PDO $pdo, int $visitId, string $subject, array $lines, string $button = 'Open my job orders'): void
{
    try {
        $v = svLoad($pdo, $visitId);
        if (!$v || empty($v['client_email'])) return;
        $e   = fn($x) => htmlspecialchars((string)$x, ENT_QUOTES, 'UTF-8');
        $all = $lines;
        $all[] = '<strong>' . $e(svTypeLabel($v['visit_type'])) . '</strong> · ' . $e(svFmtSlot($v['start_time'], $v['end_time']));
        if (!empty($v['job_order_code'])) $all[] = 'Job order: ' . $e($v['job_order_code']) . ($v['service'] ? ' (' . $e($v['service']) . ')' : '');
        $name = trim((string)$v['client_name']) ?: 'Customer';
        $html = jobOrderMailHtml($name, $subject, $all, $button, JOB_OFFER_APP_URL . '/customer/job-orders');
        jobOfferSendMail($v['client_email'], $name, $subject, $html);
    } catch (Throwable $e) {
        error_log('[site-visits] customer mail failed for visit ' . $visitId . ': ' . $e->getMessage());
    }
}

/** Tell both sides that the date is final. */
function svAnnounceFinal(PDO $pdo, int $visitId, bool $workerSawItBefore, string $byText): void
{
    $v = svLoad($pdo, $visitId);
    if (!$v) return;
    $label = svTypeLabel($v['visit_type']);
    $day   = (new DateTime($v['start_time'], jobOrderTz()))->format('M j');
    if ($v['worker_user_id']) {
        svNotify($pdo, $visitId, $workerSawItBefore ? 'visit_update' : 'site_visit',
            'Site visit confirmed: ' . $label . ' on ' . $day, $byText . ' Please be at the site on time.');
    }
    svMailCustomer($pdo, $visitId, 'Your site visit is confirmed',
        [htmlspecialchars($byText, ENT_QUOTES, 'UTF-8') . ' Our worker'
         . ($v['worker_name'] ? ' <strong>' . htmlspecialchars($v['worker_name'], ENT_QUOTES, 'UTF-8') . '</strong>' : '')
         . ' will visit you on this date.']);
}

/**
 * Create the ocular visit for a job order that just became Scheduled and ask the customer.
 * Returns ['ok' => true, 'id', 'date'] or ['ok' => false, 'reason' => not_scheduled|exists|no_free_day|error].
 * Never throws.
 */
function svAutoOcular(PDO $pdo, int $jobOrderId): array
{
    try {
        $jo = svLoadJob($pdo, $jobOrderId);
        if (!$jo || (int)$jo['status_id'] !== JO_STATUS_SCHEDULED || empty($jo['worker_user_id'])) {
            return ['ok' => false, 'reason' => 'not_scheduled'];
        }
        $open = implode(',', array_merge(svOpenStatuses(), [SV_COMPLETE]));
        $ex = $pdo->prepare("SELECT id FROM schedules WHERE job_order_id = ? AND visit_type = 'ocular' AND status_id IN ($open) LIMIT 1");
        $ex->execute([$jobOrderId]);
        if ($found = $ex->fetchColumn()) return ['ok' => false, 'reason' => 'exists', 'id' => (int)$found];

        $workerId = (int)$jo['worker_user_id'];
        $code     = $jo['job_order_code'] ?: ('#' . $jobOrderId);
        $day      = svPickRandomDay($pdo, $jo, $workerId);
        if (!$day) {
            jobOrderSystemLog($pdo, $jo, 'No free weekday for the ocular visit of job order ' . $code . '. Plan it by hand.');
            return ['ok' => false, 'reason' => 'no_free_day'];
        }

        [$start, $end] = svDaySlot($day);
        $hasClient = !empty($jo['client_user_id']);
        // No customer account: the worker answers first and the admin can step in
        $turn = $hasClient ? 'customer' : 'worker';
        $now  = jobOrderNow();
        $pdo->prepare(
            "INSERT INTO schedules (worker_user_id, client_user_id, job_order_id, visit_type, start_time, end_time, description,
                                    status_id, prop_turn, prop_round, prop_customer_ok, prop_worker_ok, prop_at, auto_created)
             VALUES (?, ?, ?, 'ocular', ?, ?, ?, ?, ?, 0, ?, 0, ?, 1)"
        )->execute([$workerId, $jo['client_user_id'] ?: null, $jobOrderId, $start, $end,
                    'Ocular inspection before the work starts.', SV_PENDING, $turn, $hasClient ? 0 : 1, $now]);
        $id = (int)$pdo->lastInsertId();
        svLogProposal($pdo, $id, 'system', 'propose', $start, $end);

        $v = svLoad($pdo, $id);
        jobOrderSystemLog($pdo, $jo, 'Proposed ocular visit ' . ($v['schedule_code'] ?? '#' . $id) . ' for job order ' . $code
            . ' on ' . svFmtDay($day) . ', waiting for the ' . $turn, null, ['visit_date' => $day, 'waiting_for' => $turn]);

        if ($hasClient) {
            svMailCustomer($pdo, $id, 'Please confirm your site visit date', [
                'Good news! A worker is now assigned to your job order. Before the work starts, our worker will visit your place to check the site.',
                'Is this date okay for you? Open your account to <strong>accept it</strong> or <strong>suggest another date</strong>.',
            ], 'Confirm the date');
        } else {
            svNotify($pdo, $id, 'site_visit', 'Site visit date to confirm: ' . svTypeLabel('ocular') . ' on ' . (new DateTime($start, jobOrderTz()))->format('M j'),
                'Please confirm this date or suggest another one in My Schedule.');
        }
        return ['ok' => true, 'id' => $id, 'date' => $day];
    } catch (Throwable $e) {
        error_log('[site-visits] auto ocular failed for job order ' . $jobOrderId . ': ' . $e->getMessage());
        return ['ok' => false, 'reason' => 'error'];
    }
}

/**
 * Cancel the open visits of a job order (all, or only one worker's) and tell the people involved.
 * Returns how many were cancelled. Never throws.
 */
function svCancelJobVisits(PDO $pdo, int $jobOrderId, string $workerText, ?string $customerText = null, ?int $onlyWorkerId = null): int
{
    try {
        $open = implode(',', svOpenStatuses());
        $sql  = "SELECT id FROM schedules WHERE job_order_id = ? AND status_id IN ($open)";
        $args = [$jobOrderId];
        if ($onlyWorkerId) { $sql .= ' AND worker_user_id = ?'; $args[] = $onlyWorkerId; }
        $st = $pdo->prepare($sql);
        $st->execute($args);
        $n = 0;
        foreach ($st->fetchAll(PDO::FETCH_COLUMN) as $vid) {
            $v = svLoad($pdo, (int)$vid);
            if (!$v) continue;
            $pdo->prepare("UPDATE schedules SET status_id = ?, prop_turn = NULL WHERE id = ?")->execute([SV_CANCELLED, $v['id']]);
            $n++;
            $label = svTypeLabel($v['visit_type']);
            if ($v['worker_user_id'] && svWorkerCanSee($v)) {
                svNotify($pdo, (int)$v['id'], 'visit_update', $label . ' cancelled', $workerText, (int)$v['worker_user_id'], false);
            }
            // The customer only hears about visits they were asked about
            if ($customerText && $v['visit_type'] === 'ocular' && !empty($v['auto_created'])) {
                svMailCustomer($pdo, (int)$v['id'], 'Your site visit is cancelled', [htmlspecialchars($customerText, ENT_QUOTES, 'UTF-8')]);
            }
        }
        return $n;
    } catch (Throwable $e) {
        error_log('[site-visits] cancel visits failed for job order ' . $jobOrderId . ': ' . $e->getMessage());
        return 0;
    }
}