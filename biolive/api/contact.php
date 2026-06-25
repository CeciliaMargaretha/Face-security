<?php
// ============================================================
//  BioLive — api/contact.php
//  Endpoint: POST /api/contact.php
//  Menyimpan pengiriman form kontak ke tabel contact_requests
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

$body     = json_decode(file_get_contents('php://input'), true) ?? [];
$nama     = trim($body['nama']     ?? '');
$instansi = trim($body['instansi'] ?? '');
$email    = trim($body['email']    ?? '');
$pesan    = trim($body['pesan']    ?? '');

// Validasi
$errors = [];
if (empty($nama))                    $errors[] = 'Nama wajib diisi';
if (empty($email))                   $errors[] = 'Email wajib diisi';
elseif (!filter_var($email, FILTER_VALIDATE_EMAIL)) $errors[] = 'Format email tidak valid';
if (empty($pesan))                   $errors[] = 'Pesan wajib diisi';

if (!empty($errors)) {
    jsonResponse(false, implode(', ', $errors));
}

// Simpan ke DB
$pdo  = getDB();
$stmt = $pdo->prepare(
    'INSERT INTO contact_requests (nama, instansi, email, pesan, ip_address)
     VALUES (?, ?, ?, ?, ?)'
);
$stmt->execute([
    $nama,
    $instansi ?: null,
    $email,
    $pesan,
    $_SERVER['REMOTE_ADDR'] ?? null,
]);
$contactId = (int) $pdo->lastInsertId();

logAction('contact_submit', null, null, "contact_id=$contactId email=$email");

echo json_encode([
    'success' => true,
    'message' => 'Pesan Anda telah diterima! Tim kami akan menghubungi Anda segera.',
    'id'      => $contactId,
]);
