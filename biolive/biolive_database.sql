-- ============================================================
--  BioLive Face Security — Database Structure
--  Import file ini ke phpMyAdmin: Database > Import > pilih file ini
-- ============================================================

CREATE DATABASE IF NOT EXISTS `biolive_db`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE `biolive_db`;

-- ─────────────────────────────────────────
-- 1. USERS — data pengguna terdaftar
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `users` (
  `id`            INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  `nama`          VARCHAR(100)    NOT NULL,
  `email`         VARCHAR(150)    NOT NULL UNIQUE,
  `instansi`      VARCHAR(150)    DEFAULT NULL,
  `role`          ENUM('admin','user') NOT NULL DEFAULT 'user',
  `face_encoding` LONGTEXT        DEFAULT NULL COMMENT 'JSON array dari face descriptor (128-float)',
  `foto_path`     VARCHAR(255)    DEFAULT NULL COMMENT 'path relatif ke foto wajah terdaftar',
  `status`        ENUM('active','inactive') NOT NULL DEFAULT 'active',
  `created_at`    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_email` (`email`),
  KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─────────────────────────────────────────
-- 2. DEMO_SESSIONS — log setiap sesi demo kamera
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `demo_sessions` (
  `id`              INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  `session_token`   VARCHAR(64)     NOT NULL UNIQUE,
  `device_info`     VARCHAR(255)    DEFAULT NULL COMMENT 'user-agent browser',
  `camera_type`     ENUM('laptop','phone','unknown') NOT NULL DEFAULT 'unknown',
  `ip_address`      VARCHAR(45)     DEFAULT NULL,
  `status`          ENUM('started','processing','verified','failed') NOT NULL DEFAULT 'started',
  `snapshot_path`   VARCHAR(255)    DEFAULT NULL COMMENT 'path foto snapshot saat demo',
  `started_at`      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `finished_at`     DATETIME        DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_token` (`session_token`),
  KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─────────────────────────────────────────
-- 3. LIVENESS_CHECKS — hasil tiap tahap deteksi
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `liveness_checks` (
  `id`                INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  `session_id`        INT UNSIGNED    NOT NULL,
  `face_detected`     TINYINT(1)      NOT NULL DEFAULT 0,
  `blink_detected`    TINYINT(1)      NOT NULL DEFAULT 0,
  `depth_analysis`    TINYINT(1)      NOT NULL DEFAULT 0,
  `finger_gesture`    TINYINT(1)      NOT NULL DEFAULT 0,
  `liveness_score`    DECIMAL(5,2)    DEFAULT NULL COMMENT 'skor 0-100',
  `is_live`           TINYINT(1)      NOT NULL DEFAULT 0 COMMENT '1=LIVE, 0=SPOOF',
  `raw_result`        JSON            DEFAULT NULL COMMENT 'hasil lengkap dari model AI',
  `checked_at`        DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_session` (`session_id`),
  CONSTRAINT `fk_liveness_session`
    FOREIGN KEY (`session_id`) REFERENCES `demo_sessions` (`id`)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─────────────────────────────────────────
-- 4. CONTACT_REQUESTS — form kontak / ajukan demo
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `contact_requests` (
  `id`          INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  `nama`        VARCHAR(100)    NOT NULL,
  `instansi`    VARCHAR(150)    DEFAULT NULL,
  `email`       VARCHAR(150)    NOT NULL,
  `pesan`       TEXT            NOT NULL,
  `status`      ENUM('new','read','replied') NOT NULL DEFAULT 'new',
  `ip_address`  VARCHAR(45)     DEFAULT NULL,
  `created_at`  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_status` (`status`),
  KEY `idx_email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─────────────────────────────────────────
-- 5. ACCESS_LOGS — audit trail semua aktivitas
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `access_logs` (
  `id`          INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  `user_id`     INT UNSIGNED    DEFAULT NULL,
  `session_id`  INT UNSIGNED    DEFAULT NULL,
  `action`      VARCHAR(100)    NOT NULL COMMENT 'contoh: demo_start, contact_submit, verified',
  `detail`      TEXT            DEFAULT NULL,
  `ip_address`  VARCHAR(45)     DEFAULT NULL,
  `user_agent`  VARCHAR(500)    DEFAULT NULL,
  `created_at`  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_user` (`user_id`),
  KEY `idx_session` (`session_id`),
  KEY `idx_action` (`action`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─────────────────────────────────────────
-- Sample data — admin user
-- ─────────────────────────────────────────
INSERT INTO `users` (`nama`, `email`, `instansi`, `role`, `status`) VALUES
('Dean', 'dean@biolive.id', 'BioLive Face Security', 'admin', 'active'),
('Cecil', 'cecil@biolive.id', 'BioLive Face Security', 'admin', 'active'),
('Iaa', 'iaa@biolive.id', 'BioLive Face Security', 'admin', 'active');
