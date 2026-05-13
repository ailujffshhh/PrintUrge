<?php
declare(strict_types=1);

require_once __DIR__ . '/../common.php';

allow_methods(['GET']);

try {
    $pdo = printurge_db();
    $auth = require_auth();
    $user = load_user_context($pdo, (int)$auth['sub']);
    if (!$user || !empty($user['archived_at']) || $user['status'] !== 'active') {
        json_response(['error' => 'Unauthorized'], 401);
    }
    json_response(['user' => map_user($user)]);
} catch (Throwable $e) {
    handle_exception($e);
}
