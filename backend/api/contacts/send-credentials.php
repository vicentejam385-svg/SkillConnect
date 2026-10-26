<?php
require_once __DIR__ . '/../../cors.php';
require_once __DIR__ . '/../../config/db.php';
require_once __DIR__ . '/../../middleware/jwt.php';

handleCors();
header('Content-Type: application/json');

requireAdminAccess();
$pdo = getDB();

require_once __DIR__ . '/../../config/brevo.php';
const FROM_EMAIL    = 'luzongabril@gmail.com';
const FROM_NAME     = 'SkillConnect – Emerald Builders';

$body     = json_decode(file_get_contents('php://input'), true) ?? [];
$email    = trim($body['email']    ?? '');
$name     = trim($body['name']     ?? '');
$password = trim($body['password'] ?? '');

if (!$email || !$name || !$password) {
    http_response_code(422);
    echo json_encode(['success' => false, 'error' => 'Missing required fields.']);
    exit;
}

try {
    $pdo = getDB();

    // ── STEP 1: Hash & save password FIRST (users table) ──
    $hash = password_hash($password, PASSWORD_BCRYPT);

    $update = $pdo->prepare('UPDATE users SET password = ?, status_id = 1 WHERE LOWER(email) = LOWER(?)');
    $update->execute([$hash, $email]);

    // rowCount() is 0 if the hash didn't change, so confirm by lookup instead
    $check = $pdo->prepare('SELECT password FROM users WHERE LOWER(email) = LOWER(?)');
    $check->execute([$email]);
    $saved = $check->fetch(PDO::FETCH_ASSOC);

    if (!$saved) {
        http_response_code(404);
        echo json_encode(['success' => false, 'error' => 'User not found for email: ' . $email]);
        exit;
    }

    // ── STEP 2: Verify the hash was saved correctly ──
    if (!password_verify($password, $saved['password'])) {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'Password hash verification failed after save.']);
        exit;
    }

    // ── STEP 3: Send the email ──
    $safeName  = htmlspecialchars($name,     ENT_QUOTES, 'UTF-8');
    $safeEmail = htmlspecialchars($email,    ENT_QUOTES, 'UTF-8');
    $safePass  = htmlspecialchars($password, ENT_QUOTES, 'UTF-8');

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
    .creds-box { background: #f0fdf4; border: 2px solid #6ee7b7; border-radius: 10px;
                 padding: 20px; margin: 24px 0; }
    .cred-row  { display: flex; justify-content: space-between; align-items: center;
                 padding: 8px 0; border-bottom: 1px solid #d1fae5; }
    .cred-row:last-child { border-bottom: none; }
    .cred-label { font-size: 13px; color: #6b7280; font-weight: 600; }
    .cred-value { font-size: 14px; color: #065f46; font-weight: 700; font-family: monospace; }
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
      <p>Hi <strong>{$safeName}</strong>,</p>
      <p>Great news! Your inquiry has been approved and your account is now ready. You can log in using the credentials below:</p>
      <div class='creds-box'>
        <div class='cred-row'>
          <span class='cred-label'>Email</span>
          <span class='cred-value'>{$safeEmail}</span>
        </div>
        <div class='cred-row'>
          <span class='cred-label'>Password</span>
          <span class='cred-value'>{$safePass}</span>
        </div>
      </div>
      <p>Please log in and change your password as soon as possible for security.</p>
      <p>If you have any questions, feel free to reply to this email.</p>
    </div>
    <div class='footer'>
      &copy; " . date('Y') . " Emerald Builders &amp; Construction. All rights reserved.
    </div>
  </div>
</body>
</html>
";

      // DEV MODE: no Brevo key → skip the email, log the credentials locally
    if (BREVO_API_KEY === '') {
        error_log("[SkillConnect DEV] Credentials for {$email} => password: {$password}");
        echo json_encode(['success' => true, 'email_sent' => false,
                          'message' => 'Account activated. Email skipped (no Brevo key).']);
        exit;
    }

    $payload = [
        'sender'      => ['name' => FROM_NAME, 'email' => FROM_EMAIL],
        'to'          => [['email' => $email, 'name' => $name]],
        'subject'     => 'Your SkillConnect Account is Ready!',
        'htmlContent' => $emailBody,
    ];

    $ch = curl_init('https://api.brevo.com/v3/smtp/email');
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
               CURLOPT_POST           => true,
        CURLOPT_TIMEOUT        => 15,
        CURLOPT_CONNECTTIMEOUT => 10,
        CURLOPT_POSTFIELDS     => json_encode($payload),
        CURLOPT_HTTPHEADER     => [
            'accept: application/json',
            'api-key: ' . BREVO_API_KEY,
            'content-type: application/json',
        ],
    ]);
    $response   = curl_exec($ch);
    $httpStatus = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlError  = curl_error($ch);
    curl_close($ch);

    if ($httpStatus < 200 || $httpStatus >= 300) {
        error_log("[SkillConnect] Brevo failed. HTTP {$httpStatus} | curl: {$curlError} | response: {$response}");
        // Account is already saved/activated, so don't fail the whole request
        echo json_encode([
            'success'    => true,
            'email_sent' => false,
            'message'    => 'Account activated, but the email could not be sent.',
            'detail'     => ['http_status' => $httpStatus, 'curl_error' => $curlError, 'response' => $response],
        ]);
        exit;
    }

    echo json_encode(['success' => true, 'message' => 'Welcome email sent and account activated.']);

} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Server error.', 'detail' => $e->getMessage()]);
}