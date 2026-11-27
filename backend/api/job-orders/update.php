<?php
// backend/api/job-orders/update.php
require_once __DIR__ . '/../../cors.php';
require_once __DIR__ . '/../../middleware/jwt.php';
require_once __DIR__ . '/../../config/db.php';
require_once __DIR__ . '/../../middleware/audit.php';
require_once __DIR__ . '/../../helpers/job-order-status.php';
require_once __DIR__ . '/../../helpers/job-offers.php';
require_once __DIR__ . '/../../helpers/site-visits.php';
require_once __DIR__ . '/../../helpers/holidays.php';

handleCors();
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'PUT') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method not allowed.']);
    exit;
}

$auth = requireAdminAccess();
$pdo = getDB();

$data = json_decode(file_get_contents('php://input'), true) ?? [];
$id   = isset($_GET['id']) ? (int)$_GET['id'] : (int)($data['id'] ?? 0);

if (!$id) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Job order ID is required.']);
    exit;
}

// Resolve status: accept both numeric ID and label string
if (isset($data['status_id'])) {
    if (!is_numeric($data['status_id'])) {
        $statusRow = $pdo->prepare("SELECT id FROM statuses WHERE label = ? AND entity = 'job_order' LIMIT 1");
        $statusRow->execute([$data['status_id']]);
        $found = $statusRow->fetchColumn();
        if ($found) {
            $data['status_id'] = (int)$found;
        } else {
            http_response_code(422);
            echo json_encode(['success' => false, 'error' => "Invalid status: {$data['status_id']}"]);
            exit;
        }
    } else {
        $data['status_id'] = (int)$data['status_id'];
        $chk = $pdo->prepare("SELECT 1 FROM statuses WHERE id = ? AND entity = 'job_order'");
        $chk->execute([$data['status_id']]);
        if (!$chk->fetchColumn()) {
            http_response_code(422);
            echo json_encode(['success' => false, 'error' => "Invalid job order status id: {$data['status_id']}"]);
            exit;
        }
    }
}

if (array_key_exists('description', $data) && empty(trim($data['description'] ?? ''))) {
    http_response_code(422);
    echo json_encode(['success' => false, 'error' => 'Description is required.']);
    exit;
}

if (!empty($data['start_date']) && !empty($data['end_date']) && $data['start_date'] >= $data['end_date']) {
    http_response_code(422);
    echo json_encode(['success' => false, 'error' => 'End date must be after start date.']);
    exit;
}

// Accept both old (contact) and new (user) field names from the frontend
if (array_key_exists('worker_contact_id', $data) && !array_key_exists('worker_user_id', $data)) {
    $data['worker_user_id'] = $data['worker_contact_id'];
}
if (array_key_exists('client_contact_id', $data) && !array_key_exists('client_user_id', $data)) {
    $data['client_user_id'] = $data['client_contact_id'];
}

$fields     = ['worker_user_id','client_user_id','inquiry_id','schedule_id','contract_type_id','description','start_date','end_date','status_id'];
$setClauses = [];
$params     = [];

foreach ($fields as $f) {
    if (array_key_exists($f, $data)) {
        $setClauses[]  = "`$f` = :$f";
        $params[":$f"] = ($data[$f] === '' || $data[$f] === null) ? null : $data[$f];
    }
}

if (empty($setClauses)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'No fields provided to update.']);
    exit;
}

$beforeStmt = $pdo->prepare(
    "SELECT jo.*, s.label AS status_label,
            CONCAT(w.first_name,' ',w.last_name) AS worker_name,
            CONCAT(c.first_name,' ',c.last_name) AS client_name,
            (SELECT COUNT(*) FROM worker_inbox m
              WHERE m.job_order_id = jo.id AND m.type = 'job_offer') AS offers_sent,
            (SELECT COUNT(*) FROM worker_inbox m
              WHERE m.job_order_id = jo.id AND m.type = 'job_offer' AND m.response = 'declined') AS offers_declined
     FROM job_orders jo
     LEFT JOIN statuses s ON s.id = jo.status_id
     LEFT JOIN users w ON w.id = jo.worker_user_id
     LEFT JOIN users c ON c.id = jo.client_user_id
     WHERE jo.id = ?"
);
$beforeStmt->execute([$id]);
$before = $beforeStmt->fetch(PDO::FETCH_ASSOC);
if (!$before) {
    http_response_code(404);
    echo json_encode(['success' => false, 'error' => 'Job order not found.']);
    exit;
}

// ── Start date: no Saturday, Sunday or holiday (only checked when the start date changes) ──
if (!empty($data['start_date']) && (string)$data['start_date'] !== (string)($before['start_date'] ?? '')) {
    if ($why = phNonWorkingReason((string)$data['start_date'])) {
        http_response_code(422);
        echo json_encode(['success' => false, 'error' => 'The start date can\'t be a Saturday, Sunday or holiday (' . $why . '). Pick a working day.']);
        exit;
    }
}

// ── Worker assignment rules ───────────────────────────────────────────────────
$oldWorker = $before['worker_user_id'] ? (int)$before['worker_user_id'] : null;
$newWorker = $oldWorker;
if (array_key_exists('worker_user_id', $data)) {
    $newWorker = ($data['worker_user_id'] === '' || $data['worker_user_id'] === null) ? null : (int)$data['worker_user_id'];
}
$directAssign  = $newWorker && $newWorker !== $oldWorker;   // admin picked (or changed) the worker
$workerRemoved = $oldWorker && !$newWorker;

if ($directAssign) {
    $wChk = $pdo->prepare("SELECT id FROM users WHERE id = ? AND type = 'worker'");
    $wChk->execute([$newWorker]);
    if (!$wChk->fetch()) {
        http_response_code(422);
        echo json_encode(['success' => false, 'error' => 'Worker not found.']);
        exit;
    }
    // Once a worker accepted (or was assigned), the worker is fixed
    if ($oldWorker) {
        http_response_code(422);
        echo json_encode(['success' => false, 'error' => 'The worker can\'t be changed after they accepted the job.']);
        exit;
    }
    // While the job is still open to workers, the admin can't pick one: wait until no one accepted
    if (!$oldWorker) {
        $offerBefore = jobOfferState($before);
        if ($offerBefore['state'] === 'waiting') {
            http_response_code(422);
            echo json_encode([
                'success' => false,
                'code'    => 'offer_open',
                'error'   => 'Workers still have time to accept this job. You can pick a worker only if no one accepts.',
            ]);
            exit;
        }
    }
}

$params[':id'] = $id;
$pdo->prepare("UPDATE job_orders SET " . implode(', ', $setClauses) . " WHERE id = :id")->execute($params);

$rowStmt = $pdo->prepare(
    "SELECT jo.*,
            jo.worker_user_id AS worker_contact_id,
            jo.client_user_id AS client_contact_id,
            CONCAT(w.first_name,' ',w.last_name) AS worker_name,
            CONCAT(c.first_name,' ',c.last_name) AS client_name,
            s.label AS status,
            ct.name AS contract_type,
            (SELECT COUNT(*) FROM worker_inbox m
              WHERE m.job_order_id = jo.id AND m.type = 'job_offer') AS offers_sent,
            (SELECT COUNT(*) FROM worker_inbox m
              WHERE m.job_order_id = jo.id AND m.type = 'job_offer' AND m.response = 'declined') AS offers_declined
     FROM job_orders jo
     LEFT JOIN users w ON w.id = jo.worker_user_id
     LEFT JOIN users c ON c.id = jo.client_user_id
     LEFT JOIN statuses s ON s.id = jo.status_id
     LEFT JOIN contract_types ct ON ct.id = jo.contract_type_id
     WHERE jo.id = ?"
);
$rowStmt->execute([$id]);
$row = $rowStmt->fetch(PDO::FETCH_ASSOC);

// Work out which fields really changed
$chgOld = []; $chgNew = [];
foreach ($fields as $f) {
    if (!array_key_exists($f, $data)) continue;
    $new = ($data[$f] === '' || $data[$f] === null) ? null : $data[$f];
    if ((string)($before[$f] ?? '') !== (string)($new ?? '')) {
        $chgOld[$f] = $before[$f] ?? null;
        $chgNew[$f] = $new;
    }
}
$termsChanged = array_key_exists('contract_type_id', $chgNew)
             || array_key_exists('start_date', $chgNew)
             || array_key_exists('end_date', $chgNew);

// Show readable labels and names instead of ids
if (array_key_exists('status_id', $chgNew)) {
    $chgOld['status'] = $before['status_label'] ?? null;
    $chgNew['status'] = $row['status'] ?? null;
    unset($chgOld['status_id'], $chgNew['status_id']);
}
if (array_key_exists('worker_user_id', $chgNew)) {
    $chgOld['worker'] = trim($before['worker_name'] ?? '') ?: null;
    $chgNew['worker'] = trim($row['worker_name'] ?? '') ?: null;
    unset($chgOld['worker_user_id'], $chgNew['worker_user_id']);
}
if (array_key_exists('client_user_id', $chgNew)) {
    $chgOld['client'] = trim($before['client_name'] ?? '') ?: null;
    $chgNew['client'] = trim($row['client_name'] ?? '') ?: null;
    unset($chgOld['client_user_id'], $chgNew['client_user_id']);
}

if ($chgNew) {
    $statusChanged = isset($chgNew['status']);
    $code = $before['job_order_code'] ?? ('#' . $id);
    auditLog(array_merge(auditActor($auth), [
        'action'         => $statusChanged ? 'STATUS_CHANGE' : 'UPDATE',
        'module'         => 'Job Orders',
        'description'    => $statusChanged
            ? 'Changed job order ' . $code . ' status from "' . ($chgOld['status'] ?? '—') . '" to "' . ($chgNew['status'] ?? '—') . '"'
            : 'Updated job order ' . $code . ' (' . implode(', ', array_keys($chgNew)) . ')'
              . ($directAssign && !$oldWorker && !empty($data['assign_now']) ? ' — assigned before the offer ended' : ''),
        'target_user_id' => $before['client_user_id'] ?? null,
        'target_type'    => 'job_order',
        'target_id'      => $id,
        'target_label'   => $code . ' — ' . trim($before['client_name'] ?? ''),
        'old_values'     => $chgOld,
        'new_values'     => $chgNew,
    ]));
}

// ── Job offers ────────────────────────────────────────────────────────────────
// Never let an email / inbox problem break saving the job order.
$offerResult = null;
try {
    $nowStatus = (int)($row['status_id'] ?? 0);

    // Worker removed from a Scheduled job: back to Under Review so it can be offered again
    if ($workerRemoved && in_array($nowStatus, [JO_STATUS_SCHEDULED, JO_STATUS_ACTIVE], true)) {
        $pdo->prepare("UPDATE job_orders SET status_id = ? WHERE id = ?")->execute([JO_STATUS_UNDER_REVIEW, $id]);
        $nowStatus = JO_STATUS_UNDER_REVIEW;
        $row['status_id'] = JO_STATUS_UNDER_REVIEW;
        jobOrderSystemLog($pdo, $before, 'Job order ' . ($before['job_order_code'] ?? '#' . $id)
            . ' moved back to "Under Review" because the worker was removed', ['status' => $before['status_label'] ?? null], ['status' => 'Under Review']);
    }

    // Status set by hand: remember when work started / when it was confirmed complete
    if (array_key_exists('status', $chgNew)) {
        if ($nowStatus === JO_STATUS_IN_PROGRESS) {
            $pdo->prepare("UPDATE job_orders SET started_at = COALESCE(started_at, ?) WHERE id = ?")->execute([jobOfferNow(), $id]);
        } elseif ($nowStatus === JO_STATUS_COMPLETE) {
            $pdo->prepare("UPDATE job_orders SET completed_at = ?, completed_by = 'admin', issue_note = NULL, issue_at = NULL WHERE id = ?")
                ->execute([jobOfferNow(), $id]);
            if (!empty($row['worker_user_id'])) {
                jobOrderInboxUpdate($pdo, (int)$row['worker_user_id'], $id,
                    ($before['job_order_code'] ?? 'Job order') . ' is complete', 'The admin marked this job as complete. Thank you!');
            }
        }
    }

    if ($directAssign) {
        // Admin picked the worker: auto-accepted, the worker gets a notice
        $pdo->prepare("UPDATE job_orders SET accepted_at = ?, assigned_by = 'admin' WHERE id = ?")
            ->execute([jobOfferNow(), $id]);
        jobOfferNotifyAssigned($pdo, $id, $newWorker);
        $offerResult = ['assigned' => true];
    } elseif ($workerRemoved) {
        $pdo->prepare("UPDATE job_orders SET accepted_at = NULL, assigned_by = NULL WHERE id = ?")
            ->execute([$id]);
    }

    // ── Site visits follow the job ─────────────────────────────────────────
    if ($oldWorker && $newWorker !== $oldWorker) {
        // Worker removed or changed: the old worker's visits are cancelled
        svCancelJobVisits($pdo, $id,
            'You are no longer the worker on this job, so you don’t need to go on this visit.',
            'The worker for your job order changed. We will send you a new date for the site visit soon.',
            $oldWorker);
    }
    if (array_key_exists('status', $chgNew) && in_array($nowStatus, [JO_STATUS_ON_HOLD, JO_STATUS_CANCELLED], true)) {
        $what = $nowStatus === JO_STATUS_ON_HOLD ? 'on hold' : 'cancelled';
        svCancelJobVisits($pdo, $id,
            'The job order is ' . $what . ', so this site visit is cancelled.',
            'Your job order is ' . $what . ', so the site visit is cancelled. Please contact us if you have questions.');
    }

    $enteredReview = (int)$before['status_id'] !== JOB_OFFER_REVIEW_STATUS && $nowStatus === JOB_OFFER_REVIEW_STATUS;

    if ($nowStatus !== JOB_OFFER_REVIEW_STATUS) {
        // Offers only stay open while the job is Under Review
        if (!$row['worker_user_id'] && $row['offered_at']) {
            $pdo->prepare("UPDATE job_orders SET offered_at = NULL WHERE id = ?")->execute([$id]);
        }
    } elseif (!$newWorker
        && !empty($row['contract_type_id']) && !empty($row['start_date']) && !empty($row['end_date'])
        && (empty($row['offered_at']) || $termsChanged || $workerRemoved || $enteredReview)
    ) {
        // Under Review, no worker yet and the dates are agreed: send to every eligible worker
        $offerResult = jobOfferSend($pdo, $id, true);

        $code = $before['job_order_code'] ?? ('#' . $id);
        auditLog(array_merge(auditActor($auth), [
            'action'         => 'UPDATE',
            'module'         => 'Job Orders',
            'description'    => 'Sent job order ' . $code . ' to ' . $offerResult['sent'] . ' matching worker(s)',
            'target_user_id' => $before['client_user_id'] ?? null,
            'target_type'    => 'job_order',
            'target_id'      => $id,
            'target_label'   => $code . ' — ' . trim($before['client_name'] ?? ''),
            'new_values'     => ['offers_sent' => $offerResult['sent'], 'emails_sent' => $offerResult['emailed']],
        ]));
    }
} catch (Throwable $e) {
    error_log('[job-offers] update.php offer step failed for job order ' . $id . ': ' . $e->getMessage());
}

// A worker and agreed dates: move to Scheduled automatically,
// then ask the customer about a date for the ocular visit
$visitResult = null;
$nowScheduled = jobOrderAutoSchedule($pdo, $id);
if ($nowScheduled || $directAssign) {
    $visitResult = svAutoOcular($pdo, $id);
    if (!$visitResult['ok'] && $visitResult['reason'] === 'not_scheduled') $visitResult = null;
}

$rowStmt->execute([$id]);
$row = $rowStmt->fetch(PDO::FETCH_ASSOC);
$st  = jobOfferState($row);
$row['offer_state']      = $st['state'];
$row['offer_expires_at'] = $st['expires_at'];
$row['offer_can_assign'] = $st['can_assign'];
$row['flags']            = jobOrderFlags($row);

echo json_encode([
    'success'   => true,
    'message'   => 'Job order updated.',
    'job_order' => $row,
    'offer'     => $offerResult,
    'visit'     => $visitResult,
]);