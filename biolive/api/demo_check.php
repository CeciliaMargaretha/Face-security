<?php
// ============================================================
//  BioLive — api/demo_check.php
//  Endpoint: POST /api/demo_check.php
//  Menerima hasil liveness check per-step dari frontend,
//  menyimpan ke DB, dan mengembalikan status terkini
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

$body         = json_decode(file_get_contents('php://input'), true) ?? [];
$token        = trim($body['session_token'] ?? '');
$faceDetected = (int) ($body['face_detected']  ?? 0);
$blinkDetected= (int) ($body['blink_detected'] ?? 0);
$depthAnalysis= (int) ($body['depth_analysis'] ?? 0);
$fingerGesture= (int) ($body['finger_gesture'] ?? 0);
$rawResult    = $body['raw_result'] ?? null;

if (empty($token)) {
    jsonResponse(false, 'session_token wajib diisi');
}

$pdo  = getDB();
$sess = $pdo->prepare('SELECT id FROM demo_sessions WHERE session_token = ? AND status != "failed" LIMIT 1');
$sess->execute([$token]);
$session = $sess->fetch();

if (!$session) {
    jsonResponse(false, 'Sesi tidak ditemukan atau sudah selesai');
}

$sessionId = (int) $session['id'];

// Hitung liveness score (sederhana: 25 poin per check)
$score  = ($faceDetected + $blinkDetected + $depthAnalysis + $fingerGesture) * 25;
$isLive = $score >= 75; // minimal 3 dari 4 check lulus

// Simpan hasil liveness
$ins = $pdo->prepare(
    'INSERT INTO liveness_checks
       (session_id, face_detected, blink_detected, depth_analysis, finger_gesture, liveness_score, is_live, raw_result)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
);
$ins->execute([
    $sessionId,
    $faceDetected,
    $blinkDetected,
    $depthAnalysis,
    $fingerGesture,
    $score,
    $isLive ? 1 : 0,
    $rawResult ? json_encode($rawResult) : null,
]);

// Update status sesi
$newStatus = $isLive ? 'verified' : 'processing';
$pdo->prepare('UPDATE demo_sessions SET status = ? WHERE id = ?')
    ->execute([$newStatus, $sessionId]);

logAction('liveness_check', null, $sessionId, "score=$score is_live=" . ($isLive ? '1' : '0'));

echo json_encode([
    'success'        => true,
    'message'        => $isLive ? 'LIVE PERSON VERIFIED' : 'Verifikasi belum selesai',
    'is_live'        => $isLive,
    'liveness_score' => $score,
    'checks'         => [
        'face_detected'  => (bool) $faceDetected,
        'blink_detected' => (bool) $blinkDetected,
        'depth_analysis' => (bool) $depthAnalysis,
        'finger_gesture' => (bool) $fingerGesture,
    ],
]);
