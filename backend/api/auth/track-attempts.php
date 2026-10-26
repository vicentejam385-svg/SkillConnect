<?php
// Add this logic inside your login PHP (e.g. api/auth/login.php)
// before checking the password

$credential = $body['credential'] ?? $body['username'] ?? $body['email'] ?? '';
$ip         = $_SERVER['REMOTE_ADDR'] ?? 'unknown';

// Use a simple file-based lock (or replace with a DB table)
$lockKey  = 'lock_' . md5(strtolower(trim($credential)) . $ip);
$lockFile = sys_get_temp_dir() . '/' . $lockKey . '.json';

$MAX_ATTEMPTS = 5;
$LOCKOUT_SECS = 15 * 60; // 15 minutes

// Read current state
$state = file_exists($lockFile)
  ? json_decode(file_get_contents($lockFile), true)
  : ['attempts' => 0, 'locked_until' => null];

// Check if currently locked
if (!empty($state['locked_until']) && time() < $state['locked_until']) {
  $remaining = $state['locked_until'] - time();
  http_response_code(429);
  echo json_encode([
    'success'      => false,
    'error'        => 'Account temporarily locked.',
    'locked'       => true,
    'retry_after'  => $remaining, // seconds
  ]);
  exit;
}

// Reset if lock expired
if (!empty($state['locked_until']) && time() >= $state['locked_until']) {
  $state = ['attempts' => 0, 'locked_until' => null];
}

// ... your existing password check here ...
// On FAILURE:
$state['attempts']++;
if ($state['attempts'] >= $MAX_ATTEMPTS) {
  $state['locked_until'] = time() + $LOCKOUT_SECS;
}
file_put_contents($lockFile, json_encode($state));

http_response_code(401);
echo json_encode([
  'success'       => false,
  'error'         => 'Invalid credentials.',
  'attempts_left' => max(0, $MAX_ATTEMPTS - $state['attempts']),
  'locked'        => $state['attempts'] >= $MAX_ATTEMPTS,
]);
exit;

// On SUCCESS:
// Clear the lockout file
if (file_exists($lockFile)) unlink($lockFile);
// ... return token as normal ...