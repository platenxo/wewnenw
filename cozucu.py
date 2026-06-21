import os
import json
import urllib.parse  # URL decode işlemi için gerekli kütüphane

def wormzilla_hepsini_coz():
    girdi_yolu = os.path.join(os.path.dirname(__file__), 'login')
    cikti_yolu = os.path.join(os.path.dirname(__file__), 'orijinal_ewf.json')

    if not os.path.exists(girdi_yolu):
        print("[-] Hata: 'registry.wormzilla' dosyası masaüstünde bulunamadı!")
        return

    try:
        # 1. Dosyadaki ham hex verisini oku
        with open(girdi_yolu, 'r', encoding='utf-8') as f:
            hex_veri = f.read().strip().replace(' ', '').replace('\n', '').replace('\r', '')
        
        print(f"[+] Şifreli veri okundu. Karakter sayısı: {len(hex_veri)}")

        # 2. Matematiksel döngü ile XOR şifresini çöz
        ham_metin = ""
        t = int(hex_veri[0:2], 16)
        
        for s in range(2, len(hex_veri), 2):
            r = int(hex_veri[s:s+2], 16)
            t = (3793 + 4513 * t) & 255
            ham_metin += chr(r ^ t)

        print("[+] Şifre çözüldü. URL Decode işlemi uygulanıyor...")

        # 3. Yüzdelik (%22, %7B vb.) kodları normal metne çevir (decodeURIComponent)
        orijinal_metin = urllib.parse.unquote(ham_metin)

        # 4. JSON formatına dönüştür ve hizalayarak kaydet
        try:
            json_objesi = json.loads(orijinal_metin)
            with open(cikti_yolu, 'w', encoding='utf-8') as out:
                json.dump(json_objesi, out, indent=4, ensure_ascii=False)
            print(f"\n[✔] BAŞARILI! Dosya tamamen orijinal ve okunabilir hale getirildi.")
            print(f"[->] Konum: {cikti_yolu}")
        except json.JSONDecodeError:
            # JSON hatası verirse düz metin olarak kaydet
            with open(cikti_yolu, 'w', encoding='utf-8') as out:
                out.write(orijinal_metin)
            print(f"\n[!] Veri çözüldü ve decode edildi ancak JSON yapısında hata var.")
            print(f"[->] Düz metin olarak kaydedildi: {cikti_yolu}")

    except Exception as e:
        print(f"[-] Bir hata oluştu: {e}")

if __name__ == "__main__":
    wormzilla_hepsini_coz()