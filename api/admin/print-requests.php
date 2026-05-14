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
        $listTtl = printurge_admin_list_cache_ttl();
        $gen = printurge_admin_cache_generation();
        $listKey = 'admin_pr_list:' . $gen . ':' . $status;
        if ($listTtl > 0) {
            $cached = printurge_cache_get($listKey);
            if (is_array($cached) && array_key_exists('items', $cached)) {
                json_response(['items' => $cached['items']]);
            }
        }
        $where = 'WHERE 1=1';
        $params = [];
        if ($status === 'active' || $status === 'archived') {
            $where .= ' AND pr.status = ?';
            $params[] = $status;
        } elseif ($status === 'history') {
            $where .= " AND pr.order_status = 'completed'";
        }
        $stmt = $pdo->prepare(
            "SELECT pr.id, pr.transaction_id, pr.service, pr.status, pr.payment_status, pr.payment_method,
                    pr.customer_name, pr.customer_email, pr.order_status, pr.created_at, pr.archived_at,
                    pr.copies, pr.pages, pr.color_mode, pr.size_key, pr.customer_notes, pr.admin_notes,
                    u.name AS user_name, u.email AS user_email
             FROM print_requests pr
             LEFT JOIN users u ON u.id = pr.user_id
             {$where}
             ORDER BY pr.created_at DESC
             LIMIT 500"
        );
        $stmt->execute($params);
        $items = $stmt->fetchAll();
        if ($listTtl > 0) {
            printurge_cache_set($listKey, ['items' => $items], $listTtl);
        }
        json_response(['items' => $items]);
    }

    if ($method === 'GET' && $id) {
        $itemTtl = printurge_admin_item_cache_ttl();
        $gen = printurge_admin_cache_generation();
        $itemKey = 'admin_pr_item:' . $gen . ':' . $id;
        if ($itemTtl > 0) {
            $cached = printurge_cache_get($itemKey);
            if (is_array($cached) && array_key_exists('item', $cached)) {
                json_response(['item' => $cached['item']]);
            }
        }
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
        if (!empty($row['receipt_stored_name'])) {
            $rstmt = $pdo->prepare(
                'SELECT stored_name, original_name, mime FROM print_request_files WHERE print_request_id = ? AND stored_name = ? LIMIT 1'
            );
            $rstmt->execute([$id, $row['receipt_stored_name']]);
            $rfile = $rstmt->fetch();
            if ($rfile) {
                $row['files'][] = [
                    'storedName' => $rfile['stored_name'],
                    'originalName' => $rfile['original_name'] ?: 'Payment receipt',
                    'mime' => $rfile['mime'],
                    'kind' => 'payment_receipt',
                ];
            }
        }
        if ($itemTtl > 0) {
            printurge_cache_set($itemKey, ['item' => $row], $itemTtl);
        }
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

    if ($method === 'POST' && $id && ($action === 'archive' || $action === 'restore' || $action === 'mark-paid' || $action === 'mark-unpaid' || $action === 'reject-receipt' || $action === 'complete')) {
        if ($action === 'archive') {
            $stmt = $pdo->prepare("UPDATE print_requests SET status = 'archived', archived_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'active'");
            $message = 'Not found or already archived';
            $stmt->execute([$id]);
            if ($stmt->rowCount() < 1) {
                json_response(['error' => $message], 404);
            }
            printurge_admin_cache_bump();
            json_response(['ok' => true]);
        }
        if ($action === 'restore') {
            $stmt = $pdo->prepare("UPDATE print_requests SET status = 'active', archived_at = NULL WHERE id = ? AND status = 'archived'");
            $message = 'Not found or not archived';
            $stmt->execute([$id]);
            if ($stmt->rowCount() < 1) {
                json_response(['error' => $message], 404);
            }
            printurge_admin_cache_bump();
            json_response(['ok' => true]);
        }
        if ($action === 'reject-receipt') {
            $sel = $pdo->prepare('SELECT receipt_stored_name FROM print_requests WHERE id = ? AND payment_status = ? LIMIT 1');
            $sel->execute([$id, 'pending_review']);
            $prev = $sel->fetch();
            if (!$prev) {
                json_response(['error' => 'Not found or not awaiting payment review'], 404);
            }
            $stored = (string)($prev['receipt_stored_name'] ?? '');
            $stmt = $pdo->prepare("UPDATE print_requests SET payment_status = 'unpaid', receipt_stored_name = NULL WHERE id = ? AND payment_status = 'pending_review'");
            $stmt->execute([$id]);
            if ($stmt->rowCount() < 1) {
                json_response(['error' => 'Not found or not awaiting payment review'], 404);
            }
            if ($stored !== '') {
                $pdo->prepare('DELETE FROM print_request_files WHERE stored_name = ? AND print_request_id = ?')->execute([$stored, $id]);
            }
            printurge_admin_cache_bump();
            json_response(['ok' => true]);
        }
        if ($action === 'mark-paid') {
            $sel = $pdo->prepare(
                'SELECT payment_status, customer_email, transaction_id, customer_name, service FROM print_requests WHERE id = ? LIMIT 1'
            );
            $sel->execute([$id]);
            $before = $sel->fetch();
            if (!$before) {
                json_response(['error' => 'Not found'], 404);
            }
            $wasPaid = ($before['payment_status'] ?? '') === 'paid';
            $stmt = $pdo->prepare("UPDATE print_requests SET payment_status = 'paid' WHERE id = ?");
            $stmt->execute([$id]);
            if (!$wasPaid) {
                require_once __DIR__ . '/../mail.php';
                $to = trim((string)($before['customer_email'] ?? ''));
                if ($to !== '' && filter_var($to, FILTER_VALIDATE_EMAIL)) {
                    printurge_send_ereceipt_email(
                        $to,
                        (string)($before['transaction_id'] ?? ''),
                        (string)($before['customer_name'] ?? ''),
                        (string)($before['service'] ?? '')
                    );
                }
            }
            printurge_admin_cache_bump();
            json_response(['ok' => true]);
        }
        if ($action === 'mark-unpaid') {
            $stmt = $pdo->prepare("UPDATE print_requests SET payment_status = 'unpaid' WHERE id = ?");
            $stmt->execute([$id]);
            if ($stmt->rowCount() < 1) {
                json_response(['error' => 'Not found'], 404);
            }
            printurge_admin_cache_bump();
            json_response(['ok' => true]);
        }
        if ($action === 'complete') {
            $stmt = $pdo->prepare("UPDATE print_requests SET order_status = 'completed' WHERE id = ?");
            $stmt->execute([$id]);
            if ($stmt->rowCount() < 1) {
                json_response(['error' => 'Not found'], 404);
            }
            printurge_admin_cache_bump();
            json_response(['ok' => true]);
        }
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
            'payment_status' => function ($v) {
                $v = strtolower(trim((string)$v));
                return in_array($v, ['paid', 'unpaid', 'pending_review'], true) ? $v : 'unpaid';
            },
            'payment_method' => function ($v) { return $v === null || $v === '' ? null : substr(trim((string)$v), 0, 80); },
            'customer_name' => function ($v) { return $v === null || $v === '' ? null : substr(trim((string)$v), 0, 160); },
            'customer_email' => function ($v) {
                if ($v === null || $v === '') {
                    return null;
                }
                $e = strtolower(trim((string)$v));
                return filter_var($e, FILTER_VALIDATE_EMAIL) ? substr($e, 0, 255) : null;
            },
            'customer_notes' => function ($v) { return $v === null ? null : substr((string)$v, 0, 2000); },
            'order_status' => function ($v) {
                $v = strtolower(trim((string)$v));
                $ok = ['submitted', 'processing', 'ready', 'completed', 'cancelled'];
                return in_array($v, $ok, true) ? $v : 'submitted';
            },
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
        printurge_admin_cache_bump();
        json_response(['ok' => true]);
    }

    json_response(['error' => 'Method not allowed'], 405);
} catch (Throwable $e) {
    handle_exception($e);
}
