<?php
// backend/api/schedules/propose.php
// The customer, the worker or the admin answers a proposed site visit date.
//   POST { schedule_id, action: 'accept' | 'counter' | 'escalate' | 'final', date?: 'YYYY-MM-DD' }
//     accept    the customer / worker agrees to the date
//     counter   suggest another date (max 3 times in total)
//     escalate  let the admin decide
//     final     admin only: set the final date (date optional = keep the current one)
// Visits are always 9:00–11:00 AM, Monday to Friday, inside the job order dates.
require_once __DIR__ . '/../../cors.php';
require_once __DIR__ . '/../../config/db.php';
require_once __DIR__ . '/../../middleware/jwt.php';
require_once __DIR__ . '/../../middleware/audit.php';
require_once __DIR__ . '/../../helpers/site-visits.php';

handleCors();
header('Content-Type: application/json');

function vpFail(string $msg, int $code = 422): never
{
    http_response_code($code);
    echo json_encode(['success' => false, 'error' => $msg]);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') vpFail('Method not allowed.', 405);

$auth   = requireAuth();
$uid    = (int)($auth['sub'] ?? 0);
$role   = $auth['role'] ?? '';
$body   = json_decode(file_get_contents('php://input'), true) ?? [];
$id     = (int)($body['schedule_id'] ?? 0);
$action = (string)($body['action'] ?? '');
$date   = trim((string)($body['date'] ?? ''));

if (!$id) vpFail('schedule_id is required.', 400);
if (!in_array($action, ['accept', 'counter', 'escalate', 'final'], true)) vpFail('Unknown action.', 400);

try {
    $pdo = getDB();
    $v   = svLoad($pdo, $id);
    if (!$v) vpFail('Site visit not found.', 404);
    if ((int)$v['status_id'] !== SV_PENDING || $v['prop_turn'] === null) vpFail('This date is already settled.', 409);

    // Who is answering?
    $clientId = (int)($v['client_user_id'] ?: $v['job_client_id']);
    if ($action === 'final') {
        if (!isAdminUser($auth)) vpFail('Only the admin can set the final date.', 403);
        $who = 'admin';
    } elseif ($role === 'client' && $clientId === $uid) {
        $who = 'customer';
    } elseif ($role === 'worker' && (int)$v['worker_user_id'] === $uid) {
        $who = 'worker';
    } else {
        vpFail('You can only answer your own site visits.', 403);
    }

    // The date that ends up on the visit
    $newDate = substr($v['start_time'], 0, 10);
    if ($action === 'counter' || ($action === 'final' && $date !== '')) {
        if ($date === '') vpFail('Pick the date you want.');
        $newDate = $date;
        if ($action === 'counter' && $newDate === substr($v['start_time'], 0, 10)) vpFail('Pick a different date, or accept this one.');
    }
    if ($action !== 'escalate') {
        $err = svCheckProposedDate($pdo, $newDate, $v['job_start_date'], $v['job_end_date'],
                                   $v['worker_user_id'] ? (int)$v['worker_user_id'] : null, $id);
        if ($err && $action === 'accept') vpFail('This date can no longer be used: ' . lcfirst($err) . ' Please suggest another date.');
        // The admin may set a date outside the job dates, but never a weekend, the past, or a busy day
        if ($err && $action === 'final') {
            $hard = svCheckProposedDate($pdo, $newDate, null, null, $v['worker_user_id'] ? (int)$v['worker_user_id'] : null, $id);
            if ($hard) vpFail($hard);
        } elseif ($err) {
            vpFail($err);
        }
    }

    $before = [
        'turn'        => $v['prop_turn'],
        'round'       => (int)$v['prop_round'],
        'customer_ok' => (int)$v['prop_customer_ok'],
        'worker_ok'   => (int)$v['prop_worker_ok'],
    ];
    [$after, $outcome] = svAgreementStep($before, $who, $action);
    if ($after === null) vpFail($outcome, 409);

    $workerSaw = svWorkerCanSee($v);
    [$start, $end] = ($action === 'escalate') ? [$v['start_time'], $v['end_time']] : svDaySlot($newDate);
    $now = jobOrderNow();

    // Save only if nobody answered in the meantime
    $upd = $pdo->prepare(
        "UPDATE schedules
            SET start_time = ?, end_time = ?, status_id = ?, prop_turn = ?, prop_round = ?,
                prop_customer_ok = ?, prop_worker_ok = ?, prop_at = ?
          WHERE id = ? AND status_id = ? AND prop_turn = ? AND prop_round = ?"
    );
    $upd->execute([$start, $end, $outcome === 'final' ? SV_SCHEDULED : SV_PENDING, $after['turn'], $after['round'],
                   $after['customer_ok'], $after['worker_ok'], $now,
                   $id, SV_PENDING, $before['turn'], $before['round']]);
    if ($upd->rowCount() !== 1) vpFail('Someone answered at the same time. Please reload the page.', 409);

    svLogProposal($pdo, $id, $who, $action, $start, $end, $uid ?: null);

    $code  = $v['schedule_code'] ?: ('#' . $id);
    $label = svTypeLabel($v['visit_type']);
    $day   = (new DateTime($start, jobOrderTz()))->format('M j');
    $whoName = ['customer' => 'The customer', 'worker' => 'The worker', 'admin' => 'The admin'][$who];

    auditLog(array_merge(auditActor($auth), [
        'action'         => 'UPDATE',
        'module'         => 'Schedules',
        'description'    => [
            'accept'   => $whoName . ' accepted the date of site visit ' . $code,
            'counter'  => $whoName . ' suggested another date for site visit ' . $code,
            'escalate' => $whoName . ' asked the admin to decide the date of site visit ' . $code,
            'final'    => 'Set the final date of site visit ' . $code,
        ][$action],
        'target_user_id' => $clientId ?: null,
        'target_type'    => 'schedule',
        'target_id'      => $id,
        'target_label'   => $code . ' — ' . trim((string)$v['worker_name']),
        'old_values'     => ['date' => substr($v['start_time'], 0, 10), 'waiting_for' => $before['turn']],
        'new_values'     => ['date' => substr($start, 0, 10), 'waiting_for' => $after['turn'] ?? 'agreed'],
    ]));

    // ── Tell the next person ────────────────────────────────────────────────
    if ($outcome === 'final') {
        svAnnounceFinal($pdo, $id, $workerSaw, $who === 'admin'
            ? 'The admin set the date of this site visit.'
            : 'The customer and the worker agreed on this date.');
        $message = 'Date confirmed. The site visit is planned.';
    } elseif ($outcome === 'worker') {
        $text = $action === 'accept'
            ? 'The customer agreed to this date. Please accept it or suggest another date in My Schedule.'
            : 'The customer suggested this date. Please accept it or suggest another date in My Schedule.';
        svNotify($pdo, $id, $workerSaw ? 'visit_update' : 'site_visit', 'Site visit date to confirm: ' . $label . ' on ' . $day, $text);
        $message = 'Thank you! We sent the date to the worker to confirm.';
    } elseif ($outcome === 'customer') {
        $left = SV_MAX_ROUNDS - (int)$after['round'];
        svMailCustomer($pdo, $id, 'The worker suggested another date', [
            'The worker can’t make the date you chose and suggested the date below instead.',
            $left > 0
                ? 'Please open your account to <strong>accept it</strong> or <strong>suggest another date</strong>.'
                : 'Please open your account to <strong>accept it</strong>, or let our admin choose the date.',
        ], 'Answer now');
        $message = 'Thank you! We sent your date to the customer.';
    } else { // admin
        $message = 'Got it. The admin will choose the date and let you know.';
    }

    $out = svLoad($pdo, $id);
    unset($out['client_email'], $out['worker_email']);
    $out['proposals'] = svProposalHistory($pdo, [$id])[$id] ?? [];
    echo json_encode(['success' => true, 'message' => $message, 'schedule' => $out]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Database error.', 'detail' => $e->getMessage()]);
}