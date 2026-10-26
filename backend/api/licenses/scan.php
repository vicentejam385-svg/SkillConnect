<?php
// backend/api/licenses/scan.php — reads the expiry date from a license image (Groq vision)
require_once __DIR__ . '/../../cors.php';
require_once __DIR__ . '/../../middleware/jwt.php';

handleCors();
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method not allowed.']);
    exit;
}

requireAuth();

// ── Config (key lives in config/groq.php, not in this file) ───
$cfg    = @include __DIR__ . '/../../config/groq.php';
$apiKey = is_array($cfg) ? trim($cfg['api_key'] ?? '') : '';
$model  = is_array($cfg) ? trim($cfg['vision_model'] ?? '') : '';
if ($model === '') $model = 'qwen/qwen3.8-27b';
// Tried in this order; a model that no longer exists is skipped automatically
$models = array_values(array_unique(array_filter([$model, 'qwen/qwen3.8-27b', 'qwen/qwen3.6-27b'])));

if ($apiKey === '') {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Groq API key is not configured (backend/config/groq.php).']);
    exit;
}

// ── Input ─────────────────────────────────────────────────────
$body        = json_decode(file_get_contents('php://input'), true) ?? [];
$imageBase64 = $body['image']     ?? '';
$mimeType    = $body['mime_type'] ?? 'image/jpeg';

if (!$imageBase64) {
    http_response_code(422);
    echo json_encode(['success' => false, 'error' => 'Image is required.']);
    exit;
}
if (!in_array($mimeType, ['image/jpeg', 'image/png', 'image/webp'], true)) {
    http_response_code(422);
    echo json_encode(['success' => false, 'error' => 'Only JPG, PNG or WEBP images can be scanned.']);
    exit;
}

// ── Date helper: returns YYYY-MM-DD or '' ─────────────────────
function normalizeDate(string $s): string {
    $s = trim($s);
    if (preg_match('/(\d{4})-(\d{2})-(\d{2})/', $s, $m)) {
        if (checkdate((int)$m[2], (int)$m[3], (int)$m[1])) return "$m[1]-$m[2]-$m[3]";
    }
    if (preg_match('/(\d{2})[\/\-](\d{2})[\/\-](\d{4})/', $s, $m)) {   // dd/mm/yyyy
        if (checkdate((int)$m[2], (int)$m[1], (int)$m[3])) return "$m[3]-$m[2]-$m[1]";
    }
    return '';
}

// ── Call Groq (tries each model until one is available) ───────
$prompt = 'Look at this license or ID card image. Find the EXPIRY date (it may be labeled "Valid Until", "Expiry Date", "Expiry", "Valid Thru" or similar), not the issue or birth date. Convert it to YYYY-MM-DD. Return ONLY a JSON object: {"expiry_date": "YYYY-MM-DD"}. If no expiry date is found return {"expiry_date": ""}. No other text.';

function callGroq(string $apiKey, string $model, string $mimeType, string $imageBase64, string $prompt): array {
    $payload = json_encode([
        'model'       => $model,
        'temperature' => 0,
        'max_tokens'  => 1500,
        'messages'    => [[
            'role'    => 'user',
            'content' => [
                ['type' => 'image_url', 'image_url' => ['url' => "data:{$mimeType};base64,{$imageBase64}"]],
                ['type' => 'text', 'text' => $prompt],
            ],
        ]],
    ]);
    $ch = curl_init('https://api.groq.com/openai/v1/chat/completions');
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => $payload,
        CURLOPT_TIMEOUT        => 45,
        CURLOPT_CONNECTTIMEOUT => 10,
        CURLOPT_HTTPHEADER     => [
            'Content-Type: application/json',
            'Authorization: Bearer ' . $apiKey,
        ],
    ]);
    $result  = curl_exec($ch);
    $curlErr = curl_error($ch);
    curl_close($ch);
    return [$result, $curlErr];
}

$data      = null;
$lastError = '';
foreach ($models as $m) {
    [$result, $curlErr] = callGroq($apiKey, $m, $mimeType, $imageBase64, $prompt);

    if ($curlErr) {
        echo json_encode(['success' => false, 'error' => 'Could not reach Groq: ' . $curlErr]);
        exit;
    }

    error_log("Groq raw ($m): " . substr((string)$result, 0, 2000));
    $data = json_decode($result, true);

    if (isset($data['error'])) {
        $msg       = $data['error']['message'] ?? 'Unknown error';
        $lastError = $msg;
        // Model missing/retired → try the next one. Any other error → stop here.
        if (stripos($msg, 'does not exist') !== false
            || stripos($msg, 'decommissioned') !== false
            || ($data['error']['code'] ?? '') === 'model_not_found') {
            continue;
        }
        echo json_encode(['success' => false, 'error' => 'Groq: ' . $msg]);
        exit;
    }
    break;   // got a good response
}

if (!is_array($data) || isset($data['error'])) {
    echo json_encode(['success' => false, 'error' => 'No available Groq vision model. Last error: ' . $lastError]);
    exit;
}

// ── Parse the answer ──────────────────────────────────────────
$text  = $data['choices'][0]['message']['content'] ?? '';
$text  = preg_replace('/<think>.*?<\/think>/is', '', $text);          // drop any reasoning block
$clean = trim(preg_replace('/```json|```/i', '', $text));

$date   = '';
$parsed = json_decode($clean, true);
if (is_array($parsed) && isset($parsed['expiry_date'])) {
    $date = normalizeDate((string)$parsed['expiry_date']);
} else {
    $date = normalizeDate($clean);   // fallback: find a date anywhere in the reply
}

if ($date === '') {
    echo json_encode(['success' => false, 'error' => 'No expiry date found in the image.']);
    exit;
}

echo json_encode(['success' => true, 'expiry_date' => $date]);