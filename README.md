# Görev Eklentisi — Outlook için görev atama ve takip

Outlook içinde, e-posta gönderir gibi görev verilir; görevi alan Kabul / İş Kaydı / Tamamla ile yanıtlar, ilerleme
liste, kanban ve Gantt görünümlerinde izlenir. Sunucu gerekmez; görevler posta kutusunda durur.

## Hangi Outlook'u kullanıyorsunuz?

**İndirme sayfası (platforma göre yönlendirir):** https://caglarutkuguler.github.io/gorev-eklentisi-dagitim/

| | Outlook'unuz | İndirilecek dosya | Sonra |
| --- | --- | --- | --- |
| 🖥️ | **Windows — klasik Outlook** (üst menüde *Dosya* sekmesi var) | **[GorevEklentisi-Kurulum.exe](https://github.com/caglarutkuguler/gorev-eklentisi-dagitim/releases/latest/download/GorevEklentisi-Kurulum.exe)** | Çift tıklanıp kurulur |
| 💻 | **Mac için Outlook** | **[manifest.xml](https://github.com/caglarutkuguler/gorev-eklentisi-dagitim/releases/latest/download/manifest.xml)** | Outlook'un Eklentiler penceresi ([iş/okul hesabı](https://outlook.office.com/mail/inclientstore) · [kişisel hesap](https://outlook.live.com/mail/0/inclientstore)) → Eklentilerim → Özel eklenti ekle → Dosyadan ekle |
| 🖥️ | **Windows — yeni Outlook** (*Dosya* sekmesi yok) | **[manifest.xml](https://github.com/caglarutkuguler/gorev-eklentisi-dagitim/releases/latest/download/manifest.xml)** | Aynı adımlar |
| 🌐 | **Outlook web** (outlook.office.com, outlook.com) | **[manifest.xml](https://github.com/caglarutkuguler/gorev-eklentisi-dagitim/releases/latest/download/manifest.xml)** | Aynı adımlar |
| 🐧 | **Linux / Outlook kurulu değil** | Dosya gerekmez | [Tarayıcıda aç](https://caglarutkuguler.github.io/gorev-eklentisi-dagitim/eklenti/) |

- `manifest.xml` çalıştırılmaz ve açılmaz; yalnızca Outlook'a yüklenir. Ayrıntılı adımlar: [Mac, web ve yeni Outlook kurulumu](https://caglarutkuguler.github.io/gorev-eklentisi-dagitim/web-kurulum.html)
- Mac, yeni Outlook, web ve tarayıcı sürümü Microsoft 365 / Outlook.com posta kutusu gerektirir. IMAP, POP ve Gmail hesapları yalnızca Windows kurulum paketiyle kullanılabilir.
- Farklı sürümleri kullananlar birbirine görev verebilir.

## Windows kurulum paketi

**[⬇ GorevEklentisi-Kurulum.exe — sürüm 0.1.41](https://github.com/caglarutkuguler/gorev-eklentisi-dagitim/releases/latest/download/GorevEklentisi-Kurulum.exe)**

Güncel sürüm: **0.1.41** · 13.11.2026 10:11 (Türkiye saati)

Bu bağlantı her zaman en son sürümü indirir.

## Kurulum

1. Outlook'ta kaydedilmemiş taslak varsa kaydedilir (kurulum Outlook'u kapatır).
2. İndirilen `GorevEklentisi-Kurulum.exe` çift tıklanır.
3. "Windows bilgisayarınızı korudu" uyarısı çıkarsa **Ek bilgi → Yine de çalıştır** seçilir.
4. "Bu uygulamanın cihazınızda değişiklik yapmasına izin verilsin mi?" sorusuna **Evet** denir (yönetici onayı gerekir).
5. Kurulum bitince pencere **Kapat** ile kapatılır; Outlook açılır ve kılavuz sayfası bir kez gösterilir.

Outlook'un **Giriş** sekmesinde **Görev** grubu görünüyorsa kurulum tamamdır.

## Gereksinimler

- Windows 10 / 11
- Outlook 2016, 2019, 2021 ya da Microsoft 365 (klasik masaüstü Outlook; yeni Outlook, Mac ve web için yukarıdaki web eklentisi)
- Gerekli Microsoft bileşenleri (VSTO Runtime, WebView2) eksikse kurulum kendisi kurar

## Güncelleme

Eklenti yeni sürümü günde bir kez denetler; yayınlandığında Görev grubunda **Yeni sürüm** düğmesi belirir. Düğme kurulum
dosyasını indirir; dosya çalıştırılınca eski sürümün üzerine kurulur. Görevler ve ayarlar korunur.
Elle denetim: **Görev → Araçlar → Güncellemeleri Denetle**.

## Kullanım ve kaldırma

- Kullanım kılavuzu: https://caglarutkuguler.github.io/gorev-eklentisi-dagitim/kilavuz.html (eklentide: **Görev → Yardım**)
- Kaldırma: **Görev → Araçlar → Eklentiyi Kaldır…** ya da Windows **Ayarlar → Uygulamalar**

## Kurum içi dağıtım (BT)

Sessiz kurulum için MSI: [GorevEklentisi.msi](https://github.com/caglarutkuguler/gorev-eklentisi-dagitim/releases/latest/download/GorevEklentisi.msi)
(`msiexec /i GorevEklentisi.msi /qn`). MSI yalnızca eklentiyi kurar; VSTO Runtime ve WebView2 ayrıca dağıtılır.
Otomatik sürüm denetimini kapatmak için: `HKLM\Software\Policies\NCU\GorevEklentisi` → `GuncellemeDenetimi` (DWORD) = `0`.

Geliştirici: NCU

