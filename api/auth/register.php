<?php
declare(strict_types=1);

require_once __DIR__ . '/../common.php';

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'GET') {
    json_response([
        'ok' => true,
        'endpoint' => 'register',
        'message' => 'Submit the signup form to create an account.',
        'method' => 'POST',
    ]);
}

allow_methods(['POST']);

try {
    $pdo = printurge_db();
    $body = read_json_body();
    if (!$body && $_POST) {
        $body = $_POST;
    }
    $name = substr(trim((string)($body['name'] ?? $body['signup-name'] ?? '')), 0, 160);
    $email = strtolower(substr(trim((string)($body['email'] ?? $body['signup-email'] ?? '')), 0, 255));
    $password = (string)($body['password'] ?? $body['signup-password'] ?? '');

    if ($name === '' || !filter_var($email, FILTER_VALIDATE_EMAIL) || strlen($password) < 8) {
        json_response(['error' => 'Name, email, and password (8+ chars) are required'], 400);
    }

    $hash = password_hash($password, PASSWORD_DEFAULT);
    $driver = db_driver($pdo);
    $sql = "INSERT INTO users (role_id, name, email, password_hash, status)
            VALUES ((SELECT id FROM roles WHERE name = 'client' LIMIT 1), ?, ?, ?, 'active')";

    if ($driver === 'pgsql') {
        $stmt = $pdo->prepare($sql . ' RETURNING id');
        $stmt->execute([$name, $email, $hash]);
        $id = (int)$stmt->fetchColumn();
    } else {
        $stmt = $pdo->prepare($sql);
        $stmt->execute([$name, $email, $hash]);
        $id = (int)$pdo->lastInsertId();
    }

    $row = load_user_context($pdo, $id);
    if (!$row) {
        json_response(['error' => 'Could not create account'], 500);
    }

    $user = map_user($row);
    $token = sign_token(['sub' => $id, 'role' => $row['role']]);
    json_response(['token' => $token, 'user' => $user], 201);
} catch (PDOException $e) {
    if ($e->getCode() === '23000' || $e->getCode() === '23505') {
        json_response(['error' => 'Email already registered'], 409);
    }
    handle_exception($e);
} catch (Throwable $e) {
    handle_exception($e);
}
