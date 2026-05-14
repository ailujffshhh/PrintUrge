<?php
declare(strict_types=1);

require_once __DIR__ . '/../common.php';

allow_methods(['GET', 'POST']);

try {
    $pdo = printurge_db();
    ensure_database_schema($pdo);
    $auth = require_auth();
    $userId = (int)$auth['sub'];
    $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
    $authUser = load_user_context($pdo, $userId);
    if (!$authUser || $authUser['status'] !== 'active' || !empty($authUser['archived_at'])) {
        json_response(['error' => 'Unauthorized'], 401);
    }

    if ($method === 'POST') {
        $body = read_json_body();
        $action = (string)($body['action'] ?? '');
        if ($action === 'save-preset') {
            $name = substr(trim((string)($body['name'] ?? 'My preset')), 0, 120);
            $service = substr(trim((string)($body['service'] ?? '')), 0, 64);
            if ($service === '') {
                json_response(['error' => 'Service is required'], 400);
            }
            $params = [
                $userId,
                $name !== '' ? $name : 'My preset',
                $service,
                substr(trim((string)($body['color_mode'] ?? '')), 0, 64) ?: null,
                substr(trim((string)($body['size_key'] ?? '')), 0, 64) ?: null,
                int_field($body['copies'] ?? 1, 1),
                int_field($body['pages'] ?? 1, 1),
                substr(trim((string)($body['custom_width'] ?? '')), 0, 32) ?: null,
                substr(trim((string)($body['custom_height'] ?? '')), 0, 32) ?: null,
            ];
            $sql = 'INSERT INTO print_presets
                    (user_id, name, service, color_mode, size_key, copies, pages, custom_width, custom_height)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)';
            if (db_driver($pdo) === 'pgsql') {
                $stmt = $pdo->prepare($sql . ' RETURNING id');
                $stmt->execute($params);
                json_response(['ok' => true, 'id' => (int)$stmt->fetchColumn()]);
            }
            $stmt = $pdo->prepare($sql);
            $stmt->execute($params);
            json_response(['ok' => true, 'id' => (int)$pdo->lastInsertId()]);
        }
        if ($action === 'membership-checkout') {
            $checkoutUrl = trim((string)(getenv('PRINTURGE_MEMBER_CHECKOUT_URL') ?: ''));
            json_response([
                'ok' => true,
                'provider' => getenv('PRINTURGE_BILLING_PROVIDER') ?: 'manual',
                'checkout_url' => $checkoutUrl !== '' ? $checkoutUrl : null,
                'message' => $checkoutUrl !== ''
                    ? 'Continue to membership checkout.'
                    : 'Membership billing is ready for provider checkout configuration.',
            ]);
        }
        json_response(['error' => 'Unsupported action'], 400);
    }

    $stmt = $pdo->prepare(
        'SELECT u.id, u.name, u.email, u.status, u.account_tier, u.member_since, u.created_at, u.last_login_at, r.name AS role
         FROM users u
         JOIN roles r ON r.id = u.role_id
         WHERE u.id = ?
         LIMIT 1'
    );
    $stmt->execute([$userId]);
    $user = $stmt->fetch();
    if (!$user || $user['status'] !== 'active') {
        json_response(['error' => 'Unauthorized'], 401);
    }

    $orders = $pdo->prepare(
        'SELECT id, transaction_id, service, payment_status, payment_method, order_status,
                copies, pages, color_mode, size_key, customer_notes, admin_notes, subtotal_amount,
                discount_amount, credits_applied, total_amount, is_priority, pickup_slot_id, preset_id,
                completed_at, created_at, updated_at
         FROM print_requests
         WHERE user_id = ? OR LOWER(TRIM(customer_email)) = LOWER(TRIM(?))
         ORDER BY created_at DESC
         LIMIT 100'
    );
    $orders->execute([$userId, (string)$user['email']]);
    $presets = $pdo->prepare(
        'SELECT id, name, service, color_mode, size_key, copies, pages, custom_width, custom_height, created_at
         FROM print_presets
         WHERE user_id = ?
         ORDER BY created_at DESC
         LIMIT 20'
    );
    $presets->execute([$userId]);
    $subscription = $pdo->prepare(
        'SELECT provider, status, plan_key, current_period_start, current_period_end, cancel_at
         FROM subscriptions
         WHERE user_id = ?
         ORDER BY created_at DESC
         LIMIT 1'
    );
    $subscription->execute([$userId]);
    $credits = $pdo->prepare(
        'SELECT period_month, starting_credits, used_credits, remaining_credits, expires_at
         FROM member_credits
         WHERE user_id = ?
         ORDER BY period_month DESC
         LIMIT 1'
    );
    $credits->execute([$userId]);
    $benefits = $pdo->prepare(
        'SELECT benefit_key, period_month, used_count, limit_count
         FROM member_benefits
         WHERE user_id = ?
         ORDER BY period_month DESC, benefit_key ASC
         LIMIT 20'
    );
    $benefits->execute([$userId]);

    json_response([
        'profile' => [
            'id' => (int)$user['id'],
            'name' => $user['name'],
            'email' => $user['email'],
            'role' => $user['role'],
            'status' => $user['status'],
            'account_tier' => $user['account_tier'] ?? 'free',
            'member_since' => $user['member_since'],
            'created_at' => $user['created_at'],
            'last_login_at' => $user['last_login_at'],
        ],
        'orders' => $orders->fetchAll(),
        'presets' => $presets->fetchAll(),
        'subscription' => $subscription->fetch() ?: null,
        'credits' => $credits->fetch() ?: null,
        'benefits' => $benefits->fetchAll(),
        'member_rules' => [
            'bulk_discount_percent' => 10,
            'bulk_discount_min_pages' => 100,
            'monthly_print_credits' => 100,
            'free_lamination_per_month' => 1,
        ],
    ]);
} catch (Throwable $e) {
    handle_exception($e);
}
