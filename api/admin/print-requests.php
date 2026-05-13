<?php
declare(strict_types=1);

require_once __DIR__ . '/../common.php';

allow_methods(['GET', 'POST', 'PATCH']);

try {
    $pdo = printurge_db();
    ensure_database_schema($pdo);
    require_admin();

    $method = $_SERVER['REQUEST_METHOD'];
    $id = isset($_GET['id']) ? (int)$_GET['id'] : null;
    $action = (string)($_GET['action'] ?? '');

    if ($method === 'GET' && !$id) {
        $status = (string)($_GET['status'] ?? 'active');
        $where = 'WHERE 1=1';
        $params = [];
        if ($status === 'active' || $status === 'archived') {
            $where .= ' AND pr.status = ?';
            $params[] = $status;
        }
        $stmt = $pdo->prepare(
            "SELECT pr.id, pr.transaction_id, pr.service, pr.status, pr.payment_status, pr.payment_method,
                    pr.customer_name, pr.created_at, pr.archived_at,
                    pr.copies, pr.pages, pr.color_mode, pr.size_key,
                    u.name AS user_name, u.email AS user_email
             FROM print_requests pr
             LEFT JOIN users u ON u.id = pr.user_id
             {$where}
             ORDER BY pr.created_at DESC
             LIMIT 500"
        );
        $stmt->execute($params);
        json_response(['items' => $stmt->fetchAll()]);
    }

    if ($method === 'GET' && $id) {
        $stmt = $pdo->prepare(
            'SELECT pr.*, u.name AS user_name, u.email AS user_email
             FROM print_requests pr
             LEFT JOIN users u ON u.id = pr.user_id
             WHERE pr.id = ?
             LIMIT 1'
        );
        $stmt->execute([$id]);
        $row = $stmt->fetch();
        if (!$row) {
            json_response(['error' => 'Not found'], 404);
        }
        $files = json_decode((string)($row['files_json'] ?? '[]'), true);
        $row['files'] = is_array($files) ? $files : [];
        unset($row['files_json']);
        json_response(['item' => $row]);
    }

    if ($method === 'POST' && !$id) {
        $forceUserId = null;
        if (isset($_POST['userId']) && trim((string)$_POST['userId']) !== '') {
            $forceUserId = (int)$_POST['userId'];
        }
        $created = create_print_request($pdo, $forceUserId, false);
        json_response([
            'id' => $created['id'],
            'transaction_id' => $created['transaction_id'],
            'payment_status' => $created['payment_status'],
            'message' => 'Print request created',
        ], 201);
    }

    if ($method === 'POST' && $id && ($action === 'archive' || $action === 'restore' || $action === 'mark-paid' || $action === 'mark-unpaid')) {
        if ($action === 'archive') {
            $stmt = $pdo->prepare("UPDATE print_requests SET status = 'archived', archived_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'active'");
            $message = 'Not found or already archived';
        } elseif ($action === 'restore') {
            $stmt = $pdo->prepare("UPDATE print_requests SET status = 'active', archived_at = NULL WHERE id = ? AND status = 'archived'");
            $message = 'Not found or not archived';
        } elseif ($action === 'mark-paid') {
            $stmt = $pdo->prepare("UPDATE print_requests SET payment_status = 'paid' WHERE id = ?");
            $message = 'Not found';
        } else {
            $stmt = $pdo->prepare("UPDATE print_requests SET payment_status = 'unpaid' WHERE id = ?");
            $message = 'Not found';
        }
        $stmt->execute([$id]);
        if ($stmt->rowCount() < 1) {
            json_response(['error' => $message], 404);
        }
        json_response(['ok' => true]);
    }

    if ($method === 'PATCH' && $id) {
        $body = read_json_body();
        $allowed = [
            'service' => function ($v) { return substr(trim((string)$v), 0, 64); },
            'color_mode' => function ($v) { return $v === null || $v === '' ? null : substr(trim((string)$v), 0, 64); },
            'size_key' => function ($v) { return $v === null || $v === '' ? null : substr(trim((string)$v), 0, 64); },
            'copies' => function ($v) { return int_field($v, 1); },
            'pages' => function ($v) { return int_field($v, 1); },
            'custom_width' => function ($v) { return $v === null || $v === '' ? null : substr(trim((string)$v), 0, 32); },
            'custom_height' => function ($v) { return $v === null || $v === '' ? null : substr(trim((string)$v), 0, 32); },
            'admin_notes' => function ($v) { return $v === null ? null : substr((string)$v, 0, 8000); },
            'payment_status' => function ($v) { return $v === 'paid' ? 'paid' : 'unpaid'; },
            'payment_method' => function ($v) { return $v === null || $v === '' ? null : substr(trim((string)$v), 0, 80); },
            'customer_name' => function ($v) { return $v === null || $v === '' ? null : substr(trim((string)$v), 0, 160); },
            'customer_notes' => function ($v) { return $v === null ? null : substr((string)$v, 0, 2000); },
        ];
        $fields = [];
        $values = [];
        foreach ($allowed as $field => $clean) {
            if (array_key_exists($field, $body)) {
                $fields[] = "{$field} = ?";
                $values[] = $clean($body[$field]);
            }
        }
        if (!$fields) {
            json_response(['error' => 'No fields to update'], 400);
        }
        $values[] = $id;
        $stmt = $pdo->prepare('UPDATE print_requests SET ' . implode(', ', $fields) . ' WHERE id = ?');
        $stmt->execute($values);
        if ($stmt->rowCount() < 1) {
            json_response(['error' => 'Not found'], 404);
        }
        json_response(['ok' => true]);
    }

    json_response(['error' => 'Method not allowed'], 405);
} catch (Throwable $e) {
    handle_exception($e);
}
