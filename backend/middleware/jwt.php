<?php
define('JWT_SECRET', 'skillconnect_secret_2026');
define('JWT_EXPIRY', 60 * 60 * 8); // 8 hours

function base64UrlEncode(string $data): string {
    return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
}

function base64UrlDecode(string $data): string {
    return base64_decode(strtr($data, '-_', '+/'));
}

function jwtCreate(array $payload): string {
    $header  = base64UrlEncode(json_encode(['alg' => 'HS256', 'typ' => 'JWT']));
    $payload['iat'] = time();
    $payload['exp'] = time() + JWT_EXPIRY;
    $body    = base64UrlEncode(json_encode($payload));
    $sig     = base64UrlEncode(hash_hmac('sha256', "$header.$body", JWT_SECRET, true));
    return "$header.$body.$sig";
}

function jwtVerify(string $token): ?array {
    $parts = explode('.', $token);
    if (count($parts) !== 3) return null;

    [$header, $body, $sig] = $parts;
    $expected = base64UrlEncode(hash_hmac('sha256', "$header.$body", JWT_SECRET, true));

    if (!hash_equals($expected, $sig)) return null;

    $payload = json_decode(base64UrlDecode($body), true);
        if (!is_array($payload) || !isset($payload['exp']) || $payload['exp'] < time()) return null;

    return $payload;
}
function requireAdminAccess(): array {
    $auth = requireAuth();
    $role = $auth['role'] ?? '';

    if (in_array($role, ['admin', 'super_admin', 'superadmin'], true)) {
        return $auth;
    }

    if ($role === 'worker') {
        require_once __DIR__ . '/../config/db.php';
        $pdo  = getDB();
        $stmt = $pdo->prepare("SELECT role FROM roles WHERE user_id = ? AND role = 'admin/worker' LIMIT 1");
        $stmt->execute([$auth['sub']]);
        if ($stmt->fetch()) {
            return $auth;
        }
    }

    header('Content-Type: application/json');
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'Admin access required.']);
    exit;
}
function isAdminUser(array $auth): bool {
    $role = $auth['role'] ?? '';
    if (in_array($role, ['admin', 'super_admin', 'superadmin'], true)) return true;
    if ($role === 'worker') {
        require_once __DIR__ . '/../config/db.php';
        $pdo  = getDB();
        $stmt = $pdo->prepare("SELECT 1 FROM roles WHERE user_id = ? AND role = 'admin/worker' LIMIT 1");
        $stmt->execute([$auth['sub'] ?? 0]);
        return (bool)$stmt->fetch();
    }
    return false;
}

function requireAuth(): array {
    $authHeader = $_SERVER['HTTP_AUTHORIZATION'] 
        ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] 
        ?? (function_exists('apache_request_headers') ? (apache_request_headers()['Authorization'] ?? '') : '')
        ?? '';

    if (!str_starts_with($authHeader, 'Bearer ')) {
        
        header('Content-Type: application/json');
        http_response_code(401);
        echo json_encode(['success' => false, 'error' => 'Missing or invalid token.']);
        exit;
    }

    $token   = substr($authHeader, 7);
    $payload = jwtVerify($token);

    if (!$payload) {
       
        header('Content-Type: application/json');
        http_response_code(401);
        echo json_encode(['success' => false, 'error' => 'Token expired or invalid.']);
        exit;
    }

    return $payload;
}