const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 8080;

// Middleware
app.use(cors({ origin: '*', credentials: true }));
app.use(express.json());

// ============================================
// 📁 STATİK DOSYALAR (index.html, js/ vb.)
// ============================================
app.use(express.static(__dirname));
app.use('/js', express.static(path.join(__dirname, 'js')));

// ============================================
// 🔑 GOOGLE LOGIN - SADECE JSON DÖNER
// ============================================

app.get('/api/google_login/:token?', (req, res) => {
  const token = req.params.token || 'TOKEN_YOK';
  
  console.log('🔑 Login isteği:', req.originalUrl);
  
  // Her zaman aynı JSON'u döndür
  res.json({
    status: 200,
    success: true,
    data: {
      user_id: "999999",
      username: "BypassUser",
      email: "bypass@localhost.com",
      level: 42,
      score: 1500,
      token: token,
      login_time: new Date().toISOString()
    }
  });
});

// ============================================
// 🚀 SERVER'İ BAŞLAT
// ============================================

app.listen(PORT, () => {
  console.log(`🚀 Server çalışıyor: Port ${PORT}`);
  console.log(`🔑 Login: /api/google_login/HER_SEY`);
});