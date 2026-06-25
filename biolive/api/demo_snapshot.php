<?php
// ============================================================
//  BioLive — api/demo_snapshot.php
//  Endpoint: POST /api/demo_snapshot.php
//  Menerima snapshot base64 dari kamera, simpan ke disk & DB
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

$body      = json_decode(file_get_contents('php://input'), true) ?? [];
$token     = trim($body['session_token'] ?? '');
$imageData = $body['image'] ?? ''; // base64 string, contoh: "data:image/jpeg;base64,..."

if (empty($token) || empty($imageData)) {
    jsonResponse(false, 'session_token dan image wajib diisi');
}

$pdo  = getDB();
$sess = $pdo->prepare('SELECT id FROM demo_sessions WHERE session_token = ? LIMIT 1');
$sess->execute([$token]);
$session = $sess->fetch();

if (!$session) {
    jsonResponse(false, 'Sesi tidak ditemukan');
}

$sessionId = (int) $session['id'];

// Parse base64 image
if (preg_match('/^data:image\/(\w+);base64,/', $imageData, $matches)) {
    $ext      = strtolower($matches[1]); // jpeg / png / webp
    $allowed  = ['jpeg', 'jpg', 'png', 'webp'];
    if (!in_array($ext, $allowed)) {
        jsonResponse(false, 'Format gambar tidak didukung');
    }
    $raw = base64_decode(preg_replace('/^data:image\/\w+;base64,/', '', $imageData));
} else {
    jsonResponse(false, 'Format image tidak valid (harus base64 data URL)');
}

// Simpan file
$uploadDir = __DIR__ . '/../uploads/snapshots/';
if (!is_dir($uploadDir)) {
    mkdir($uploadDir, 0755, true);
}

$filename  = 'snap_' . $sessionId . '_' . time() . '.' . ($ext === 'jpg' ? 'jpeg' : $ext);
$filepath  = $uploadDir . $filename;
$relPath   = 'uploads/snapshots/' . $filename;

if (file_put_contents($filepath, $raw) === false) {
    jsonResponse(false, 'Gagal menyimpan snapshot');
}

// Update path di DB
$pdo->prepare('UPDATE demo_sessions SET snapshot_path = ? WHERE id = ?')
    ->execute([$relPath, $sessionId]);

logAction('snapshot_saved', null, $sessionId, "file=$filename");

echo json_encode([
    'success'  => true,
    'message'  => 'Snapshot berhasil disimpan',
    'filename' => $filename,
    'path'     => $relPath,
]);
