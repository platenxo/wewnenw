// ============================================
// 🔓 WORMZILLA ŞİFRE ÇÖZÜCÜ - NODE.JS VERSİYONU
// ============================================

const fs = require('fs');
const path = require('path');

// ============================================
// 📋 ANA FONKSİYON
// ============================================

function wormzillaHepsiniCoz() {
    const girdiYolu = path.join(__dirname, 'login');
    const ciktiYolu = path.join(__dirname, 'orijinal_lein.json');

    // 1️⃣ Dosya var mı kontrol et
    if (!fs.existsSync(girdiYolu)) {
        console.log('❌ Hata: "login" dosyası bulunamadı!');
        return;
    }

    try {
        // 2️⃣ Ham hex verisini oku
        let hexVeri = fs.readFileSync(girdiYolu, 'utf8')
            .trim()
            .replace(/ /g, '')
            .replace(/\n/g, '')
            .replace(/\r/g, '');

        console.log(`✅ Şifreli veri okundu. Karakter sayısı: ${hexVeri.length}`);

        // 3️⃣ Matematiksel döngü ile XOR şifresini çöz
        let hamMetin = '';
        let t = parseInt(hexVeri.substring(0, 2), 16);

        for (let s = 2; s < hexVeri.length; s += 2) {
            const r = parseInt(hexVeri.substring(s, s + 2), 16);
            t = (3793 + 4513 * t) & 255;
            hamMetin += String.fromCharCode(r ^ t);
        }

        console.log('✅ Şifre çözüldü. URL Decode işlemi uygulanıyor...');

        // 4️⃣ URL decode (decodeURIComponent)
        let orijinalMetin = decodeURIComponent(hamMetin);

        // 5️⃣ JSON formatına dönüştür ve kaydet
        try {
            const jsonObjesi = JSON.parse(orijinalMetin);
            fs.writeFileSync(ciktiYolu, JSON.stringify(jsonObjesi, null, 4), 'utf8');
            console.log(`\n✅ BAŞARILI! Dosya orijinal ve okunabilir hale getirildi.`);
            console.log(`📁 Konum: ${ciktiYolu}`);
        } catch (jsonError) {
            // JSON değilse düz metin olarak kaydet
            fs.writeFileSync(ciktiYolu, orijinalMetin, 'utf8');
            console.log(`\n⚠️ Veri çözüldü ancak JSON yapısında hata var.`);
            console.log(`📁 Düz metin olarak kaydedildi: ${ciktiYolu}`);
        }

    } catch (error) {
        console.log(`❌ Bir hata oluştu: ${error.message}`);
    }
}

// ============================================
// 🚀 ÇALIŞTIR
// ============================================

wormzillaHepsiniCoz();