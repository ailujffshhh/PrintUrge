<?php
// db.php - Supabase PostgreSQL Connection

$connection_string = "postgresql://postgres:01102006Estonio!@db.uyqgehcwduzafpdexpag.supabase.co:5432/postgres";

// Parse the connection string
$parsed = parse_url($connection_string);

$host     = $parsed['host'];
$port     = $parsed['port'] ?? '5432';
$dbname   = ltrim($parsed['path'], '/');
$user     = $parsed['user'];
$password = $parsed['pass'];

try {
    $dsn = "pgsql:host=$host;port=$port;dbname=$dbname;sslmode=require";

    $pdo = new PDO($dsn, $user, $password, [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES   => false,
    ]);

    // Optional: Test connection
    echo "✅ Successfully connected to Supabase!";

} catch (PDOException $e) {
    die("❌ Connection Error: " . $e->getMessage());
}
?>