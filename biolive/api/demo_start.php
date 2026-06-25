<?php
// ============================================================
//  BioLive — api/demo_start.php
//  Endpoint: POST /api/demo_start.php
//  Membuat sesi demo baru, mengembalikan session_token
// ============================================================
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { exit; }
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed']);
    exit;
}

require_once __DIR__ . '/../config/database.php';

$body        = json_decode(file_get_contents('php://input'), true) ?? [];
$cameraType  = in_array($body['camera_type'] ?? '', ['laptop','phone']) ? $body['camera_type'] : 'unknown';
$deviceInfo  = substr($_SERVER['HTTP_USER_AGENT'] ?? '', 0, 255);
$ip          = $_SERVER['REMOTE_ADDR'] ?? null;

// Generate unik token
$token = bin2hex(random_bytes(32));

$pdo  = getDB();
$stmt = $pdo->prepare(
    'INSERT INTO demo_sessions (session_token, device_info, camera_type, ip_address, status)
     VALUES (?, ?, ?, ?, "started")'
);
$stmt->execute([$token, $deviceInfo, $cameraType, $ip]);
$sessionId = (int) $pdo->lastInsertId();

logAction('demo_start', null, $sessionId, "camera_type=$cameraType");

echo json_encode([
    'success'       => true,
    'message'       => 'Sesi demo dimulai',
    'session_token' => $token,
    'session_id'    => $sessionId,
]);
