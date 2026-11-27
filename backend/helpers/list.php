<?php
// backend/api/holidays/list.php
// GET ?from=2026&to=2027 -> { success, holidays: [{ date, name }] }   (Philippine non-working holidays)
require_once __DIR__ . '/../../cors.php';
require_once __DIR__ . '/../../helpers/holidays.php';

handleCors();
header('Content-Type: application/json');
header('Cache-Control: public, max-age=86400');

$thisYear = (int)date('Y');
$from = max(2000, min(2100, (int)($_GET['from'] ?? $thisYear)));
$to   = max($from, min($from + 5, (int)($_GET['to'] ?? ($thisYear + 1))));

$out = [];
for ($y = $from; $y <= $to; $y++) {
    foreach (phHolidays($y) as $date => $name) $out[] = ['date' => $date, 'name' => $name];
}
echo json_encode(['success' => true, 'holidays' => $out]);