const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 8080;

// Middleware
app.use(cors({ origin: '*', credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Statik dosyalar
app.use(express.static(__dirname));
app.use('/js', express.static(path.join(__dirname, 'js')));

// ============================================================
// 📢 REKLAM ENDPOINT'i - /ads?client=abc
// ============================================================

app.get('/ads', (req, res) => {
  const client = req.query.client || '';
  console.log('📢 Ads isteği alındı! client:', client);
  res.send('ok');
});

// ============================================================
// 🔑 ANA LOGIN ENDPOINT'i - OYUNUN Zb FONKSİYONU İÇİN
// ============================================================

function getLoginData(token) {
  try {
    // orjinal_login.json dosyasını oku
    const loginDataPath = path.join(__dirname, 'orjinal_login.json');
    const loginData = JSON.parse(fs.readFileSync(loginDataPath, 'utf8'));
    
    // Token'ı güncelle
    loginData["dbf8b2a53afe"] = token || loginData["dbf8b2a53afe"];
    
    return loginData;
  } catch (error) {
    console.log('📄 orjinal_login.json okunamadı, varsayılan veri kullanılıyor');
    // Dosya yoksa varsayılan veri
    return {
      "b2b607a0c418112d": "999999",
      "8fadf06b7f": "BypassUser",
      "dbf8b2a53afe": token || "bypass_token_2024",
      "bf84a44a33": new Date(Date.now() + 30*24*60*60*1000).toISOString(),
      "b0f48166c65a9fe3": "BypassUser",
      "5533a46dab153268": "BypassUser",
      "code": 200,
      "user_id": "999999",
      "username": "BypassUser",
      "coins": 999999,
      "level": 999,
      "xp": 9999999,
      "kills": 9999,
      "max_score": 9999999,
      "headshots": 9999,
      "skin_id": 1,
      "eyes_id": 1,
      "mouth_id": 1,
      "glasses_id": 0,
      "hat_id": 0,
      "name_cards": 1,
      "mail": "bypass@example.com",
      "skins": [1, 2, 3, 4, 5],
      "eyes": [1, 2, 3],
      "mouths": [1, 2, 3],
      "glasses": [0, 1],
      "hats": [0, 1, 2],
      "texp": new Date(Date.now() + 7*24*60*60*1000).toISOString(),
      "premium": new Date(Date.now() + 30*24*60*60*1000).toISOString(),
      "success": true,
      "status": 200
    };
  }
}

// ============================================================
// 🔑 LOGIN - jj FONKSİYONUNUN BEKLEDİĞİ FORMAT
// ============================================================

app.get('/api/google_login/:token', (req, res) => {
  const token = req.params.token || '';
  
  console.log('✅ Login isteği geldi!');
  console.log('📝 Token:', token.substring(0, 30) + '...');
  
  // Oyunun jj fonksiyonunun beklediği format
  const response = {
    "f0a25d2791": 200,  // we = 200 → başarılı
    "a653094dcb": getLoginData(token)  // Zb'ye gönderilecek veri
  };
  
  console.log('📤 Login cevabı gönderildi');
  res.json(response);
});

// ============================================================
// 🔑 KOD DOĞRULAMA - jj FONKSİYONUNUN ÇAĞIRDIĞI ENDPOINT
// ============================================================

app.get('/api/code_verify/:code', (req, res) => {
  const code = req.params.code || '';
  
  console.log('🔑 Kod doğrulama isteği geldi! Kod:', code);
  
  // Her kod kabul edilir (bypass)
  const response = {
    "f0a25d2791": 200,  // Başarılı
    "a653094dcb": getLoginData(code)
  };
  
  console.log('📤 Kod doğrulama cevabı gönderildi');
  res.json(response);
});

// ============================================================
// 🔑 KOD GÖNDERME - POST ile kod gönderme
// ============================================================

app.post('/api/verify_code', (req, res) => {
  const code = req.body.code || req.query.code || '';
  
  console.log('📨 POST Kod doğrulama isteği! Kod:', code);
  
  const response = {
    "f0a25d2791": 200,
    "a653094dcb": getLoginData(code)
  };
  
  res.json(response);
});

// ============================================================
// 🔑 GOOGLE LOGIN - Oyunun kullandığı format
// ============================================================

app.get('/api/auth/google', (req, res) => {
  console.log('🔑 Google Auth isteği geldi');
  
  res.json({
    "f0a25d2791": 200,
    "a653094dcb": getLoginData('google_' + Date.now())
  });
});

// ============================================================
// 📡 TÜM DİĞER API İSTEKLERİ
// ============================================================

app.get('/api/*', (req, res) => {
  console.log('🎯 GET /api/*:', req.originalUrl);
  res.json({ code: 200, message: "Başarılı" });
});

app.post('/api/*', (req, res) => {
  console.log('🎯 POST /api/*:', req.originalUrl);
  res.json({ code: 200, message: "Başarılı" });
});

// ============================================================
// 🏠 ANA SAYFA
// ============================================================

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// ============================================================
// 🚀 SERVER'İ BAŞLAT
// ============================================================

app.listen(PORT, () => {
  console.log('╔═══════════════════════════════════════════════════╗');
  console.log('║   🚀 SUNUCU BAŞARIYLA BAŞLATILDI!                ║');
  console.log('╠═══════════════════════════════════════════════════╣');
  console.log(`║   📡 Port: ${PORT}                                  ║`);
  console.log('║   📢 Ads: /ads?client=abc                        ║');
  console.log('║   🔑 Login: /api/google_login/TOKEN             ║');
  console.log('║   🔑 Kod: /api/code_verify/KOD                 ║');
  console.log('║   📄 Login JSON: orjinal_login.json             ║');
  console.log('╚═══════════════════════════════════════════════════╝');
});