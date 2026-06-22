const express = require('express');
const http = require('http');
const WebSocket = require('ws');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ port: 3000 });

// Statik dosyaları (index.html, game.js) ayağa kaldır
app.use(express.static(__dirname));

// Oyun giriş isteği (Gateway)
app.get('/pub/wuid/:token/start', (req, res) => {
    console.log("Giriş isteği geldi, sunucu adresi gönderiliyor...");
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.json({
        "server_url": "wss://didactic-invention-p7g475r997q39pww-3000.app.github.dev",
        "game_mode": "ARENA",
        "status": "ok"
    });
});

// WebSocket Dünyası (Oyun burada döner)
wss.on('connection', (ws) => {
    console.log("⚡ Bağlantı kuruldu!");

    ws.on('message', (message) => {
        // Oyunun gönderdiği her paketi konsola yazdır (debug için)
        console.log("📩 İstemci Verisi (Hex):", message.toString('hex'));
        
        // ÖNEMLİ: Oyunun 'loading' ekranını geçmesi için gereken basit bir onay paketi
        // Bu paket oyunun "bağlandım, dünyayı çizmeye hazırım" demesini sağlar
        ws.send(Buffer.from([0x00, 0x01, 0x02]));
    });
});

server.listen(8000, () => {
    console.log('Sunucu 8000 portunda aktif.');
});