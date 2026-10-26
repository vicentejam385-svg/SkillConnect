<?php
// api/forgot-password/verify-otp.php
// Verifies the 6-digit OTP submitted by the user.

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Content-Type');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }

require_once __DIR__ . '/../../config/db.php';
$pdo = getDB(); // ← add this line

const MAX_ATTEMPTS = 5;

// ── Input ─────────────────────────────────────────────────────────────────────
$body  = json_decode(file_get_contents('php://input'), true);
$email = trim($body['email'] ?? '');
$otp   = trim($body['otp']   ?? '');

if (!$email || !$otp || strlen($otp) !== 6 || !ctype_digit($otp)) {
    http_response_code(422);
    echo json_encode(['error' => 'Invalid request.']);
    exit;
}

// ── Fetch OTP record ──────────────────────────────────────────────────────────
$stmt = $pdo->prepare('
    SELECT otp_hash, expires_at, attempts
    FROM   password_reset_otps
    WHERE  email = ?
    LIMIT  1
');
$stmt->execute([$email]);
$row = $stmt->fetch(PDO::FETCH_ASSOC);

if (!$row) {
    http_response_code(400);
    echo json_encode(['error' => 'No OTP request found. Please request a new code.']);
    exit;
}

// ── Attempt limit ─────────────────────────────────────────────────────────────
if ((int)$row['attempts'] >= MAX_ATTEMPTS) {
    $pdo->prepare('DELETE FROM password_reset_otps WHERE email = ?')->execute([$email]);
    http_response_code(429);
    echo json_encode(['error' => 'Too many incorrect attempts. Please request a new code.']);
    exit;
}

// ── Expiry check ──────────────────────────────────────────────────────────────
if (new DateTime() > new DateTime($row['expires_at'])) {
    $pdo->prepare('DELETE FROM password_reset_otps WHERE email = ?')->execute([$email]);
    http_response_code(400);
    echo json_encode(['error' => 'This code has expired. Please request a new one.']);
    exit;
}

// ── Hash check ────────────────────────────────────────────────────────────────
if (!password_verify($otp, $row['otp_hash'])) {
    $newAttempts = (int)$row['attempts'] + 1;
    $remaining   = MAX_ATTEMPTS - $newAttempts;

    if ($remaining <= 0) {
        $pdo->prepare('DELETE FROM password_reset_otps WHERE email = ?')->execute([$email]);
        http_response_code(429);
        echo json_encode(['error' => 'Too many incorrect attempts. Please request a new code.']);
        exit;
    }

    $pdo->prepare('UPDATE password_reset_otps SET attempts = attempts + 1 WHERE email = ?')
        ->execute([$email]);
    http_response_code(400);
    echo json_encode(['error' => "Incorrect code. {$remaining} attempt(s) remaining."]);
    exit;
}

// ── OTP is valid — mark as verified (reset attempts so reset-password.php can proceed) ──
// We keep the row so reset-password.php can confirm the OTP is still valid server-side.
$pdo->prepare('UPDATE password_reset_otps SET attempts = -1 WHERE email = ?')
    ->execute([$email]);
// attempts = -1 is our sentinel: "OTP verified, pending password reset"

echo json_encode(['message' => 'OTP verified successfully.']);