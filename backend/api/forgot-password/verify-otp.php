<?php
// api/forgot-password/verify-otp.php
// Step 2 of Forgot Password: checks the 6-digit code. 5 wrong tries ends the request.

require_once __DIR__ . '/../../helpers/password-reset.php';
prStart();

require_once __DIR__ . '/../../config/db.php';

const MAX_ATTEMPTS   = 5;
const RESET_WINDOW_MIN = 10;   // after a correct code, 10 minutes to choose the new password

$body  = prInput();
$email = prEmail($body);
$otp   = prOtp($body);

try {
    $pdo = getDB();
    $req = prFindRequest($pdo, $email);

    if (!$req) prFail(400, 'No code was requested for this email, or it was already used. Please request a new code.');

    if ((int)$req['still_valid'] !== 1) {
        prDeleteRequest($pdo, $email);
        prFail(400, 'This code has expired. Please request a new one.');
    }

    if ((int)$req['verified'] === 1) {
        prOk('Code already verified.');   // e.g. the button was clicked twice
    }

    if ((int)$req['attempts'] >= MAX_ATTEMPTS) {
        prDeleteRequest($pdo, $email);
        prFail(429, 'Too many wrong codes. Please request a new code.');
    }

    if (!password_verify($otp, $req['otp_hash'])) {
        $left = MAX_ATTEMPTS - ((int)$req['attempts'] + 1);
        if ($left <= 0) {
            prDeleteRequest($pdo, $email);
            prFail(429, 'Too many wrong codes. Please request a new code.');
        }
        $pdo->prepare('UPDATE password_reset_otps SET attempts = attempts + 1 WHERE email = ?')->execute([$email]);
        prFail(400, "That code is not correct. {$left} " . ($left === 1 ? 'try' : 'tries') . ' left.');
    }

    // Correct: give them a little time to choose the new password
    $pdo->prepare('UPDATE password_reset_otps SET verified = 1, expires_at = NOW() + INTERVAL ' . RESET_WINDOW_MIN . ' MINUTE WHERE email = ?')
        ->execute([$email]);

    prOk('Code verified.');
} catch (Throwable $e) {
    error_log('[forgot-password] verify-otp: ' . $e->getMessage());
    prFail(500, 'Something went wrong. Please try again.');
}