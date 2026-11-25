/* Görev Eklentisi (web) — Yeni Görev formu ve işlem diyaloğu (Windows eklentisindeki YeniGorevPenceresi / IslemPenceresi
   karşılığı). Aynı doğrulama kuralları: zorunlu alanlar, alıcı adresleri, tarih sırası, sayı aralıkları, alt adım ve ek
   sınırları, yürütülebilir ek engeli. Hata iletileri alan düzeltilince kendiliğinden kalkar.
   Başka kullanıcıdan gelen hiçbir metin innerHTML ile basılmaz; öğeler DOM ile kurulur. */
(function (kok) {
  'use strict';
  const C = kok.GorevCekirdek, D = kok.GorevDil, T = D.T;
  const KD = D.kod === 'en' ? 'en' : 'tr'; // büyük/küçük harf karşılaştırma dili
  const ondalikOrnek = () => (D.kod === 'en' ? ' (e.g. 1.5)' : ' (ör. 1,5)');
  const sayiYaz = n => (D.kod === 'en' ? String(n) : String(n).replace('.', ','));

  const el = (etiket, oz, ...cocuklar) => {
    const e = document.createElement(etiket);
    for (const k in oz || {}) {
      if (k === 'class') e.className = oz[k];
      else if (k.startsWith('on')) e.addEventListener(k.slice(2), oz[k]);
      else if (oz[k] === true) e.setAttribute(k, '');
      else if (oz[k] !== false && oz[k] != null) e.setAttribute(k, oz[k]);
    }
    for (const c of cocuklar.flat()) if (c != null && c !== false) e.append(c.nodeType ? c : document.createTextNode(String(c)));
    return e;
  };
  const yildiz = () => el('span', { class: 'zorunlu', title: T('Zorunlu') }, ' *');
  const tekBosluk = s => String(s || '').trim().replace(/\s+/g, ' ');
  const kontrolVar = s => /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(s);
  const EPOSTA = /^[^@\s<>;,"]+@[^@\s<>;,"]+\.[^@\s<>;,"]{2,}$/;

  // ------------------------------------------------------------------ ek politikası (EkPolitikasi.cs)
  const EK = { enFazlaDosya: 20, enFazlaToplam: 20 * 1024 * 1024, enFazlaTek: 15 * 1024 * 1024 };
  const ENGELLI = new Set(('exe com scr pif cpl dll ocx sys drv efi msc gadget msi msp mst msu msix msixbundle appx appxbundle appinstaller application xbap cab ' +
    'bat cmd ps1 ps1xml ps2 ps2xml psc1 psc2 psd1 psm1 vb vbe vbs js jse ws wsc wsf wsh hta sct py pyc pyo pyw pyz pyzw pl rb sh csh ksh ' +
    'jar jnlp reg inf ins isp its scf shb shs chm hlp mht mhtml lnk url website settingcontent-ms appref-ms library-ms searchconnector-ms theme themepack ' +
    'diagcab udl wsb xll xnk mde mdb accde ade adp mda mdz prf iso img vhd vhdx docm dotm xlsm xltm xlam pptm potm ppam ppsm sldm htm html xhtml svg ' +
    'app command dmg pkg desktop run bin deb rpm apk ipa scpt workflow action').split(' '));
  const uzanti = ad => { const i = String(ad).lastIndexOf('.'); return i < 0 ? '' : String(ad).slice(i + 1).toLowerCase(); };

  /** Dosya eklenebilirse null; değilse nedeni. bayt: Uint8Array (içerik). */
  function ekDenetle(ad, bayt) {
    if (bayt.length === 0) return T('dosya boş');
    if (bayt.length > EK.enFazlaTek) return T('dosya {0} MB\'tan büyük', EK.enFazlaTek / 1048576);
    if (/[ .]$/.test(ad) || /[\\/:*?"<>|\u0000-\u001f]/.test(ad)) return T('dosya adı geçersiz');
    const uz = uzanti(ad);
    if (ENGELLI.has(uz)) return T('.{0} türündeki dosyalar güvenlik nedeniyle eklenemez', uz);
    if (bayt[0] === 0x4d && bayt[1] === 0x5a) return T('dosya içeriği yürütülebilir program (uzantısı değiştirilmiş olabilir)');
    if (bayt[0] === 0x7f && bayt[1] === 0x45 && bayt[2] === 0x4c && bayt[3] === 0x46) return T('dosya içeriği yürütülebilir program');
    if ([0xfeedface, 0xfeedfacf, 0xcefaedfe, 0xcffaedfe, 0xcafebabe].includes(((bayt[0] << 24) | (bayt[1] << 16) | (bayt[2] << 8) | bayt[3]) >>> 0)) return T('dosya içeriği yürütülebilir program');
    if (bayt[0] === 0x23 && bayt[1] === 0x21) return T('dosya içeriği betik');
    if (uz === 'zip') {
      // Zip merkezî dizinindeki dosya adları: içinde engelli türde dosya varsa reddedilir.
      const coz = new TextDecoder('utf-8');
      for (let i = 0; i + 46 < bayt.length; i++) {
        if (bayt[i] !== 0x50 || bayt[i + 1] !== 0x4b || bayt[i + 2] !== 0x01 || bayt[i + 3] !== 0x02) continue;
        const adUz = bayt[i + 28] | (bayt[i + 29] << 8);
        const icAd = coz.decode(bayt.subarray(i + 46, i + 46 + adUz));
        if (ENGELLI.has(uzanti(icAd))) return T('zip içinde izin verilmeyen dosya var: {0}', icAd.split('/').pop());
        i += 45 + adUz;
      }
    }
    return null;
  }

  // ------------------------------------------------------------------ ortak: diyalog kabuğu ve hata kaydı
  function diyalog(baslik, altBaslik, sinif) {
    const govde = el('div', { class: 'gf-govde' });
    const hata = el('div', { class: 'gf-hata', role: 'alert' });
    const dugmeler = el('div', { class: 'gf-dugmeler' });
    const d = el('dialog', { class: 'gf ' + (sinif || '') },
      el('div', { class: 'gf-baslik' }, el('div', { class: 'gf-b1' }, baslik), altBaslik ? el('div', { class: 'gf-b2' }, altBaslik) : null),
      govde, hata, dugmeler);
    document.body.append(d);
    d.addEventListener('cancel', e => { if (d.dataset.mesgul) e.preventDefault(); });
    d.addEventListener('close', () => d.remove());
    return { d, govde, hata, dugmeler };
  }

  /** Alan hataları: alan → ileti. Düzeltilince silinir; özet kutusu güncel hataları sırasıyla gösterir. */
  function HataKaydi(ozetKutusu) {
    const hatalar = new Map(), sira = [];
    const ciz = () => {
      ozetKutusu.replaceChildren(...sira.filter(a => hatalar.has(a)).map(a => el('div', null, '• ' + hatalar.get(a))));
    };
    return {
      yaz(alan, ileti) {
        if (!sira.includes(alan)) sira.push(alan);
        if (ileti) { hatalar.set(alan, ileti); alan.classList.add('hatali'); alan.title = ileti; }
        else { hatalar.delete(alan); alan.classList.remove('hatali'); alan.removeAttribute('title'); }
        ciz();
        return ileti || null;
      },
      var: alan => hatalar.has(alan),
      ilk: () => sira.find(a => hatalar.has(a)) || null,
      sayi: () => hatalar.size
    };
  }

  const satir = (etiket, zorunlu, ...icerik) => el('div', { class: 'gf-satir' }, el('label', { class: 'gf-etiket' }, etiket, zorunlu ? yildiz() : null), el('div', { class: 'gf-alan' }, ...icerik));

  // ------------------------------------------------------------------ alıcı kutusu (etiketli giriş + öneri)
  function AliciKutusu(ad, kisiAra, sonAlicilar) {
    const kisiler = [];
    const giris = el('input', { type: 'text', class: 'ak-giris', autocomplete: 'off', spellcheck: 'false', 'aria-label': ad, placeholder: T('ad ya da e-posta; birden çok kişi için ; ya da Enter') });
    const oneri = el('div', { class: 'ak-oneri gizli' });
    const kutu = el('div', { class: 'ak' }, giris);
    const sarmal = el('div', { class: 'ak-sarmal' }, kutu, oneri);
    let degisti = () => { };

    function ciz() {
      kutu.querySelectorAll('.ak-kisi').forEach(x => x.remove());
      for (const k of kisiler)
        giris.before(el('span', { class: 'ak-kisi', title: k.eposta }, C.bos(k.ad) || k.ad === k.eposta ? k.eposta : k.ad,
          el('button', { type: 'button', 'aria-label': T('Kaldır'), onclick: () => { kisiler.splice(kisiler.indexOf(k), 1); ciz(); degisti(); } }, '×')));
    }
    function ekle(k) {
      if (!kisiler.some(x => C.kisiEsit(x, k))) kisiler.push({ ad: C.bos(k.ad) ? k.eposta : k.ad.trim(), eposta: k.eposta.trim() });
      ciz();
    }
    /** Yazılan metni kişilere çevirir; çözülemeyen parçaları döner. */
    function metniIsle() {
      const kalan = [];
      for (const parca of giris.value.split(/[;,\n]/).map(s => s.trim()).filter(Boolean)) {
        const m = /^(.*)<\s*([^<>\s]+)\s*>$/.exec(parca);
        if (m && EPOSTA.test(m[2])) ekle({ ad: m[1].trim().replace(/^"|"$/g, ''), eposta: m[2] });
        else if (EPOSTA.test(parca)) ekle({ ad: (sonAlicilar.find(s => C.norm(s.eposta) === C.norm(parca)) || {}).ad || parca, eposta: parca });
        else {
          const uyan = sonAlicilar.filter(s => (s.ad || '').toLocaleLowerCase(KD) === parca.toLocaleLowerCase(KD));
          if (uyan.length === 1) ekle(uyan[0]); else kalan.push(parca);
        }
      }
      giris.value = kalan.join('; ');
      return kalan;
    }
    let aramaSayaci = 0, zamanlayici;
    function oneriGoster(liste) {
      oneri.replaceChildren(...liste.slice(0, 8).map(k => el('div', { class: 'ak-o', onmousedown: e => { e.preventDefault(); giris.value = giris.value.replace(/[^;,]*$/, ''); ekle(k); oneri.classList.add('gizli'); degisti(); } },
        el('b', null, k.ad || k.eposta), ' ', el('span', null, k.eposta))));
      oneri.classList.toggle('gizli', liste.length === 0);
    }
    giris.addEventListener('input', () => {
      const son = giris.value.split(/[;,]/).pop().trim();
      clearTimeout(zamanlayici);
      if (son.length < 2) return oneriGoster([]);
      const yerel = sonAlicilar.filter(s => ((s.ad || '') + ' ' + s.eposta).toLocaleLowerCase(KD).includes(son.toLocaleLowerCase(KD)));
      oneriGoster(yerel);
      const no = ++aramaSayaci;
      zamanlayici = setTimeout(async () => {
        const uzak = await kisiAra(son);
        if (no !== aramaSayaci) return;
        const hepsi = [...yerel];
        for (const k of uzak) if (!hepsi.some(x => C.kisiEsit(x, k))) hepsi.push(k);
        oneriGoster(hepsi.filter(k => !kisiler.some(x => C.kisiEsit(x, k))));
      }, 300);
    });
    giris.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ';' || e.key === ',') { if (giris.value.trim()) { e.preventDefault(); metniIsle(); degisti(); } }
      else if (e.key === 'Backspace' && !giris.value && kisiler.length) { kisiler.pop(); ciz(); degisti(); }
    });
    giris.addEventListener('blur', () => { oneri.classList.add('gizli'); metniIsle(); degisti(); });
    kutu.addEventListener('click', () => giris.focus());
    return { dugum: sarmal, kutu, kisiler, metniIsle, kalan: () => giris.value.trim(), degisince: fn => { degisti = fn; }, odak: () => giris.focus() };
  }

  // ------------------------------------------------------------------ Yeni Görev
  /** Formu açar; gönderilince { gorevler, kuyrukta } ile, vazgeçilince null ile çözülür. */
  function yeniGorev(servis, kisiAra) {
    return new Promise(coz => {
      const t = servis.tercihler(), ben = servis.ben, bugun = C.bugunYerel();
      const { d, govde, hata, dugmeler } = diyalog(T('Yeni Görev'), T('Gönderen: {0}', ben.eposta), 'gf-genis');
      const H = HataKaydi(hata);
      let gonderimDenendi = false;

      const sorumlu = AliciKutusu(T('Sorumlu(lar)'), kisiAra, t.sonAlicilar), bilgi = AliciKutusu(T('Bilgi'), kisiAra, t.sonAlicilar);
      const baslik = el('input', { type: 'text', maxlength: 200, 'aria-label': T('Başlık') });
      const aciklama = el('div', { class: 'gf-zengin', contenteditable: 'true', role: 'textbox', 'aria-multiline': 'true', 'aria-label': T('Açıklama') });
      const arac = (ad, komut, ipucu) => el('button', { type: 'button', class: 'gf-arac', title: ipucu, onmousedown: e => { e.preventDefault(); aciklama.focus(); document.execCommand(komut, false, null); } }, ad);
      const aracCubugu = el('div', { class: 'gf-araclar' }, arac(el('b', null, T('K')), 'bold', T('Kalın (Ctrl+B)')), arac(el('i', null, T('T')), 'italic', T('İtalik (Ctrl+I)')), arac(el('u', null, T('A')), 'underline', T('Altı çizili (Ctrl+U)')),
        arac(T('• Liste'), 'insertUnorderedList', T('Madde işaretli liste')), arac(T('1. Liste'), 'insertOrderedList', T('Numaralı liste')));
      try { document.execCommand('defaultParagraphSeparator', false, 'p'); } catch (e) { /* desteklenmiyorsa div → p dönüşümü okurken yapılır */ }
      aciklama.addEventListener('paste', e => { e.preventDefault(); document.execCommand('insertText', false, (e.clipboardData || kok.clipboardData).getData('text/plain')); });
      aciklama.addEventListener('drop', e => e.preventDefault());

      const baslangic = el('input', { type: 'date', value: bugun, min: '2000-01-01', max: '2100-12-31', 'aria-label': T('Başlangıç') });
      const termin = el('input', { type: 'date', min: '2000-01-01', max: '2100-12-31', 'aria-label': T('Termin') });
      const oncelik = el('select', { 'aria-label': T('Öncelik') }, ['Dusuk', 'Normal', 'Yuksek', 'Kritik'].map(o => el('option', { value: o, selected: o === t.varsayilanOncelik }, C.oncelikAdi(o))));
      const projeListe = el('datalist', { id: 'gf-projeler' }, servis.tumProjeler().map(p => el('option', { value: p })));
      const sonProje = t.sonProjeler[0] && !t.gizliProjeler.includes(t.sonProjeler[0]) ? t.sonProjeler[0] : '';
      const proje = el('input', { type: 'text', list: 'gf-projeler', maxlength: 100, value: sonProje, 'aria-label': T('Proje / kategori') });
      const ayri = el('input', { type: 'radio', name: 'gf-mod', id: 'gf-ayri', checked: t.varsayilanAtamaModu !== 'Ortak' });
      const ortak = el('input', { type: 'radio', name: 'gf-mod', id: 'gf-ortak', checked: t.varsayilanAtamaModu === 'Ortak' });
      const efor = el('input', { type: 'checkbox', id: 'gf-efor', checked: !!t.varsayilanEforTakibi });
      const tahmini = el('input', { type: 'text', inputmode: 'decimal', maxlength: 7, class: 'gf-kisa', 'aria-label': T('Tahmini saat') });
      const tahminiSatir = el('span', { class: 'gf-yan' }, ' ' + T('Tahmini saat') + ' ', tahmini);

      // Alt adımlar (kontrol listesi)
      const adimlar = [];
      const adimListe = el('div', { class: 'gf-adimlar' });
      const yeniAdim = el('input', { type: 'text', maxlength: 200, placeholder: T('Alt adım yazıp Ekle\'ye basılır'), 'aria-label': T('Yeni alt adım') });
      const adimCiz = () => adimListe.replaceChildren(...adimlar.map((a, i) => el('div', { class: 'gf-adim' }, el('span', { class: 'gf-kutu' }, '☐'), el('span', { class: 'gf-adim-m' }, a),
        el('button', { type: 'button', title: T('Kaldır'), onclick: () => { adimlar.splice(i, 1); adimCiz(); } }, '×'))));
      function adimEkle() {
        const m = tekBosluk(yeniAdim.value);
        let h = null;
        if (!m) h = T('Alt adım metni yazılır.');
        else if (adimlar.length >= 50) h = T('En fazla 50 alt adım eklenebilir.');
        else if (kontrolVar(m)) h = T('Alt adım geçersiz karakter içeriyor.');
        else if (adimlar.some(a => a.toLocaleLowerCase(KD) === m.toLocaleLowerCase(KD))) h = T('"{0}" alt adımı listede zaten var.', m);
        H.yaz(yeniAdim, h);
        if (h) return false;
        adimlar.push(m); yeniAdim.value = ''; adimCiz(); return true;
      }
      yeniAdim.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); adimEkle(); } });
      yeniAdim.addEventListener('input', () => { if (H.var(yeniAdim)) H.yaz(yeniAdim, null); });

      // Ekler
      const ekler = [];
      const ekListe = el('div', { class: 'gf-ekler' });
      const ekSec = el('input', { type: 'file', multiple: true, class: 'gizli' });
      const ekDugme = el('button', { type: 'button', onclick: () => ekSec.click() }, T('Dosya ekle…'));
      const ekCiz = () => {
        ekListe.replaceChildren(...ekler.map((e, i) => el('div', { class: 'gf-ek' }, el('span', null, `${e.ad} (${(e.bayt.length / 1024).toFixed(0)} KB)`),
          el('button', { type: 'button', title: T('Kaldır'), onclick: () => { ekler.splice(i, 1); ekCiz(); denetleEkler(); } }, '×'))));
      };
      function denetleEkler(yeniHata) {
        let h = yeniHata || null;
        const toplam = ekler.reduce((n, e) => n + e.bayt.length, 0);
        if (!h && ekler.length > EK.enFazlaDosya) h = T('En fazla {0} dosya eklenebilir.', EK.enFazlaDosya);
        if (!h && toplam > EK.enFazlaToplam) h = T('Eklerin toplamı {0} MB\'ı geçemez (şu an {1} MB).', EK.enFazlaToplam / 1048576, sayiYaz((toplam / 1048576).toFixed(1)));
        return H.yaz(ekDugme, h);
      }
      ekSec.addEventListener('change', async () => {
        let ret = null;
        for (const f of Array.from(ekSec.files || [])) {
          if (f.size > EK.enFazlaTek) { ret = `${f.name}: ` + T('dosya {0} MB\'tan büyük', EK.enFazlaTek / 1048576); continue; }
          const bayt = new Uint8Array(await f.arrayBuffer());
          const neden = ekDenetle(f.name, bayt);
          if (neden) { ret = `${f.name}: ${neden}`; continue; }
          if (ekler.some(e => e.ad === f.name && e.bayt.length === bayt.length)) continue;
          ekler.push({ ad: f.name, tur: f.type || 'application/octet-stream', bayt });
        }
        ekSec.value = ''; ekCiz(); denetleEkler(ret);
      });

      // ---- doğrulama
      function denetleAlici(kutu, ad, zorunlu) {
        const kalan = kutu.metniIsle();
        let h = null;
        if (kalan.length) h = T('{0}: "{1}" bir e-posta adresi olarak çözülemedi.', ad, kalan[0]);
        else if (zorunlu && kutu.kisiler.length === 0) h = gonderimDenendi ? T('En az bir sorumlu seçilmelidir.') : null;
        else if (kutu.kisiler.length > 50) h = T('{0}: en fazla 50 kişi.', ad);
        H.yaz(kutu.kutu, h);
      }
      const denetleSorumlu = () => { denetleAlici(sorumlu, T('Sorumlu(lar)'), true); if (!H.var(sorumlu.kutu) && sorumlu.kisiler.some(k => C.kisiEsit(k, ben))) H.yaz(sorumlu.kutu, null); };
      const denetleBilgi = () => denetleAlici(bilgi, T('Bilgi'), false);
      function denetleBaslik() {
        const m = baslik.value.trim();
        H.yaz(baslik, !m ? (gonderimDenendi ? T('Başlık zorunludur.') : null) : m.length > 200 ? T('Başlık en fazla 200 karakter olabilir.') : kontrolVar(m) ? T('Başlık geçersiz karakter içeriyor.') : null);
      }
      function denetleTarihler() {
        const b = baslangic.value, tm = termin.value;
        H.yaz(baslangic, baslangic.validity.badInput ? T('Başlangıç geçerli bir tarih değil.') : !b ? T('Başlangıç seçilmelidir.') : null);
        let h = termin.validity.badInput ? T('Termin geçerli bir tarih değil.') : !tm ? (gonderimDenendi ? T('Termin seçilmelidir.') : null) : null;
        if (!h && tm && tm < bugun) h = T('Termin bugünden önce olamaz.');
        if (!h && tm && b && tm < b) h = T('Termin, başlangıç tarihinden önce olamaz.');
        H.yaz(termin, h);
      }
      function sayiOku(kutu, ad, ondalik, enAz, enCok) {
        const m = kutu.value.trim();
        if (!m) { H.yaz(kutu, null); return null; }
        const n = Number(m.replace(',', '.'));
        if (!/^\d+([.,]\d+)?$/.test(m) || isNaN(n) || (!ondalik && n % 1 !== 0)) { H.yaz(kutu, T('{0} sayı olmalıdır{1}.', ad, ondalik ? ondalikOrnek() : '')); return undefined; }
        if (n < enAz || n > enCok) { H.yaz(kutu, T('{0} {1}–{2} arasında olmalıdır.', ad, sayiYaz(enAz), enCok)); return undefined; }
        H.yaz(kutu, null);
        return Math.round(n * 100) / 100;
      }
      const denetleTahmini = () => efor.checked ? sayiOku(tahmini, T('Tahmini saat'), true, 0.25, 9999) : (H.yaz(tahmini, null), null);
      function denetleProje() {
        const p = tekBosluk(proje.value);
        H.yaz(proje, p.length > 100 ? T('Proje / kategori en fazla 100 karakter olabilir.') : kontrolVar(p) ? T('Proje / kategori geçersiz karakter içeriyor.') : null);
        return p;
      }
      const aciklamaHtml = () => C.htmlTemizle(aciklama.innerHTML.replace(/<(\/?)div\b[^>]*>/gi, '<$1p>'));
      function denetleAciklama() {
        const uz = C.duzMetin(aciklama.innerHTML).length;
        H.yaz(aciklama, uz > 8000 ? T('Açıklama en fazla 8000 karakter olabilir (şu an {0}).', uz) : null);
      }

      sorumlu.degisince(denetleSorumlu); bilgi.degisince(denetleBilgi);
      baslik.addEventListener('blur', denetleBaslik); baslik.addEventListener('input', () => { if (H.var(baslik)) denetleBaslik(); });
      baslangic.addEventListener('change', denetleTarihler); termin.addEventListener('change', denetleTarihler);
      baslangic.addEventListener('blur', denetleTarihler); termin.addEventListener('blur', denetleTarihler);
      tahmini.addEventListener('blur', denetleTahmini); tahmini.addEventListener('input', () => { tahmini.value = tahmini.value.replace(/[^\d.,]/g, ''); if (H.var(tahmini)) denetleTahmini(); });
      proje.addEventListener('blur', denetleProje);
      aciklama.addEventListener('input', () => { if (H.var(aciklama)) denetleAciklama(); });
      const eforDegisti = () => { tahminiSatir.classList.toggle('gizli', !efor.checked); if (!efor.checked) H.yaz(tahmini, null); };
      efor.addEventListener('change', eforDegisti); eforDegisti();

      govde.append(
        satir(T('Sorumlu(lar)'), true, sorumlu.dugum),
        satir(T('Bilgi'), false, bilgi.dugum),
        satir(T('Başlık'), true, baslik),
        satir(T('Açıklama'), false, aracCubugu, aciklama),
        satir(T('Başlangıç'), true, el('span', { class: 'gf-yan' }, baslangic, el('span', { class: 'gf-ic-etiket' }, T('Termin'), yildiz()), termin, el('span', { class: 'gf-ic-etiket' }, T('Öncelik')), oncelik)),
        satir(T('Proje / kategori'), false, proje, projeListe),
        satir(T('Atama'), false, el('span', { class: 'gf-yan' }, ayri, el('label', { for: 'gf-ayri' }, T('Her biri için ayrı görev')), ortak, el('label', { for: 'gf-ortak' }, T('Ortak tek görev')))),
        satir(T('Efor'), false, el('span', { class: 'gf-yan' }, efor, el('label', { for: 'gf-efor' }, T('Efor takibi (iş kayıtlarında harcanan saat zorunlu)')), tahminiSatir)),
        satir(T('Alt adımlar'), false, adimListe, el('span', { class: 'gf-yan' }, yeniAdim, el('button', { type: 'button', onclick: adimEkle }, T('Ekle')))),
        satir(T('Ekler'), false, ekListe, ekDugme, ekSec, el('div', { class: 'gf-not' }, T('En çok {0} dosya, toplam {1} MB. Çalıştırılabilir dosyalar eklenemez.', EK.enFazlaDosya, EK.enFazlaToplam / 1048576))));

      const gonder = el('button', { type: 'button', class: 'birincil' }, T('Gönder'));
      const vazgec = el('button', { type: 'button', onclick: () => d.close() }, T('Vazgeç'));
      dugmeler.append(gonder, vazgec);

      let sonuc = null;
      d.addEventListener('close', () => coz(sonuc));
      gonder.addEventListener('click', async () => {
        gonderimDenendi = true;
        if (yeniAdim.value.trim() && !adimEkle()) { yeniAdim.focus(); return; }
        denetleSorumlu(); denetleBilgi(); denetleBaslik(); denetleTarihler(); const th = denetleTahmini(); const p = denetleProje(); denetleAciklama(); denetleEkler();
        if (H.sayi() > 0) { const ilk = H.ilk(); (ilk.querySelector && ilk.querySelector('input') || ilk).focus(); return; }
        const taslak = {
          baslik: baslik.value.trim(), aciklamaHtml: aciklamaHtml(), sorumlular: sorumlu.kisiler.slice(), bilgi: bilgi.kisiler.slice(),
          baslangic: baslangic.value, termin: termin.value, oncelik: oncelik.value, proje: p,
          tahminiSaat: efor.checked && th != null ? th : null, altAdimlar: adimlar.map(m => ({ metin: m })),
          atamaModu: ortak.checked ? 'Ortak' : 'AyriAyri', eforTakibi: efor.checked, ekler: ekler.slice()
        };
        d.dataset.mesgul = '1'; gonder.disabled = vazgec.disabled = true; gonder.textContent = T('Gönderiliyor…');
        try {
          const r = await servis.gorevOlustur(taslak);
          if (!r.basarili) { hata.replaceChildren(el('div', null, '• ' + r.mesaj)); return; }
          servis.sonSecimleriGuncelle(taslak.atamaModu, taslak.eforTakibi, taslak.oncelik, taslak.proje, [...taslak.sorumlular, ...taslak.bilgi]);
          sonuc = r; delete d.dataset.mesgul; d.close();
        } catch (e) { hata.replaceChildren(el('div', null, '• ' + (e && e.message || e))); }
        finally { delete d.dataset.mesgul; gonder.disabled = vazgec.disabled = false; gonder.textContent = T('Gönder'); }
      });

      d.showModal();
      sorumlu.odak();
    });
  }

  // ------------------------------------------------------------------ İşlem diyaloğu
  const ISLEM_BASLIK = {
    Kabul: T('Görevi Kabul Et'), Reddet: T('Görevi Reddet'), IsKaydi: T('İş Kaydı Ekle'), Tamamla: T('Görevi Tamamla'), Kapat: T('Görevi Kapat (Onayla)'),
    YenidenAc: T('Görevi Yeniden Aç'), Iptal: T('Görevi İptal Et'), Yorum: T('Yorum Ekle'), TerminDegistir: T('Termini Değiştir'),
    TerminIste: T('Termin Değişikliği İste'), Beklet: T('Beklemeye Al'), DevamEt: T('Devam Et')
  };
  const gerekceZorunlu = t => ['Reddet', 'Iptal', 'YenidenAc', 'TerminIste'].includes(t);

  /** İşlem diyaloğunu açar; yapılınca güncel görevle, vazgeçilince null ile çözülür. İzin yoksa hata fırlatır. */
  function islem(servis, g, tur) {
    if (!C.islemIzinli(g, tur, servis.ben.eposta))
      return Promise.reject(new Error(T('"{0}" bu görev için şu an yapılamaz (durum: {1}).', ISLEM_BASLIK[tur] || tur, C.durumAdi(g.durum))));
    return new Promise(coz => {
      const bugun = C.bugunYerel();
      const { d, govde, hata, dugmeler } = diyalog(ISLEM_BASLIK[tur], `[${C.kisaId(g.gorevId)}] ${g.baslik} · ${C.durumAdi(g.durum)} · ${D.yuzde(g.yuzde)} · ${T('Termin')} ${C.tarihGoster(g.termin)}`);
      const H = HataKaydi(hata);
      const notZorunlu = gerekceZorunlu(tur) || tur === 'Yorum';
      const notAd = gerekceZorunlu(tur) ? T('Gerekçe') : tur === 'Yorum' ? T('Yorum') : T('Not');
      const not = el('textarea', { rows: 4, maxlength: 4000, 'aria-label': notAd });
      const tarih = el('input', { type: 'date', value: bugun, max: bugun, min: '2000-01-01', 'aria-label': T('Tarih') });
      const saat = el('input', { type: 'text', inputmode: 'decimal', maxlength: 5, class: 'gf-kisa', 'aria-label': T('Harcanan saat') });
      const yuzde = el('input', { type: 'text', inputmode: 'numeric', maxlength: 3, class: 'gf-kisa', 'aria-label': T('İlerleme yüzdesi') });
      const termin = el('input', { type: 'date', min: bugun, max: '2100-12-31', 'aria-label': T('Termin') });
      saat.addEventListener('input', () => { saat.value = saat.value.replace(/[^\d.,]/g, ''); });
      yuzde.addEventListener('input', () => { yuzde.value = yuzde.value.replace(/\D/g, ''); });

      if (tur === 'IsKaydi') {
        govde.append(satir(T('Tarih'), true, tarih));
        if (g.eforTakibi) govde.append(satir(T('Harcanan saat'), true, saat));
        govde.append(satir(T('İlerleme %'), false, yuzde, el('span', { class: 'gf-not' }, ' ' + T('şu an {0}', D.yuzde(g.yuzde)))));
      }
      if (tur === 'TerminDegistir' || tur === 'TerminIste') govde.append(satir(tur === 'TerminIste' ? T('Önerilen termin') : T('Yeni termin'), true, termin));
      govde.append(satir(notAd, notZorunlu, not));

      const sayi = (kutu, ad, ondalik, enAz, enCok, zorunlu) => {
        const m = kutu.value.trim();
        if (!m) { H.yaz(kutu, zorunlu ? T('{0} zorunludur{1}.', ad, ondalik ? ondalikOrnek() : '') : null); return zorunlu ? undefined : null; }
        const n = Number(m.replace(',', '.'));
        if (!/^\d+([.,]\d+)?$/.test(m) || isNaN(n) || (!ondalik && n % 1 !== 0)) { H.yaz(kutu, T('{0} sayı olmalıdır{1}.', ad, ondalik ? ondalikOrnek() : '')); return undefined; }
        if (n < enAz || n > enCok) { H.yaz(kutu, T('{0} {1}–{2} arasında olmalıdır.', ad, sayiYaz(enAz), enCok)); return undefined; }
        H.yaz(kutu, null); return Math.round(n * 100) / 100;
      };
      function denetle() {
        const v = {};
        const m = not.value.trim();
        H.yaz(not, notZorunlu && !m ? T('{0} zorunludur{1}.', notAd, '') : m.length > 4000 ? T('{0} en fazla 4000 karakter olabilir.', notAd) : kontrolVar(m) ? T('{0} geçersiz karakter içeriyor.', notAd) : null);
        v.not = m || null;
        if (tur === 'IsKaydi') {
          H.yaz(tarih, tarih.validity.badInput || !tarih.value ? T('Tarih seçilmelidir.') : tarih.value > bugun ? T('İş kaydı tarihi ileri bir gün olamaz.') : null);
          v.tarih = tarih.value;
          if (g.eforTakibi) v.saat = sayi(saat, T('Harcanan saat'), true, 0.25, 24, true);
          v.yuzde = sayi(yuzde, T('İlerleme %'), false, 0, 100, false);
        }
        if (tur === 'TerminDegistir' || tur === 'TerminIste') {
          H.yaz(termin, termin.validity.badInput || !termin.value ? T('Termin seçilmelidir.') : termin.value < bugun ? T('Termin bugünden önce olamaz.') : termin.value === g.termin ? T('Yeni termin mevcut terminle aynı.') : null);
          v.termin = termin.value;
        }
        return v;
      }
      for (const k of [not, tarih, saat, yuzde, termin]) { k.addEventListener('input', () => { if (H.var(k)) denetle(); }); k.addEventListener('change', () => { if (H.var(k)) denetle(); }); }

      const tamam = el('button', { type: 'button', class: 'birincil' }, T('Tamam'));
      const vazgec = el('button', { type: 'button', onclick: () => d.close() }, T('Vazgeç'));
      dugmeler.append(tamam, vazgec);
      let sonuc = null;
      d.addEventListener('close', () => coz(sonuc));
      tamam.addEventListener('click', async () => {
        const v = denetle();
        if (H.sayi() > 0) { H.ilk().focus(); return; }
        d.dataset.mesgul = '1'; tamam.disabled = vazgec.disabled = true;
        try {
          const r = await servis.islem(g.gorevId, tur, v);
          if (!r.basarili) { hata.replaceChildren(el('div', null, '• ' + r.mesaj)); return; }
          sonuc = Object.assign({}, r.gorevler[0], { _kuyrukta: r.kuyrukta }); delete d.dataset.mesgul; d.close();
        } catch (e) { hata.replaceChildren(el('div', null, '• ' + (e && e.message || e))); }
        finally { delete d.dataset.mesgul; tamam.disabled = vazgec.disabled = false; }
      });
      d.showModal();
      (tur === 'IsKaydi' ? (g.eforTakibi ? saat : yuzde) : (tur === 'TerminDegistir' || tur === 'TerminIste') ? termin : not).focus();
    });
  }

  /** Basit onay / bilgi kutusu. dugmeler: [[etiket, deger, birincil]] */
  function sor(baslik, metin, dugmeListesi) {
    return new Promise(coz => {
      const { d, govde, dugmeler } = diyalog(baslik, null);
      for (const p of String(metin).split('\n')) govde.append(el('p', null, p));
      let sonuc = null;
      for (const [etiket, deger, birincil] of dugmeListesi || [[T('Tamam'), true, true]])
        dugmeler.append(el('button', { type: 'button', class: birincil ? 'birincil' : '', onclick: () => { sonuc = deger; d.close(); } }, etiket));
      d.addEventListener('close', () => coz(sonuc));
      d.showModal();
    });
  }

  kok.GorevFormlar = { yeniGorev, islem, sor, ekDenetle, ISLEM_BASLIK };
})(typeof self !== 'undefined' ? self : globalThis);
