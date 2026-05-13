<?php
declare(strict_types=1);

require_once __DIR__ . '/../common.php';

try {
    require_admin();
    $storedName = (string)($_GET['storedName'] ?? '');
    if (!preg_match('/^[a-f0-9]{36}(\.[a-zA-Z0-9._-]{1,24})?$/i', $storedName)) {
        json_response(['error' => 'Invalid file name'], 400);
    }

    $path = realpath(PRINTURGE_UPLOAD_DIR . '/' . basename($storedName));
    $root = realpath(PRINTURGE_UPLOAD_DIR);
    if (!$path || !$root || strpos($path, $root) !== 0 || !is_file($path)) {
        json_response(['error' => 'Missing file'], 404);
    }

    header('Content-Type: application/octet-stream');
    header('Content-Length: ' . filesize($path));
    header('Content-Disposition: attachment; filename="' . basename($storedName) . '"');
    readfile($path);
    exit;
} catch (Throwable $e) {
    handle_exception($e);
}
