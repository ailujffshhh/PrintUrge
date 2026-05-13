<?php
declare(strict_types=1);

/**
 * Short-TTL cache: APCu when available, otherwise JSON files under sys_get_temp_dir().
 * Used to avoid repeated database work on serverless (where request-scoped statics reset each invocation).
 */

function printurge_cache_apcu_available(): bool
{
    return function_exists('apcu_fetch')
        && function_exists('apcu_store')
        && filter_var(ini_get('apc.enabled'), FILTER_VALIDATE_BOOLEAN);
}

function printurge_cache_storage_key(string $key): string
{
    return 'pu:' . hash('sha256', $key);
}

function printurge_cache_dir(): string
{
    return sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'printurge-cache';
}

function printurge_cache_file_path(string $storageKey): string
{
    $dir = printurge_cache_dir();
    if (!is_dir($dir)) {
        @mkdir($dir, 0700, true);
    }
    return $dir . DIRECTORY_SEPARATOR . $storageKey . '.json';
}

/**
 * @return mixed|null Null when missing or expired.
 */
function printurge_cache_get(string $key)
{
    $sk = printurge_cache_storage_key($key);
    if (printurge_cache_apcu_available()) {
        $ok = false;
        $v = apcu_fetch($sk, $ok);
        return $ok ? $v : null;
    }

    $path = printurge_cache_file_path($sk);
    if (!is_file($path)) {
        return null;
    }
    $raw = @file_get_contents($path);
    if ($raw === false || $raw === '') {
        return null;
    }
    $row = json_decode($raw, true);
    if (!is_array($row) || !isset($row['exp'])) {
        return null;
    }
    if (time() > (int)$row['exp']) {
        @unlink($path);
        return null;
    }
    return $row['val'] ?? null;
}

function printurge_cache_set(string $key, $value, int $ttlSeconds): void
{
    if ($ttlSeconds < 1) {
        return;
    }
    $sk = printurge_cache_storage_key($key);
    if (printurge_cache_apcu_available()) {
        apcu_store($sk, $value, $ttlSeconds);
        return;
    }

    $path = printurge_cache_file_path($sk);
    $payload = json_encode(
        ['exp' => time() + $ttlSeconds, 'val' => $value],
        JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES
    );
    if ($payload === false) {
        return;
    }
    @file_put_contents($path, $payload, LOCK_EX);
}

function printurge_cache_delete(string $key): void
{
    $sk = printurge_cache_storage_key($key);
    if (printurge_cache_apcu_available()) {
        apcu_delete($sk);
        return;
    }
    $path = printurge_cache_file_path($sk);
    if (is_file($path)) {
        @unlink($path);
    }
}
