# BioLive Face Security — Setup Guide

## Struktur File
```
biolive/
├── index.html                  ← Website utama (sudah terintegrasi)
├── biolive_database.sql        ← Import ke phpMyAdmin
├── config/
│   └── database.php            ← Konfigurasi koneksi DB
├── api/
│   ├── demo_start.php          ← POST: mulai sesi demo
│   ├── demo_check.php          ← POST: simpan hasil liveness
│   ├── demo_snapshot.php       ← POST: simpan foto dari kamera
│   ├── demo_status.php         ← GET: cek status sesi
│   └── contact.php             ← POST: form kontak
└── uploads/
    └── snapshots/              ← Foto snapshot tersimpan di sini
```

---

## Langkah Setup di XAMPP / WAMP / Laragon

### 1. Letakkan folder di htdocs
Salin seluruh folder `biolive/` ke:
- XAMPP  → `C:\xampp\htdocs\biolive\`
- WAMP   → `C:\wamp64\www\biolive\`
- Laragon → `C:\laragon\www\biolive\`

### 2. Import Database ke phpMyAdmin
1. Buka browser → `http://localhost/phpmyadmin`
2. Klik **New** → buat database bernama `biolive_db`
   (atau biarkan SQL yang buat otomatis)
3. Pilih tab **Import**
4. Klik **Choose File** → pilih `biolive_database.sql`
5. Klik **Go / Import**
6. Selesai — 5 tabel akan terbuat

### 3. Sesuaikan Kredensial Database
Buka `config/database.php` dan ubah:
```php
define('DB_USER', 'root');   // username phpMyAdmin Anda
define('DB_PASS', '');       // password phpMyAdmin Anda (default: kosong)
```

### 4. Akses Website
Buka browser → `http://localhost/biolive/index.html`

---

## Cara Demo Kamera
1. Scroll ke bagian **Live Demo**
2. Pilih **KAMERA LAPTOP** atau **KAMERA HP**
3. Browser akan minta izin kamera → klik **Allow / Izinkan**
4. Klik tombol **MULAI DEMO**
5. Sistem akan memproses 4 tahap liveness detection
6. Hasil + snapshot tersimpan otomatis ke database

### Kamera HP (via browser)
- Buka `http://[IP-laptop]:80/biolive/index.html` dari HP
- Pastikan laptop dan HP satu jaringan WiFi
- Cari IP laptop: buka CMD → ketik `ipconfig`
- Pilih **KAMERA HP** → izinkan kamera → demo

---

## Tabel Database

| Tabel | Fungsi |
|-------|--------|
| `users` | Data pengguna & encoding wajah |
| `demo_sessions` | Log setiap sesi demo kamera |
| `liveness_checks` | Hasil tiap tahap deteksi |
| `contact_requests` | Pengiriman form kontak |
| `access_logs` | Audit trail semua aktivitas |

---

## API Endpoints

| Method | URL | Fungsi |
|--------|-----|--------|
| POST | `/api/demo_start.php` | Buat sesi demo baru |
| POST | `/api/demo_check.php` | Simpan hasil liveness |
| POST | `/api/demo_snapshot.php` | Upload foto kamera |
| GET  | `/api/demo_status.php?token=XXX` | Cek status sesi |
| POST | `/api/contact.php` | Submit form kontak |

---

## Catatan
- Website tetap berfungsi penuh **tanpa backend** (offline mode)
  jika PHP tidak aktif — kamera tetap jalan, hanya data tidak tersimpan
- Snapshot tersimpan di folder `uploads/snapshots/`
- Semua aktivitas tercatat di tabel `access_logs`
