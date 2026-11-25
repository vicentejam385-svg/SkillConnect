<?php
// api/forgot-password/send-otp.php
// Step 1 of Forgot Password: emails a 6-digit code (Brevo).
// The answer is the same whether or not the email has an account, so nobody can
// use this page to find out which emails are registered.

require_once __DIR__ . '/../../helpers/password-reset.php';
prStart();

require_once __DIR__ . '/../../config/db.php';
require_once __DIR__ . '/../../config/brevo.php';

const OTP_EXPIRES_MIN   = 5;   // code is valid for 5 minutes
const RESEND_WAIT_SEC   = 60;  // at least 60 seconds between codes
const MAX_SENDS_PER_HR  = 5;   // at most 5 codes per email per hour
const PR_FROM_EMAIL     = 'luzongabril@gmail.com';            // must be a verified sender in Brevo
const PR_FROM_NAME      = 'SkillConnect – Emerald Builders';

$GENERIC = 'If that email has an account, we sent a 6-digit code to it.';

$email = prEmail(prInput());

try {
    $pdo = getDB();

    // ── Account lookup (all accounts live in `users`) ──────────────────────
    $stmt = $pdo->prepare('SELECT id, first_name, password, status_id FROM users WHERE email = ? LIMIT 1');
    $stmt->execute([$email]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);

    // No account, no password yet, or Suspended (3) / Blacklisted (6): say the same thing, send nothing
    if (!$user || empty($user['password']) || in_array((int)$user['status_id'], [3, 6], true)) {
        prOk($GENERIC);
    }

    // ── Limits: one code a minute, five an hour ────────────────────────────
    $req = prFindRequest($pdo, $email);
    if ($req) {
        $wait = RESEND_WAIT_SEC - (int)$req['secs_since_sent'];
        if ($wait > 0) prFail(429, "Please wait {$wait} seconds before asking for a new code.");
        if ((int)$req['in_window'] === 1 && (int)$req['send_count'] >= MAX_SENDS_PER_HR) {
            prFail(429, 'Too many codes were requested for this email. Please try again in an hour.');
        }
    }

    // ── New code (only its hash is stored) ─────────────────────────────────
    $otp     = str_pad((string)random_int(0, 999999), 6, '0', STR_PAD_LEFT);
    $otpHash = password_hash($otp, PASSWORD_BCRYPT);

    $pdo->prepare('
        INSERT INTO password_reset_otps (email, otp_hash, expires_at, attempts, verified, send_count, window_start, created_at)
        VALUES (?, ?, NOW() + INTERVAL ' . OTP_EXPIRES_MIN . ' MINUTE, 0, 0, 1, NOW(), NOW())
        ON DUPLICATE KEY UPDATE
            otp_hash     = VALUES(otp_hash),
            expires_at   = VALUES(expires_at),
            attempts     = 0,
            verified     = 0,
            send_count   = IF(window_start > NOW() - INTERVAL 1 HOUR, send_count + 1, 1),
            window_start = IF(window_start > NOW() - INTERVAL 1 HOUR, window_start, NOW()),
            created_at   = NOW()
    ')->execute([$email, $otpHash]);

    // ── Email ──────────────────────────────────────────────────────────────
    if (!defined('BREVO_API_KEY') || BREVO_API_KEY === '') {
        error_log('[forgot-password] BREVO_API_KEY is not set');
        prDeleteRequest($pdo, $email);
        prFail(500, 'Email is not set up yet. Please contact the admin.');
    }

    $name = htmlspecialchars($user['first_name'] ?: 'there', ENT_QUOTES, 'UTF-8');
    $safeEmail = htmlspecialchars($email, ENT_QUOTES, 'UTF-8');
    $year = date('Y');
    $mins = OTP_EXPIRES_MIN;
    $html = <<<HTML
<!DOCTYPE html>
<html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:32px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;">
        <tr><td style="padding:28px 32px 8px;">
          <p style="margin:0;font-size:15px;font-weight:bold;color:#047857;">SkillConnect</p>
          <p style="margin:2px 0 0;font-size:12px;color:#64748b;">Emerald Builders &amp; Construction</p>
        </td></tr>
        <tr><td style="padding:16px 32px 8px;color:#334155;font-size:15px;line-height:1.6;">
          <p style="margin:0 0 12px;">Hi {$name},</p>
          <p style="margin:0 0 12px;">We received a request to reset the password for <strong>{$safeEmail}</strong>. Enter this code on the reset page:</p>
        </td></tr>
        <tr><td align="center" style="padding:8px 32px;">
          <div style="display:inline-block;padding:14px 24px;border:1px solid #a7f3d0;background:#ecfdf5;border-radius:10px;font-size:32px;font-weight:bold;letter-spacing:8px;color:#065f46;">{$otp}</div>
        </td></tr>
        <tr><td style="padding:12px 32px 24px;color:#64748b;font-size:13px;line-height:1.6;">
          <p style="margin:0 0 8px;">The code expires in {$mins} minutes. Never share it with anyone, including our staff.</p>
          <p style="margin:0;">If you didn't ask to reset your password, you can ignore this email. Your password stays the same.</p>
        </td></tr>
        <tr><td style="padding:16px 32px;border-top:1px solid #f1f5f9;color:#94a3b8;font-size:12px;">&copy; {$year} Emerald Builders &amp; Construction</td></tr>
      </table>
    </td></tr>
  </table>
</body></html>
HTML;

    $ch = curl_init('https://api.brevo.com/v3/smtp/email');
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST           => true,
        CURLOPT_TIMEOUT        => 10,
        CURLOPT_CONNECTTIMEOUT => 5,
        CURLOPT_POSTFIELDS     => json_encode([
            'sender'      => ['name' => PR_FROM_NAME, 'email' => PR_FROM_EMAIL],
            'to'          => [['email' => $email]],
            'subject'     => 'Your SkillConnect password reset code',
            'htmlContent' => $html,
            'textContent' => "Your SkillConnect password reset code is {$otp}. It expires in {$mins} minutes. If you didn't ask for this, ignore this email.",
        ]),
        CURLOPT_HTTPHEADER     => [
            'accept: application/json',
            'api-key: ' . BREVO_API_KEY,
            'content-type: application/json',
        ],
    ]);
    $response   = curl_exec($ch);
    $httpStatus = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlError  = curl_error($ch);
    curl_close($ch);

    if ($httpStatus < 200 || $httpStatus >= 300) {
        error_log("[forgot-password] Brevo error [{$httpStatus}] {$curlError}: {$response}");
        prDeleteRequest($pdo, $email);   // so the person can try again right away
        prFail(502, "We couldn't send the email right now. Please try again in a moment.");
    }

    prOk($GENERIC);
} catch (Throwable $e) {
    error_log('[forgot-password] send-otp: ' . $e->getMessage());
    prFail(500, 'Something went wrong. Please try again.');
}