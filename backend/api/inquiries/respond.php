<?php
// backend/api/inquiries/respond.php
// PUBLIC (no login): the page the email buttons open.
//   GET  ?t=<private link>                       → the inquiry summary and the current answer
//   POST { t, answer: 'proceed' | 'cancel' }     → save the customer's answer
// The customer can change the answer until the admin marks the inquiry Won or Lost, or the link expires.
require_once __DIR__ . '/../../cors.php';
require_once __DIR__ . '/../../config/db.php';
require_once __DIR__ . '/../../middleware/audit.php';
require_once __DIR__ . '/../../helpers/inquiry-confirm.php';

handleCors();
header('Content-Type: application/json');
header('Cache-Control: no-store');

function irFail(string $msg, int $code = 422, array $extra = []): never
{
    http_response_code($code);
    echo json_encode(array_merge(['success' => false, 'error' => $msg], $extra));
    exit;
}

/** Only what the customer needs to see; nothing that identifies other records. */
function irPublic(array $inq): array
{
    $sent = !empty($inq['created_at'])
        ? (new DateTime($inq['created_at'], new DateTimeZone('UTC')))->setTimezone(jobOrderTz())->format('Y-m-d H:i:s')
        : null;
    return [
        'inquiry_code' => $inq['inquiry_code'],
        'first_name'   => $inq['first_name'],
        'service'      => $inq['reason'],
        'address'      => $inq['address'],
        'sent_at'      => $sent,
        'answer'       => $inq['customer_answer'],
        'answer_at'    => $inq['customer_answer_at'],
        'expires_at'   => $inq['respond_expires_at'],
        'state'        => inquiryAnswerState($inq),       // open | closed | expired
        'decision'     => (int)$inq['status_id'] === INQ_STATUS_WON ? 'won' : ((int)$inq['status_id'] === INQ_STATUS_LOST ? 'lost' : null),
    ];
}

$method = $_SERVER['REQUEST_METHOD'];
if (!in_array($method, ['GET', 'POST'], true)) irFail('Method not allowed.', 405);

$body  = $method === 'POST' ? (json_decode(file_get_contents('php://input'), true) ?? []) : [];
$token = trim((string)($method === 'POST' ? ($body['t'] ?? '') : ($_GET['t'] ?? '')));

try {
    $pdo = getDB();
    $inq = inquiryFindByToken($pdo, $token);
    if (!$inq) irFail('This link is not valid. Please use the buttons in the latest email we sent you.', 404);

    if ($method === 'GET') {
        echo json_encode(['success' => true, 'inquiry' => irPublic($inq)]);
        exit;
    }

    $answer = (string)($body['answer'] ?? '');
    if (!in_array($answer, ['proceed', 'cancel'], true)) irFail('Choose Yes, proceed or No, cancel.', 400);

    $state = inquiryAnswerState($inq);
    if ($state === 'closed')  irFail('Our team has already reviewed this inquiry, so the answer can no longer be changed.', 409, ['inquiry' => irPublic($inq)]);
    if ($state === 'expired') irFail('This link has expired. Please contact us to continue with your inquiry.', 410, ['inquiry' => irPublic($inq)]);

    if ($inq['customer_answer'] !== $answer) {
        $now = jobOrderNow();
        $pdo->prepare("UPDATE inquiries SET customer_answer = ?, customer_answer_at = ? WHERE id = ? AND status_id = ?")
            ->execute([$answer, $now, $inq['id'], INQ_STATUS_NEW]);

        $who  = trim($inq['first_name'] . ' ' . $inq['last_name']);
        $code = $inq['inquiry_code'] ?: ('#' . $inq['id']);
        auditLog([
            'actor_user_id'  => $inq['user_id'] ?: null,
            'actor_name'     => $who,
            'actor_type'     => $inq['user_id'] ? 'client' : 'guest',
            'action'         => 'UPDATE',
            'module'         => 'Inquiries',
            'description'    => $answer === 'proceed'
                ? 'Customer confirmed they want to proceed with inquiry ' . $code
                : 'Customer cancelled inquiry ' . $code,
            'target_type'    => 'inquiry',
            'target_id'      => (int)$inq['id'],
            'target_label'   => $code . ' — ' . $who,
            'old_values'     => ['customer_answer' => $inq['customer_answer']],
            'new_values'     => ['customer_answer' => $answer],
            'status'         => 'success',
        ]);
        $inq['customer_answer']    = $answer;
        $inq['customer_answer_at'] = $now;
    }

    echo json_encode([
        'success' => true,
        'message' => $answer === 'proceed'
            ? 'Thank you! Our team will review your inquiry and contact you soon.'
            : 'Your inquiry has been cancelled. Thank you for letting us know.',
        'inquiry' => irPublic($inq),
    ]);
} catch (PDOException $e) {
    error_log('[SkillConnect] inquiry respond failed: ' . $e->getMessage());
    irFail('Something went wrong. Please try again.', 500);
}