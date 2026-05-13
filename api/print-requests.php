<?php
declare(strict_types=1);

require_once __DIR__ . '/common.php';

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'GET') {
    json_response([
        'ok' => true,
        'endpoint' => 'print-requests',
        'message' => 'Submit the print request form to create a request.',
        'method' => 'POST',
    ]);
}

allow_methods(['POST']);

try {
    $pdo = printurge_db();
    ensure_database_schema($pdo);
    $created = create_print_request($pdo, null, true);
    json_response([
        'id' => $created['id'],
        'transaction_id' => $created['transaction_id'],
        'payment_status' => $created['payment_status'],
        'message' => 'Print request created',
    ], 201);
} catch (Throwable $e) {
    handle_exception($e);
}
