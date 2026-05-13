<?php
declare(strict_types=1);

require_once __DIR__ . '/../common.php';

allow_methods(['GET']);

try {
    $pdo = printurge_db();
    ensure_database_schema($pdo);
    require_admin();
    $storedName = (string)($_GET['storedName'] ?? '');
    if (!preg_match('/^[a-f0-9]{36}(\.[a-zA-Z0-9._-]{1,24})?$/i', $storedName)) {
        json_response(['error' => 'Invalid file name'], 400);
    }

    $stmt = $pdo->prepare(
        'SELECT stored_name, original_name, mime, size_bytes, content
         FROM print_request_files
         WHERE stored_name = ?
         LIMIT 1'
    );
    $stmt->execute([$storedName]);
    $file = $stmt->fetch();
    if (!$file) {
        json_response(['error' => 'Missing file'], 404);
    }

    $content = $file['content'];
    if (is_resource($content)) {
        $content = stream_get_contents($content);
    }
    if (is_string($content) && strpos($content, '\\x') === 0) {
        $decoded = hex2bin(substr($content, 2));
        if ($decoded !== false) {
            $content = $decoded;
        }
    }

    header('Content-Type: ' . ($file['mime'] ?: 'application/octet-stream'));
    header('Content-Length: ' . strlen((string)$content));
    header('Content-Disposition: attachment; filename="' . basename((string)$file['original_name']) . '"');
    echo $content;
    exit;
} catch (Throwable $e) {
    handle_exception($e);
}
