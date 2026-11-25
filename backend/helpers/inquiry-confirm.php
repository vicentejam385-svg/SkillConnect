<?php
// backend/helpers/inquiry-confirm.php
// When a customer submits an inquiry online:
//   1. SMS (Semaphore): "We received your inquiry … please check your email."  (no link: PH networks block links)
//   2. Email (Brevo):   the inquiry details + "Yes, proceed" / "No, cancel" buttons.
// The buttons open /inquiry-response?t=<private link>. The customer's answer is saved on the inquiry,
// and the admin still marks it Won or Lost by hand.
require_once __DIR__ . '/job-offers.php';        // Brevo email + app URL
require_once __DIR__ . '/job-order-status.php';  // Manila time
require_once __DIR__ . '/sms.php';               // Semaphore SMS

if (!defined('INQ_STATUS_NEW')) {
    define('INQ_STATUS_NEW', 8);
    define('INQ_STATUS_WON', 9);
    define('INQ_STATUS_LOST', 10);
    define('INQ_LINK_DAYS', 7);       // the email buttons work for 7 days
    define('INQ_SMS_PER_DAY', 3);     // at most 3 "received" SMS per mobile number per 24 hours (stops spam using up credits)
}

function inquiryResponseUrl(string $token, string $answer = ''): string
{
    return JOB_OFFER_APP_URL . '/inquiry-response?t=' . rawurlencode($token) . ($answer ? '&a=' . $answer : '');
}

/** The inquiry that owns this private link, or null. */
function inquiryFindByToken(PDO $pdo, string $token): ?array
{
    if (!preg_match('/^[a-f0-9]{64}$/', $token)) return null;
    $st = $pdo->prepare(
        "SELECT i.*, s.label AS status FROM inquiries i LEFT JOIN statuses s ON s.id = i.status_id
         WHERE i.respond_token_hash = ? LIMIT 1"
    );
    $st->execute([hash('sha256', $token)]);
    return $st->fetch(PDO::FETCH_ASSOC) ?: null;
}

/** 'open' (can answer), 'closed' (already Won or Lost) or 'expired'. */
function inquiryAnswerState(array $inq): string
{
    if ((int)$inq['status_id'] !== INQ_STATUS_NEW) return 'closed';
    if (!empty($inq['respond_expires_at']) && $inq['respond_expires_at'] < jobOrderNow()) return 'expired';
    return 'open';
}

/** The email with the two buttons. */
function inquiryReceivedEmailHtml(array $inq, string $token): string
{
    $e    = fn($v) => htmlspecialchars((string)$v, ENT_QUOTES, 'UTF-8');
    $year = date('Y');
    $code = $inq['inquiry_code'] ?: ('#' . $inq['id']);
    $sent = (new DateTime($inq['created_at'] ?? 'now', new DateTimeZone('UTC')))->setTimezone(jobOrderTz())->format('F j, Y g:i A');
    $days = INQ_LINK_DAYS;
    $rows = '';
    foreach ([
        'Inquiry'  => $code,
        'Service'  => $inq['reason'],
        'Address'  => $inq['address'],
        'Mobile'   => $inq['mobile'],
        'Sent on'  => $sent,
        'Details'  => $inq['description'],
    ] as $k => $v) {
        if ($v === null || $v === '') continue;
        $rows .= "<tr><td style='padding:6px 0;color:#6b7280;font-size:13px;width:90px;vertical-align:top'>{$e($k)}</td>"
               . "<td style='padding:6px 0;color:#111827;font-size:14px'>" . nl2br($e($v)) . "</td></tr>";
    }
    $yes = $e(inquiryResponseUrl($token, 'proceed'));
    $no  = $e(inquiryResponseUrl($token, 'cancel'));

    return "<!DOCTYPE html><html><head><meta charset='UTF-8'></head>
<body style=\"font-family:'Helvetica Neue',Arial,sans-serif;background:#f9fafb;margin:0;padding:0\">
  <div style='max-width:480px;margin:40px auto;background:#ffffff;border-radius:12px;box-shadow:0 2px 12px rgba(0,0,0,0.08);overflow:hidden'>
    <div style='background:#059669;padding:28px 40px;text-align:center'>
      <h1 style='color:#ffffff;margin:0;font-size:20px;font-weight:700'>We received your inquiry</h1>
      <p style='color:#a7f3d0;margin:4px 0 0;font-size:13px'>SkillConnect · Emerald Builders and Construction</p>
    </div>
    <div style='padding:32px 40px'>
      <p style='color:#374151;font-size:15px;line-height:1.6;margin:0 0 14px'>Hi <strong>{$e($inq['first_name'])}</strong>,</p>
      <p style='color:#374151;font-size:15px;line-height:1.6;margin:0 0 18px'>Thank you for your inquiry. Here are the details you sent us:</p>
      <table style='width:100%;border-collapse:collapse;margin:0 0 20px;border-top:1px solid #e5e7eb;border-bottom:1px solid #e5e7eb'>{$rows}</table>
      <p style='color:#111827;font-size:15px;font-weight:600;line-height:1.6;margin:0 0 14px;text-align:center'>Do you want to proceed with this inquiry?</p>
      <table role='presentation' style='width:100%;border-collapse:collapse;margin:0 0 8px'><tr>
        <td style='padding:0 6px 0 0;width:50%'>
          <a href='{$yes}' style='display:block;text-align:center;background:#059669;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 10px;border-radius:8px'>Yes, proceed</a>
        </td>
        <td style='padding:0 0 0 6px;width:50%'>
          <a href='{$no}' style='display:block;text-align:center;background:#ffffff;color:#374151;text-decoration:none;font-weight:600;font-size:14px;padding:11px 10px;border-radius:8px;border:1px solid #d1d5db'>No, cancel</a>
        </td>
      </tr></table>
      <p style='color:#6b7280;font-size:12px;line-height:1.6;margin:16px 0 0;text-align:center'>
        These buttons work for {$days} days. Our team will review your answer and contact you.
        If you didn't send this inquiry, you can ignore this email.
      </p>
    </div>
    <div style='background:#f3f4f6;padding:18px 40px;text-align:center;color:#9ca3af;font-size:12px'>
      &copy; {$year} Emerald Builders &amp; Construction. All rights reserved.
    </div>
  </div>
</body></html>";
}

/**
 * Send the "inquiry received" SMS and email, and save how it went on the inquiry.
 * Returns ['sms' => sent|failed|skipped, 'email' => sent|failed|skipped]. Never throws.
 */
function inquiryNotifyReceived(PDO $pdo, int $inquiryId): array
{
    $result = ['sms' => 'skipped', 'email' => 'skipped'];
    try {
        $st = $pdo->prepare('SELECT * FROM inquiries WHERE id = ? LIMIT 1');
        $st->execute([$inquiryId]);
        $inq = $st->fetch(PDO::FETCH_ASSOC);
        if (!$inq) return $result;

        $code  = $inq['inquiry_code'] ?: ('#' . $inquiryId);
        $token = bin2hex(random_bytes(32));
        $exp   = (new DateTime('now', jobOrderTz()))->modify('+' . INQ_LINK_DAYS . ' days')->format('Y-m-d H:i:s');

        // 1. Email with the buttons
        if (!empty($inq['email'])) {
            $ok = jobOfferSendMail($inq['email'], trim($inq['first_name'] . ' ' . $inq['last_name']),
                'We received your inquiry ' . $code . ' – please confirm', inquiryReceivedEmailHtml($inq, $token));
            $result['email'] = $ok ? 'sent' : 'failed';
        }

        // 2. SMS (no link), at most INQ_SMS_PER_DAY per number per day
        $smsError = null;
        $mobile   = smsNormalizeMobile($inq['mobile'] ?? '');
        if ($mobile) {
            $cnt = $pdo->prepare(
                "SELECT COUNT(*) FROM inquiries
                 WHERE id <> ? AND sms_status = 'sent' AND created_at >= ?
                   AND REPLACE(REPLACE(mobile, '+63', '0'), ' ', '') = ?"
            );
            // created_at is stored by the database (UTC); compare with a UTC time
            $sinceUtc = (new DateTime('now', new DateTimeZone('UTC')))->modify('-1 day')->format('Y-m-d H:i:s');
            $cnt->execute([$inquiryId, $sinceUtc, $mobile]);
            if ((int)$cnt->fetchColumn() >= INQ_SMS_PER_DAY) {
                $smsError = 'Daily SMS limit for this number reached.';
            } else {
                $first = trim((string)$inq['first_name']);
                // Kept under 160 characters so it is sent (and charged) as ONE SMS
                $msg = 'SkillConnect: Hi ' . mb_substr($first, 0, 15) . ', we received your inquiry ' . $code
                     . ' (' . mb_substr((string)$inq['reason'], 0, 25) . '). '
                     . ($result['email'] === 'sent'
                         ? 'Please check your email to confirm.'
                         : 'Our team will contact you to confirm.')
                     . ' - Emerald Builders';
                $sms = smsSend($mobile, $msg);
                $result['sms'] = $sms['ok'] ? 'sent' : (!empty($sms['skipped']) ? 'skipped' : 'failed');
                $smsError = $sms['ok'] ? null : ($sms['error'] ?? null);
            }
        } else {
            $smsError = 'No valid mobile number.';
        }

        $pdo->prepare(
            "UPDATE inquiries SET respond_token_hash = ?, respond_expires_at = ?, sms_status = ?, sms_error = ?, email_status = ?
             WHERE id = ?"
        )->execute([
            $result['email'] === 'sent' ? hash('sha256', $token) : null,
            $result['email'] === 'sent' ? $exp : null,
            $result['sms'], $smsError, $result['email'], $inquiryId,
        ]);
    } catch (Throwable $e) {
        error_log('[SkillConnect] inquiry notify failed for #' . $inquiryId . ': ' . $e->getMessage());
    }
    return $result;
}