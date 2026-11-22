<?php
// backend/api/schedules/workers.php
// Admin: workers who could go on a site visit for a job order.
//   GET ?job_order_id=..&visit_type=ocular|progress|other&start=..&end=..&exclude=<visit id>
require_once __DIR__ . '/../../cors.php';
require_once __DIR__ . '/../../config/db.php';
require_once __DIR__ . '/../../middleware/jwt.php';
require_once __DIR__ . '/../../helpers/site-visits.php';

handleCors();
header('Content-Type: application/json');

requireAdminAccess();

$jobId = (int)($_GET['job_order_id'] ?? 0);
if (!$jobId) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'job_order_id is required.']);
    exit;
}

try {
    $pdo = getDB();
    $jo  = svLoadJob($pdo, $jobId);
    if (!$jo) {
        http_response_code(404);
        echo json_encode(['success' => false, 'error' => 'Job order not found.']);
        exit;
    }
    $start = svNormalizeTime($_GET['start'] ?? '');
    $end   = svNormalizeTime($_GET['end'] ?? '');
    $excl  = (int)($_GET['exclude'] ?? 0) ?: null;

    echo json_encode([
        'success'       => true,
        'service'       => $jo['service'],
        'allowed_types' => svAllowedTypes((int)$jo['status_id']),
        'workers'       => svWorkerOptions($pdo, $jo, $start, $end, $excl),
    ]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Database error.', 'detail' => $e->getMessage()]);
}