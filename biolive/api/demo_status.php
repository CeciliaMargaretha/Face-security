<?php
// ============================================================
//  BioLive — api/demo_status.php
//  Endpoint: GET /api/demo_status.php?token=SESSION_TOKEN
//  Mengembalikan detail sesi + hasil liveness terakhir
// ============================================================
header('Access-Control-Allow-Origin: *');
header('Content-Type: application/json');

require_once __DIR__ . '/../config/database.php';

$token = trim($_GET['token'] ?? '');
if (empty($token)) {
    jsonResponse(false, 'Parameter token wajib diisi');
}

$pdo  = getDB();
$stmt = $pdo->prepare(
    'SELECT s.*, lc.face_detected, lc.blink_detected, lc.depth_analysis,
            lc.finger_gesture, lc.liveness_score, lc.is_live
     FROM demo_sessions s
     LEFT JOIN liveness_checks lc ON lc.session_id = s.id
     WHERE s.session_token = ?
     ORDER BY lc.id DESC
     LIMIT 1'
);
$stmt->execute([$token]);
$row = $stmt->fetch();

if (!$row) {
    jsonResponse(false, 'Sesi tidak ditemukan');
}

echo json_encode([
    'success' => true,
    'data'    => [
        'session_id'     => $row['id'],
        'status'         => $row['status'],
        'camera_type'    => $row['camera_type'],
        'started_at'     => $row['started_at'],
        'finished_at'    => $row['finished_at'],
        'snapshot_path'  => $row['snapshot_path'],
        'liveness'       => [
            'face_detected'  => (bool) ($row['face_detected']  ?? false),
            'blink_detected' => (bool) ($row['blink_detected'] ?? false),
            'depth_analysis' => (bool) ($row['depth_analysis'] ?? false),
            'finger_gesture' => (bool) ($row['finger_gesture'] ?? false),
            'score'          => $row['liveness_score'] ?? 0,
            'is_live'        => (bool) ($row['is_live'] ?? false),
        ],
    ],
]);
