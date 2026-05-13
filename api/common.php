<?php
declare(strict_types=1);

require_once __DIR__ . '/../database/db.php';

const PRINTURGE_DEFAULT_JWT_SECRET = 'dev-only-change-me';

function allow_methods(array $methods): void
{
    header('Access-Control-Allow-Origin: *');
    header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
    header('Access-Control-Allow-Methods: ' . implode(', ', array_merge($methods, ['OPTIONS'])));

    if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'OPTIONS') {
        http_response_code(204);
        exit;
    }

    $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
    if (!in_array($method, $methods, true)) {
        json_response([
            'error' => 'Method not allowed',
            'method' => $method,
            'allowed' => $methods,
        ], 405);
    }
}

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

function ensure_database_schema(PDO $pdo): void
{
    static $done = false;
    if ($done) {
        return;
    }

    if (db_driver($pdo) !== 'pgsql') {
        $done = true;
        return;
    }

    $pdo->exec("
        CREATE TABLE IF NOT EXISTS roles (
          id BIGSERIAL PRIMARY KEY,
          name VARCHAR(50) NOT NULL UNIQUE,
          created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
    ");
    $pdo->exec("
        INSERT INTO roles (id, name) VALUES
          (1, 'admin'),
          (2, 'staff'),
          (3, 'client')
        ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name
    ");
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS users (
          id BIGSERIAL PRIMARY KEY,
          role_id BIGINT NOT NULL DEFAULT 3,
          name VARCHAR(160) NOT NULL,
          email VARCHAR(255) NOT NULL UNIQUE,
          password_hash VARCHAR(255) NOT NULL,
          status VARCHAR(20) NOT NULL DEFAULT 'active',
          archived_at TIMESTAMPTZ NULL,
          last_login_at TIMESTAMPTZ NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
    ");
    $pdo->exec("ALTER TABLE users ADD COLUMN IF NOT EXISTS role_id BIGINT NOT NULL DEFAULT 3");
    $pdo->exec("ALTER TABLE users ADD COLUMN IF NOT EXISTS name VARCHAR(160)");
    $pdo->exec("ALTER TABLE users ADD COLUMN IF NOT EXISTS email VARCHAR(255)");
    $pdo->exec("ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255)");
    $pdo->exec("ALTER TABLE users ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'active'");
    $pdo->exec("ALTER TABLE users ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ NULL");
    $pdo->exec("ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ NULL");
    $pdo->exec("CREATE UNIQUE INDEX IF NOT EXISTS uq_users_email ON users (email)");
    $pdo->exec("CREATE INDEX IF NOT EXISTS idx_users_role_id ON users (role_id)");
    $pdo->exec("CREATE INDEX IF NOT EXISTS idx_users_archived_at ON users (archived_at)");
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS print_requests (
          id BIGSERIAL PRIMARY KEY,
          user_id BIGINT NULL,
          service VARCHAR(64) NOT NULL,
          color_mode VARCHAR(64) NULL,
          size_key VARCHAR(64) NULL,
          copies INT NOT NULL DEFAULT 1,
          pages INT NOT NULL DEFAULT 1,
          custom_width VARCHAR(32) NULL,
          custom_height VARCHAR(32) NULL,
          files_json JSONB NOT NULL,
          admin_notes TEXT NULL,
          status VARCHAR(20) NOT NULL DEFAULT 'active',
          archived_at TIMESTAMPTZ NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
    ");
    $pdo->exec("CREATE INDEX IF NOT EXISTS idx_print_requests_user_id ON print_requests(user_id)");
    $pdo->exec("CREATE INDEX IF NOT EXISTS idx_print_requests_status ON print_requests(status)");
    $pdo->exec("CREATE INDEX IF NOT EXISTS idx_print_requests_created_at ON print_requests(created_at)");
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS print_request_files (
          id BIGSERIAL PRIMARY KEY,
          print_request_id BIGINT NOT NULL,
          stored_name VARCHAR(80) NOT NULL UNIQUE,
          original_name VARCHAR(255) NOT NULL,
          mime VARCHAR(160) NULL,
          size_bytes BIGINT NOT NULL DEFAULT 0,
          content BYTEA NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
    ");
    $pdo->exec("CREATE INDEX IF NOT EXISTS idx_print_request_files_request_id ON print_request_files(print_request_id)");
    $pdo->exec("CREATE INDEX IF NOT EXISTS idx_print_request_files_stored_name ON print_request_files(stored_name)");

    $done = true;
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
    $sig = hash_hmac('sha256', "{$head}.{$body}", jwt_secret(), true);
    return "{$head}.{$body}." . b64url_encode($sig);
}

function jwt_secret(): string
{
    return getenv('PRINTURGE_JWT_SECRET') ?: PRINTURGE_DEFAULT_JWT_SECRET;
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
    $expected = b64url_encode(hash_hmac('sha256', "{$head}.{$body}", jwt_secret(), true));
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

function collect_uploaded_files(): array
{
    $files = $_FILES['files'] ?? null;
    if (!$files || empty($files['name'])) {
        json_response(['error' => 'At least one file is required'], 400);
    }

    $names = is_array($files['name']) ? $files['name'] : [$files['name']];
    $tmps = is_array($files['tmp_name']) ? $files['tmp_name'] : [$files['tmp_name']];
    $types = is_array($files['type']) ? $files['type'] : [$files['type']];
    $sizes = is_array($files['size']) ? $files['size'] : [$files['size']];
    $errors = is_array($files['error']) ? $files['error'] : [$files['error']];
    $collected = [];

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
        $content = file_get_contents((string)$tmps[$i]);
        if ($content === false) {
            json_response(['error' => 'Could not read uploaded file'], 500);
        }
        $collected[] = [
            'storedName' => $stored,
            'originalName' => (string)$original,
            'mime' => (string)($types[$i] ?? ''),
            'size' => (int)($sizes[$i] ?? 0),
            'content' => $content,
        ];
    }

    if (!$collected) {
        json_response(['error' => 'At least one file is required'], 400);
    }
    return $collected;
}

function create_print_request(PDO $pdo, $forceUserId, bool $attachUploader): int
{
    $files = collect_uploaded_files();
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

    $metadata = array_map(function (array $file): array {
        return [
            'storedName' => $file['storedName'],
            'originalName' => $file['originalName'],
            'mime' => $file['mime'],
            'size' => $file['size'],
        ];
    }, $files);

    $filesJson = json_encode($metadata, JSON_UNESCAPED_SLASHES);
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
        $pdo->beginTransaction();
        try {
            $stmt = $pdo->prepare($sql . ' RETURNING id');
            $stmt->execute($params);
            $id = (int)$stmt->fetchColumn();
            save_file_rows($pdo, $id, $files);
            $pdo->commit();
            return $id;
        } catch (Throwable $e) {
            $pdo->rollBack();
            throw $e;
        }
    }

    $pdo->beginTransaction();
    try {
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $id = (int)$pdo->lastInsertId();
        save_file_rows($pdo, $id, $files);
        $pdo->commit();
        return $id;
    } catch (Throwable $e) {
        $pdo->rollBack();
        throw $e;
    }
}

function save_file_rows(PDO $pdo, int $requestId, array $files): void
{
    $stmt = $pdo->prepare(
        'INSERT INTO print_request_files
          (print_request_id, stored_name, original_name, mime, size_bytes, content)
         VALUES (?, ?, ?, ?, ?, ?)'
    );

    foreach ($files as $file) {
        $stmt->bindValue(1, $requestId, PDO::PARAM_INT);
        $stmt->bindValue(2, $file['storedName']);
        $stmt->bindValue(3, $file['originalName']);
        $stmt->bindValue(4, $file['mime']);
        $stmt->bindValue(5, (int)$file['size'], PDO::PARAM_INT);
        $stmt->bindValue(6, $file['content'], PDO::PARAM_LOB);
        $stmt->execute();
    }
}

function handle_exception(Throwable $e): void
{
    error_log($e->getMessage());
    json_response([
        'error' => 'Server error',
        'detail' => $e->getMessage(),
    ], 500);
}
