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
// 🔑 LOGIN - OYUNUN BEKLEDİĞİ FORMATTA
// ============================================

app.get('/api/google_login/:token', (req, res) => {
  const token = req.params.token || '';
  
  console.log('✅ Login isteği geldi!');
  console.log('📝 Token:', token.substring(0, 30) + '...');
  
  // ============================================
  // 📋 OYUNUN Zb FONKSİYONUNUN BEKLEDİĞİ FORMAT
  // ============================================
  
  res.json({
    // Zb fonksiyonunun beklediği alanlar
    "b2b607a0c418112d": "999999",        // k.Fc = user_id
    "8fadf06b7f": "bypass_user",          // k.uf = username
    "dbf8b2a53afe": token,                // D["1ak"] = token
    "bf84a44a33": new Date(Date.now() + 30*24*60*60*1000).toISOString(), // premium bitiş
    
    // Ek olarak oyunun kullanabileceği diğer alanlar
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
  console.log(`🔑 Login: /api/google_login/TOKEN`);
});