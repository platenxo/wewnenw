const express = require('express');
const http = require('http');
const WebSocket = require('ws');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server }); // WebSocket'ı HTTP sunucusuna bağla

// Statik dosyaları (index.html, game.js) ayağa kaldır
app.use(express.static(__dirname));

// CORS (Cross-Origin Resource Sharing) sorunlarını engellemek için
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    next();
});

// Oyun giriş isteği (Gateway)
app.get('/pub/wuid/:token/start', (req, res) => {
    console.log(`Giriş isteği geldi (Token: ${req.params.token})`);
    res.json({
        "server_url": `ws://${req.headers.host}`, // WebSocket adresini dinamik olarak gönder
        "game_mode": "ARENA",
        "status": "ok"
    });
});

// Ana WebSocket mantığı
wss.on('connection', (ws) => {
    console.log('⚡ Yeni oyuncu bağlandı!');
    let playerId = null; // Oyuncunun atanacak ID'si
    let gameState = {
        players: {},
        foodCount: 0,
    };

    // **1. YÜKLEME EKRANINI GEÇMEK İÇİN İLK PAKETİ GÖNDER**
    // Oyun 'Region' (Bölge) bilgilerini bekler. Bu paket sgp1 ve sgp2'yi tetikler.
    function sendRegionPacket() {
        // Örnek Bölge Bilgisi (sgp1)
        const regionData = {
            mode: 0,          // w.$e (Normal oyun)
            myId: 1,          // Oyuncunun ID'si (1 verelim)
            mapRadius: 500,   // Harita yarıçapı
            foodCount: 4000,  // Yiyecek sayısı
            maxFoodCount: 7000
        };

        const buf = Buffer.alloc(1 + 1 + 2 + 4 + 4 + 4);
        let offset = 0;
        buf.writeUInt8(0, offset); offset += 1; // Paket ID (sgp1)
        buf.writeUInt8(regionData.mode, offset); offset += 1;
        buf.writeUInt16LE(regionData.myId, offset); offset += 2;
        buf.writeFloatLE(regionData.mapRadius, offset); offset += 4;
        buf.writeFloatLE(regionData.foodCount, offset); offset += 4;
        buf.writeFloatLE(regionData.maxFoodCount, offset); offset += 4;

        ws.send(buf);
        console.log('✅ Bölge (sgp1) paketi gönderildi.');
    }

    // **2. OYUNCUYU (SOLUCANI) EKLEME PAKETİ (sgp_vg)**
    function sendPlayerPacket(id) {
        // Oyuncu ID'si 1 olarak alınır, onu kullanırız.
        const playerConfig = {
            id: id,
            team: 0,             // Takım yok
            skin: 0,             // Varsayılan skin
            eye: 0,
            mouth: 0,
            glasses: 0,
            hat: 0,
            name: `Player_${id}` // İsim
        };

        // Basit bir isim (string) için buffer hesaplama
        const nameBuffer = Buffer.from(playerConfig.name, 'utf16le');
        // Paket boyutu: 2(id) + 1(skin) + 2(eye) + 2(mouth) + 2(glasses) + 2(hat) + 1(nameLen) + nameLen*2
        const buf = Buffer.alloc(2 + 1 + 2 + 2 + 2 + 2 + 1 + nameBuffer.length);
        let offset = 0;
        buf.writeUInt16LE(playerConfig.id, offset); offset += 2;
        buf.writeUInt8(playerConfig.skin, offset); offset += 1;
        buf.writeUInt16LE(playerConfig.eye, offset); offset += 2;
        buf.writeUInt16LE(playerConfig.mouth, offset); offset += 2;
        buf.writeUInt16LE(playerConfig.glasses, offset); offset += 2;
        buf.writeUInt16LE(playerConfig.hat, offset); offset += 2;
        buf.writeUInt8(playerConfig.name.length, offset); offset += 1;
        nameBuffer.copy(buf, offset);

        ws.send(buf);
        console.log(`🧑‍🦰 Oyuncu (${playerConfig.name}) eklendi.`);
    }

    // **3. SAHTE OYUNCULAR (BOTLAR) EKLEME**
    function addBotPlayers() {
        const botCount = 10; // 10 tane bot ekleyelim
        for (let i = 2; i <= botCount + 1; i++) {
            const botConfig = {
                id: i,
                team: 0,
                skin: Math.floor(Math.random() * 100),
                eye: Math.floor(Math.random() * 100),
                mouth: Math.floor(Math.random() * 100),
                glasses: Math.floor(Math.random() * 100),
                hat: Math.floor(Math.random() * 100),
                name: `Bot_${i}`
            };

            const nameBuffer = Buffer.from(botConfig.name, 'utf16le');
            const buf = Buffer.alloc(2 + 1 + 2 + 2 + 2 + 2 + 1 + nameBuffer.length);
            let offset = 0;
            buf.writeUInt16LE(botConfig.id, offset); offset += 2;
            buf.writeUInt8(botConfig.skin, offset); offset += 1;
            buf.writeUInt16LE(botConfig.eye, offset); offset += 2;
            buf.writeUInt16LE(botConfig.mouth, offset); offset += 2;
            buf.writeUInt16LE(botConfig.glasses, offset); offset += 2;
            buf.writeUInt16LE(botConfig.hat, offset); offset += 2;
            buf.writeUInt8(botConfig.name.length, offset); offset += 1;
            nameBuffer.copy(buf, offset);

            ws.send(buf);
        }
        console.log(`🤖 ${botCount} bot eklendi.`);
    }

    // **4. OYUN DURUMUNU GÜNCELLEME (sgp_zg) - SOLUCAN KONUMLARI**
    function sendGameStateUpdate() {
        // Bu paket, oyuncuların ve botların konumlarını günceller.
        // Basitçe, tüm oyuncuları dairesel bir hareketle güncelleyelim.
        const time = Date.now() / 1000;

        // Önce mevcut oyuncu ID'sini alalım.
        if (!playerId) return;

        // Paket yapısı: Kafa ve gövde pozisyonları (Float) ve bir 'canlı' flag'i.
        const playerPositions = {};
        // Ana oyuncuyu ekle (1)
        playerPositions[playerId] = {
            headX: Math.sin(time * 0.5) * 150,
            headY: Math.cos(time * 0.5) * 150,
            tailX: Math.sin(time * 0.5 - 1) * 100,
            tailY: Math.cos(time * 0.5 - 1) * 100,
            alive: true
        };
        // Botları ekle (2'den 11'e)
        for (let i = 2; i <= 11; i++) {
            playerPositions[i] = {
                headX: Math.sin(time * 0.3 + i) * 200,
                headY: Math.cos(time * 0.4 + i) * 200,
                tailX: Math.sin(time * 0.3 - 1 + i) * 150,
                tailY: Math.cos(time * 0.4 - 1 + i) * 150,
                alive: true
            };
        }

        // Paketi oluştur (Basitleştirilmiş)
        // Her oyuncu için: 2(id) + 1(flag) + 4(headX) + 4(headY) + 4(tailX) + 4(tailY)
        // Önce paket başlığı: ID (sgp_zg) ve oyuncu sayısı
        const playerCount = Object.keys(playerPositions).length;
        const buf = Buffer.alloc(1 + 1 + playerCount * (2 + 1 + 4 + 4 + 4 + 4));
        let offset = 0;
        buf.writeUInt8(2, offset); offset += 1; // Paket ID (sgp_zg)
        buf.writeUInt8(playerCount, offset); offset += 1; // Oyuncu sayısı

        for (const [id, pos] of Object.entries(playerPositions)) {
            buf.writeUInt16LE(parseInt(id), offset); offset += 2;
            let flag = 0;
            if (pos.alive) flag |= 1;
            // Sağlık göstergesi (opsiyonel) - burada 0 olarak bırakalım
            buf.writeUInt8(flag, offset); offset += 1;
            buf.writeFloatLE(pos.headX, offset); offset += 4;
            buf.writeFloatLE(pos.headY, offset); offset += 4;
            buf.writeFloatLE(pos.tailX, offset); offset += 4;
            buf.writeFloatLE(pos.tailY, offset); offset += 4;
        }

        ws.send(buf);
    }

    // **5. SIRALAMA (LİDERLİK TABLOSU) PAKETİ (sgp_ng)**
    function sendLeaderboardUpdate() {
        // Bu paket, skor tablosunu günceller.
        const topPlayers = [
            { id: 1, score: 5000 },   // Ana oyuncu
            { id: 2, score: 4500 },
            { id: 3, score: 4000 },
            { id: 4, score: 3500 },
            { id: 5, score: 3000 },
        ];

        const buf = Buffer.alloc(1 + 2 + 1 + topPlayers.length * (2 + 4));
        let offset = 0;
        buf.writeUInt8(5, offset); offset += 1; // Paket ID (sgp_ng)
        buf.writeUInt16LE(topPlayers.length, offset); offset += 2; // Toplam oyuncu sayısı (online)
        buf.writeUInt8(topPlayers.length, offset); offset += 1; // Gösterilecek oyuncu sayısı

        for (const player of topPlayers) {
            buf.writeUInt16LE(player.id, offset); offset += 2;
            buf.writeFloatLE(player.score, offset); offset += 4;
        }

        ws.send(buf);
    }

    // Bağlantı kurulduğunda yapılacaklar
    sendRegionPacket();
    // Oyuncu ID'sini atamak için ana oyuncunun ilk mesajını bekleyelim
    // (Oyun, bağlantıdan hemen sonra 'mg' veya başka bir paket gönderebilir)

    // İstemciden gelen mesajları işle
    ws.on('message', (data) => {
        // Gelen veriyi analiz et
        try {
            const firstByte = data.readUInt8(0);
            console.log(`📩 Gelen Paket ID: ${firstByte}`);

            // Paket ID'sine göre işlem yap
            switch (firstByte) {
                case 0: // sg_pg (oyuncu hareketi vs.) - Şimdilik yoksay
                    // console.log('🔄 Hareket verisi alındı.');
                    break;
                case 3: // sg_mg (yiyecek yeme vs.) - Opsiyonel
                    // console.log('🍎 Yiyecek verisi alındı.');
                    break;
                // Ana oyuncunun ID'sini almak için 'sgp1' paketinin içindeki ID'yi yakala
                case 1: // sgp1 (Bölge bilgisi istemi, genellikle yanıt olarak gelir)
                    // Bu paketin içinde oyuncunun kendi ID'si olabilir, alalım.
                    if (data.length >= 3) {
                        const id = data.readUInt16LE(1);
                        if (id > 0) {
                            playerId = id;
                            console.log(`🆔 Ana Oyuncu ID'si alındı: ${playerId}`);
                            // Oyuncuyu ve botları ekle
                            sendPlayerPacket(playerId);
                            addBotPlayers();
                            // İlk güncellemeleri gönder
                            sendGameStateUpdate();
                            sendLeaderboardUpdate();
                        }
                    }
                    break;
                default:
                    console.log(`⚠️ Bilinmeyen paket ID'si: ${firstByte}`);
            }
        } catch (error) {
            console.error('❌ Mesaj işlenirken hata:', error);
        }
    });

    // Her 200ms'de bir oyun durumunu güncelle
    const updateInterval = setInterval(() => {
        if (playerId) {
            sendGameStateUpdate();
            sendLeaderboardUpdate();
        }
    }, 200);

    // Bağlantı kapandığında temizlik
    ws.on('close', () => {
        clearInterval(updateInterval);
        console.log('🔌 Bağlantı kapandı.');
    });

    // Hata yönetimi
    ws.on('error', (error) => {
        console.error('WebSocket Hatası:', error);
    });
});

// 8000 portunda dinle
server.listen(8000, () => {
    console.log('✅ Sunucu başarıyla 8000 portunda çalışıyor.');
});
