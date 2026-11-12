/* Görevler penceresi — liste / kanban / gantt / yük. Dış bağımlılık yok; çevrimdışı çalışır.
   Köprü: Windows eklentisinde window.chrome.webview (bkz. UI/WebKoprusu.cs); web eklentisinde window.GorevKoprusu
   (bkz. web-eklenti/kaynak/kopru.js — aynı komutlar Microsoft Graph üzerinden). İkisi de yoksa örnek verilerle çalışır.
   Bu dosya iki eklentide ortaktır. */
(function () {
  'use strict';

  // ------------------------------------------------------------------ köprü
  const kopru = (() => {
    const bekleyen = new Map();
    let sayac = 0;
    const webview = window.chrome && window.chrome.webview;

    const ozel = window.GorevKoprusu;
    if (ozel) {
      ozel.dinle((olay, veri) => ornekOlay(olay, veri));
      return { gonder: (komut, p) => ozel.gonder(komut, p), canli: true, web: true };
    }

    if (webview) {
      webview.addEventListener('message', e => {
        const m = e.data;
        if (m && m.olay) { ornekOlay(m.olay, m.veri); return; }
        const b = bekleyen.get(m.id);
        if (!b) return;
        bekleyen.delete(m.id);
        m.tamam ? b.resolve(m.veri) : b.reject(new Error(m.hata || 'Hata'));
      });
    }

    function gonder(komut, parametre) {
      if (!webview) return sahte(komut, parametre);
      const id = ++sayac;
      return new Promise((resolve, reject) => {
        bekleyen.set(id, { resolve, reject });
        webview.postMessage({ id, komut, parametre: parametre || {} });
      });
    }
    return { gonder, canli: !!webview };
  })();

  // ------------------------------------------------------------------ durum
  const S = { ben: null, hesaplar: [], bugun: new Date().toISOString().slice(0, 10), gorevler: [], gorunum: 'liste', secili: null, sira: { alan: 'termin', ters: false } };

  const DURUM_AD = { Yeni: 'Yeni', KabulEdildi: 'Kabul edildi', DevamEdiyor: 'Devam ediyor', Beklemede: 'Beklemede', Tamamlandi: 'Tamamlandı', Kapatildi: 'Kapatıldı', Reddedildi: 'Reddedildi', IptalEdildi: 'İptal edildi' };
  const ONCELIK_AD = { Dusuk: 'Düşük', Normal: 'Normal', Yuksek: 'Yüksek', Kritik: 'Kritik' };
  const KANBAN_SUTUN = ['Yeni', 'KabulEdildi', 'DevamEdiyor', 'Beklemede', 'Tamamlandi', 'Kapatildi'];
  const ACIK = new Set(['Yeni', 'KabulEdildi', 'DevamEdiyor', 'Beklemede']);

  // Başka kullanıcılardan gelen biçimli metin (görev açıklaması) innerHTML ile basılmaz: ayrıştırılır ve yalnızca izinli
  // biçim etiketleri, özniteliksiz olarak yeniden kurulur. (Eklenti tarafı da aynı izin listesiyle temizler; bu ikinci savunma.)
  const IZINLI = new Set(['P', 'BR', 'B', 'STRONG', 'I', 'EM', 'U', 'UL', 'OL', 'LI']);
  const guvenliHtml = html => {
    const frag = document.createDocumentFragment();
    const kaynak = new DOMParser().parseFromString('<body>' + String(html || '') + '</body>', 'text/html').body;
    const kopyala = (dugum, hedef) => {
      for (const c of Array.from(dugum.childNodes)) {
        if (c.nodeType === Node.TEXT_NODE) hedef.append(document.createTextNode(c.nodeValue));
        else if (c.nodeType === Node.ELEMENT_NODE) {
          if (['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'TEMPLATE', 'SVG', 'MATH'].includes(c.tagName.toUpperCase())) continue;
          if (IZINLI.has(c.tagName.toUpperCase())) { const y = document.createElement(c.tagName.toLowerCase()); kopyala(c, y); hedef.append(y); }
          else kopyala(c, hedef);
        }
      }
    };
    kopyala(kaynak, frag);
    return frag;
  };

  const $ = s => document.querySelector(s);
  const el = (tag, attrs, ...cocuklar) => {
    const e = document.createElement(tag);
    for (const k in attrs || {}) {
      if (k === 'class') e.className = attrs[k];
      else if (k.startsWith('on')) e.addEventListener(k.slice(2), attrs[k]);
      else if (k === 'html') e.append(guvenliHtml(attrs[k]));
      else e.setAttribute(k, attrs[k]);
    }
    for (const c of cocuklar) if (c != null) e.append(c.nodeType ? c : document.createTextNode(String(c)));
    return e;
  };
  const tr = s => s ? s.split('-').reverse().join('.') : '';
  const norm = e => (e || '').trim().toLowerCase();
  // Görev anahtarı: hesap alanı + görev. Profilde hem veren hem alan hesap varsa aynı görev iki alanda bulunur.
  const gk = g => (g.hk || '') + '|' + g.gorevId;
  const coklu = () => S.hesaplar.length > 1;
  const rol = g => {
    const b = norm(g.benEposta || (S.ben && S.ben.eposta));
    if (norm(g.sahip && g.sahip.eposta) === b) return 'Sahip';
    if ((g.sorumlular || []).some(k => norm(k.eposta) === b)) return 'Sorumlu';
    if ((g.bilgi || []).some(k => norm(k.eposta) === b)) return 'Bilgi';
    return 'Yok';
  };
  const gecikmis = g => g.termin && g.termin < S.bugun && ACIK.has(g.durum);
  const kisiAd = k => k ? (k.ad || k.eposta) : '';
  const sorumluMetin = g => (g.sorumlular || []).map(kisiAd).join(', ');

  // ------------------------------------------------------------------ yükleme
  async function yukle() {
    try {
      const v = await kopru.gonder('listele');
      S.ben = v.ben; S.bugun = v.bugun || S.bugun; S.gorevler = v.gorevler || []; S.hesaplar = v.hesaplar || [];
      hesapSecenekleri();
      if (v.surum) { $('#hkSurum').textContent = 'sürüm ' + v.surum; $('#altSurum').textContent = v.surum; }
      filtreSecenekleri();
      ciz();
    } catch (e) { bildir(e.message, true); }
  }

  function ornekOlay(olay, veri) {
    if (olay === 'gorevGuncellendi') {
      if (!veri) return;
      const i = S.gorevler.findIndex(g => gk(g) === gk(veri));
      if (i >= 0) S.gorevler[i] = veri; else S.gorevler.push(veri);
      filtreSecenekleri();
      ciz();
      if (S.secili === gk(veri)) detayGoster(veri);
    } else if (olay === 'goreveGit') {
      const id = typeof veri === 'string' ? veri : veri && veri.gorevId, hk = veri && veri.hesap;
      const g = S.gorevler.find(x => x.gorevId === id && (!hk || x.hk === hk)) || S.gorevler.find(x => x.gorevId === id);
      if (g) { if (S.gorunum === 'yardim') sekmeSec('liste'); S.secili = gk(g); detayGoster(g); ciz(); }
    } else if (olay === 'yenile') {
      yukle();
    } else if (olay === 'gorunumeGit') {
      sekmeSec(veri);
    }
  }

  // Hesap süzgeci: yalnızca birden çok görev alanı açıkken görünür.
  function hesapSecenekleri() {
    const sel = $('#fHesap');
    doldur(sel, S.hesaplar.map(h => [h.anahtar, h.eposta]), 'Tüm hesaplar');
    if (!S.hesaplar.some(h => h.anahtar === sel.value)) sel.value = '';
    sel.classList.toggle('gizli', !coklu());
    document.body.classList.toggle('coklu-hesap', coklu());
  }
  const hesapAd = g => { const h = S.hesaplar.find(x => x.anahtar === g.hk); return h ? h.eposta : (g.hk || ''); };

  function filtreSecenekleri() {
    const projeler = [...new Set(S.gorevler.map(g => g.proje).filter(Boolean))].sort();
    const kisiler = new Map();
    for (const g of S.gorevler) for (const k of [g.sahip, ...(g.sorumlular || [])]) if (k) kisiler.set(norm(k.eposta), kisiAd(k));
    doldur($('#fProje'), projeler.map(p => [p, p]), 'Tüm projeler');
    doldur($('#fKisi'), [...kisiler].sort((a, b) => a[1].localeCompare(b[1], 'tr')), 'Tüm kişiler');
  }
  function doldur(sel, liste, bos) {
    const eski = sel.value;
    sel.innerHTML = '';
    sel.append(el('option', { value: '' }, bos));
    for (const [v, ad] of liste) sel.append(el('option', { value: v }, ad));
    sel.value = eski;
  }

  // ------------------------------------------------------------------ filtre
  function filtrele() {
    const hesap = $('#fHesap').value;
    const kapsam = $('#fKapsam').value, durum = $('#fDurum').value, proje = $('#fProje').value, kisi = $('#fKisi').value;
    const sadeceGecikmis = $('#fGecikmis').checked, ara = norm($('#fAra').value);
    return S.gorevler.filter(g => {
      if (hesap && g.hk !== hesap) return false;
      const r = rol(g);
      if (kapsam === 'verdiklerim' && r !== 'Sahip') return false;
      if (kapsam === 'uzerimdekiler' && r !== 'Sorumlu') return false;
      if (kapsam === 'izlediklerim' && r !== 'Bilgi') return false;
      if (durum === 'acik' ? !ACIK.has(g.durum) : durum !== 'hepsi' && g.durum !== durum) return false;
      if (proje && g.proje !== proje) return false;
      if (kisi && norm(g.sahip && g.sahip.eposta) !== kisi && !(g.sorumlular || []).some(k => norm(k.eposta) === kisi)) return false;
      if (sadeceGecikmis && !gecikmis(g)) return false;
      if (ara && !(norm(g.baslik).includes(ara) || norm(g.proje).includes(ara) || norm(sorumluMetin(g)).includes(ara) || norm(g.kisaIdHesap = g.gorevId.replace(/-/g, '').slice(0, 8)).includes(ara))) return false;
      return true;
    });
  }
  const kisaId = g => g.gorevId.replace(/-/g, '').slice(0, 8).toUpperCase();

  // ------------------------------------------------------------------ çizim
  function ciz() {
    if (S.gorunum === 'yardim') return; // statik içerik
    const liste = filtrele();
    ({ liste: cizListe, kanban: cizKanban, gantt: cizGantt, yuk: cizYuk })[S.gorunum](liste);
  }

  function sekmeSec(ad) {
    if (ad === 'hosgeldin') { // ilk açılış: yardım sekmesi + hoş geldin şeridi
      $('#hosgeldin').classList.remove('gizli');
      ad = 'yardim';
    }
    if (!document.querySelector(`.sekme[data-gorunum="${ad}"]`)) return;
    document.querySelectorAll('.sekme').forEach(x => x.classList.toggle('aktif', x.dataset.gorunum === ad));
    document.querySelectorAll('.gorunum').forEach(x => x.classList.toggle('aktif', x.id === ad));
    document.body.classList.toggle('gorunum-yardim', ad === 'yardim');
    S.gorunum = ad;
    if (ad === 'yardim') detayKapat(); else ciz();
  }

  function rozet(durum) {
    return el('span', { class: 'rozet', style: `background:var(--d-${durum})` }, DURUM_AD[durum] || durum);
  }
  function ilerleme(y) {
    return el('span', { class: 'cubuk', title: `%${y}` }, el('i', { style: `width:${y}%` }));
  }

  // Liste
  function cizListe(liste) {
    const kok = $('#liste'); kok.innerHTML = '';
    if (!liste.length) { kok.append(el('div', { class: 'bos' }, 'Filtreye uyan görev yok.')); return; }
    const sutunlar = [
      ['kisa', 'No', g => kisaId(g)], ['baslik', 'Başlık', g => g.baslik], ['sahip', 'Sahip', g => kisiAd(g.sahip)],
      ['sorumlu', 'Sorumlu', g => (g.sorumlular || []).length > 1 ? el('div', { class: 'kisi-liste' }, ...g.sorumlular.map(k => el('div', { title: k.eposta || '' }, kisiAd(k)))) : sorumluMetin(g)], ['durum', 'Durum', g => rozet(g.durum)], ['yuzde', '%', g => ilerleme(g.yuzde)],
      ['oncelik', 'Öncelik', g => el('span', { class: 'oncelik-' + g.oncelik }, ONCELIK_AD[g.oncelik])],
      ['baslangic', 'Başlangıç', g => tr(g.baslangic)], ['termin', 'Termin', g => el('span', { class: gecikmis(g) ? 'gecikmis' : '' }, tr(g.termin))],
      ['proje', 'Proje', g => g.proje || ''], ['efor', 'Efor (sa)', g => g.eforTakibi ? `${g.harcananSaat || 0} / ${g.tahminiSaat || '-'}` : '']
    ];
    if (coklu() && !$('#fHesap').value) sutunlar.unshift(['hesap', 'Hesap', g => el('span', { class: 'hesap-etiket', title: hesapAd(g) }, hesapAd(g))]);
    const anahtar = { hesap: hesapAd, kisa: kisaId, sahip: g => kisiAd(g.sahip), sorumlu: sorumluMetin, efor: g => g.harcananSaat || 0 };
    liste.sort((a, b) => {
      const f = anahtar[S.sira.alan] || (g => g[S.sira.alan] ?? '');
      const x = f(a), y = f(b);
      const c = typeof x === 'number' ? x - y : String(x).localeCompare(String(y), 'tr');
      return S.sira.ters ? -c : c;
    });
    const thead = el('thead', null, el('tr', null, ...sutunlar.map(([k, ad]) =>
      el('th', { class: S.sira.alan === k ? 'sirali' + (S.sira.ters ? ' ters' : '') : '', onclick: () => { S.sira = { alan: k, ters: S.sira.alan === k && !S.sira.ters }; ciz(); } }, ad))));
    const tbody = el('tbody', null, ...liste.map(g => el('tr', { class: S.secili === gk(g) ? 'secili' : '', onclick: () => sec(g) },
      ...sutunlar.map(([k, , f]) => el('td', { class: k === 'baslik' || k === 'sorumlu' ? k : '' }, f(g))))));
    kok.append(el('table', { class: 'liste' }, thead, tbody));
  }

  // Kanban
  function cizKanban(liste) {
    const kok = $('#kanban'); kok.innerHTML = '';
    const pano = el('div', { class: 'kanban' });
    for (const d of KANBAN_SUTUN) {
      const kartlar = liste.filter(g => g.durum === d);
      const sutun = el('div', { class: 'sutun', 'data-durum': d },
        el('h3', null, DURUM_AD[d], el('span', { class: 'sayi' }, kartlar.length)));
      sutun.addEventListener('dragover', e => { e.preventDefault(); sutun.classList.add('hedef'); });
      sutun.addEventListener('dragleave', () => sutun.classList.remove('hedef'));
      sutun.addEventListener('drop', async e => {
        e.preventDefault(); sutun.classList.remove('hedef');
        const g = S.gorevler.find(x => gk(x) === e.dataTransfer.getData('text/plain'));
        if (!g) return;
        try {
          const yeni = await kopru.gonder('kanbanTasi', { gorevId: g.gorevId, hesap: g.hk, hedef: d });
          if (yeni) ornekOlay('gorevGuncellendi', yeni);
        }
        catch (err) { bildir(err.message, true); }
      });
      for (const g of kartlar) {
        const kart = el('div', { class: 'kart', draggable: 'true', style: `border-left-color:var(--d-${g.durum})`, onclick: () => sec(g) },
          el('div', { class: 'k-baslik', title: g.baslik }, g.baslik),
          el('div', { class: 'k-alt' }, el('span', { class: 'esnek', title: sorumluMetin(g) }, sorumluMetin(g)),
            el('span', { class: 'sabit' + (gecikmis(g) ? ' gecikmis' : '') }, tr(g.termin))),
          el('div', { class: 'k-alt' }, el('span', { class: 'sabit oncelik-' + g.oncelik }, ONCELIK_AD[g.oncelik]),
            el('span', { class: 'esnek sag', title: g.proje || '' }, g.proje || '')),
          ilerleme(g.yuzde));
        kart.addEventListener('dragstart', e => { e.dataTransfer.setData('text/plain', gk(g)); kart.classList.add('suruklenen'); });
        kart.addEventListener('dragend', () => kart.classList.remove('suruklenen'));
        sutun.append(kart);
      }
      pano.append(sutun);
    }
    kok.append(pano);
  }

  // Gantt
  function cizGantt(liste) {
    const alan = $('#ganttAlan'); alan.innerHTML = '';
    liste = liste.filter(g => g.termin);
    if (!liste.length) { alan.append(el('div', { class: 'bos' }, 'Gösterilecek görev yok.')); return; }

    const olcek = $('#gOlcek').value, grup = $('#gGrup').value;
    const gunPx = olcek === 'gun' ? 36 : olcek === 'hafta' ? 14 : 4;
    const solGen = 400, satirY = 28, ustY = 44;
    const gun = s => new Date(s + 'T00:00:00');
    const fark = (a, b) => Math.round((b - a) / 86400000);

    let bas = gun(S.bugun), bit = gun(S.bugun);
    for (const g of liste) { const b = gun(g.baslangic || g.termin), t = gun(g.termin); if (b < bas) bas = b; if (t > bit) bit = t; }
    bas = new Date(bas); bas.setDate(bas.getDate() - 3);
    bit = new Date(bit); bit.setDate(bit.getDate() + 7);
    const toplamGun = fark(bas, bit) + 1;
    const x = d => solGen + fark(bas, d) * gunPx;

    // Gruplama
    const satirlar = [];
    if (grup) {
      const anahtar = g => grup === 'proje' ? (g.proje || '(projesiz)') : (sorumluMetin(g) || '(sorumlu yok)');
      const gruplar = new Map();
      for (const g of liste) { const k = anahtar(g); if (!gruplar.has(k)) gruplar.set(k, []); gruplar.get(k).push(g); }
      for (const [k, gs] of [...gruplar].sort((a, b) => a[0].localeCompare(b[0], 'tr'))) {
        satirlar.push({ grup: k });
        gs.sort((a, b) => (a.baslangic || a.termin).localeCompare(b.baslangic || b.termin));
        for (const g of gs) satirlar.push({ g });
      }
    } else {
      liste.sort((a, b) => (a.baslangic || a.termin).localeCompare(b.baslangic || b.termin));
      for (const g of liste) satirlar.push({ g });
    }

    const W = solGen + toplamGun * gunPx, H = ustY + satirlar.length * satirY + 8;
    const NS = 'http://www.w3.org/2000/svg';
    const s = (tag, attrs, metin) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); if (metin != null) e.textContent = metin; return e; };

    // Sol sütun (görev adları) sabit, sağ taraf yatay kaydırılır
    const tuval = document.createElement('canvas').getContext('2d'), yazi = getComputedStyle(document.body).fontFamily;
    const olc = (metin, punto) => { tuval.font = punto + 'px ' + yazi; return tuval.measureText(metin).width; };
    const sol = document.createElementNS(NS, 'svg');
    sol.setAttribute('width', solGen); sol.setAttribute('height', H); sol.setAttribute('class', 'g-sol');
    satirlar.forEach((st, i) => {
      const y = ustY + i * satirY;
      if (st.grup) { sol.append(s('text', { x: 8, y: y + 18, class: 'g-grup' }, st.grup)); return; }
      const g = st.g;
      const grp = s('g', { class: 'g-satir', style: 'cursor:pointer' });
      grp.addEventListener('click', () => sec(g));
      grp.append(s('rect', { x: 0, y, width: solGen, height: satirY, class: 'g-zemin', fill: 'transparent' }));
      // Kişi etiketi kısa tutulur (ad ya da adresin @ öncesi, en çok 14 harf); başlık kalan genişliğe göre kısaltılır ki üst üste binmesin.
      let kisi = g.sorumlular && g.sorumlular[0] ? kisiAd(g.sorumlular[0]).split(' ')[0].split('@')[0] : '';
      if (kisi.length > 14) kisi = kisi.slice(0, 13) + '…';
      if (kisi && g.sorumlular.length > 1) kisi += ' +' + (g.sorumlular.length - 1);
      const bos = solGen - 16 - (kisi ? olc(kisi, 11) + 14 : 0);
      let baslik = g.baslik;
      if (olc(baslik, 12) > bos) { while (baslik.length > 4 && olc(baslik + '…', 12) > bos) baslik = baslik.slice(0, -1); baslik = baslik.trimEnd() + '…'; }
      grp.append(s('text', { x: 8, y: y + 18, class: 'g-metin' }, baslik));
      grp.append(s('text', { x: solGen - 8, y: y + 18, class: 'g-metin2', 'text-anchor': 'end' }, kisi));
      grp.append(s('title', {}, `${g.baslik}\n${sorumluMetin(g)}`));
      sol.append(grp);
    });
    sol.append(s('line', { x1: solGen - 0.5, y1: 0, x2: solGen - 0.5, y2: H, class: 'g-izgara' }));

    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('width', W - solGen); svg.setAttribute('height', H);
    svg.setAttribute('viewBox', `${solGen} 0 ${W - solGen} ${H}`);

    // Zaman ekseni: hafta sonu zemini + ızgara + etiketler
    for (let i = 0; i < toplamGun; i++) {
      const d = new Date(bas); d.setDate(d.getDate() + i);
      const gx = x(d);
      if (d.getDay() === 0 || d.getDay() === 6) svg.append(s('rect', { x: gx, y: ustY, width: gunPx, height: H - ustY, class: 'g-haftasonu' }));
      const haftaBasi = d.getDay() === 1, ayBasi = d.getDate() === 1;
      if ((olcek === 'gun') || (olcek === 'hafta' && haftaBasi) || (olcek === 'ay' && ayBasi)) {
        svg.append(s('line', { x1: gx, y1: 22, x2: gx, y2: H, class: 'g-izgara' }));
        const etiket = olcek === 'ay' ? d.toLocaleDateString('tr-TR', { month: 'short', year: '2-digit' }) : d.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit' });
        svg.append(s('text', { x: gx + 3, y: 36, class: 'g-metin2' }, etiket));
      }
      if (olcek !== 'ay' && ayBasi) svg.append(s('text', { x: gx + 3, y: 16, class: 'g-grup' }, d.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' })));
    }

    // Satırlar (çubuklar)
    satirlar.forEach((st, i) => {
      const y = ustY + i * satirY;
      if (st.grup) { svg.append(s('line', { x1: solGen, y1: y + satirY - 0.5, x2: W, y2: y + satirY - 0.5, class: 'g-izgara' })); return; }
      const g = st.g;
      const grp = s('g', { class: 'g-satir', style: 'cursor:pointer' });
      grp.addEventListener('click', () => sec(g));
      grp.append(s('rect', { x: solGen, y, width: W - solGen, height: satirY, class: 'g-zemin', fill: 'transparent' }));
      const b = gun(g.baslangic || g.termin), t = gun(g.termin);
      const bx = x(b), bw = Math.max(gunPx, (fark(b, t) + 1) * gunPx);
      const gec = gecikmis(g);
      grp.append(s('rect', { x: bx, y: y + 6, width: bw, height: satirY - 12, class: 'g-cubuk' + (gec ? ' gecikmis' : '') }));
      if (g.yuzde > 0) grp.append(s('rect', { x: bx, y: y + 6, width: bw * g.yuzde / 100, height: satirY - 12, class: 'g-ilerleme' + (gec ? ' gecikmis' : '') }));
      grp.append(s('title', {}, `${g.baslik}\n${tr(g.baslangic)} → ${tr(g.termin)} · %${g.yuzde} · ${DURUM_AD[g.durum]}`));
      svg.append(grp);
    });

    // Bugün çizgisi
    const bx = x(gun(S.bugun)) + gunPx / 2;
    svg.append(s('line', { x1: bx, y1: 22, x2: bx, y2: H, class: 'g-bugun' }));
    svg.append(s('text', { x: bx + 4, y: H - 4, class: 'g-metin2', fill: 'var(--kirmizi)' }, 'Bugün'));

    const sag = el('div', { class: 'g-sag' }, svg);
    alan.append(el('div', { class: 'g-cerceve' }, sol, sag));
    sag.scrollLeft = Math.max(0, (bx - solGen) - sag.clientWidth / 2);
  }

  // Yük
  function cizYuk(liste) {
    const kok = $('#yuk'); kok.innerHTML = '';
    const kisiler = new Map();
    for (const g of liste) for (const k of g.sorumlular || []) {
      const key = norm(k.eposta);
      if (!kisiler.has(key)) kisiler.set(key, { ad: kisiAd(k), acik: 0, gecikmis: 0, tamam: 0, tahmini: 0, harcanan: 0 });
      const r = kisiler.get(key);
      if (ACIK.has(g.durum)) r.acik++; else if (g.durum === 'Tamamlandi' || g.durum === 'Kapatildi') r.tamam++;
      if (gecikmis(g)) r.gecikmis++;
      if (g.eforTakibi) { r.tahmini += g.tahminiSaat || 0; r.harcanan += g.harcananSaat || 0; }
    }
    if (!kisiler.size) { kok.append(el('div', { class: 'bos' }, 'Veri yok.')); return; }
    const satir = [...kisiler.values()].sort((a, b) => b.acik - a.acik);
    kok.append(el('table', { class: 'yuk' },
      el('thead', null, el('tr', null, ...['Sorumlu', 'Açık', 'Gecikmiş', 'Tamamlanan', 'Tahmini (sa)', 'Harcanan (sa)', 'Kalan (sa)'].map(h => el('th', null, h)))),
      el('tbody', null, ...satir.map(r => el('tr', null,
        el('td', null, r.ad), el('td', null, r.acik), el('td', { class: r.gecikmis ? 'gecikmis' : '' }, r.gecikmis), el('td', null, r.tamam),
        el('td', null, r.tahmini.toFixed(1)), el('td', null, r.harcanan.toFixed(1)), el('td', null, Math.max(0, r.tahmini - r.harcanan).toFixed(1)))))));
  }

  // ------------------------------------------------------------------ detay
  function sec(g) { S.secili = gk(g); detayGoster(g); if (S.gorunum === 'liste') ciz(); }

  function detayGoster(g) {
    document.body.classList.add('detay-acik');
    $('#detay').classList.remove('kapali');
    $('#dKisaId').textContent = kisaId(g) + (g.grupId ? ' · grup' : '');
    $('#dBaslik').textContent = g.baslik;
    const r = rol(g);
    const govde = $('#dGovde'); govde.innerHTML = '';

    // Aksiyonlar (yetki + durum: Core kuralları ile uyumlu; sunucu tarafı yine doğrular)
    const aks = [];
    const d = g.durum;
    const ekle = (ad, tur) => aks.push(el('button', { onclick: () => islem(g, tur) }, ad));
    if (r === 'Sorumlu') {
      if (d === 'Yeni') { ekle('Kabul et', 'Kabul'); ekle('Reddet', 'Reddet'); }
      if (['Yeni', 'KabulEdildi', 'DevamEdiyor', 'Beklemede'].includes(d)) ekle('İş kaydı', 'IsKaydi');
      if (['KabulEdildi', 'DevamEdiyor'].includes(d)) { ekle('Tamamla', 'Tamamla'); ekle('Beklet', 'Beklet'); ekle('Termin iste', 'TerminIste'); }
      if (d === 'Beklemede') ekle('Devam et', 'DevamEt');
    }
    if (r === 'Sahip') {
      if (d === 'Tamamlandi') ekle('Kapat (onayla)', 'Kapat');
      if (['Tamamlandi', 'Kapatildi', 'Reddedildi', 'IptalEdildi'].includes(d)) ekle('Yeniden aç', 'YenidenAc');
      if (['Yeni', 'KabulEdildi', 'DevamEdiyor', 'Beklemede'].includes(d)) { ekle('Termin değiştir', 'TerminDegistir'); ekle('İptal et', 'Iptal'); }
      if (['KabulEdildi', 'DevamEdiyor'].includes(d)) ekle('Tamamla', 'Tamamla');
    }
    if (r !== 'Yok' && d !== 'IptalEdildi') ekle('Yorum', 'Yorum');
    aks.push(el('button', { onclick: () => kopru.gonder('mailiAc', { gorevId: g.gorevId, hesap: g.hk }).catch(e => bildir(e.message, true)) }, 'Maili aç'));
    govde.append(el('div', { class: 'aksiyonlar' }, ...aks));

    const dl = el('dl', null,
      coklu() ? el('dt', null, 'Hesap') : null, coklu() ? el('dd', null, hesapAd(g)) : null,
      el('dt', null, 'Durum'), el('dd', null, rozet(g.durum), ' ', ilerleme(g.yuzde), ` %${g.yuzde}`),
      el('dt', null, 'Sahip'), el('dd', null, kisiAd(g.sahip)),
      el('dt', null, g.atamaModu === 'Ortak' ? 'Sorumlular (ortak)' : 'Sorumlu'), el('dd', null, sorumluMetin(g)),
      el('dt', null, 'Bilgi'), el('dd', null, (g.bilgi || []).map(kisiAd).join(', ') || '—'),
      el('dt', null, 'Tarihler'), el('dd', { class: gecikmis(g) ? 'gecikmis' : '' }, `${tr(g.baslangic)} → ${tr(g.termin)}` + (g.bekleyenTerminIstegi ? ` (istek: ${tr(g.bekleyenTerminIstegi)})` : '')),
      el('dt', null, 'Öncelik'), el('dd', { class: 'oncelik-' + g.oncelik }, ONCELIK_AD[g.oncelik]),
      el('dt', null, 'Proje'), el('dd', null, g.proje || '—'));
    if (g.eforTakibi) dl.append(el('dt', null, 'Efor'), el('dd', null, `Harcanan ${g.harcananSaat || 0} sa / tahmini ${g.tahminiSaat || '-'} sa`));
    if (g.redGerekcesi) dl.append(el('dt', null, 'Red gerekçesi'), el('dd', null, g.redGerekcesi));
    govde.append(dl);

    if (g.aciklamaHtml) { govde.append(el('h4', null, 'Açıklama')); govde.append(el('div', { class: 'aciklama', html: g.aciklamaHtml })); }

    if ((g.altAdimlar || []).length) {
      govde.append(el('h4', null, `Alt adımlar (${g.altAdimlar.filter(a => a.tamam).length}/${g.altAdimlar.length})`));
      for (const a of g.altAdimlar) {
        const cb = el('input', { type: 'checkbox' });
        cb.checked = !!a.tamam;
        cb.disabled = !(r === 'Sahip' || r === 'Sorumlu') || d === 'IptalEdildi';
        cb.addEventListener('change', () => kopru.gonder('altAdim', { gorevId: g.gorevId, hesap: g.hk, altAdimId: a.id, tamam: cb.checked }).catch(e => { bildir(e.message, true); cb.checked = !cb.checked; }));
        govde.append(el('label', { class: 'altadim' }, cb, a.metin));
      }
    }

    if ((g.isKayitlari || []).length) {
      govde.append(el('h4', null, 'İş kayıtları'));
      for (const k of [...g.isKayitlari].reverse())
        govde.append(el('div', { class: 'kayit' },
          el('div', { class: 'k-ust' }, `${tr(k.tarih)} · ${kisiAd(k.kisi)}` + (k.saat != null ? ` · ${k.saat} sa` : '') + (k.yuzde != null ? ` · %${k.yuzde}` : '')),
          el('div', null, k.not || '')));
    }

    if ((g.yorumlar || []).length) {
      govde.append(el('h4', null, 'Yorumlar'));
      for (const y of [...g.yorumlar].reverse())
        govde.append(el('div', { class: 'kayit' },
          el('div', { class: 'k-ust' }, `${new Date(y.zaman).toLocaleString('tr-TR')} · ${kisiAd(y.kisi)}`),
          el('div', null, y.metin)));
    }
  }

  async function islem(g, tur) {
    try {
      const yeni = await kopru.gonder('islem', { gorevId: g.gorevId, hesap: g.hk, tur });
      if (yeni) ornekOlay('gorevGuncellendi', yeni);
    } catch (e) { bildir(e.message, true); }
  }

  function detayKapat() { document.body.classList.remove('detay-acik'); $('#detay').classList.add('kapali'); S.secili = null; if (S.gorunum === 'liste') ciz(); }

  // ------------------------------------------------------------------ bildirim
  let bildirimZamanlayici;
  function bildir(metin, hata) {
    const b = $('#bildirim'); b.textContent = metin; b.className = 'bildirim' + (hata ? ' hata' : '');
    clearTimeout(bildirimZamanlayici); bildirimZamanlayici = setTimeout(() => b.classList.add('gizli'), 4000);
  }

  // ------------------------------------------------------------------ olaylar
  document.querySelectorAll('.sekme').forEach(b => b.addEventListener('click', () => sekmeSec(b.dataset.gorunum)));

  // Yardım içi gezinme: bölüme kaydır, aktif bağlantıyı işaretle
  document.querySelectorAll('.yardim-nav a').forEach(a => a.addEventListener('click', e => {
    e.preventDefault();
    const hedef = document.getElementById(a.getAttribute('href').slice(1));
    if (hedef) hedef.scrollIntoView({ behavior: 'smooth', block: 'start' });
    document.querySelectorAll('.yardim-nav a').forEach(x => x.classList.toggle('aktif', x === a));
  }));
  ['#fHesap', '#fKapsam', '#fDurum', '#fProje', '#fKisi', '#fGecikmis', '#gOlcek', '#gGrup'].forEach(s => $(s).addEventListener('change', ciz));
  $('#fAra').addEventListener('input', ciz);
  $('#btnYenile').addEventListener('click', () => kopru.web ? kopru.gonder('esitle').then(yukle).catch(e => bildir(e.message, true)) : yukle());
  document.querySelectorAll('[data-komut]').forEach(b => b.addEventListener('click', () => kopru.gonder(b.dataset.komut).catch(e => bildir(e.message, true))));
  $('#btnYeni').addEventListener('click', () => kopru.gonder('yeniGorev', { hesap: $('#fHesap').value }).catch(e => bildir(e.message, true)));
  $('#btnAktar').addEventListener('click', () => kopru.gonder('disariAktar').then(ok => ok && bildir('CSV kaydedildi.')).catch(e => bildir(e.message, true)));
  $('#dKapat').addEventListener('click', detayKapat);
  if ($('#btnHesaplarAc')) $('#btnHesaplarAc').addEventListener('click', () => kopru.gonder('hesaplar').catch(e => bildir(e.message, true)));
  $('#hosgeldinKapat').addEventListener('click', () => $('#hosgeldin').classList.add('gizli'));

  // Dış bağlantılar WebView içinde değil, varsayılan tarayıcıda açılır
  document.addEventListener('click', e => {
    const a = e.target.closest('a[href^="http"]');
    if (!a) return;
    e.preventDefault();
    if (kopru.canli) kopru.gonder('disBaglantiAc', { url: a.href }).catch(err => bildir(err.message, true));
    else window.open(a.href, '_blank', 'noopener');
  });

  // ------------------------------------------------------------------ tarayıcı geliştirme modu (köprü yokken)
  function sahte(komut, p) {
    if (!window.__ornek) {
      const ben = { ad: 'Ayşe Yönetici', eposta: 'ayse@kurum.local' };
      const m = { ad: 'Mehmet Uzman', eposta: 'mehmet@kurum.local' }, z = { ad: 'Zeynep Uzman', eposta: 'zeynep@kurum.local' };
      const bugun = new Date(), t = n => { const d = new Date(bugun); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
      const g = (i, baslik, sorumlu, durum, yuzde, b, e, proje, onc) => ({ gorevId: `00000000-0000-0000-0000-00000000000${i}`, baslik, sahip: ben, sorumlular: [sorumlu], bilgi: [], durum, yuzde, baslangic: t(b), termin: t(e), proje, oncelik: onc || 'Normal', eforTakibi: true, tahminiSaat: 8, harcananSaat: yuzde / 10, altAdimlar: [{ id: 'a' + i, metin: 'Veri topla', tamam: yuzde > 30 }, { id: 'b' + i, metin: 'Rapor yaz', tamam: false }], isKayitlari: [], yorumlar: [], atamaModu: 'AyriAyri' });
      window.__ornek = { ben, bugun: t(0), gorevler: [
        g(1, 'Fatura mutabakat raporu', m, 'DevamEdiyor', 40, -5, 4, 'Kapanış', 'Yuksek'),
        g(2, 'Sunucu bakım planı', z, 'Yeni', 0, 0, 12, 'Altyapı'),
        g(3, 'Eğitim materyali güncelleme', m, 'Beklemede', 60, -12, -2, 'Eğitim', 'Kritik'),
        g(4, 'Tedarikçi sözleşme revizyonu', z, 'Tamamlandi', 100, -20, -3, 'Kapanış'),
        g(5, 'Yıl sonu envanter', m, 'KabulEdildi', 0, 2, 20, 'Kapanış', 'Dusuk')
      ] };
    }
    if (komut === 'listele') return Promise.resolve(Object.assign({ surum: '0.0.0 (tarayıcı)' }, window.__ornek));
    return Promise.reject(new Error('Tarayıcı geliştirme modunda "' + komut + '" desteklenmez.'));
  }

  // Tarayıcıda ?gorunum=yardim ile doğrudan yardım açılabilir (geliştirme/önizleme)
  const istenen = new URLSearchParams(location.search).get('gorunum');
  if (istenen) sekmeSec(istenen);

  yukle();
})();
