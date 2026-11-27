<?php
// backend/api/inquiries/resend.php
// ADMIN: send the "inquiry received" SMS + Proceed / Cancel email again
// (e.g. the first email failed, or the customer lost it / the link expired).
//   POST { id }
require_once __DIR__ . '/../../cors.php';
require_once __DIR__ . '/../../middleware/jwt.php';
require_once __DIR__ . '/../../config/db.php';
require_once __DIR__ . '/../../middleware/audit.php';
require_once __DIR__ . '/../../helpers/inquiry-confirm.php';

handleCors();
header('Content-Type: application/json');

function rsFail(string $msg, int $code = 422): never
{
    http_response_code($code);
    echo json_encode(['success' => false, 'error' => $msg]);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') rsFail('Method not allowed.', 405);

$hdr = $_SERVER['HTTP_AUTHORIZATION']
    ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION']
    ?? (function_exists('apache_request_headers') ? (apache_request_headers()['Authorization'] ?? '') : '');
$tok = str_starts_with($hdr, 'Bearer ') ? jwtVerify(substr($hdr, 7)) : null;
if (!$tok) rsFail('Please sign in again.', 401);
if (!isAdminUser($tok)) rsFail('Only admins can do this.', 403);

$data = json_decode(file_get_contents('php://input'), true) ?? [];
$id   = (int)($data['id'] ?? 0);
if ($id <= 0) rsFail('Inquiry not found.', 404);

try {
    $pdo = getDB();
    $st  = $pdo->prepare('SELECT * FROM inquiries WHERE id = ? LIMIT 1');
    $st->execute([$id]);
    $inq = $st->fetch(PDO::FETCH_ASSOC);
    if (!$inq) rsFail('Inquiry not found.', 404);
    if ((int)$inq['status_id'] !== INQ_STATUS_NEW) rsFail('This inquiry is already closed.', 409);
    if ($inq['customer_answer'] === 'proceed') rsFail('The customer already confirmed this inquiry.', 409);
    if (empty(trim((string)$inq['email']))) rsFail('This inquiry has no email address.');

    $notify = inquiryNotifyReceived($pdo, $id);
    $code   = $inq['inquiry_code'] ?: ('#' . $id);
    $who    = trim($inq['first_name'] . ' ' . $inq['last_name']);

    auditLog(array_merge(auditActor($tok), [
        'action'       => 'UPDATE',
        'module'       => 'Inquiries',
        'description'  => 'Resent the confirmation email for inquiry ' . $code,
        'target_type'  => 'inquiry',
        'target_id'    => $id,
        'target_label' => $code . ' — ' . $who,
        'status'       => $notify['email'] === 'sent' ? 'success' : 'failed',
    ]));

    if ($notify['email'] !== 'sent') rsFail('The email could not be sent. Please check the email address and the Brevo setup.', 502);
    echo json_encode(['success' => true, 'message' => 'Confirmation email sent again.', 'notify' => $notify]);
} catch (PDOException $e) {
    error_log('[SkillConnect] inquiry resend failed: ' . $e->getMessage());
    rsFail('Something went wrong. Please try again.', 500);
}