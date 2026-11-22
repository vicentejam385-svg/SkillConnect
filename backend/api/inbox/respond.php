<?php
// backend/api/inbox/respond.php
// Worker answers a job offer.   POST { id, action: 'accept' | 'decline' }
// The first worker to accept gets the job.
require_once __DIR__ . '/../../cors.php';
require_once __DIR__ . '/../../config/db.php';
require_once __DIR__ . '/../../middleware/jwt.php';
require_once __DIR__ . '/../../middleware/audit.php';
require_once __DIR__ . '/../../helpers/job-offers.php';
require_once __DIR__ . '/../../helpers/job-order-status.php';

handleCors();
header('Content-Type: application/json');

function respondFail(string $msg, int $code = 422, array $extra = []): never
{
    http_response_code($code);
    echo json_encode(array_merge(['success' => false, 'error' => $msg], $extra));
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') respondFail('Method not allowed.', 405);

$auth = requireAuth();
if (($auth['role'] ?? '') !== 'worker') respondFail('Only workers can answer job offers.', 403);

$uid    = (int)($auth['sub'] ?? 0);
$data   = json_decode(file_get_contents('php://input'), true) ?? [];
$id     = (int)($data['id'] ?? 0);
$action = $data['action'] ?? '';

if (!$id) respondFail('Message ID is required.', 400);
if (!in_array($action, ['accept', 'decline'], true)) respondFail('Choose accept or decline.', 400);

try {
    $pdo = getDB();
    $now = jobOfferNow();

    $st = $pdo->prepare("SELECT * FROM worker_inbox WHERE id = ? AND user_id = ? AND type = 'job_offer'");
    $st->execute([$id, $uid]);
    $msg = $st->fetch(PDO::FETCH_ASSOC);
    if (!$msg) respondFail('Job offer not found.', 404);
    if ($msg['response'] !== null) respondFail('You already answered this job offer.', 409);
    if (!$msg['job_order_id']) respondFail('This job is no longer available.', 409, ['code' => 'withdrawn']);

    $joId = (int)$msg['job_order_id'];
    $jo   = jobOfferLoad($pdo, $joId);
    if (!$jo) respondFail('This job is no longer available.', 409, ['code' => 'withdrawn']);

    $code  = $jo['job_order_code'] ?: ('#' . $joId);
    $wn    = $pdo->prepare("SELECT TRIM(CONCAT(first_name,' ',last_name)) FROM users WHERE id = ?");
    $wn->execute([$uid]);
    $workerName = (string)$wn->fetchColumn();

    // ── Not interested ─────────────────────────────────────────────────────
    if ($action === 'decline') {
        $pdo->prepare("UPDATE worker_inbox SET response = 'declined', responded_at = ?, read_at = COALESCE(read_at, ?) WHERE id = ?")
            ->execute([$now, $now, $id]);

        auditLog(array_merge(auditActor($auth), [
            'action'         => 'UPDATE',
            'module'         => 'Job Orders',
            'description'    => $workerName . ' is not interested in job order ' . $code,
            'target_user_id' => $jo['client_user_id'] ?? null,
            'target_type'    => 'job_order',
            'target_id'      => $joId,
            'target_label'   => $code . ' — ' . trim($jo['client_name'] ?? ''),
            'new_values'     => ['offer_response' => 'declined'],
        ]));
        echo json_encode(['success' => true, 'message' => 'Got it. You will not get more updates about this job.', 'state' => 'declined']);
        exit;
    }

    // ── Accept ─────────────────────────────────────────────────────────────
    if (!empty($jo['worker_user_id'])) {
        respondFail('Sorry, another worker already took this job.', 409, ['code' => 'taken']);
    }
    if (empty($jo['offered_at']) || (int)$jo['status_id'] !== JOB_OFFER_REVIEW_STATUS) {
        respondFail('This job is no longer available.', 409, ['code' => 'withdrawn']);
    }
    $expires = (new DateTime($jo['offered_at'], jobOfferTz()))->modify('+' . JOB_OFFER_HOURS . ' hours')->format('Y-m-d H:i:s');
    if ($expires <= $now) {
        respondFail('This offer has ended. The admin will choose a worker.', 409, ['code' => 'expired']);
    }
    // Still a match? (license still valid, no new clash, still Active)
    if (!jobOfferEligibleWorkers($pdo, $jo, $uid)) {
        respondFail('You cannot take this job right now. Check that your license is valid and that you have no other job on the same dates.', 409, ['code' => 'not_eligible']);
    }

    $pdo->beginTransaction();
    // Only one worker can win: the row must still have no worker
    $take = $pdo->prepare(
        "UPDATE job_orders
            SET worker_user_id = ?, accepted_at = ?, assigned_by = 'worker'
          WHERE id = ? AND worker_user_id IS NULL AND offered_at IS NOT NULL"
    );
    $take->execute([$uid, $now, $joId]);
    if ($take->rowCount() !== 1) {
        $pdo->rollBack();
        respondFail('Sorry, another worker already took this job.', 409, ['code' => 'taken']);
    }
    $pdo->prepare("UPDATE worker_inbox SET response = 'accepted', responded_at = ?, read_at = COALESCE(read_at, ?) WHERE id = ?")
        ->execute([$now, $now, $id]);
    $pdo->commit();

    // A worker and agreed dates: the job moves to Scheduled
    jobOrderAutoSchedule($pdo, $joId);

    auditLog(array_merge(auditActor($auth), [
        'action'         => 'UPDATE',
        'module'         => 'Job Orders',
        'description'    => $workerName . ' accepted job order ' . $code,
        'target_user_id' => $jo['client_user_id'] ?? null,
        'target_type'    => 'job_order',
        'target_id'      => $joId,
        'target_label'   => $code . ' — ' . trim($jo['client_name'] ?? ''),
        'old_values'     => ['worker' => null],
        'new_values'     => ['worker' => $workerName, 'offer_response' => 'accepted'],
    ]));

    echo json_encode(['success' => true, 'message' => 'The job is yours. You can find it under My Job Orders.', 'state' => 'accepted']);
} catch (PDOException $e) {
    if (isset($pdo) && $pdo->inTransaction()) $pdo->rollBack();
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Database error.', 'detail' => $e->getMessage()]);
}