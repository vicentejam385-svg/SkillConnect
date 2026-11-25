<?php
// api/forgot-password/reset-password.php
// Step 3 of Forgot Password: saves the new password after the code was verified.

require_once __DIR__ . '/../../helpers/password-reset.php';
prStart();

require_once __DIR__ . '/../../config/db.php';
require_once __DIR__ . '/../../middleware/audit.php';

$body     = prInput();
$email    = prEmail($body);
$otp      = prOtp($body);
$password = isset($body['password']) ? $body['password'] : '';

$pwError = prPasswordError($password);
if ($pwError) prFail(422, $pwError);

try {
    $pdo = getDB();
    $req = prFindRequest($pdo, $email);

    // The code must have been verified in step 2, still be in time, and match again
    if (!$req || (int)$req['verified'] !== 1) prFail(400, 'Please verify your code first.');
    if ((int)$req['still_valid'] !== 1) {
        prDeleteRequest($pdo, $email);
        prFail(400, 'This reset session has expired. Please start over.');
    }
    if (!password_verify($otp, $req['otp_hash'])) prFail(400, 'This reset session is not valid. Please start over.');

    $uStmt = $pdo->prepare('SELECT id, type, first_name, last_name, username, password FROM users WHERE email = ? LIMIT 1');
    $uStmt->execute([$email]);
    $acct = $uStmt->fetch(PDO::FETCH_ASSOC);
    if (!$acct) {
        prDeleteRequest($pdo, $email);
        prFail(400, 'This reset session is not valid. Please start over.');
    }

    if (!empty($acct['password']) && password_verify($password, $acct['password'])) {
        prFail(422, 'Your new password must be different from your current one.');
    }

    $pdo->prepare('UPDATE users SET password = ? WHERE id = ?')
        ->execute([password_hash($password, PASSWORD_BCRYPT, ['cost' => 12]), $acct['id']]);

    // The code can only be used once
    prDeleteRequest($pdo, $email);

    $acctName = trim($acct['first_name'] . ' ' . $acct['last_name']);
    try {
        auditLog([
            'actor_user_id'  => $acct['id'],
            'actor_name'     => $acctName,
            'actor_type'     => $acct['type'],
            'action'         => 'PASSWORD_RESET',
            'module'         => 'Auth',
            'description'    => 'Password reset through Forgot Password (email code verified) for "' . ($acct['username'] ?: $acctName) . '"',
            'target_user_id' => $acct['id'],
            'target_type'    => 'users',
            'target_id'      => $acct['id'],
            'target_label'   => $acct['username'] ?: $acctName,
            'status'         => 'success',
        ]);
    } catch (Throwable $e) {
        error_log('[forgot-password] audit log failed: ' . $e->getMessage());   // never block the reset
    }

    prOk('Your password was updated. You can sign in now.');
} catch (Throwable $e) {
    error_log('[forgot-password] reset-password: ' . $e->getMessage());
    prFail(500, 'Something went wrong. Please try again.');
}