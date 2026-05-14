<?php
declare(strict_types=1);

require_once __DIR__ . '/../common.php';

allow_methods(['GET']);

try {
    $pdo = printurge_db();
    ensure_database_schema($pdo);
    $auth = require_auth();
    $userId = (int)$auth['sub'];

    $stmt = $pdo->prepare(
        'SELECT u.id, u.name, u.email, u.status, u.created_at, u.last_login_at, r.name AS role
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
                copies, pages, color_mode, size_key, customer_notes, admin_notes, completed_at, created_at, updated_at
         FROM print_requests
         WHERE user_id = ? OR LOWER(TRIM(customer_email)) = LOWER(TRIM(?))
         ORDER BY created_at DESC
         LIMIT 100'
    );
    $orders->execute([$userId, (string)$user['email']]);

    json_response([
        'profile' => [
            'id' => (int)$user['id'],
            'name' => $user['name'],
            'email' => $user['email'],
            'role' => $user['role'],
            'status' => $user['status'],
            'created_at' => $user['created_at'],
            'last_login_at' => $user['last_login_at'],
        ],
        'orders' => $orders->fetchAll(),
    ]);
} catch (Throwable $e) {
    handle_exception($e);
}
