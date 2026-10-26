<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

$realTime = null;

// Try online API first
$ctx = stream_context_create(['http' => ['timeout' => 3]]);
$response = @file_get_contents('https://timeapi.io/api/time/current/zone?timeZone=Asia%2FManila', false, $ctx);

if ($response) {
  $data = json_decode($response, true);
  if (!empty($data['dateTime'])) {
    $dt = preg_replace('/\.\d+$/', '', $data['dateTime']);
    $realTime = $dt . '+08:00';
  }
}

// Fallback: calculate real time using a fixed known reference point
// Reference: 2026-05-20 is the real date when this was set up
// We calculate offset from device clock to correct for wrong system date
if (!$realTime) {
  date_default_timezone_set('Asia/Manila');
  $deviceYear = (int) date('Y');
  $correctYear = 2026;
  $yearDiff = $correctYear - $deviceYear; // e.g. if device=2025, diff=1
  
  $ts = time() + ($yearDiff * 365 * 24 * 3600);
  $realTime = date('Y-m-d\TH:i:s', $ts) . '+08:00';
}

$dateOnly = substr($realTime, 0, 10);

echo json_encode([
  'success'  => true,
  'datetime' => $realTime,
  'date'     => $dateOnly,
]);