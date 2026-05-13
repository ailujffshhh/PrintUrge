<?php
declare(strict_types=1);

require_once __DIR__ . '/common.php';

allow_methods(['POST']);

try {
    $pdo = printurge_db();
    ensure_database_schema($pdo);
    $body = read_json_body();
    $tid = strtoupper(trim((string)($body['transaction_id'] ?? $body['transactionId'] ?? '')));
    $email = strtolower(trim((string)($body['email'] ?? '')));

    if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
        json_response(['error' => 'Valid email is required'], 400);
    }
    if ($tid === '' || !preg_match('/^PU-\d{8}-[A-F0-9]{16}$/', $tid)) {
        json_response(['error' => 'Invalid transaction ID format'], 400);
    }

    $stmt = $pdo->prepare(
        'SELECT pr.id, pr.transaction_id, pr.order_status, pr.payment_status, pr.service, pr.customer_name,
                pr.status, pr.created_at, pr.updated_at
         FROM print_requests pr
         WHERE pr.transaction_id = ? AND LOWER(TRIM(pr.customer_email)) = ?
         LIMIT 1'
    );
    $stmt->execute([$tid, $email]);
    $row = $stmt->fetch();
    if (!$row) {
        json_response(['error' => 'No order found for this transaction ID and email'], 404);
    }

    json_response([
        'order' => [
            'id' => (int)$row['id'],
            'transaction_id' => $row['transaction_id'],
            'order_status' => $row['order_status'] ?? 'submitted',
            'payment_status' => $row['payment_status'],
            'service' => $row['service'],
            'customer_name' => $row['customer_name'],
            'request_status' => $row['status'],
            'created_at' => $row['created_at'],
            'updated_at' => $row['updated_at'],
        ],
    ]);
} catch (Throwable $e) {
    handle_exception($e);
}
