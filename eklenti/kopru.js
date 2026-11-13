/* Görev Eklentisi (web) — arayüz köprüsü. Windows eklentisinde app.js, C# tarafına WebView2 iletileriyle bağlanır
   (UI/WebKoprusu.cs); burada aynı komutlar tarayıcıda, Microsoft Graph üzerinden posta kutusuna karşı çalışır.
   app.js değişmeden kullanılır: window.GorevKoprusu tanımlıysa köprü olarak onu alır. */
(function (kok) {
  'use strict';
  const C = kok.GorevCekirdek, G = kok.GorevGraph, F = kok.GorevFormlar;
  const SURUM = (kok.GorevYapilandirma && kok.GorevYapilandirma.surum) || '0.0.0';
  const dinleyiciler = [];
  const yay = (olay, veri) => { for (const d of dinleyiciler) try { d(olay, veri); } catch (e) { console.error(e); } };
  const gunluk = { bilgi: m => console.info('[görev]', m), uyari: m => console.warn('[görev]', m), hata: (m, e) => console.error('[görev]', m, e || '') };
  const el = (etiket, oz, ...cocuklar) => { const e = document.createElement(etiket); for (const k in oz || {}) { if (k === 'class') e.className = oz[k]; else if (k.startsWith('on')) e.addEventListener(k.slice(2), oz[k]); else e.setAttribute(k, oz[k]); } e.append(...cocuklar.filter(c => c != null)); return e; };

  let servis = null, ben = null, office = false, posta = null;
  const hk = () => C.norm(ben.eposta);
  const paket = g => g ? Object.assign({}, g, { hk: hk(), benEposta: ben.eposta }) : null;

  // ------------------------------------------------------------------ açılış perdesi ve durum çubuğu
  const perde = el('div', { id: 'webPerde', class: 'web-perde' });
  function perdeGoster(baslik, metin, ...ekler) {
    perde.replaceChildren(el('div', { class: 'web-perde-kutu' }, el('img', { src: 'ncu-logo.png', alt: '', class: 'web-perde-logo' }), el('h1', null, baslik), ...String(metin || '').split('\n').map(p => el('p', null, p)), ...ekler.filter(Boolean)));
    if (!perde.isConnected) document.body.append(perde);
  }
  const perdeKaldir = () => perde.remove();

  const durumKutusu = el('span', { class: 'web-durum', 'aria-live': 'polite' });
  function durum(metin, hata) { durumKutusu.textContent = metin || ''; durumKutusu.classList.toggle('hata', !!hata); }

  function cubukKur() {
    const cubuk = el('div', { class: 'web-cubuk' }, durumKutusu,
      el('span', { class: 'web-hesap', title: 'Görevlerin tutulduğu posta kutusu' }, ben.eposta),
      office ? el('a', { href: new URL('index.html', location.href).href, target: '_blank', rel: 'noopener', class: 'web-baglanti', title: 'Kanban, Gantt ve yük görünümleri için geniş pencere' }, 'Tarayıcıda aç ↗') : null,
      !office && G.oturumKapat && !kok.__gorevDeneme ? el('button', { type: 'button', class: 'web-baglanti', onclick: () => G.oturumKapat() }, 'Çıkış') : null);
    (document.querySelector('.alt-imza') || document.body).append(cubuk); // alt bilgi satırının sağında
    document.body.classList.add('web', office ? 'web-office' : 'web-tarayici');
  }

  // ------------------------------------------------------------------ başlatma
  async function baslat() {
    perdeGoster('Görevler', 'Yükleniyor…');
    const deneme = kok.__gorevDeneme; // otomatik testler: oturum ve Graph yerine sahte posta
    if (deneme) { ben = deneme.ben; posta = deneme.posta; office = !!deneme.office; }
    else {
      let r;
      try { r = await G.oturumBaslat(); }
      catch (e) {
        if (e.kod === 'yapilandirma') perdeGoster('Kurulum tamamlanmadı', 'Eklentinin Microsoft hesabıyla çalışabilmesi için uygulama kaydı kimliği henüz tanımlanmamış.\nYönetici: KURULUM belgesindeki "Uygulama kaydı" adımı.');
        else if (e.kod === 'naa-yok') perdeGoster('Bu Outlook sürümünde açılamıyor', e.message, el('a', { class: 'web-dugme', href: new URL('index.html', location.href).href, target: '_blank', rel: 'noopener' }, 'Görevleri tarayıcıda aç'));
        else perdeGoster('Oturum başlatılamadı', e.message, el('button', { class: 'web-dugme', onclick: () => location.reload() }, 'Yeniden dene'));
        return new Promise(() => { });
      }
      office = r.office;
      if (!r.oturumVar) {
        perdeGoster('Görev Eklentisi', 'Görevler posta kutusunda tutulur. Devam etmek için görevlerin gönderilip alınacağı Microsoft 365 / Outlook.com hesabıyla oturum açılır.',
          el('button', { class: 'web-dugme', onclick: () => G.oturumAc() }, 'Microsoft hesabıyla oturum aç'),
          el('p', { class: 'web-kucuk' }, 'Outlook içinde kullanmak için eklenti dosyası indirme sayfasından alınır. İstenen izinler: profil, e-postaları okuma/taşıma, e-posta gönderme, kişi önerileri. Veriler yalnızca bu tarayıcıda ve posta kutusunda durur; başka bir sunucuya gönderilmez.'));
        return new Promise(() => { });
      }
      try { ben = await G.ben(); }
      catch (e) {
        // Posta kutusu Microsoft'ta olmayan hesaplarda (ör. kendi adresiyle açılmış kişisel Microsoft hesabı, IMAP/Gmail kutusu) Graph yanıt veremez.
        const kim = G.hesapAdi && G.hesapAdi();
        const kutuYok = [404, 502, 503, 504].includes(e.durum) || /MailboxNotEnabledForRESTAPI|UnknownError|ResourceNotFound/.test(e.kod || '');
        if (kutuYok)
          perdeGoster('Bu hesabın posta kutusuna ulaşılamadı',
            (kim ? kim + ' hesabıyla oturum açıldı, ancak ' : 'Oturum açıldı, ancak ') + 'bu hesabın Microsoft 365 / Outlook.com posta kutusu bulunamadı (' + e.message + ').\n' +
            'Web eklentisi yalnızca postası Microsoft 365 ya da Outlook.com üzerinde duran hesaplarla çalışır. Postası başka bir sağlayıcıda (IMAP, Gmail vb.) olan adresler için Windows\'ta klasik Outlook eklentisi kullanılır.',
            !office && G.oturumAc ? el('button', { class: 'web-dugme', onclick: () => G.oturumAc() }, 'Başka hesapla oturum aç') : null,
            el('button', { class: 'web-dugme ikincil', onclick: () => location.reload() }, 'Yeniden dene'));
        else perdeGoster('Hesap okunamadı', e.message, el('button', { class: 'web-dugme', onclick: () => location.reload() }, 'Yeniden dene'));
        return new Promise(() => { });
      }
      posta = G.Posta;
    }

    const kalici = kok.indexedDB && !(deneme && deneme.kaliciYok) ? kok.GorevDepo.indexedDbKalici('gorev-eklentisi:' + C.norm(ben.eposta), gunluk.uyari) : kok.GorevDepo.bellekKalici();
    const depo = kok.GorevDepo.Depo(kalici);
    await depo.yukle();
    servis = kok.GorevServis.Servis(ben, depo, posta, gunluk);
    servis.dinle(g => yay('gorevGuncellendi', paket(g)));
    cubukKur();
    perdeKaldir();

    esitle(false);
    setInterval(() => { if (!document.hidden) esitle(false); }, 2 * 60 * 1000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) esitle(false); });
    kok.addEventListener('online', () => esitle(false));
    if (office) officeBagla();
    if (new URLSearchParams(location.search).get('yeni') === '1') setTimeout(() => calistir('yeniGorev', {}).catch(e => durum(e.message, true)), 300);
  }

  let sonHata = null;
  async function esitle(bastan) {
    durum('Eşitleniyor…');
    try {
      const o = bastan ? await servis.yenidenKurHepsi() : await servis.esitle(false);
      sonHata = o.hatalar.length ? o.hatalar[0] : null;
      const bekleyen = servis.depo.gidenKuyruk().length;
      durum(sonHata ? 'Eşitlenemedi: ' + sonHata : bekleyen ? `${bekleyen} işlem gönderilmeyi bekliyor` : 'Güncel · ' + new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }), !!sonHata);
      if (bastan) yay('yenile', true);
      return o;
    } catch (e) { durum('Eşitlenemedi: ' + e.message, true); throw e; }
  }

  // ------------------------------------------------------------------ Outlook içinde: açık maile göre görev
  function officeBagla() {
    const kutu = kok.Office.context.mailbox;
    const bak = () => gecerliMail().catch(e => gunluk.uyari('Açık mail okunamadı: ' + e.message));
    try { kutu.addHandlerAsync(kok.Office.EventType.ItemChanged, bak); } catch (e) { /* sabitlenemeyen bölme */ }
    bak();
  }

  async function gecerliMail() {
    const oge = kok.Office.context.mailbox.item;
    if (!oge || typeof oge.subject !== 'string' || !C.gorevMailiGibi(oge.subject)) return;
    const depo = servis.depo, iid = oge.internetMessageId;
    const bul = () => {
      const kisa = C.konudanKisaId(oge.subject);
      let g = kisa ? depo.kisaIdIleGetir(kisa) : null;
      if (!g && iid) { const id = servis.maildenGorevId(iid); g = id ? depo.gorevGetir(id) : null; }
      return g;
    };
    let g = bul();
    if (!g) {
      // Henüz eşitlenmemiş mail: gövdesindeki zarf doğrudan okunur.
      const html = await new Promise(coz => oge.body.getAsync(kok.Office.CoercionType.Html, r => coz(r.status === kok.Office.AsyncResultStatus.Succeeded ? r.value : '')));
      const zarf = C.zarfOku(html);
      if (zarf) {
        const r = servis.gelenZarfIsle(zarf, oge.from && oge.from.emailAddress, iid || oge.itemId);
        if (r.basarili) { if (iid) depo.ayarYaz('mail:' + iid, { gorev: zarf.olay.gorevId }); g = depo.gorevGetir(zarf.olay.gorevId); }
      }
      if (!g) { await esitle(false).catch(() => { }); g = bul(); }
    }
    if (g) yay('goreveGit', { gorevId: g.gorevId, hesap: hk() });
  }

  // ------------------------------------------------------------------ komutlar (WebKoprusu.cs ile aynı adlar)
  const gorevAl = p => { const g = servis.depo.gorevGetir(p.gorevId); if (!g) throw new Error('Görev bulunamadı.'); return g; };

  async function calistir(komut, p) {
    switch (komut) {
      case 'listele':
        return { ben, bugun: C.bugunYerel(), surum: SURUM + ' (web)', web: true, office, hesaplar: [{ anahtar: hk(), eposta: ben.eposta, ad: ben.ad, varsayilan: true }], gorevler: servis.depo.tumGorevler().map(paket) };
      case 'detay': return paket(gorevAl(p));
      case 'islem': {
        const g = gorevAl(p);
        const yeni = await F.islem(servis, g, p.tur);
        if (yeni && yeni._kuyrukta) durum('İşlem kaydedildi; bağlantı gelince gönderilecek.', true);
        return paket(yeni || servis.depo.gorevGetir(g.gorevId));
      }
      case 'kanbanTasi': {
        const g = gorevAl(p);
        const tur = servis.kanbanIslemi(g.gorevId, p.hedef);
        if (!tur) throw new Error('Bu geçiş izinli değil.');
        return paket(await F.islem(servis, g, tur) || g);
      }
      case 'altAdim': {
        const r = await servis.altAdimIsaretle(p.gorevId, p.altAdimId, p.tamam);
        if (!r.basarili) throw new Error(r.mesaj);
        return paket(r.gorevler[0]);
      }
      case 'yeniGorev': {
        const r = await F.yeniGorev(servis, metin => posta.kisiAra ? posta.kisiAra(metin) : Promise.resolve([]));
        if (r) durum(r.kuyrukta ? 'Görev kaydedildi; bağlantı gelince gönderilecek.' : `${r.gorevler.length > 1 ? r.gorevler.length + ' görev' : 'Görev'} gönderildi.`, !!r.kuyrukta);
        return !!r;
      }
      case 'esitle': await esitle(false); return true;
      case 'yenidenKur':
        if (await F.sor('Veritabanını Yeniden Kur', 'Bu tarayıcıdaki görev kayıtları silinip posta kutusundaki görev maillerinden (Gelen Kutusu, Görevler klasörü, Gönderilmiş Öğeler) yeniden kurulacak.\nGönderilmeyi bekleyen işlemler korunur. Devam edilsin mi?', [['Yeniden kur', true, true], ['Vazgeç', false]]))
          await esitle(true);
        return true;
      case 'hesaplar':
        await F.sor('Görev hesabı', `Görevler şu posta kutusunda tutulur: ${ben.eposta}\n` + (office
          ? 'Outlook\'ta başka bir hesabın görevleri için o hesabın posta kutusunda eklenti açılır; her posta kutusunun görevleri ayrıdır.'
          : 'Başka bir hesabın görevleri için sağ üstteki Çıkış ile oturum kapatılıp o hesapla açılır; her posta kutusunun görevleri ayrıdır.'));
        return true;
      case 'mailBaglantisi': {
        const iid = servis.depo.ilkMailId(p.gorevId);
        if (!iid) throw new Error('Bu göreve ait mail bulunamadı.');
        const bag = await posta.mailBaglantisi(iid);
        if (!bag) throw new Error('Mail posta kutusunda bulunamadı (silinmiş olabilir).');
        return bag;
      }
      case 'disariAktar': {
        const tirnak = s => { s = s == null ? '' : String(s); if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; return '"' + s.replace(/"/g, '""') + '"'; };
        const satirlar = servis.depo.tumGorevler().map(g => [C.kisaId(g.gorevId), tirnak(g.baslik), C.durumAdi(g.durum), g.yuzde, tirnak(C.kisiMetin(g.sahip)),
          tirnak((g.sorumlular || []).map(C.kisiMetin).join(', ')), g.baslangic || '', g.termin || '', C.oncelikAdi(g.oncelik), tirnak(g.proje), g.tahminiSaat != null ? g.tahminiSaat : '', g.harcananSaat || 0].join(';'));
        const csv = '﻿No;Başlık;Durum;Yüzde;Sahip;Sorumlular;Başlangıç;Termin;Öncelik;Proje;Tahmini saat;Harcanan saat\r\n' + satirlar.join('\r\n');
        const a = el('a', { href: URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })), download: `gorevler-${C.bugunYerel()}.csv` });
        document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
        return true;
      }
    }
    throw new Error('Bu işlem web sürümünde desteklenmiyor: ' + komut);
  }

  const hazir = baslat().catch(e => { gunluk.hata('Başlatma', e); perdeGoster('Açılamadı', e && e.message || String(e), el('button', { class: 'web-dugme', onclick: () => location.reload() }, 'Yeniden dene')); return new Promise(() => { }); });

  /** Yeni sekme açan komutlar: pencere, kullanıcı tıklaması sürerken (beklemeden önce) açılır; yoksa tarayıcı engeller. */
  function sekmedeAc(adresSozu) {
    const w = kok.open('', '_blank');
    adresSozu.then(adres => {
      if (!/^https:\/\//i.test(adres)) throw new Error('Geçersiz bağlantı.');
      if (w) { try { w.opener = null; } catch (e) { /* yok say */ } w.location.replace(adres); } else kok.open(adres, '_blank', 'noopener');
    }).catch(e => { if (w) w.close(); durum(e.message, true); });
  }

  kok.GorevKoprusu = {
    canli: true, web: true,
    dinle: fn => dinleyiciler.push(fn),
    gonder(komut, p) {
      p = p || {};
      if (komut === 'disBaglantiAc') { sekmedeAc(Promise.resolve(String(p.url || ''))); return Promise.resolve(true); }
      if (komut === 'mailiAc') { sekmedeAc(hazir.then(() => calistir('mailBaglantisi', p))); return Promise.resolve(true); }
      return hazir.then(() => calistir(komut, p));
    }
  };
})(typeof self !== 'undefined' ? self : globalThis);
