<?php
// api/forgot-password/send-otp.php
// Sends a 6-digit OTP to the user's email via Brevo Transactional API.

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Content-Type');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }

require_once __DIR__ . '/../../config/db.php';
$pdo = getDB(); // ← add this line

// ── Config ────────────────────────────────────────────────────────────────────
require_once __DIR__ . '/../../config/brevo.php';
const FROM_EMAIL    = 'luzongabril@gmail.com';
const FROM_NAME       = 'SkillConnect – Emerald Builders';
const OTP_EXPIRES_MIN = 5;                           

// ── Input ─────────────────────────────────────────────────────────────────────
$body  = json_decode(file_get_contents('php://input'), true);
$email = trim($body['email'] ?? '');

if (!$email || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    http_response_code(422);
    echo json_encode(['error' => 'Please provide a valid email address.']);
    exit;
}

// ── Check user exists ─────────────────────────────────────────────────────────
$stmt = $pdo->prepare('SELECT id FROM contacts WHERE email = ? LIMIT 1');
$stmt->execute([$email]);
if (!$stmt->fetch()) {
    // Return 200 to avoid email enumeration — frontend treats it as success
    echo json_encode(['message' => 'If that email exists, a code has been sent.']);
    exit;
}

// ── Generate OTP ──────────────────────────────────────────────────────────────
$otp       = str_pad(random_int(0, 999999), 6, '0', STR_PAD_LEFT);
$expiresAt = date('Y-m-d H:i:s', strtotime('+' . OTP_EXPIRES_MIN . ' minutes'));
$otpHash   = password_hash($otp, PASSWORD_BCRYPT);   // store hashed, never plain


$pdo->prepare('
    INSERT INTO password_reset_otps (email, otp_hash, expires_at, attempts)
    VALUES (?, ?, ?, 0)
    ON DUPLICATE KEY UPDATE otp_hash = VALUES(otp_hash),
                            expires_at = VALUES(expires_at),
                            attempts = 0,
                            created_at = CURRENT_TIMESTAMP
')->execute([$email, $otpHash, $expiresAt]);

// ── Send via Brevo ────────────────────────────────────────────────────────────
$emailBody = "
<!DOCTYPE html>
<html>
<head>
  <meta charset='UTF-8'>
  <style>
    body { font-family: 'Helvetica Neue', Arial, sans-serif; background: #f9fafb; margin: 0; padding: 0; }
    .wrapper { max-width: 480px; margin: 40px auto; background: #ffffff; border-radius: 12px;
               box-shadow: 0 2px 12px rgba(0,0,0,0.08); overflow: hidden; }
    .header  { background: #059669; padding: 32px 40px; text-align: center; }
    .header h1 { color: #ffffff; margin: 0; font-size: 22px; font-weight: 700; }
    .header p  { color: #a7f3d0; margin: 4px 0 0; font-size: 13px; }
    .body    { padding: 36px 40px; }
    .body p  { color: #374151; font-size: 15px; line-height: 1.6; margin: 0 0 16px; }
    .otp-box { background: #f0fdf4; border: 2px solid #6ee7b7; border-radius: 10px;
               text-align: center; padding: 20px; margin: 24px 0; }
    .otp-box span { font-size: 38px; font-weight: 800; letter-spacing: 10px; color: #065f46; }
    .expire  { color: #6b7280; font-size: 13px; text-align: center; margin-top: -8px; }
    .footer  { background: #f3f4f6; padding: 20px 40px; text-align: center;
               color: #9ca3af; font-size: 12px; }
  </style>
</head>
<body>
  <div class='wrapper'>
    <div class='header'>
      <h1>SkillConnect</h1>
      <p>Emerald Builders and Construction</p>
    </div>
    <div class='body'>
      <p>Hi there,</p>
      <p>We received a request to reset the password for your account associated with <strong>{$email}</strong>.</p>
      <p>Use the code below to proceed. <strong>Do not share this code with anyone.</strong></p>
      <div class='otp-box'>
        <span>{$otp}</span>
      </div>
      <p class='expire'>⏱ This code expires in " . OTP_EXPIRES_MIN . " minutes.</p>
      <p>If you did not request a password reset, you can safely ignore this email.</p>
    </div>
    <div class='footer'>
      &copy; " . date('Y') . " Emerald Builders &amp; Construction. All rights reserved.
    </div>
  </div>
</body>
</html>
";

$payload = [
    'sender'     => ['name' => FROM_NAME, 'email' => FROM_EMAIL],
    'to'         => [['email' => $email]],
    'subject'    => 'Your SkillConnect Password Reset Code',
    'htmlContent'=> $emailBody,
];

$ch = curl_init('https://api.brevo.com/v3/smtp/email');
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_POST           => true,
    CURLOPT_POSTFIELDS     => json_encode($payload),
    CURLOPT_HTTPHEADER     => [
        'accept: application/json',
        'api-key: ' . BREVO_API_KEY,
        'content-type: application/json',
    ],
]);
$response   = curl_exec($ch);
$httpStatus = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

if ($httpStatus < 200 || $httpStatus >= 300) {
    error_log("Brevo error [{$httpStatus}]: {$response}");
    http_response_code(502);
    echo json_encode(['error' => 'Failed to send email. Please try again later.']);
    exit;
}

echo json_encode(['message' => 'If that email exists, a code has been sent.']);