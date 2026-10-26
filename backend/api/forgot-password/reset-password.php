<?php
// api/forgot-password/reset-password.php
// Applies the new password after OTP is verified.

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Content-Type');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }

require_once __DIR__ . '/../../config/db.php';
require_once __DIR__ . '/../../middleware/audit.php';
$pdo = getDB(); // ← add this line

// ── Input ─────────────────────────────────────────────────────────────────────
$body     = json_decode(file_get_contents('php://input'), true);
$email    = trim($body['email']    ?? '');
$otp      = trim($body['otp']      ?? '');   // re-sent as double-check
$password = $body['password']              ?? '';

if (!$email || !$otp || !$password) {
    http_response_code(422);
    echo json_encode(['error' => 'Missing required fields.']);
    exit;
}

if (strlen($otp) !== 6 || !ctype_digit($otp)) {
    http_response_code(422);
    echo json_encode(['error' => 'Invalid OTP format.']);
    exit;
}

if (strlen($password) < 8) {
    http_response_code(422);
    echo json_encode(['error' => 'Password must be at least 8 characters.']);
    exit;
}

// ── Confirm OTP record still exists and was verified (attempts = -1) ──────────
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
    echo json_encode(['error' => 'Session expired. Please start over.']);
    exit;
}

// Must be in verified state (attempts = -1) AND not expired
if ((int)$row['attempts'] !== -1) {
    http_response_code(400);
    echo json_encode(['error' => 'OTP has not been verified. Please verify your code first.']);
    exit;
}

if (new DateTime() > new DateTime($row['expires_at'])) {
    $pdo->prepare('DELETE FROM password_reset_otps WHERE email = ?')->execute([$email]);
    http_response_code(400);
    echo json_encode(['error' => 'Session expired. Please start over.']);
    exit;
}

// Double-check the OTP hash as an extra security layer
if (!password_verify($otp, $row['otp_hash'])) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid session. Please start over.']);
    exit;
}

// ── Update password ───────────────────────────────────────────────────────────
$newHash = password_hash($password, PASSWORD_BCRYPT, ['cost' => 12]);

$uStmt = $pdo->prepare('SELECT id, type, first_name, last_name, username FROM users WHERE email = ? LIMIT 1');
$uStmt->execute([$email]);
$acct = $uStmt->fetch(PDO::FETCH_ASSOC);
if (!$acct) {
    http_response_code(404);
    echo json_encode(['error' => 'Account not found.']);
    exit;
}

$stmt = $pdo->prepare('UPDATE users SET password = ? WHERE id = ?');
$stmt->execute([$newHash, $acct['id']]);

if ($stmt->rowCount() === 0) {
    http_response_code(500);
    echo json_encode(['error' => 'Failed to update password. Please try again.']);
    exit;
}

$acctName = trim($acct['first_name'] . ' ' . $acct['last_name']);
auditLog([
    'actor_user_id'  => $acct['id'],
    'actor_name'     => $acctName,
    'actor_type'     => $acct['type'],
    'action'         => 'PASSWORD_RESET',
    'module'         => 'Auth',
    'description'    => 'Password reset through Forgot Password (email OTP verified) for "' . ($acct['username'] ?: $acctName) . '"',
    'target_user_id' => $acct['id'],
    'target_type'    => 'users',
    'target_id'      => $acct['id'],
    'target_label'   => $acct['username'] ?: $acctName,
    'status'         => 'success',
]);

// ── Clean up OTP record ───────────────────────────────────────────────────────
$pdo->prepare('DELETE FROM password_reset_otps WHERE email = ?')->execute([$email]);

// ── Optionally: invalidate all active sessions for this user here ─────────────
// e.g. delete from sessions table, or rotate a session_version column

echo json_encode(['message' => 'Password updated successfully.']);