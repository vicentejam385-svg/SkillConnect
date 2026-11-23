<?php
// backend/api/schedules/update.php
// Admin changes a site visit: time, worker, notes, or status (complete / cancel / reopen).
//   PUT { id, start_time?, end_time?, worker_user_id?, description?, visit_type?, status_id? }
// Saving a visit whose date is still being agreed sets it as the final date (Planned),
// and both the worker and the customer are told.
require_once __DIR__ . '/../../cors.php';
require_once __DIR__ . '/../../config/db.php';
require_once __DIR__ . '/../../middleware/audit.php';
require_once __DIR__ . '/../../middleware/jwt.php';
require_once __DIR__ . '/../../helpers/site-visits.php';

handleCors();
header('Content-Type: application/json');

function svFail(string $msg, int $code = 422): never
{
    http_response_code($code);
    echo json_encode(['success' => false, 'error' => $msg]);
    exit;
}

if (!in_array($_SERVER['REQUEST_METHOD'], ['PUT', 'PATCH'], true)) svFail('Method not allowed.', 405);

$auth = requireAdminAccess();
$body = json_decode(file_get_contents('php://input'), true) ?? [];
$id   = (int)($body['id'] ?? 0);
if (!$id) svFail('Schedule id is required.');

try {
    $pdo    = getDB();
    $before = svLoad($pdo, $id);
    if (!$before) svFail('Schedule not found.', 404);

    // Status by label is still accepted
    if (!empty($body['status_id']) && !is_numeric($body['status_id'])) {
        $q = $pdo->prepare("SELECT id FROM statuses WHERE entity = 'schedule' AND label = ? LIMIT 1");
        $q->execute([$body['status_id']]);
        $body['status_id'] = $q->fetchColumn() ?: null;
    }
    if (array_key_exists('worker_contact_id', $body) && !array_key_exists('worker_user_id', $body)) {
        $body['worker_user_id'] = $body['worker_contact_id'];
    }

    $new = [
        'start_time'     => array_key_exists('start_time', $body) ? svNormalizeTime($body['start_time']) : $before['start_time'],
        'end_time'       => array_key_exists('end_time', $body) ? svNormalizeTime($body['end_time']) : $before['end_time'],
        'worker_user_id' => array_key_exists('worker_user_id', $body) ? ((int)$body['worker_user_id'] ?: null) : ($before['worker_user_id'] ? (int)$before['worker_user_id'] : null),
        'description'    => array_key_exists('description', $body) ? (trim((string)$body['description']) ?: null) : $before['description'],
        'visit_type'     => array_key_exists('visit_type', $body) ? ($body['visit_type'] ?: null) : $before['visit_type'],
        'status_id'      => array_key_exists('status_id', $body) ? (int)$body['status_id'] : (int)$before['status_id'],
    ];
    if (!in_array($new['status_id'], [SV_PENDING, SV_SCHEDULED, SV_IN_PROGRESS, SV_COMPLETE, SV_CANCELLED], true)) svFail('Invalid status.');
    if ($new['visit_type'] !== null && !in_array($new['visit_type'], ['ocular', 'progress', 'other'], true)) svFail('Invalid visit type.');

    // The admin's save ends the date agreement
    $wasAgreeing = $before['prop_turn'] !== null && (int)$before['status_id'] === SV_PENDING;
    $finalizes   = $wasAgreeing && in_array($new['status_id'], [SV_PENDING, SV_SCHEDULED], true);
    if ($finalizes) $new['status_id'] = SV_SCHEDULED;

    $timeChanged   = $new['start_time'] !== $before['start_time'] || $new['end_time'] !== $before['end_time'];
    $workerChanged = (string)$new['worker_user_id'] !== (string)$before['worker_user_id'];
    $stillOpen     = in_array($new['status_id'], svOpenStatuses(), true);

    if ($stillOpen && ($timeChanged || $workerChanged || $finalizes || !in_array((int)$before['status_id'], svOpenStatuses(), true))) {
        if ($err = svCheckSlot($new['start_time'], $new['end_time'])) svFail($err);
        if (!$new['worker_user_id']) svFail('Choose who goes on the visit.');
        if (!empty($before['job_order_id']) && $workerChanged) {
            $jo = svLoadJob($pdo, (int)$before['job_order_id']);
            if ($jo && ($err = svCheckWorker($pdo, $jo, $new['visit_type'] ?: 'other', (int)$new['worker_user_id']))) svFail($err);
        }
        if ($clash = svWorkerClash($pdo, (int)$new['worker_user_id'], $new['start_time'], $new['end_time'], $id)) {
            svFail('This worker already has visit ' . $clash . ' at that time.');
        }
    }

    $pdo->prepare(
        "UPDATE schedules SET start_time = ?, end_time = ?, worker_user_id = ?, description = ?, visit_type = ?, status_id = ? WHERE id = ?"
    )->execute([$new['start_time'], $new['end_time'], $new['worker_user_id'], $new['description'], $new['visit_type'], $new['status_id'], $id]);
    if ($wasAgreeing) {
        // Planned, cancelled or done: nobody needs to answer the date any more
        $pdo->prepare("UPDATE schedules SET prop_turn = NULL, prop_customer_ok = 1, prop_worker_ok = 1, prop_at = ? WHERE id = ?")
            ->execute([jobOrderNow(), $id]);
        if ($finalizes) svLogProposal($pdo, $id, 'admin', 'final', $new['start_time'], $new['end_time'], (int)($auth['sub'] ?? 0) ?: null);
    }

    $after = svLoad($pdo, $id);
    $code  = $before['schedule_code'] ?? ('#' . $id);

    // Audit: only what changed, with readable names
    $old = []; $chg = [];
    if ($timeChanged)   { $old['time'] = $before['start_time'] . ' – ' . $before['end_time']; $chg['time'] = $after['start_time'] . ' – ' . $after['end_time']; }
    if ($workerChanged) { $old['worker'] = $before['worker_name'] ?: null; $chg['worker'] = $after['worker_name'] ?: null; }
    if ((int)$before['status_id'] !== $new['status_id']) { $old['status'] = $before['status']; $chg['status'] = $after['status']; }
    if ((string)$before['description'] !== (string)$new['description']) { $old['notes'] = $before['description']; $chg['notes'] = $new['description']; }
    if ((string)$before['visit_type'] !== (string)$new['visit_type']) { $old['type'] = svTypeLabel($before['visit_type']); $chg['type'] = svTypeLabel($new['visit_type']); }

    if ($chg) {
        auditLog(array_merge(auditActor($auth), [
            'action'         => isset($chg['status']) ? 'STATUS_CHANGE' : 'UPDATE',
            'module'         => 'Schedules',
            'description'    => isset($chg['status'])
                ? 'Changed site visit ' . $code . ' status from "' . ($old['status'] ?? '—') . '" to "' . ($chg['status'] ?? '—') . '"'
                : 'Updated site visit ' . $code . ' (' . implode(', ', array_keys($chg)) . ')',
            'target_user_id' => $before['client_user_id'] ?? null,
            'target_type'    => 'schedule',
            'target_id'      => $id,
            'target_label'   => $code . ' — ' . trim((string)$after['worker_name']),
            'old_values'     => $old,
            'new_values'     => $chg,
        ]));
    }

    // Tell the workers (and the customer for visits they agreed on)
    $label       = svTypeLabel($after['visit_type']);
    $workerSaw   = svWorkerCanSee($before);
    $customerToo = !empty($before['auto_created']);
    if ($new['status_id'] === SV_CANCELLED && (int)$before['status_id'] !== SV_CANCELLED) {
        if ($before['worker_user_id'] && $workerSaw) svNotify($pdo, $id, 'visit_update', $label . ' cancelled', 'This site visit was cancelled.', (int)$before['worker_user_id']);
        if ($customerToo) svMailCustomer($pdo, $id, 'Your site visit is cancelled', ['The site visit below is cancelled. We will contact you if a new visit is needed.']);
    } elseif ($finalizes && !$workerChanged) {
        svAnnounceFinal($pdo, $id, $workerSaw, 'The admin set the date of this site visit.');
    } elseif ($stillOpen) {
        if ($workerChanged) {
            if ($before['worker_user_id'] && $workerSaw) svNotify($pdo, $id, 'visit_update', $label . ' reassigned', 'This site visit was given to another worker. You no longer need to go.', (int)$before['worker_user_id'], false);
            if ($new['worker_user_id'])    svNotify($pdo, $id, 'site_visit', 'Site visit: ' . $label, $new['description'] ?: 'You are scheduled to visit this site.');
        } elseif ($timeChanged) {
            svNotify($pdo, $id, 'visit_update', $label . ' moved to ' . (new DateTime($new['start_time'], jobOrderTz()))->format('M j, g:i A'),
                'The date or time of this site visit changed.');
        }
        if ($customerToo && ($timeChanged || $finalizes)) {
            svMailCustomer($pdo, $id, $finalizes ? 'Your site visit is confirmed' : 'Your site visit was moved',
                [$finalizes ? 'The admin set the date of your site visit.' : 'The date or time of your site visit changed. Here is the new schedule.']);
        }
    }

    echo json_encode(['success' => true, 'schedule' => $after]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Database error.', 'detail' => $e->getMessage()]);
}