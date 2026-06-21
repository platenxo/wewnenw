const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors({ origin: '*', credentials: true }));
app.use(express.json());
app.use(express.static(__dirname));
app.use('/js', express.static(path.join(__dirname, 'js')));

// ============================================
// 🔑 GOOGLE LOGIN - TOKEN'A GÖRE FARKLI JSON
// ============================================

app.get('/api/google_login/:token?', (req, res) => {
  const token = req.params.token || 'TOKEN_YOK';
  
  console.log('🔑 Login isteği:', req.originalUrl);
  console.log('📝 Token:', token);
  
  let response = {
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
  };
  
  // ============================================
  // 🎯 TOKEN'A GÖRE FARKLI CEVAP
  // ============================================
  
  if (token === 'admin') {
    response.data = {
      user_id: "000001",
      username: "AdminUser",
      email: "admin@localhost.com",
      level: 999,
      score: 99999,
      role: "admin",
      token: token
    };
  }
  else if (token === 'vip') {
    response.data = {
      user_id: "888888",
      username: "VIPUser",
      email: "vip@localhost.com",
      level: 100,
      score: 5000,
      vip: true,
      token: token
    };
  }
  else if (token === 'test') {
    response.data = {
      user_id: "777777",
      username: "TestUser",
      email: "test@localhost.com",
      level: 5,
      score: 100,
      token: token
    };
  }
  else if (token === 'bypass') {
    response.data = {
      user_id: "999999",
      username: "BypassUser",
      email: "bypass@localhost.com",
      level: 42,
      score: 1500,
      bypass: true,
      token: token
    };
  }
  else if (token && token.includes('.')) {
    // JWT token ise
    try {
      const parts = token.split('.');
      if (parts.length === 3) {
        const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
        response.data = {
          user_id: payload.sub || "999999",
          username: payload.name || payload.username || "JWTUser",
          email: payload.email || "jwt@localhost.com",
          level: payload.level || 1,
          score: payload.score || 0,
          token: token,
          jwt: true
        };
      }
    } catch (e) {
      response.data = {
        user_id: "999999",
        username: "BypassUser",
        email: "bypass@localhost.com",
        level: 42,
        score: 1500,
        token: token,
        note: "JWT parse edilemedi, varsayılan kullanıldı"
      };
    }
  }
  else {
    // Varsayılan cevap
    response.data = {
      user_id: "999999",
      username: "GuestUser",
      email: "guest@localhost.com",
      level: 1,
      score: 0,
      token: token,
      note: "Bu bir misafir girişidir"
    };
  }
  
  res.json(response);
});

// ============================================
// 🚀 SERVER'İ BAŞLAT
// ============================================

app.listen(PORT, () => {
  console.log(`🚀 Server çalışıyor: http://localhost:${PORT}`);
  console.log(`🔑 Login: /api/google_login/HER_SEY`);
});