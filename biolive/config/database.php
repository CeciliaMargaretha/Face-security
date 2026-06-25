<?php
// ============================================================
//  BioLive — config/database.php
//  Koneksi ke MySQL (phpMyAdmin)
//  Sesuaikan DB_USER dan DB_PASS dengan credential lokal Anda
// ============================================================

define('DB_HOST', 'localhost');
define('DB_NAME', 'biolive_db');
define('DB_USER', 'root');       // ganti jika beda
define('DB_PASS', '');           // ganti jika pakai password
define('DB_CHARSET', 'utf8mb4');

/**
 * Mengembalikan PDO instance (singleton)
 */
function getDB(): PDO {
    static $pdo = null;
    if ($pdo === null) {
        $dsn = sprintf(
            'mysql:host=%s;dbname=%s;charset=%s',
            DB_HOST, DB_NAME, DB_CHARSET
        );
        try {
            $pdo = new PDO($dsn, DB_USER, DB_PASS, [
                PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES   => false,
            ]);
        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Database connection failed: ' . $e->getMessage()]);
            exit;
        }
    }
    return $pdo;
}

/**
 * Helper: kirim JSON response
 */
function jsonResponse(bool $success, string $message, array $data = []): void {
    header('Content-Type: application/json');
    echo json_encode(array_merge(['success' => $success, 'message' => $message], $data));
    exit;
}

/**
 * Helper: catat ke access_logs
 */
function logAction(string $action, ?int $userId = null, ?int $sessionId = null, ?string $detail = null): void {
    $pdo = getDB();
    $stmt = $pdo->prepare(
        'INSERT INTO access_logs (user_id, session_id, action, detail, ip_address, user_agent)
         VALUES (?, ?, ?, ?, ?, ?)'
    );
    $stmt->execute([
        $userId,
        $sessionId,
        $action,
        $detail,
        $_SERVER['REMOTE_ADDR'] ?? null,
        $_SERVER['HTTP_USER_AGENT'] ?? null,
    ]);
}
