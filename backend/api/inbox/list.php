<?php
// backend/api/inbox/list.php
// Worker Inbox: job offers and assignment notices for the logged-in worker.
//   GET                 -> { messages: [...], unread, open_offers }
//   GET ?summary=1      -> { unread, open_offers }   (for the menu badge)
require_once __DIR__ . '/../../cors.php';
require_once __DIR__ . '/../../config/db.php';
require_once __DIR__ . '/../../middleware/jwt.php';
require_once __DIR__ . '/../../helpers/job-offers.php';

handleCors();
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method not allowed.']);
    exit;
}

$auth = requireAuth();
if (($auth['role'] ?? '') !== 'worker') {
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'Only workers have an inbox.']);
    exit;
}
$uid = (int)($auth['sub'] ?? 0);

try {
    $pdo = getDB();
    $now = jobOfferNow();
    $cut = (new DateTime('now', jobOfferTz()))->modify('-' . JOB_OFFER_HOURS . ' hours')->format('Y-m-d H:i:s');

    // Unread messages, and offers this worker can still accept
    $sum = $pdo->prepare(
        "SELECT
            (SELECT COUNT(*) FROM worker_inbox WHERE user_id = :u1 AND read_at IS NULL) AS unread,
            (SELECT COUNT(*) FROM worker_inbox m
               JOIN job_orders jo ON jo.id = m.job_order_id
              WHERE m.user_id = :u2 AND m.type = 'job_offer' AND m.response IS NULL
                AND jo.worker_user_id IS NULL AND jo.offered_at IS NOT NULL
                AND jo.offered_at > :cut
                AND jo.status_id = 20) AS open_offers"
    );
    $sum->execute([':u1' => $uid, ':u2' => $uid, ':cut' => $cut]);
    $counts = $sum->fetch(PDO::FETCH_ASSOC) ?: ['unread' => 0, 'open_offers' => 0];
    $unread     = (int)$counts['unread'];
    $openOffers = (int)$counts['open_offers'];

    if (!empty($_GET['summary'])) {
        echo json_encode(['success' => true, 'unread' => $unread, 'open_offers' => $openOffers]);
        exit;
    }

    $st = $pdo->prepare(
        "SELECT m.id, m.job_order_id, m.type, m.title, m.body, m.read_at, m.response,
                m.responded_at, m.created_at,
                jo.job_order_code, jo.worker_user_id, jo.offered_at, jo.status_id,
                jo.start_date, jo.end_date, jo.description,
                v.id AS visit_id, v.schedule_code AS visit_code, v.visit_type, v.start_time AS visit_start,
                v.end_time AS visit_end, v.worker_user_id AS visit_worker_id, vs.label AS visit_status,
                s.label  AS job_status,
                ct.name  AS contract_type,
                sp.name  AS service,
                COALESCE(NULLIF(c.address, ''), i.address) AS client_address,
                TRIM(CONCAT(COALESCE(c.first_name,''),' ',COALESCE(c.last_name,''))) AS client_name,
                COALESCE(NULLIF(c.mobile, ''), i.mobile) AS client_mobile
         FROM worker_inbox m
         LEFT JOIN job_orders jo      ON jo.id = m.job_order_id
         LEFT JOIN statuses s         ON s.id  = jo.status_id
         LEFT JOIN contract_types ct  ON ct.id = jo.contract_type_id
         LEFT JOIN inquiries i        ON i.id  = jo.inquiry_id
         LEFT JOIN users c            ON c.id  = jo.client_user_id
         LEFT JOIN specializations sp ON sp.name = COALESCE(NULLIF(i.reason, ''), jo.description)
         LEFT JOIN schedules v        ON v.id  = m.schedule_id
         LEFT JOIN statuses vs        ON vs.id = v.status_id
         WHERE m.user_id = ?
         ORDER BY m.created_at DESC, m.id DESC
         LIMIT 200"
    );
    $st->execute([$uid]);
    $rows = $st->fetchAll(PDO::FETCH_ASSOC);

    $messages = [];
    foreach ($rows as $r) {
        $mine = $r['worker_user_id'] !== null && (int)$r['worker_user_id'] === $uid;
        // The worker going on a site visit needs the full address too
        $myVisit = $r['visit_id'] !== null && (int)$r['visit_worker_id'] === $uid;

        // Live state of the message
        if ($r['type'] === 'job_assigned') {
            $state = $mine ? 'assigned' : 'reassigned';
        } elseif ($r['type'] === 'site_visit') {
            $state = !$myVisit ? 'reassigned'
                   : ($r['visit_status'] === 'Cancelled' ? 'withdrawn'
                   : ($r['visit_status'] === 'Complete' ? 'visit_done' : 'visit'));
        } elseif ($r['type'] !== 'job_offer') {
            $state = 'info';   // updates and notices: nothing to answer
        } elseif ($r['response'] === 'accepted') {
            $state = $mine ? 'accepted' : 'reassigned';
        } elseif ($r['response'] === 'declined') {
            $state = 'declined';
        } elseif ($r['job_order_id'] === null || $r['worker_user_id'] !== null) {
            $state = 'taken';
        } elseif (empty($r['offered_at']) || (int)$r['status_id'] !== JOB_OFFER_REVIEW_STATUS) {
            $state = 'withdrawn';
        } elseif ($r['offered_at'] <= $cut) {
            $state = 'expired';
        } else {
            $state = 'open';
        }

        $expires = null;
        if ($r['offered_at']) {
            $expires = (new DateTime($r['offered_at'], jobOfferTz()))
                ->modify('+' . JOB_OFFER_HOURS . ' hours')->format('Y-m-d H:i:s');
        }

        $messages[] = [
            'id'             => (int)$r['id'],
            'job_order_id'   => $r['job_order_id'] !== null ? (int)$r['job_order_id'] : null,
            'type'           => $r['type'],
            'title'          => $r['title'],
            'body'           => $r['body'],
            'read_at'        => $r['read_at'],
            'response'       => $r['response'],
            'responded_at'   => $r['responded_at'],
            'created_at'     => $r['created_at'],
            'state'          => $state,
            'expires_at'     => $state === 'open' ? $expires : null,
            'job' => $r['job_order_id'] === null ? null : [
                'code'          => $r['job_order_code'],
                'service'       => $r['service'],
                'contract_type' => $r['contract_type'],
                'start_date'    => $r['start_date'],
                'end_date'      => $r['end_date'],
                'status'        => $r['job_status'],
                'area'          => jobOfferArea($r['client_address']),
                // Full address and client contact only once the job is theirs
                'address'       => ($mine || $myVisit) ? $r['client_address'] : null,
                'client_name'   => $mine ? ($r['client_name'] ?: null) : null,
                'client_mobile' => $mine ? $r['client_mobile'] : null,
                'is_mine'       => $mine,
            ],
            'visit' => $r['visit_id'] === null ? null : [
                'id'         => (int)$r['visit_id'],
                'code'       => $r['visit_code'],
                'type'       => $r['visit_type'],
                'start_time' => $r['visit_start'],
                'end_time'   => $r['visit_end'],
                'status'     => $r['visit_status'],
                'is_mine'    => $myVisit,
            ],
        ];
    }

    echo json_encode([
        'success'     => true,
        'messages'    => $messages,
        'unread'      => $unread,
        'open_offers' => $openOffers,
        'server_now'  => $now,
    ]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Database error.', 'detail' => $e->getMessage()]);
}