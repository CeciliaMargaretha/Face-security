// ════════════════════════════════════════════════════════════
//  liveness.js — Anti-Spoofing Liveness Detection
//  Pakai face-api.js, 100% gratis, no API key
// ════════════════════════════════════════════════════════════

const MODELS_URL = './models';
let faceApiLoaded = false;

async function loadFaceApiModels() {
  if (faceApiLoaded) return true;
  try {
    await Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(MODELS_URL),
      faceapi.nets.faceLandmark68Net.loadFromUri(MODELS_URL),
      faceapi.nets.faceExpressionNet.loadFromUri(MODELS_URL),
    ]);
    faceApiLoaded = true;
    return true;
  } catch (err) {
    console.error('Gagal load model:', err);
    return false;
  }
}

async function detectFace(video) {
  const options = new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 });
  return await faceapi
    .detectSingleFace(video, options)
    .withFaceLandmarks()
    .withFaceExpressions();
}

/** Capture frame → ImageData (downscale untuk kecepatan) */
function captureFrameData(video, canvas, scale = 0.5) {
  if (!video.videoWidth) return null;
  const w = Math.floor(video.videoWidth  * scale);
  const h = Math.floor(video.videoHeight * scale);
  canvas.width  = w;
  canvas.height = h;
  canvas.getContext('2d').drawImage(video, 0, 0, w, h);
  return canvas.getContext('2d').getImageData(0, 0, w, h);
}

/** Motion score antar dua frame */
function computeMotion(d1, d2) {
  let diff = 0;
  for (let i = 0; i < d1.data.length; i += 16) {
    diff += Math.abs(d1.data[i]   - d2.data[i]);
    diff += Math.abs(d1.data[i+1] - d2.data[i+1]);
    diff += Math.abs(d1.data[i+2] - d2.data[i+2]);
  }
  return diff / (d1.data.length / 16);
}

/**
 * Analisis tekstur — deteksi apakah permukaan "flat" (foto)
 * Foto punya variasi warna sangat seragam (kurang noise natural kulit)
 * Kulit manusia asli punya variasi tekstur micro yang lebih tinggi
 */
function analyzeTexture(imgData, canvas) {
  const { data, width, height } = imgData;
  
  // Ambil area tengah (area wajah kemungkinan besar di sini)
  const cx = Math.floor(width  / 2);
  const cy = Math.floor(height / 2);
  const size = Math.floor(Math.min(width, height) * 0.3);
  
  let gradientSum = 0;
  let count = 0;
  
  for (let y = cy - size; y < cy + size; y += 2) {
    for (let x = cx - size; x < cx + size; x += 2) {
      if (x <= 0 || x >= width - 1 || y <= 0 || y >= height - 1) continue;
      
      const idx = (y * width + x) * 4;
      const idxR = (y * width + (x+1)) * 4;
      const idxD = ((y+1) * width + x) * 4;
      
      // Gradient horizontal + vertikal (Sobel sederhana)
      const gx = Math.abs(data[idx] - data[idxR]) +
                 Math.abs(data[idx+1] - data[idxR+1]) +
                 Math.abs(data[idx+2] - data[idxR+2]);
      const gy = Math.abs(data[idx] - data[idxD]) +
                 Math.abs(data[idx+1] - data[idxD+1]) +
                 Math.abs(data[idx+2] - data[idxD+2]);
      
      gradientSum += Math.sqrt(gx*gx + gy*gy);
      count++;
    }
  }
  
  return count > 0 ? gradientSum / count : 0;
}

/**
 * Analisis variasi warna di area wajah
 * Foto tercetak / di layar cenderung punya saturasi tidak natural
 * atau terlalu uniform dibanding kulit asli
 */
function analyzeColorVariance(imgData) {
  const { data, width, height } = imgData;
  const cx = Math.floor(width  / 2);
  const cy = Math.floor(height / 2);
  const size = Math.floor(Math.min(width, height) * 0.25);
  
  const rVals = [], gVals = [], bVals = [];
  
  for (let y = cy - size; y < cy + size; y += 3) {
    for (let x = cx - size; x < cx + size; x += 3) {
      if (x < 0 || x >= width || y < 0 || y >= height) continue;
      const idx = (y * width + x) * 4;
      rVals.push(data[idx]);
      gVals.push(data[idx+1]);
      bVals.push(data[idx+2]);
    }
  }
  
  const variance = (arr) => {
    const mean = arr.reduce((a,b) => a+b, 0) / arr.length;
    return arr.reduce((s, v) => s + (v - mean) ** 2, 0) / arr.length;
  };
  
  return (variance(rVals) + variance(gVals) + variance(bVals)) / 3;
}

/**
 * Analisis pola gerakan — foto yang dipegang bergerak "rigid" (translasi murni)
 * Manusia asli punya micro-expression + gerakan tidak beraturan
 */
function analyzeMotionPattern(frames) {
  if (frames.length < 3) return { isRigid: true, variance: 0 };
  
  const scores = [];
  for (let i = 1; i < frames.length; i++) {
    scores.push(computeMotion(frames[i-1], frames[i]));
  }
  
  const mean = scores.reduce((a,b) => a+b, 0) / scores.length;
  const variance = scores.reduce((s,v) => s + (v - mean)**2, 0) / scores.length;
  
  // Gerakan rigid (foto dipegang): variance rendah, score hampir sama tiap frame
  // Gerakan manusia: variance lebih tinggi karena tidak perfectly still
  const isRigid = variance < 0.8 && mean > 0;
  
  return { isRigid, variance, mean, scores };
}

function isFaceSizeSufficient(detection, videoWidth, videoHeight) {
  const box = detection.detection.box;
  const ratio = (box.width * box.height) / (videoWidth * videoHeight);
  return ratio >= 0.03;
}

/**
 * ─── FUNGSI UTAMA ───────────────────────────────────────────
 */
async function runLivenessCheck(video, canvas, callbacks = {}) {
  const { onStep = () => {}, onResult = () => {} } = callbacks;
  const result = { passed: false, reason: '', details: {} };

  if (!video || !video.videoWidth) {
    result.reason = 'Kamera tidak aktif atau belum siap.';
    onResult(result);
    return result;
  }

  const modelsOk = await loadFaceApiModels();
  if (!modelsOk) {
    result.reason = 'Gagal memuat model deteksi wajah. Pastikan folder models/ tersedia.';
    onResult(result);
    return result;
  }

  // ── STEP 1: Deteksi Wajah ─────────────────────────────────
  onStep('st-face', false);
  await delay(300);

  const detection1 = await detectFace(video);
  if (!detection1 || !isFaceSizeSufficient(detection1, video.videoWidth, video.videoHeight)) {
    result.reason = !detection1
      ? 'Tidak ada wajah terdeteksi. Pastikan wajah terlihat jelas di kamera.'
      : 'Wajah terlalu jauh. Dekati kamera.';
    onResult(result);
    return result;
  }
  onStep('st-face', true);
  result.details.score1 = detection1.detection.score;

  // ── STEP 2: Analisis Tekstur (anti foto) ──────────────────
  await delay(400);
  onStep('st-blink', false);

  const frame1 = captureFrameData(video, canvas, 0.6);
  if (!frame1) {
    result.reason = 'Gagal mengambil frame untuk analisis.';
    onResult(result);
    return result;
  }

  const textureScore   = analyzeTexture(frame1, canvas);
  const colorVariance  = analyzeColorVariance(frame1);
  result.details.textureScore  = textureScore;
  result.details.colorVariance = colorVariance;

  // Foto tercetak: texture rendah (< 8), color variance rendah (< 200)
  // Foto di layar HP/monitor: texture sedang tapi color variance sangat tinggi (> 2000) atau sangat rendah
  // Kulit manusia asli: texture 8–60, color variance 200–1800
  const textureOk      = textureScore >= 7;
  const colorOk        = colorVariance >= 150 && colorVariance <= 2200;
  const antiPhotoOk    = textureOk && colorOk;

  onStep('st-blink', antiPhotoOk);

  if (!antiPhotoOk) {
    if (!textureOk) {
      result.reason = 'Permukaan terlalu flat — terdeteksi sebagai foto atau gambar.';
    } else {
      result.reason = 'Warna tidak natural — kemungkinan foto di layar atau cetakan.';
    }
    onResult(result);
    return result;
  }

  // ── STEP 3: Kumpulkan multiple frame untuk motion analysis ─
  await delay(300);
  onStep('st-depth', false);

  const motionFrames = [frame1];
  for (let i = 0; i < 3; i++) {
    await delay(350);
    const f = captureFrameData(video, canvas, 0.6);
    if (f) motionFrames.push(f);
  }

  const motionPattern = analyzeMotionPattern(motionFrames);
  result.details.motion = motionPattern;

  // Foto dipegang: gerakan ada tapi rigid (variance rendah)
  // Tidak ada gerakan sama sekali: mean sangat kecil (< 1) → foto di tripod / ditempel
  // Manusia: ada gerakan natural dengan variance lebih tinggi
  const totalMotion = motionPattern.mean || 0;
  const motionVariance = motionPattern.variance || 0;

  const hasMotion   = totalMotion > 1.2;          // ada gerakan
  const notRigid    = !motionPattern.isRigid || motionVariance > 0.5; // bukan gerakan rigid
  const notVideoLoop = totalMotion < 90;           // bukan video dengan noise tinggi
  const depthOk     = hasMotion && notRigid && notVideoLoop;

  onStep('st-depth', depthOk);

  if (!depthOk) {
    if (!hasMotion) {
      result.reason = 'Tidak ada gerakan — kemungkinan foto statis atau gambar diam.';
    } else if (motionPattern.isRigid) {
      result.reason = 'Gerakan terlalu kaku — kemungkinan foto yang dipegang atau digerakkan.';
    } else {
      result.reason = 'Gerakan tidak wajar — kemungkinan video yang diputar.';
    }
    onResult(result);
    return result;
  }

  // ── STEP 4: Konfirmasi wajah masih ada + cek ekspresi ─────
  await delay(300);
  onStep('st-finger', false);

  const detection2 = await detectFace(video);
  if (!detection2) {
    result.reason = 'Wajah tidak terdeteksi konsisten. Jaga posisi wajah di kamera.';
    onResult(result);
    return result;
  }

  // Cek ada ekspresi yang terdeteksi (foto biasanya "neutral" sempurna)
  const expressions   = detection2.expressions;
  const topExpression = Object.entries(expressions).sort((a,b) => b[1]-a[1])[0];
  const expressionConf = topExpression ? topExpression[1] : 0;

  // Foto biasanya dominant "neutral" dengan confidence sangat tinggi (> 0.97)
  // Manusia biasanya neutral tapi confidence tidak sempurna
  const neutralConf    = expressions.neutral || 0;
  const photoNeutral   = neutralConf > 0.97; // terlalu sempurna → foto
  const confirmOk      = !photoNeutral && isFaceSizeSufficient(detection2, video.videoWidth, video.videoHeight);

  onStep('st-finger', confirmOk);
  result.details.expressions = expressions;

  if (!confirmOk) {
    result.reason = photoNeutral
      ? 'Ekspresi terlalu sempurna — kemungkinan foto atau gambar.'
      : 'Konfirmasi wajah gagal. Coba lagi.';
    onResult(result);
    return result;
  }

  // ── SEMUA PASS ────────────────────────────────────────────
  result.passed = true;
  result.reason  = 'Wajah manusia sungguhan terverifikasi.';
  onResult(result);
  return result;
}

function delay(ms) {
  return new Promise(r => setTimeout(r, ms));
}
