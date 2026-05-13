<?php
declare(strict_types=1);

require_once __DIR__ . '/../common.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_response(['error' => 'Method not allowed'], 405);
}

try {
    $pdo = printurge_db();
    $body = read_json_body();
    $email = strtolower(trim((string)($body['email'] ?? '')));
    $password = (string)($body['password'] ?? '');

    if ($email === '' || $password === '') {
        json_response(['error' => 'Email and password are required'], 400);
    }

    $stmt = $pdo->prepare(
        'SELECT u.id, u.name, u.email, u.password_hash, u.status, u.archived_at, r.name AS role
         FROM users u
         JOIN roles r ON r.id = u.role_id
         WHERE LOWER(u.email) = ?
         LIMIT 1'
    );
    $stmt->execute([$email]);
    $row = $stmt->fetch();

    if (!$row || !password_verify($password, (string)$row['password_hash'])) {
        json_response(['error' => 'Invalid credentials'], 401);
    }
    if (!empty($row['archived_at'])) {
        json_response(['error' => 'Account archived'], 403);
    }
    if ($row['status'] !== 'active') {
        json_response(['error' => 'Account disabled'], 403);
    }

    $pdo->prepare('UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?')->execute([$row['id']]);

    $user = map_user($row);
    $token = sign_token(['sub' => (int)$row['id'], 'role' => $row['role']]);
    json_response(['token' => $token, 'user' => $user]);
} catch (Throwable $e) {
    handle_exception($e);
}
