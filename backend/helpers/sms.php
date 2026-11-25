<?php
// backend/helpers/sms.php
// Send one SMS through Semaphore (Philippine numbers only).
//   smsSend('09171234567', 'Hello') → ['ok' => true] or ['ok' => false, 'error' => '…', 'skipped' => bool]
// Never throws: a failed SMS must never stop the main action.
require_once __DIR__ . '/../config/semaphore.php';

/** "+639171234567" / "639171234567" / "09171234567" → "09171234567", or null if it isn't a PH mobile number. */
function smsNormalizeMobile(?string $mobile): ?string
{
    $digits = preg_replace('/\D+/', '', (string)$mobile);
    if (preg_match('/^639\d{9}$/', $digits)) return '0' . substr($digits, 2);
    if (preg_match('/^09\d{9}$/', $digits))  return $digits;
    return null;
}

function smsSend(string $mobile, string $message): array
{
    if (!defined('SEMAPHORE_API_KEY') || SEMAPHORE_API_KEY === '') {
        error_log("[SkillConnect DEV] SMS to {$mobile} skipped (no Semaphore key): {$message}");
        return ['ok' => false, 'skipped' => true, 'error' => 'SMS is not set up yet (no Semaphore API key).'];
    }
    $number = smsNormalizeMobile($mobile);
    if (!$number) return ['ok' => false, 'skipped' => true, 'error' => 'Not a valid PH mobile number.'];

    // Semaphore silently drops messages that start with "TEST"
    if (stripos(ltrim($message), 'test') === 0) $message = 'SkillConnect: ' . $message;

    $fields = ['apikey' => SEMAPHORE_API_KEY, 'number' => $number, 'message' => $message];
    if (defined('SEMAPHORE_SENDER') && SEMAPHORE_SENDER !== '') $fields['sendername'] = SEMAPHORE_SENDER;

    try {
        $ch = curl_init('https://api.semaphore.co/api/v4/messages');
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST           => true,
            CURLOPT_TIMEOUT        => 10,
            CURLOPT_CONNECTTIMEOUT => 5,
            CURLOPT_POSTFIELDS     => http_build_query($fields),
        ]);
        $response = curl_exec($ch);
        $http     = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $curlErr  = curl_error($ch);
        curl_close($ch);

        $json = json_decode((string)$response, true);
        // Success = HTTP 2xx and a list of messages, each with a message_id
        if ($http >= 200 && $http < 300 && is_array($json) && isset($json[0]['message_id'])) {
            $status = strtolower((string)($json[0]['status'] ?? ''));
            if ($status === 'failed' || $status === 'refunded') {
                return ['ok' => false, 'skipped' => false, 'error' => 'Semaphore could not deliver the SMS (' . $status . ').'];
            }
            return ['ok' => true, 'message_id' => $json[0]['message_id']];
        }

        // Semaphore returns errors as {"field": ["message"]} or a plain string
        $err = $curlErr ?: '';
        if (!$err && is_array($json)) {
            $flat = [];
            array_walk_recursive($json, function ($v) use (&$flat) { if (is_string($v)) $flat[] = $v; });
            $err = implode(' ', array_slice($flat, 0, 3));
        }
        if (!$err) $err = 'HTTP ' . $http;
        error_log("[SkillConnect] SMS failed. HTTP {$http} | {$err} | response: {$response}");
        return ['ok' => false, 'skipped' => false, 'error' => mb_substr($err, 0, 250)];
    } catch (Throwable $e) {
        error_log('[SkillConnect] SMS error: ' . $e->getMessage());
        return ['ok' => false, 'skipped' => false, 'error' => 'Could not reach Semaphore.'];
    }
}