# SHUİ Soru Bankası

Havacılık Hukuku, Müşteri İlişkileri Yönetimi ve Lojistik Yönetimi için online soru bankası ve deneme sınavı. Sunucu, veritabanı ya da kurulum gerektirmez; GitHub Pages'te ücretsiz çalışır.

## Dosyalar

```
soru-bankasi/
├── index.html    → sayfa iskeleti
├── style.css     → tasarım (koyu/açık tema)
├── app.js        → uygulama mantığı (Vanilla JS)
├── sorular.json  → soru veritabanı
├── gorseller/    → şekilli/tablolu soruların görselleri
├── manifest.webmanifest, sw.js, icons/ → telefona kurulum ve internetsiz çalışma
└── README.md     → bu kılavuz
```

**Canlı adres:** https://mrtmmk1221.github.io/shui-sinav-portali/

## Final Seferi (RPG çalışma uygulaması)

26 Aralık finaline kadar günlük görev, XP, lanetli kart ve boss savaşlarıyla çalışmak için ayrı bir uygulama: `final-seferi/` klasöründe.

**Adres:** https://mrtmmk1221.github.io/shui-sinav-portali/final-seferi/

Telefona ayrı bir uygulama olarak kurulabilir ve internetsiz çalışır.

## Telefona uygulama olarak kurma

- **Android (Chrome):** siteyi aç → üstteki **⬇ Uygulamayı yükle** butonuna bas (görünmüyorsa Chrome menüsü → *Ana ekrana ekle* / *Uygulamayı yükle*).
- **iPhone (Safari):** siteyi aç → Paylaş simgesi → **Ana Ekrana Ekle**.

Kurduktan sonra uygulama bir kez açıldığında tüm dosyalar telefona kaydedilir; internet olmadan da çalışır. İnternet varken açıldığında yeni eklenen sorular otomatik olarak gelir.

## GitHub Pages'te yayınlama

1. github.com'da **New repository** ile yeni bir depo aç (ör. `soru-bankasi`). **Public** seçili olsun.
2. Depo sayfasında **Add file → Upload files**'a tıkla, beş dosyayı sürükleyip bırak, **Commit changes** de.
3. **Settings → Pages** bölümüne gir.
4. **Source**: `Deploy from a branch`, **Branch**: `main` ve `/ (root)` seç, **Save** de.
5. 1–2 dakika sonra site şu adreste açılır: `https://KULLANICI-ADIN.github.io/soru-bankasi/`

> `index.html` dosyasını bilgisayarda çift tıklayarak açarsan sorular yüklenmez; tarayıcılar güvenlik nedeniyle yerel dosyadan `fetch()` yapılmasına izin vermez. Yerelde denemek için klasörde şu komutu çalıştır ve `http://localhost:8000` adresini aç:
>
> ```
> python -m http.server
> ```

## Yeni soru ekleme

`sorular.json` dosyasını GitHub'da aç, kalem simgesiyle düzenle. `"sorular": [` listesinin içine aşağıdaki bloğu kopyalayıp yapıştır:

```json
{
  "kategori": "Lojistik Yönetimi",
  "konu": "Stok yönetimi",
  "soru": "Soru metni buraya",
  "secenekler": ["A şıkkı", "B şıkkı", "C şıkkı", "D şıkkı", "E şıkkı"],
  "dogru": "C",
  "aciklama": "Çözüm açıklaması buraya"
},
```

| Alan | Zorunlu | Açıklama |
|---|---|---|
| `kategori` | Hayır | Ders adı. Ana ekrandaki kategori listesi bu alandan otomatik oluşur. Yeni bir ad yazarsan yeni kategori açılır. |
| `konu` | Hayır | Kategori içindeki alt başlık. Konu filtresi bu alandan oluşur. |
| `soru` | **Evet** | Soru metni. |
| `secenekler` | **Evet** | 2 ile 6 arası şık. Sırası A, B, C… olarak gösterilir. |
| `dogru` | **Evet** | Doğru şıkkın **harfi**: `"A"`, `"B"`, `"C"`, `"D"` veya `"E"`. |
| `aciklama` | Hayır | Çalışma modunda ve karnede gösterilen çözüm. |
| `kaynak` | Hayır | Sorunun nereden geldiği (ör. "Ders kitabı (ünite sonu)", "Geçmiş sınav"). Soru ekranında gösterilir. |
| `sinavSayisi` | Hayır | Sorunun geçmiş sınavlarda kaç kez çıktığı. 2 ve üzeriyse soru ekranında gösterilir. |
| `gorsel` | Hayır | Şekil veya tablo içeren sorular için resim yolu, ör. `"gorseller/depo.webp"`. Resmi `gorseller` klasörüne yükle. |
| `id` | Hayır | Yazmazsan soru metninden otomatik üretilir. |

Kurallar:

- Bloklar arasına **virgül** koy, **son bloktan sonra virgül koyma**.
- Metin içinde çift tırnak kullanacaksan başına ters eğik çizgi koy: `\"örnek\"`.
- Kaydetmeden önce dosyayı [jsonlint.com](https://jsonlint.com) adresinde kontrol edebilirsin. Hatalı bir soru uygulamayı bozmaz, yalnızca atlanır (tarayıcı konsolunda uyarı görünür).
- Bir sorunun metnini değiştirirsen ve `id` vermediysen, o soru için kayıtlı istatistikler sıfırlanır.

## Ayarlar

`sorular.json` dosyasının başındaki alanlar:

- `baslik`: üst menüde görünen ad
- `aciklama`: başlığın altındaki kısa yazı
- `soruBasinaSaniye`: sınav modunda soru başına süre (varsayılan 75 sn; 20 soru = 25 dakika)

## Uygulama dosyalarını değiştirirsen

`app.js`, `style.css` veya `index.html` üzerinde değişiklik yaptıysan ya da `gorseller` klasörüne resim eklediysen `sw.js` dosyasının başındaki `SURUM` değerini artır (ör. `shui-v4`). Yeni resmi `sw.js` içindeki `DOSYALAR` listesine de ekle. Böylece telefona kurulu uygulama yeni sürümü alır. Sadece `sorular.json` değiştiyse buna gerek yok.

## Veriler nerede saklanıyor?

İstatistikler, yanlışlar ve test geçmişi tarayıcının `localStorage` alanında tutulur. Başka cihaz veya tarayıcıya taşınmaz. Tarayıcı verilerini silersen ilerleme de silinir.
