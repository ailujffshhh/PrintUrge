<?php
declare(strict_types=1);

require_once __DIR__ . '/../database/db.php';

const PRINTURGE_JWT_SECRET = 'dev-only-change-me';
const PRINTURGE_UPLOAD_DIR = __DIR__ . '/../uploads/print-requests';

function json_response(array $payload, int $status = 200): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($payload, JSON_UNESCAPED_SLASHES);
    exit;
}

function read_json_body(): array
{
    $raw = file_get_contents('php://input');
    if ($raw === false || trim($raw) === '') {
        return [];
    }
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}

function db_driver(PDO $pdo): string
{
    return $pdo->getAttribute(PDO::ATTR_DRIVER_NAME);
}

function now_sql(PDO $pdo): string
{
    return db_driver($pdo) === 'pgsql' ? 'CURRENT_TIMESTAMP' : 'CURRENT_TIMESTAMP';
}

function b64url_encode(string $value): string
{
    return rtrim(strtr(base64_encode($value), '+/', '-_'), '=');
}

function b64url_decode(string $value)
{
    $pad = strlen($value) % 4;
    if ($pad) {
        $value .= str_repeat('=', 4 - $pad);
    }
    return base64_decode(strtr($value, '-_', '+/'), true);
}

function sign_token(array $payload): string
{
    $payload['exp'] = time() + (7 * 24 * 60 * 60);
    $header = ['alg' => 'HS256', 'typ' => 'JWT'];
    $head = b64url_encode(json_encode($header, JSON_UNESCAPED_SLASHES));
    $body = b64url_encode(json_encode($payload, JSON_UNESCAPED_SLASHES));
    $sig = hash_hmac('sha256', "{$head}.{$body}", PRINTURGE_JWT_SECRET, true);
    return "{$head}.{$body}." . b64url_encode($sig);
}

function verify_token($token)
{
    if (!$token) {
        return null;
    }
    $parts = explode('.', $token);
    if (count($parts) !== 3) {
        return null;
    }
    [$head, $body, $sig] = $parts;
    $expected = b64url_encode(hash_hmac('sha256', "{$head}.{$body}", PRINTURGE_JWT_SECRET, true));
    if (!hash_equals($expected, $sig)) {
        return null;
    }
    $payloadRaw = b64url_decode($body);
    $payload = $payloadRaw === false ? null : json_decode($payloadRaw, true);
    if (!is_array($payload) || (isset($payload['exp']) && time() > (int)$payload['exp'])) {
        return null;
    }
    return $payload;
}

function bearer_token()
{
    $header = $_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '';
    if (preg_match('/^Bearer\s+(.+)$/i', $header, $m)) {
        return trim($m[1]);
    }
    return null;
}

function current_auth()
{
    return verify_token(bearer_token());
}

function require_auth(): array
{
    $auth = current_auth();
    if (!$auth || empty($auth['sub'])) {
        json_response(['error' => 'Unauthorized'], 401);
    }
    return $auth;
}

function require_admin(): array
{
    $auth = require_auth();
    if (($auth['role'] ?? '') !== 'admin') {
        json_response(['error' => 'Admin only'], 403);
    }
    return $auth;
}

function load_user_context(PDO $pdo, $userId)
{
    $stmt = $pdo->prepare(
        'SELECT u.id, u.name, u.email, u.status, u.archived_at, r.name AS role
         FROM users u
         JOIN roles r ON r.id = u.role_id
         WHERE u.id = ?
         LIMIT 1'
    );
    $stmt->execute([$userId]);
    $row = $stmt->fetch();
    return $row ?: null;
}

function map_user(array $row): array
{
    return [
        'id' => (int)$row['id'],
        'name' => $row['name'],
        'email' => $row['email'],
        'role' => $row['role'],
        'status' => $row['status'],
    ];
}

function int_field($value, int $fallback): int
{
    $n = filter_var($value, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
    return $n === false ? $fallback : (int)$n;
}

function save_uploaded_files(): array
{
    if (!is_dir(PRINTURGE_UPLOAD_DIR) && !mkdir(PRINTURGE_UPLOAD_DIR, 0775, true) && !is_dir(PRINTURGE_UPLOAD_DIR)) {
        json_response(['error' => 'Upload directory is not writable'], 500);
    }

    $files = $_FILES['files'] ?? null;
    if (!$files || empty($files['name'])) {
        json_response(['error' => 'At least one file is required'], 400);
    }

    $names = is_array($files['name']) ? $files['name'] : [$files['name']];
    $tmps = is_array($files['tmp_name']) ? $files['tmp_name'] : [$files['tmp_name']];
    $types = is_array($files['type']) ? $files['type'] : [$files['type']];
    $sizes = is_array($files['size']) ? $files['size'] : [$files['size']];
    $errors = is_array($files['error']) ? $files['error'] : [$files['error']];
    $saved = [];

    foreach ($names as $i => $original) {
        if (($errors[$i] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
            continue;
        }
        if (($sizes[$i] ?? 0) > 25 * 1024 * 1024) {
            json_response(['error' => 'Each file must be 25MB or smaller'], 400);
        }
        $ext = pathinfo((string)$original, PATHINFO_EXTENSION);
        $ext = preg_replace('/[^a-zA-Z0-9]/', '', $ext ?? '');
        $stored = bin2hex(random_bytes(18)) . ($ext ? ".{$ext}" : '.bin');
        $target = PRINTURGE_UPLOAD_DIR . '/' . $stored;
        if (!move_uploaded_file((string)$tmps[$i], $target)) {
            json_response(['error' => 'Could not save uploaded file'], 500);
        }
        $saved[] = [
            'storedName' => $stored,
            'originalName' => (string)$original,
            'mime' => (string)($types[$i] ?? ''),
            'size' => (int)($sizes[$i] ?? 0),
        ];
    }

    if (!$saved) {
        json_response(['error' => 'At least one file is required'], 400);
    }
    return $saved;
}

function create_print_request(PDO $pdo, $forceUserId, bool $attachUploader): int
{
    $saved = save_uploaded_files();
    $service = substr(trim((string)($_POST['service'] ?? '')), 0, 64);
    if ($service === '') {
        json_response(['error' => 'service is required'], 400);
    }

    $auth = current_auth();
    $userId = $forceUserId;
    if ($forceUserId === null && $attachUploader && $auth && !empty($auth['sub'])) {
        $user = load_user_context($pdo, (int)$auth['sub']);
        if ($user && $user['status'] === 'active' && empty($user['archived_at'])) {
            $userId = (int)$user['id'];
        }
    }

    $filesJson = json_encode($saved, JSON_UNESCAPED_SLASHES);
    $driver = db_driver($pdo);
    $filesPlaceholder = $driver === 'pgsql' ? '?::jsonb' : '?';
    $sql = 'INSERT INTO print_requests
        (user_id, service, color_mode, size_key, copies, pages, custom_width, custom_height, files_json, admin_notes, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ' . $filesPlaceholder . ', NULL, ?)';
    $params = [
        $userId,
        $service,
        substr(trim((string)($_POST['colorMode'] ?? '')), 0, 64) ?: null,
        substr(trim((string)($_POST['size'] ?? '')), 0, 64) ?: null,
        int_field($_POST['copies'] ?? 1, 1),
        int_field($_POST['pages'] ?? 1, 1),
        trim((string)($_POST['customWidth'] ?? '')) !== '' ? substr(trim((string)$_POST['customWidth']), 0, 32) : null,
        trim((string)($_POST['customHeight'] ?? '')) !== '' ? substr(trim((string)$_POST['customHeight']), 0, 32) : null,
        $filesJson,
        'active',
    ];

    if ($driver === 'pgsql') {
        $stmt = $pdo->prepare($sql . ' RETURNING id');
        $stmt->execute($params);
        return (int)$stmt->fetchColumn();
    }

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    return (int)$pdo->lastInsertId();
}

function handle_exception(Throwable $e): void
{
    error_log($e->getMessage());
    json_response(['error' => 'Server error'], 500);
}
