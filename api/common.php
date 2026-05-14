<?php
declare(strict_types=1);

require_once __DIR__ . '/../database/db.php';
require_once __DIR__ . '/../database/cache.php';

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

function printurge_schema_cache_ttl(): int
{
    return max(0, (int)(getenv('PRINTURGE_SCHEMA_CACHE_TTL') ?: 3600));
}

function printurge_user_cache_ttl(): int
{
    return max(0, (int)(getenv('PRINTURGE_USER_CACHE_TTL') ?: 30));
}

function printurge_admin_list_cache_ttl(): int
{
    return max(0, (int)(getenv('PRINTURGE_ADMIN_LIST_CACHE_TTL') ?: 10));
}

function printurge_admin_item_cache_ttl(): int
{
    return max(0, (int)(getenv('PRINTURGE_ADMIN_ITEM_CACHE_TTL') ?: 15));
}

function printurge_admin_cache_generation(): int
{
    $g = printurge_cache_get('admin_pr_gen');
    return (int)($g ?? 0);
}

function printurge_admin_cache_bump(): void
{
    $next = printurge_admin_cache_generation() + 1;
    printurge_cache_set('admin_pr_gen', $next, 86400 * 365);
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

    $schemaTtl = printurge_schema_cache_ttl();
    $schemaCacheKey = 'pgsql_schema_ready:v3';
    if ($schemaTtl > 0 && printurge_cache_get($schemaCacheKey) !== null) {
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
          account_tier VARCHAR(20) NOT NULL DEFAULT 'free',
          member_since TIMESTAMPTZ NULL,
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
    $pdo->exec("ALTER TABLE users ADD COLUMN IF NOT EXISTS account_tier VARCHAR(20) NOT NULL DEFAULT 'free'");
    $pdo->exec("ALTER TABLE users ADD COLUMN IF NOT EXISTS member_since TIMESTAMPTZ NULL");
    $pdo->exec("ALTER TABLE users ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ NULL");
    $pdo->exec("ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ NULL");
    $pdo->exec("CREATE UNIQUE INDEX IF NOT EXISTS uq_users_email ON users (email)");
    $pdo->exec("CREATE INDEX IF NOT EXISTS idx_users_role_id ON users (role_id)");
    $pdo->exec("CREATE INDEX IF NOT EXISTS idx_users_archived_at ON users (archived_at)");
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS print_requests (
          id BIGSERIAL PRIMARY KEY,
          transaction_id VARCHAR(40) NULL UNIQUE,
          user_id BIGINT NULL,
          customer_name VARCHAR(160) NULL,
          customer_notes TEXT NULL,
          payment_method VARCHAR(80) NULL,
          payment_status VARCHAR(20) NOT NULL DEFAULT 'unpaid',
          service VARCHAR(64) NOT NULL,
          color_mode VARCHAR(64) NULL,
          size_key VARCHAR(64) NULL,
          copies INT NOT NULL DEFAULT 1,
          pages INT NOT NULL DEFAULT 1,
          custom_width VARCHAR(32) NULL,
          custom_height VARCHAR(32) NULL,
          files_json JSONB NOT NULL,
          admin_notes TEXT NULL,
          subtotal_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
          discount_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
          credits_applied NUMERIC(10,2) NOT NULL DEFAULT 0,
          total_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
          is_priority BOOLEAN NOT NULL DEFAULT FALSE,
          pickup_slot_id BIGINT NULL,
          preset_id BIGINT NULL,
          status VARCHAR(20) NOT NULL DEFAULT 'active',
          archived_at TIMESTAMPTZ NULL,
          completed_at TIMESTAMPTZ NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
    ");
    $pdo->exec("ALTER TABLE print_requests ADD COLUMN IF NOT EXISTS transaction_id VARCHAR(40) NULL");
    $pdo->exec("ALTER TABLE print_requests ADD COLUMN IF NOT EXISTS customer_name VARCHAR(160) NULL");
    $pdo->exec("ALTER TABLE print_requests ADD COLUMN IF NOT EXISTS customer_notes TEXT NULL");
    $pdo->exec("ALTER TABLE print_requests ADD COLUMN IF NOT EXISTS payment_method VARCHAR(80) NULL");
    $pdo->exec("ALTER TABLE print_requests ADD COLUMN IF NOT EXISTS payment_status VARCHAR(20) NOT NULL DEFAULT 'unpaid'");
    $pdo->exec("ALTER TABLE print_requests ADD COLUMN IF NOT EXISTS subtotal_amount NUMERIC(10,2) NOT NULL DEFAULT 0");
    $pdo->exec("ALTER TABLE print_requests ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(10,2) NOT NULL DEFAULT 0");
    $pdo->exec("ALTER TABLE print_requests ADD COLUMN IF NOT EXISTS credits_applied NUMERIC(10,2) NOT NULL DEFAULT 0");
    $pdo->exec("ALTER TABLE print_requests ADD COLUMN IF NOT EXISTS total_amount NUMERIC(10,2) NOT NULL DEFAULT 0");
    $pdo->exec("ALTER TABLE print_requests ADD COLUMN IF NOT EXISTS is_priority BOOLEAN NOT NULL DEFAULT FALSE");
    $pdo->exec("ALTER TABLE print_requests ADD COLUMN IF NOT EXISTS pickup_slot_id BIGINT NULL");
    $pdo->exec("ALTER TABLE print_requests ADD COLUMN IF NOT EXISTS preset_id BIGINT NULL");
    $pdo->exec("ALTER TABLE print_requests ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ NULL");
    $pdo->exec("CREATE UNIQUE INDEX IF NOT EXISTS uq_print_requests_transaction_id ON print_requests(transaction_id)");
    $pdo->exec("CREATE INDEX IF NOT EXISTS idx_print_requests_user_id ON print_requests(user_id)");
    $pdo->exec("CREATE INDEX IF NOT EXISTS idx_print_requests_status ON print_requests(status)");
    $pdo->exec("CREATE INDEX IF NOT EXISTS idx_print_requests_payment_status ON print_requests(payment_status)");
    $pdo->exec("CREATE INDEX IF NOT EXISTS idx_print_requests_created_at ON print_requests(created_at)");
    $pdo->exec("CREATE INDEX IF NOT EXISTS idx_print_requests_completed_at ON print_requests(completed_at)");
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
    $pdo->exec("ALTER TABLE print_request_files ADD COLUMN IF NOT EXISTS file_kind VARCHAR(24) NOT NULL DEFAULT 'print'");
    $pdo->exec("ALTER TABLE print_requests ADD COLUMN IF NOT EXISTS customer_email VARCHAR(255) NULL");
    $pdo->exec("ALTER TABLE print_requests ADD COLUMN IF NOT EXISTS receipt_stored_name VARCHAR(80) NULL");
    $pdo->exec("ALTER TABLE print_requests ADD COLUMN IF NOT EXISTS order_status VARCHAR(32) NOT NULL DEFAULT 'submitted'");
    $pdo->exec('ALTER TABLE print_requests DROP CONSTRAINT IF EXISTS print_requests_payment_status_check');
    $pdo->exec("ALTER TABLE print_requests ADD CONSTRAINT print_requests_payment_status_check CHECK (payment_status IN ('unpaid', 'pending_review', 'paid'))");
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS subscriptions (
          id BIGSERIAL PRIMARY KEY,
          user_id BIGINT NOT NULL,
          provider VARCHAR(40) NOT NULL DEFAULT 'manual',
          provider_customer_id VARCHAR(160) NULL,
          provider_subscription_id VARCHAR(160) NULL,
          status VARCHAR(32) NOT NULL DEFAULT 'incomplete',
          plan_key VARCHAR(80) NOT NULL DEFAULT 'printurge_member',
          current_period_start TIMESTAMPTZ NULL,
          current_period_end TIMESTAMPTZ NULL,
          cancel_at TIMESTAMPTZ NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
    ");
    $pdo->exec("CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id)");
    $pdo->exec("CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status)");
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS member_credits (
          id BIGSERIAL PRIMARY KEY,
          user_id BIGINT NOT NULL,
          period_month VARCHAR(7) NOT NULL,
          starting_credits NUMERIC(10,2) NOT NULL DEFAULT 0,
          used_credits NUMERIC(10,2) NOT NULL DEFAULT 0,
          remaining_credits NUMERIC(10,2) NOT NULL DEFAULT 0,
          expires_at TIMESTAMPTZ NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
    ");
    $pdo->exec("CREATE UNIQUE INDEX IF NOT EXISTS uq_member_credits_period ON member_credits(user_id, period_month)");
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS member_benefits (
          id BIGSERIAL PRIMARY KEY,
          user_id BIGINT NOT NULL,
          benefit_key VARCHAR(80) NOT NULL,
          period_month VARCHAR(7) NOT NULL,
          used_count INT NOT NULL DEFAULT 0,
          limit_count INT NOT NULL DEFAULT 1,
          created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
    ");
    $pdo->exec("CREATE UNIQUE INDEX IF NOT EXISTS uq_member_benefits_period ON member_benefits(user_id, benefit_key, period_month)");
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS print_presets (
          id BIGSERIAL PRIMARY KEY,
          user_id BIGINT NOT NULL,
          name VARCHAR(120) NOT NULL,
          service VARCHAR(64) NOT NULL,
          color_mode VARCHAR(64) NULL,
          size_key VARCHAR(64) NULL,
          copies INT NOT NULL DEFAULT 1,
          pages INT NOT NULL DEFAULT 1,
          custom_width VARCHAR(32) NULL,
          custom_height VARCHAR(32) NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
    ");
    $pdo->exec("CREATE INDEX IF NOT EXISTS idx_print_presets_user_id ON print_presets(user_id)");
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS pickup_slots (
          id BIGSERIAL PRIMARY KEY,
          print_request_id BIGINT NULL,
          user_id BIGINT NOT NULL,
          pickup_date DATE NOT NULL,
          time_window VARCHAR(80) NOT NULL,
          status VARCHAR(24) NOT NULL DEFAULT 'booked',
          created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
    ");
    $pdo->exec("CREATE INDEX IF NOT EXISTS idx_pickup_slots_user_id ON pickup_slots(user_id)");
    $pdo->exec("CREATE INDEX IF NOT EXISTS idx_pickup_slots_request_id ON pickup_slots(print_request_id)");

    if ($schemaTtl > 0) {
        printurge_cache_set($schemaCacheKey, 1, $schemaTtl);
    }

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
    if (!in_array(($auth['role'] ?? ''), ['admin', 'staff'], true)) {
        json_response(['error' => 'Admin or staff only'], 403);
    }
    return $auth;
}

function load_user_context(PDO $pdo, $userId)
{
    $userId = (int)$userId;
    $ttl = printurge_user_cache_ttl();
    $cacheKey = 'user_ctx:' . $userId;
    if ($ttl > 0) {
        $cached = printurge_cache_get($cacheKey);
        if (is_array($cached)) {
            return $cached;
        }
    }

    $stmt = $pdo->prepare(
        'SELECT u.id, u.name, u.email, u.status, u.account_tier, u.member_since, u.archived_at, r.name AS role
         FROM users u
         JOIN roles r ON r.id = u.role_id
         WHERE u.id = ?
         LIMIT 1'
    );
    $stmt->execute([$userId]);
    $row = $stmt->fetch();
    if ($ttl > 0 && $row) {
        printurge_cache_set($cacheKey, $row, $ttl);
    }
    return $row ?: null;
}

function printurge_invalidate_user_context_cache(int $userId): void
{
    printurge_cache_delete('user_ctx:' . $userId);
}

function map_user(array $row): array
{
    return [
        'id' => (int)$row['id'],
        'name' => $row['name'],
        'email' => $row['email'],
        'role' => $row['role'],
        'status' => $row['status'],
        'account_tier' => $row['account_tier'] ?? 'free',
        'member_since' => $row['member_since'] ?? null,
    ];
}

function int_field($value, int $fallback): int
{
    $n = filter_var($value, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
    return $n === false ? $fallback : (int)$n;
}

function generate_transaction_id(): string
{
    return 'PU-' . gmdate('Ymd') . '-' . strtoupper(bin2hex(random_bytes(8)));
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

function printurge_normalize_payment_status_for_create(string $requested, bool $hasReceipt, string $paymentMethod, bool $publicForm): string
{
    $requested = strtolower(trim($requested));
    if (!$publicForm) {
        if (in_array($requested, ['unpaid', 'pending_review', 'paid'], true)) {
            return $requested;
        }
        return 'unpaid';
    }
    if (!in_array($requested, ['unpaid', 'pending_review', 'paid'], true)) {
        $requested = 'unpaid';
    }
    $isCash = strtolower(trim($paymentMethod)) === 'cash';
    if ($requested === 'paid') {
        return $hasReceipt && !$isCash ? 'pending_review' : 'unpaid';
    }
    if ($requested === 'pending_review') {
        if ($isCash || !$hasReceipt) {
            return 'unpaid';
        }
    }
    return $requested;
}

function create_print_request(PDO $pdo, $forceUserId, bool $attachUploader): array
{
    $files = collect_uploaded_files();
    $service = substr(trim((string)($_POST['service'] ?? '')), 0, 64);
    if ($service === '') {
        json_response(['error' => 'service is required'], 400);
    }

    $auth = current_auth();
    $userId = $forceUserId;
    $requestUser = null;
    if ($forceUserId === null && $attachUploader && $auth && !empty($auth['sub'])) {
        $user = load_user_context($pdo, (int)$auth['sub']);
        if ($user && $user['status'] === 'active' && empty($user['archived_at'])) {
            $userId = (int)$user['id'];
            $requestUser = $user;
        }
    }
    if ($requestUser === null && $userId) {
        $requestUser = load_user_context($pdo, (int)$userId);
    }

    $customerEmail = strtolower(trim((string)($_POST['customerEmail'] ?? $_POST['customer_email'] ?? '')));
    if ($userId && ($customerEmail === '' || !filter_var($customerEmail, FILTER_VALIDATE_EMAIL))) {
        $u = load_user_context($pdo, (int)$userId);
        if ($u && !empty($u['email'])) {
            $ce = strtolower(trim((string)$u['email']));
            if (filter_var($ce, FILTER_VALIDATE_EMAIL)) {
                $customerEmail = $ce;
            }
        }
    }

    $receiptFile = collect_payment_receipt_file();

    $metadata = array_map(function (array $file): array {
        return [
            'storedName' => $file['storedName'],
            'originalName' => $file['originalName'],
            'mime' => $file['mime'],
            'size' => $file['size'],
        ];
    }, $files);

    $transactionId = generate_transaction_id();
    $customerName = trim((string)($_POST['customerName'] ?? $_POST['customer_name'] ?? ''));
    $customerNotes = trim((string)($_POST['customerNotes'] ?? $_POST['customer_notes'] ?? ''));
    $paymentMethod = trim((string)($_POST['paymentMethod'] ?? $_POST['payment_method'] ?? ''));
    $requestedPayment = strtolower(trim((string)($_POST['paymentStatus'] ?? $_POST['payment_status'] ?? 'unpaid')));
    $paymentStatus = printurge_normalize_payment_status_for_create(
        $requestedPayment,
        $receiptFile !== null,
        $paymentMethod,
        $attachUploader
    );

    if ($attachUploader && ($customerEmail === '' || !filter_var($customerEmail, FILTER_VALIDATE_EMAIL))) {
        json_response(['error' => 'A valid customer email is required'], 400);
    }
    if ($attachUploader && $paymentStatus === 'pending_review' && $receiptFile === null) {
        json_response(['error' => 'Payment receipt image is required for this payment option'], 400);
    }

    $customerEmailDb = $customerEmail !== '' ? substr($customerEmail, 0, 255) : null;
    $copiesValue = int_field($_POST['copies'] ?? 1, 1);
    $pagesValue = int_field($_POST['pages'] ?? 1, 1);
    $quantityUnits = max(1, $copiesValue * $pagesValue);
    $subtotalAmount = (float)($_POST['subtotalAmount'] ?? 0);
    if ($subtotalAmount <= 0) {
        $subtotalAmount = round($quantityUnits * 2.00, 2);
    }
    $accountTier = strtolower((string)($requestUser['account_tier'] ?? 'free'));
    $isMember = $accountTier === 'member';
    $discountAmount = 0.0;
    if ($isMember && $quantityUnits >= 100) {
        $discountAmount = round($subtotalAmount * 0.10, 2);
    }
    $creditsApplied = 0.0;
    $totalAmount = max(0, round($subtotalAmount - $discountAmount - $creditsApplied, 2));
    $isPriority = $isMember ? 1 : 0;
    $presetId = int_field($_POST['presetId'] ?? 0, 0);
    $pickupSlotId = int_field($_POST['pickupSlotId'] ?? 0, 0);

    $filesJson = json_encode($metadata, JSON_UNESCAPED_SLASHES);
    $driver = db_driver($pdo);
    $filesPlaceholder = $driver === 'pgsql' ? '?::jsonb' : '?';
    $sql = 'INSERT INTO print_requests
        (transaction_id, user_id, customer_name, customer_email, customer_notes, payment_method, payment_status, order_status, service, color_mode, size_key, copies, pages, custom_width, custom_height, files_json, admin_notes, subtotal_amount, discount_amount, credits_applied, total_amount, is_priority, pickup_slot_id, preset_id, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ' . $filesPlaceholder . ', NULL, ?, ?, ?, ?, ?, ?, ?, ?)';
    $params = [
        $transactionId,
        $userId,
        $customerName !== '' ? substr($customerName, 0, 160) : null,
        $customerEmailDb,
        $customerNotes !== '' ? substr($customerNotes, 0, 2000) : null,
        $paymentMethod !== '' ? substr($paymentMethod, 0, 80) : null,
        $paymentStatus,
        'submitted',
        $service,
        substr(trim((string)($_POST['colorMode'] ?? '')), 0, 64) ?: null,
        substr(trim((string)($_POST['size'] ?? '')), 0, 64) ?: null,
        $copiesValue,
        $pagesValue,
        trim((string)($_POST['customWidth'] ?? '')) !== '' ? substr(trim((string)$_POST['customWidth']), 0, 32) : null,
        trim((string)($_POST['customHeight'] ?? '')) !== '' ? substr(trim((string)$_POST['customHeight']), 0, 32) : null,
        $filesJson,
        number_format($subtotalAmount, 2, '.', ''),
        number_format($discountAmount, 2, '.', ''),
        number_format($creditsApplied, 2, '.', ''),
        number_format($totalAmount, 2, '.', ''),
        $isPriority,
        $pickupSlotId > 0 ? $pickupSlotId : null,
        $presetId > 0 ? $presetId : null,
        'active',
    ];

    if ($driver === 'pgsql') {
        $pdo->beginTransaction();
        try {
            $stmt = $pdo->prepare($sql . ' RETURNING id');
            $stmt->execute($params);
            $id = (int)$stmt->fetchColumn();
            save_file_rows($pdo, $id, $files, 'print');
            if ($receiptFile !== null) {
                save_file_rows($pdo, $id, [$receiptFile], 'payment_receipt');
                $pdo->prepare('UPDATE print_requests SET receipt_stored_name = ? WHERE id = ?')->execute([$receiptFile['storedName'], $id]);
            }
            $pdo->commit();
            printurge_admin_cache_bump();
            return ['id' => $id, 'transaction_id' => $transactionId, 'payment_status' => $paymentStatus];
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
        save_file_rows($pdo, $id, $files, 'print');
        if ($receiptFile !== null) {
            save_file_rows($pdo, $id, [$receiptFile], 'payment_receipt');
            $pdo->prepare('UPDATE print_requests SET receipt_stored_name = ? WHERE id = ?')->execute([$receiptFile['storedName'], $id]);
        }
        $pdo->commit();
        printurge_admin_cache_bump();
        return ['id' => $id, 'transaction_id' => $transactionId, 'payment_status' => $paymentStatus];
    } catch (Throwable $e) {
        $pdo->rollBack();
        throw $e;
    }
}

function save_file_rows(PDO $pdo, int $requestId, array $files, string $fileKind = 'print'): void
{
    $kind = substr(preg_replace('/[^a-z_]/', '', strtolower($fileKind)) ?: 'print', 0, 24) ?: 'print';
    $stmt = $pdo->prepare(
        'INSERT INTO print_request_files
          (print_request_id, stored_name, original_name, mime, size_bytes, content, file_kind)
         VALUES (?, ?, ?, ?, ?, ?, ?)'
    );

    foreach ($files as $file) {
        $stmt->bindValue(1, $requestId, PDO::PARAM_INT);
        $stmt->bindValue(2, $file['storedName']);
        $stmt->bindValue(3, $file['originalName']);
        $stmt->bindValue(4, $file['mime']);
        $stmt->bindValue(5, (int)$file['size'], PDO::PARAM_INT);
        $stmt->bindValue(6, $file['content'], PDO::PARAM_LOB);
        $stmt->bindValue(7, $kind);
        $stmt->execute();
    }
}

function collect_payment_receipt_file(): ?array
{
    $f = $_FILES['paymentReceipt'] ?? $_FILES['receipt'] ?? null;
    if (!$f || empty($f['name']) || ($f['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
        return null;
    }
    $size = (int)($f['size'] ?? 0);
    if ($size > 8 * 1024 * 1024) {
        json_response(['error' => 'Receipt image must be 8MB or smaller'], 400);
    }
    $mime = (string)($f['type'] ?? '');
    if ($mime === '' || stripos($mime, 'image/') !== 0) {
        json_response(['error' => 'Receipt must be an image file (JPG, PNG, etc.)'], 400);
    }
    $original = (string)$f['name'];
    $content = file_get_contents((string)$f['tmp_name']);
    if ($content === false) {
        json_response(['error' => 'Could not read receipt upload'], 500);
    }
    $ext = pathinfo($original, PATHINFO_EXTENSION);
    $ext = preg_replace('/[^a-zA-Z0-9]/', '', $ext ?? '');
    $stored = bin2hex(random_bytes(18)) . ($ext ? ".{$ext}" : '.bin');
    return [
        'storedName' => $stored,
        'originalName' => $original,
        'mime' => $mime,
        'size' => $size,
        'content' => $content,
    ];
}

function handle_exception(Throwable $e): void
{
    error_log($e->getMessage());
    json_response([
        'error' => 'Server error',
        'detail' => $e->getMessage(),
    ], 500);
}
