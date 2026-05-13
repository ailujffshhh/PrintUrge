<?php
declare(strict_types=1);

require_once __DIR__ . '/common.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_response(['error' => 'Method not allowed'], 405);
}

try {
    $pdo = printurge_db();
    $id = create_print_request($pdo, null, true);
    json_response(['id' => $id, 'message' => 'Print request created'], 201);
} catch (Throwable $e) {
    handle_exception($e);
}
