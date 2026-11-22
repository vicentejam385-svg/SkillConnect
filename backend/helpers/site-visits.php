<?php
// backend/helpers/site-visits.php
//
// Site visits (the `schedules` table):
//   ocular    inspection while the job order is Under Review (before the dates are agreed)
//   progress  inspection while the job is Scheduled / In Progress
//   other     anything else
// Visits are Monday to Friday only, one day each, and a worker can't have two visits at the same time.
// The worker gets an Inbox message and an email for every new or changed visit.

require_once __DIR__ . '/job-order-status.php';
require_once __DIR__ . '/job-offers.php';   // email sending + license column helper

if (!defined('SV_PENDING')) {
    define('SV_PENDING', 11);
    define('SV_SCHEDULED', 12);
    define('SV_IN_PROGRESS', 13);
    define('SV_COMPLETE', 14);
    define('SV_CANCELLED', 15);
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
                jo.job_order_code, jo.status_id AS job_status_id, jo.worker_user_id AS job_worker_id,
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
    if (in_array($jobStatus, [JO_STATUS_SCHEDULED, JO_STATUS_IN_PROGRESS, JO_STATUS_ACTIVE], true)) return ['progress', 'other'];
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