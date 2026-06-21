const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 8080;

// Middleware
app.use(cors({ origin: '*', credentials: true }));
app.use(express.json());

// Statik dosyalar
app.use(express.static(__dirname));
app.use('/js', express.static(path.join(__dirname, 'js')));

// ============================================
// 📢 REKLAM ENDPOINT'i - /ads?client=abc
// ============================================

app.get('/ads', (req, res) => {
  const client = req.query.client || '';
  console.log('📢 Ads isteği alındı! client:', client);
  res.send('ok');
});

// ============================================
// 📢 Google AdSense için yedek endpoint
// ============================================

app.get('/pagead/ads', (req, res) => {
  console.log('📢 Google AdSense isteği alındı');
  res.send('ok');
});

// ============================================
// 🔑 LOGIN - OYUNUN BEKLEDİĞİ FORMATTA
// ============================================

app.get('/api/google_login/:token', (req, res) => {
  const token = req.params.token || '';
  
  console.log('✅ Login isteği geldi!');
  console.log('📝 Token:', token.substring(0, 30) + '...');
  
  res.json({
    "b2b607a0c418112d": "999999",
    "8fadf06b7f": "bypass_user",
    "dbf8b2a53afe": token,
    "bf84a44a33": new Date(Date.now() + 30*24*60*60*1000).toISOString(),
    "code": 200,
    "user_id": "999999",
    "username": "BypassUser",
    "coins": 0,
    "level": 169,
    "xp": 4357572,
    "kills": 1586,
    "max_score": 2741540,
    "headshots": 905,
    "skin_id": 2258,
    "eyes_id": 390,
    "mouth_id": 327,
    "glasses_id": 0,
    "hat_id": 381,
    "name_cards": 2,
    "mail": "platwn50@gmail.com",
    "skins": [6212, 19999],
    "eyes": [999],
    "mouths": [999],
    "glasses": [999],
    "hats": [999],
    "texp": new Date(Date.now() + 7*24*60*60*1000).toISOString(),
    "premium": new Date(Date.now() + 30*24*60*60*1000).toISOString()
  });
});

// ============================================
// 📡 TÜM DİĞER API İSTEKLERİ
// ============================================

app.get('/api/*', (req, res) => {
  console.log('🎯 GET /api/*:', req.originalUrl);
  res.json({ code: 200, message: "Başarılı" });
});

app.post('/api/*', (req, res) => {
  console.log('🎯 POST /api/*:', req.originalUrl);
  res.json({ code: 200, message: "Başarılı" });
});

// ============================================
// 🏠 ANA SAYFA
// ============================================

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// ============================================
// 🚀 SERVER'İ BAŞLAT
// ============================================

app.listen(PORT, () => {
  console.log(`🚀 Server: http://localhost:${PORT}`);
  console.log(`📢 Ads: http://localhost:${PORT}/ads?client=abc`);
  console.log(`🔑 Login: /api/google_login/TOKEN`);
});