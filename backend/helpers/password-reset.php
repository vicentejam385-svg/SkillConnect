<?php
// helpers/password-reset.php
// Shared by api/forgot-password/send-otp.php, verify-otp.php and reset-password.php

// ── Public endpoint: allow the website to call it, answer the browser's pre-check
function prStart()
{
    header('Content-Type: application/json');
    header('Cache-Control: no-store');
    header('Access-Control-Allow-Origin: *');
    header('Access-Control-Allow-Methods: POST, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type');
    if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') prFail(405, 'Method not allowed.');
}

function prFail($code, $message)
{
    http_response_code($code);
    echo json_encode(['success' => false, 'error' => $message]);
    exit;
}

function prOk($message, $extra = [])
{
    echo json_encode(array_merge(['success' => true, 'message' => $message], $extra));
    exit;
}

function prInput()
{
    $body = json_decode(file_get_contents('php://input'), true);
    return is_array($body) ? $body : [];
}

// Email as typed, trimmed and lower-cased (emails are matched without caring about case)
function prEmail($body)
{
    $email = strtolower(trim(isset($body['email']) ? (string)$body['email'] : ''));
    if ($email === '' || strlen($email) > 254 || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
        prFail(422, 'Please enter a valid email address.');
    }
    return $email;
}

function prOtp($body)
{
    $otp = trim(isset($body['otp']) ? (string)$body['otp'] : '');
    if (strlen($otp) !== 6 || !ctype_digit($otp)) prFail(422, 'Enter the 6-digit code from your email.');
    return $otp;
}

// Same rule as the website (utils/validators.js): 8–64 characters, upper, lower and a number
function prPasswordError($password)
{
    if (!is_string($password) || $password === '') return 'Please enter a new password.';
    if (strlen($password) < 8)  return 'Password must be at least 8 characters.';
    if (strlen($password) > 64) return 'Password must be 64 characters or fewer.';
    if (!preg_match('/[a-z]/', $password) || !preg_match('/[A-Z]/', $password) || !preg_match('/\d/', $password)) {
        return 'Use at least one uppercase letter, one lowercase letter and one number.';
    }
    return null;
}

// The current reset request for this email, with the expiry worked out by the database clock
function prFindRequest($pdo, $email)
{
    $stmt = $pdo->prepare('
        SELECT otp_hash, attempts, verified, send_count, created_at,
               (expires_at > NOW())                                   AS still_valid,
               TIMESTAMPDIFF(SECOND, created_at, NOW())               AS secs_since_sent,
               (window_start > NOW() - INTERVAL 1 HOUR)               AS in_window
        FROM   password_reset_otps
        WHERE  email = ?
        LIMIT  1
    ');
    $stmt->execute([$email]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    return $row ?: null;
}

function prDeleteRequest($pdo, $email)
{
    $pdo->prepare('DELETE FROM password_reset_otps WHERE email = ?')->execute([$email]);
}