<?php
declare(strict_types=1);

function printurge_db(): PDO
{
    static $pdo = null;
    if ($pdo instanceof PDO) {
        return $pdo;
    }

    $url = getenv('DATABASE_URL') ?: 'postgresql://postgres.uyqgehcwduzafpdexpag:01102006Estonio!@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres';
    $parts = parse_url($url);

    if (!$parts || empty($parts['host']) || empty($parts['path']) || empty($parts['user'])) {
        throw new RuntimeException('Invalid database connection string.');
    }

    $scheme = $parts['scheme'] ?? 'pgsql';
    $driver = strpos($scheme, 'postgres') === 0 ? 'pgsql' : 'mysql';
    $host = $parts['host'];
    $port = (string)($parts['port'] ?? ($driver === 'pgsql' ? 6543));
    $dbname = ltrim((string)$parts['path'], '/');
    $user = rawurldecode((string)$parts['user']);
    $password = rawurldecode((string)($parts['pass'] ?? ''));

    if ($driver === 'pgsql') {
        $dsn = "pgsql:host={$host};port={$port};dbname={$dbname};sslmode=require";
    } else {
        $dsn = "mysql:host={$host};port={$port};dbname={$dbname};charset=utf8mb4";
    }

    $pdo = new PDO($dsn, $user, $password, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]);

    return $pdo;
}
