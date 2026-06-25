// ════════════════════════════════════════════════════════════
//  PATCH index.html — Ganti step 4 simulasi dengan liveness.js
//  Tambahkan di index.html:
//    1. <script src="liveness.js"></script> sebelum <script> utama
//    2. Ganti blok demoBtn.addEventListener('click', ...) dengan ini:
// ════════════════════════════════════════════════════════════

demoBtn.addEventListener('click', async () => {
  if (demoRunning) return;

  // 1. Pastikan kamera aktif
  if (!stream) { await startCamera(); }
  if (!stream)  { return; }

  demoRunning = true;
  demoBtn.textContent       = '⏳  PROCESSING...';
  demoBtn.style.background  = 'var(--surface2)';
  demoBtn.style.color       = 'var(--muted)';
  scanOverlay.style.display = 'block';
  resetStatus();

  try {
    // 2. Buat sesi di backend
    const startRes = await fetch(`${BASE_URL}/demo_start.php`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ camera_type: selectedCamera }),
    }).then(r => r.json()).catch(() => null);

    if (startRes?.success) {
      sessionToken = startRes.session_token;
      sessionInfoEl.textContent = 'Session: ' + sessionToken.substring(0, 16) + '...';
    }

    // 3. Jalankan liveness check NYATA via Claude Vision
    const livenessResult = await runLivenessCheck(video, canvas, {
      onStep: (id, ok) => setStatus(id, ok),
    });

    // 4. Simpan snapshot ke backend (opsional, silent fail)
    const snap = captureSnapshot();
    if (snap && sessionToken) {
      fetch(`${BASE_URL}/demo_snapshot.php`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ session_token: sessionToken, image: snap }),
      }).catch(() => {});
    }

    // 5. Kirim hasil ke backend
    if (sessionToken) {
      fetch(`${BASE_URL}/demo_check.php`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          session_token:  sessionToken,
          face_detected:  livenessResult.details?.analysis?.face_detected  ? 1 : 0,
          blink_detected: livenessResult.details?.analysis?.is_real_human  ? 1 : 0,
          depth_analysis: livenessResult.details?.analysis2?.is_real_human ? 1 : 0,
          finger_gesture: (livenessResult.details?.motionScore ?? 0) > 1.5  ? 1 : 0,
          is_live:        livenessResult.passed ? 1 : 0,
        }),
      }).catch(() => {});
    }

    // 6. Tampilkan hasil akhir
    await delay(300);
    if (livenessResult.passed) {
      resultStatus.textContent = 'LIVE PERSON VERIFIED ✓';
      resultStatus.style.color = 'var(--accent2)';
    } else {
      resultStatus.textContent = '✗ ' + (livenessResult.reason || 'VERIFIKASI GAGAL');
      resultStatus.style.color = 'var(--warn)';
    }

  } catch (e) {
    console.error('Demo error:', e);
    resultStatus.textContent = 'ERROR — COBA LAGI';
    resultStatus.style.color = 'var(--warn)';
  }

  // 7. Reset tombol
  await delay(400);
  scanOverlay.style.display = 'none';
  demoBtn.textContent       = '▶  MULAI DEMO';
  demoBtn.style.background  = '';
  demoBtn.style.color       = '';
  demoRunning = false;
});
