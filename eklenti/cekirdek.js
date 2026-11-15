/* Görev Eklentisi — çekirdek (GorevEklentisi.Core'un JavaScript karşılığı).
   Windows eklentisiyle aynı olay modeli, yetki/geçiş kuralları, projeksiyon, mail metinleri ve zarf biçimi.
   İki uygulama aynı mailleri okuyup yazdığından buradaki davranış C# tarafıyla birebir tutulur
   (bkz. src/GorevEklentisi.Core; değişiklik iki tarafta birlikte yapılır). DOM'a bağımlı değildir: Node'da da çalışır (testler). */
(function (kok) {
  'use strict';

  const Sabitler = {
    SemaSurumu: 1, EkAdi: 'gorev.json', EkAzamiBoyut: 256 * 1024,
    BaslikSurum: 'X-Gorev-Surum', BaslikGorevId: 'X-Gorev-Id', BaslikOlay: 'X-Gorev-Olay', BaslikOlayId: 'X-Gorev-OlayId',
    KonuOnEki: '[GÖREV]', KonuKoku: '[GÖREV', GorevKlasoru: 'Görevler', KaynakWeb: 'outlook'
  };

  // ------------------------------------------------------------------ temel yardımcılar
  const bos = s => s == null || String(s).trim() === '';
  const norm = e => bos(e) ? '' : String(e).trim().toLowerCase();
  const kisiEsit = (a, b) => !!a && !!b && norm(a.eposta) === norm(b.eposta);
  const kisiMetin = k => !k ? '' : (bos(k.ad) ? (k.eposta || '') : `${k.ad} <${k.eposta}>`);
  const kopya = o => JSON.parse(JSON.stringify(o));

  function guid() {
    const c = kok.crypto || (typeof require === 'function' ? require('crypto').webcrypto : null);
    if (c && c.randomUUID) return c.randomUUID();
    const b = new Uint8Array(16); c.getRandomValues(b);
    b[6] = (b[6] & 0x0f) | 0x40; b[8] = (b[8] & 0x3f) | 0x80;
    const h = Array.from(b, x => x.toString(16).padStart(2, '0')).join('');
    return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
  }
  const guidMi = s => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(s || ''));
  const kisaId = gorevId => String(gorevId || '').replace(/-/g, '').slice(0, 8).toUpperCase();

  /** Zaman karşılaştırma anahtarı: .NET 7 basamaklı kesir yazar, JS 3; sözlük sırası = zaman sırası olacak biçime getirilir. */
  function zamanAnahtar(z) {
    const s = String(z || '');
    const m = /^(\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d)(?:\.(\d+))?(Z|[+-]\d\d:?\d\d)?$/.exec(s);
    if (!m) { const d = new Date(s); return isNaN(d) ? '' : d.toISOString().slice(0, 19) + '.' + d.toISOString().slice(20, 23) + '0000'; }
    let taban = m[1]; const kesir = (m[2] || '').padEnd(7, '0').slice(0, 7);
    if (m[3] && m[3] !== 'Z') { const d = new Date(m[1] + m[3]); if (!isNaN(d)) taban = d.toISOString().slice(0, 19); }
    return taban + '.' + kesir;
  }
  const simdiIso = () => new Date().toISOString();
  const bugunYerel = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
  const tarihGoster = t => /^\d{4}-\d\d-\d\d/.test(t || '') ? `${t.slice(8, 10)}.${t.slice(5, 7)}.${t.slice(0, 4)}` : (t || '');
  const sayi1 = n => { const r = Math.round(n * 10) / 10; return String(r).replace('.', ','); }; // "0.#" (tr-TR)

  // ------------------------------------------------------------------ görev modeli
  /** Dışarıdan gelen görev nesnesini eksik alanları varsayılanlarla tamamlayarak döner (C# sınıf varsayılanları). */
  function gorevTamamla(g) {
    if (!g) return null;
    const y = kopya(g);
    y.sorumlular = y.sorumlular || []; y.bilgi = y.bilgi || []; y.altAdimlar = y.altAdimlar || [];
    y.isKayitlari = y.isKayitlari || []; y.yorumlar = y.yorumlar || []; y.disKimlikler = y.disKimlikler || {};
    y.atamaModu = y.atamaModu || 'AyriAyri'; y.oncelik = y.oncelik || 'Normal'; y.durum = y.durum || 'Yeni';
    y.eforTakibi = !!y.eforTakibi; y.yuzde = y.yuzde || 0; y.harcananSaat = y.harcananSaat || 0;
    y.surum = y.surum || Sabitler.SemaSurumu;
    return y;
  }

  function rolBul(g, eposta) {
    const e = norm(eposta);
    if (g.sahip && norm(g.sahip.eposta) === e) return 'Sahip';
    if ((g.sorumlular || []).some(k => norm(k.eposta) === e)) return 'Sorumlu';
    if ((g.bilgi || []).some(k => norm(k.eposta) === e)) return 'Bilgi';
    return 'Yok';
  }

  // ------------------------------------------------------------------ kurallar
  const Izinler = {
    GorevOlusturuldu: ['Sahip'], GorevKabulEdildi: ['Sorumlu'], GorevReddedildi: ['Sorumlu'], IsKaydiEklendi: ['Sorumlu'],
    DurumDegisti: ['Sahip', 'Sorumlu'], TerminDegisikligiIstendi: ['Sorumlu'], TerminDegistirildi: ['Sahip'],
    GorevTamamlandi: ['Sahip', 'Sorumlu'], GorevKapatildi: ['Sahip'], GorevYenidenAcildi: ['Sahip'], GorevIptalEdildi: ['Sahip'],
    GorevDuzenlendi: ['Sahip'], AltAdimGuncellendi: ['Sahip', 'Sorumlu'], YorumEklendi: ['Sahip', 'Sorumlu', 'Bilgi']
  };

  function yetkili(gorev, olay) {
    const ur = olay.uretici && olay.uretici.eposta;
    if (olay.tip === 'GorevOlusturuldu') return gorev == null || rolBul(gorev, ur) === 'Sahip';
    if (gorev == null || !olay.uretici) return false;
    const roller = Izinler[olay.tip];
    return !!roller && roller.includes(rolBul(gorev, ur));
  }

  const veri = (o, alan) => { const v = o.veri ? o.veri[alan] : undefined; return v === undefined || v === null ? null : v; };
  const veriStr = (o, alan) => { const v = veri(o, alan); return v === null ? null : String(v); };

  function gecisIzinli(mevcut, olay) {
    const t = olay.tip;
    if (t === 'GorevOlusturuldu') return true;
    if (t === 'YorumEklendi' || t === 'AltAdimGuncellendi') return mevcut !== 'IptalEdildi';
    const yeniDurum = veri(olay, 'yeniDurum') || 'Yeni';
    switch (mevcut) {
      case 'Yeni': return ['GorevKabulEdildi', 'GorevReddedildi', 'IsKaydiEklendi', 'GorevIptalEdildi', 'GorevDuzenlendi', 'TerminDegistirildi'].includes(t);
      case 'KabulEdildi': return ['IsKaydiEklendi', 'DurumDegisti', 'GorevTamamlandi', 'GorevIptalEdildi', 'GorevDuzenlendi', 'TerminDegistirildi', 'TerminDegisikligiIstendi'].includes(t);
      case 'DevamEdiyor':
        if (t === 'DurumDegisti') return yeniDurum === 'Beklemede';
        return ['IsKaydiEklendi', 'GorevTamamlandi', 'GorevIptalEdildi', 'GorevDuzenlendi', 'TerminDegistirildi', 'TerminDegisikligiIstendi'].includes(t);
      case 'Beklemede':
        if (t === 'DurumDegisti') return yeniDurum === 'DevamEdiyor';
        return ['IsKaydiEklendi', 'GorevIptalEdildi', 'GorevDuzenlendi', 'TerminDegistirildi'].includes(t);
      case 'Reddedildi': return t === 'GorevYenidenAcildi' || t === 'GorevIptalEdildi';
      case 'Tamamlandi': return t === 'GorevKapatildi' || t === 'GorevYenidenAcildi';
      case 'Kapatildi': case 'IptalEdildi': return t === 'GorevYenidenAcildi';
    }
    return false;
  }

  /** Kanban sürükle-bırak: hedef sütuna geçişi sağlayan olay tipi, yoksa null. */
  function hedefDurumIcinOlay(mevcut, hedef, rol) {
    if (mevcut === hedef) return null;
    switch (hedef) {
      case 'KabulEdildi': return rol === 'Sorumlu' && mevcut === 'Yeni' ? 'GorevKabulEdildi' : null;
      case 'DevamEdiyor':
        if (mevcut === 'Beklemede') return 'DurumDegisti';
        if (mevcut === 'Tamamlandi' || mevcut === 'Kapatildi') return rol === 'Sahip' ? 'GorevYenidenAcildi' : null;
        return rol === 'Sorumlu' ? 'IsKaydiEklendi' : null;
      case 'Beklemede': return mevcut === 'DevamEdiyor' || mevcut === 'KabulEdildi' ? 'DurumDegisti' : null;
      case 'Tamamlandi': return 'GorevTamamlandi';
      case 'Kapatildi': return rol === 'Sahip' && mevcut === 'Tamamlandi' ? 'GorevKapatildi' : null;
      case 'IptalEdildi': return rol === 'Sahip' ? 'GorevIptalEdildi' : null;
      case 'Reddedildi': return rol === 'Sorumlu' && mevcut === 'Yeni' ? 'GorevReddedildi' : null;
    }
    return null;
  }

  function dogrulamaHatasi(gorev, olay) {
    switch (olay.tip) {
      case 'GorevReddedildi': case 'GorevIptalEdildi': case 'GorevYenidenAcildi':
        return bos(veriStr(olay, 'gerekce')) ? 'Gerekçe zorunludur.' : null;
      case 'IsKaydiEklendi': {
        const v = olay.veri || {};
        if (bos(v.tarih)) return 'İş kaydı tarihi zorunludur.';
        if (gorev && gorev.eforTakibi && (v.saat == null || v.saat <= 0)) return 'Bu görevde efor takibi açık: harcanan saat zorunludur.';
        if (v.yuzde != null && (v.yuzde < 0 || v.yuzde > 100)) return 'Yüzde 0–100 aralığında olmalıdır.';
        return null;
      }
      case 'TerminDegistirildi': return bos(veriStr(olay, 'yeniTermin')) ? 'Yeni termin zorunludur.' : null;
      case 'TerminDegisikligiIstendi': return bos(veriStr(olay, 'onerilenTermin')) ? 'Önerilen termin zorunludur.' : null;
      case 'YorumEklendi': return bos(veriStr(olay, 'metin')) ? 'Yorum boş olamaz.' : null;
    }
    return null;
  }

  /** Arayüz işlem türü (Kabul, IsKaydi…) şu an bu rolde yapılabilir mi (GorevEylemleri.Izinli). */
  function islemIzinli(g, tur, benEposta) {
    if (!g) return false;
    const rol = rolBul(g, benEposta), d = g.durum;
    const aktif = ['Yeni', 'KabulEdildi', 'DevamEdiyor', 'Beklemede'].includes(d);
    const calisiyor = d === 'KabulEdildi' || d === 'DevamEdiyor';
    const sahip = rol === 'Sahip', sorumlu = rol === 'Sorumlu';
    switch (tur) {
      case 'Kabul': case 'Reddet': return sorumlu && d === 'Yeni';
      case 'IsKaydi': return sorumlu && aktif;
      case 'Tamamla': return (sahip || sorumlu) && calisiyor;
      case 'Kapat': return sahip && d === 'Tamamlandi';
      case 'YenidenAc': return sahip && ['Reddedildi', 'Tamamlandi', 'Kapatildi', 'IptalEdildi'].includes(d);
      case 'Iptal': return sahip && (aktif || d === 'Reddedildi');
      case 'Yorum': return rol !== 'Yok' && d !== 'IptalEdildi';
      case 'TerminDegistir': return sahip && aktif;
      case 'TerminIste': return sorumlu && calisiyor;
      case 'Beklet': return (sahip || sorumlu) && calisiyor;
      case 'DevamEt': return (sahip || sorumlu) && d === 'Beklemede';
    }
    return false;
  }

  // ------------------------------------------------------------------ HTML temizleyici (izin listesi)
  const IZINLI = new Set(['p', 'br', 'b', 'strong', 'i', 'em', 'u', 'ul', 'ol', 'li']);
  const TEHLIKELI = /<\s*(script|style|iframe|object|embed|noscript|template|svg|math|xml|head|title|textarea|select|button|form)\b[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi;
  const YORUM = /<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>|<![^>]*>|<\?[^>]*>/g;
  const ETIKET = /<\s*(\/?)\s*([a-zA-Z][a-zA-Z0-9]*)\b[^>]*>/g;
  const ADLI = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: '\u00a0' };

  function htmlCoz(s) {
    return String(s).replace(/&(#x[0-9a-f]+|#\d+|[a-z][a-z0-9]*);/gi, (tam, ad) => {
      if (ad[0] === '#') {
        const kod = ad[1] === 'x' || ad[1] === 'X' ? parseInt(ad.slice(2), 16) : parseInt(ad.slice(1), 10);
        return kod > 0 && kod <= 0x10ffff ? String.fromCodePoint(kod) : tam;
      }
      const k = ADLI[ad.toLowerCase()];
      return k !== undefined ? k : tam;
    });
  }
  const htmlKodla = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function htmlTemizle(html) {
    if (bos(html)) return null;
    html = String(html);
    if (html.length > 100000) html = html.slice(0, 100000);
    html = html.replace(TEHLIKELI, '').replace(YORUM, '');
    let cikti = '', konum = 0, m;
    const metin = p => { if (p.length) cikti += htmlKodla(htmlCoz(p)); };
    ETIKET.lastIndex = 0;
    while ((m = ETIKET.exec(html)) !== null) {
      metin(html.slice(konum, m.index));
      konum = m.index + m[0].length;
      const ad = m[2].toLowerCase();
      if (!IZINLI.has(ad)) continue;
      if (ad === 'br') { cikti += '<br>'; continue; }
      cikti += (m[1] === '/' ? '</' : '<') + ad + '>';
    }
    metin(html.slice(konum));
    cikti = cikti.trim();
    return cikti.length === 0 ? null : cikti;
  }

  function duzMetin(html) {
    if (!html) return '';
    return htmlCoz(String(html).replace(/<\s*(br|\/p|\/li)\s*>/gi, '\n').replace(/<[^>]*>/g, '')).trim();
  }

  // ------------------------------------------------------------------ projeksiyon
  function sirala(olaylar) {
    return [...olaylar].sort((a, b) => {
      const za = zamanAnahtar(a.zaman), zb = zamanAnahtar(b.zaman);
      if (za !== zb) return za < zb ? -1 : 1;
      const ea = norm(a.uretici && a.uretici.eposta), eb = norm(b.uretici && b.uretici.eposta);
      if (ea !== eb) return ea < eb ? -1 : 1;
      return (a.sira || 0) - (b.sira || 0);
    });
  }

  const damgala = (g, o) => { g.sonOlayZamani = o.zaman; g.sonOlayUretici = o.uretici; };

  /** Tek olayı uygular; mevcut görevi değiştirmez. { uygulandi, neden, gorev } */
  function uygula(mevcut, olay, olusturmaAnlik) {
    if (olay.tip === 'GorevOlusturuldu') {
      if (mevcut != null) return { uygulandi: false, neden: 'Görev zaten var.', gorev: mevcut };
      if (olusturmaAnlik == null && olay.veri && olay.veri.anlik) olusturmaAnlik = olay.veri.anlik;
      if (olusturmaAnlik == null) return { uygulandi: false, neden: 'Oluşturma anlık görüntüsü yok.' };
      const ilk = gorevTamamla(olusturmaAnlik);
      if (!yetkili(ilk, olay)) return { uygulandi: false, neden: 'Oluşturma olayı sahipten gelmiyor.' };
      ilk.aciklamaHtml = htmlTemizle(ilk.aciklamaHtml) || undefined;
      ilk.gorevId = olay.gorevId; ilk.durum = 'Yeni'; ilk.yuzde = 0; ilk.harcananSaat = 0;
      ilk.isKayitlari = []; ilk.yorumlar = []; ilk.olusturma = olay.zaman;
      damgala(ilk, olay);
      return { uygulandi: true, gorev: ilk };
    }

    if (mevcut == null) return { uygulandi: false, neden: 'Görev bilinmiyor.' };
    if (!yetkili(mevcut, olay)) return { uygulandi: false, neden: 'Yetkisiz üretici.', gorev: mevcut };
    if (!gecisIzinli(mevcut.durum, olay)) return { uygulandi: false, neden: `${mevcut.durum} durumunda ${olay.tip} izinli değil.`, gorev: mevcut };
    const hata = dogrulamaHatasi(mevcut, olay);
    if (hata != null) return { uygulandi: false, neden: hata, gorev: mevcut };

    const g = gorevTamamla(mevcut);
    switch (olay.tip) {
      case 'GorevKabulEdildi': g.durum = 'KabulEdildi'; break;
      case 'GorevReddedildi': g.durum = 'Reddedildi'; g.redGerekcesi = veriStr(olay, 'gerekce'); break;
      case 'IsKaydiEklendi': {
        const v = olay.veri || {};
        const kayit = { olayId: olay.olayId, kisi: olay.uretici, tarih: v.tarih };
        if (v.not != null) kayit.not = v.not;
        if (v.saat != null) kayit.saat = v.saat;
        if (v.yuzde != null) kayit.yuzde = v.yuzde;
        g.isKayitlari.push(kayit);
        if (v.saat != null) g.harcananSaat = Math.round((g.harcananSaat + Number(v.saat)) * 100) / 100;
        if (v.yuzde != null) g.yuzde = Math.max(g.yuzde, Math.trunc(v.yuzde));
        if (['Yeni', 'KabulEdildi', 'Beklemede'].includes(g.durum)) g.durum = 'DevamEdiyor';
        break;
      }
      case 'DurumDegisti': g.durum = veri(olay, 'yeniDurum') || 'Yeni'; break;
      case 'TerminDegisikligiIstendi': g.bekleyenTerminIstegi = veriStr(olay, 'onerilenTermin'); break;
      case 'TerminDegistirildi': g.termin = veriStr(olay, 'yeniTermin'); delete g.bekleyenTerminIstegi; break;
      case 'GorevTamamlandi': g.durum = 'Tamamlandi'; g.yuzde = 100; break;
      case 'GorevKapatildi': g.durum = 'Kapatildi'; break;
      case 'GorevYenidenAcildi':
        g.durum = mevcut.durum === 'Reddedildi' ? 'Yeni' : 'DevamEdiyor';
        if (g.yuzde === 100) g.yuzde = 90;
        delete g.redGerekcesi;
        break;
      case 'GorevIptalEdildi': g.durum = 'IptalEdildi'; break;
      case 'YorumEklendi': g.yorumlar.push({ olayId: olay.olayId, kisi: olay.uretici, zaman: olay.zaman, metin: veriStr(olay, 'metin') }); break;
      case 'AltAdimGuncellendi': {
        const id = norm(veriStr(olay, 'altAdimId'));
        const adim = g.altAdimlar.find(a => norm(a.id) === id);
        const tamam = veri(olay, 'tamam');
        if (adim && tamam !== null) adim.tamam = !!tamam;
        break;
      }
      case 'GorevDuzenlendi': {
        const a = (olay.veri && olay.veri.alanlar) || {};
        if (a.baslik != null) g.baslik = String(a.baslik);
        if (a.aciklamaHtml != null) { const t = htmlTemizle(a.aciklamaHtml); if (t) g.aciklamaHtml = t; else delete g.aciklamaHtml; }
        if (a.oncelik != null && ['Dusuk', 'Normal', 'Yuksek', 'Kritik'].includes(a.oncelik)) g.oncelik = a.oncelik;
        if (a.proje != null) g.proje = String(a.proje);
        if (a.tahminiSaat != null) g.tahminiSaat = Number(a.tahminiSaat);
        if (a.baslangic != null) g.baslangic = String(a.baslangic);
        if (a.altAdimlar != null) g.altAdimlar = a.altAdimlar;
        break;
      }
    }
    damgala(g, olay);
    return { uygulandi: true, gorev: g };
  }

  /** Olay günlüğünden sıfırdan kurar. { gorev, atlananlar } */
  function kur(olusturmaAnlik, olaylar) {
    const atlananlar = [];
    let g = null, liste = sirala(olaylar);
    if (!liste.some(o => o.tip === 'GorevOlusturuldu') && olusturmaAnlik != null) {
      g = gorevTamamla(olusturmaAnlik);
      const sinir = zamanAnahtar(g.sonOlayZamani);
      liste = liste.filter(o => zamanAnahtar(o.zaman) > sinir);
    }
    for (const o of liste) {
      const s = uygula(g, o, olusturmaAnlik);
      if (s.uygulandi) g = s.gorev; else atlananlar.push(`${o.olayId}: ${s.neden}`);
    }
    return { gorev: g, atlananlar };
  }

  // ------------------------------------------------------------------ mail metinleri
  const DURUM_AD = { Yeni: 'Yeni', KabulEdildi: 'Kabul edildi', DevamEdiyor: 'Devam ediyor', Beklemede: 'Beklemede', Reddedildi: 'Reddedildi', Tamamlandi: 'Tamamlandı', Kapatildi: 'Kapatıldı', IptalEdildi: 'İptal edildi' };
  const ONCELIK_AD = { Dusuk: 'Düşük', Normal: 'Normal', Yuksek: 'Yüksek', Kritik: 'Kritik' };
  const durumAdi = d => DURUM_AD[d] || String(d);
  const oncelikAdi = p => ONCELIK_AD[p] || String(p);

  function olayBasligi(o) {
    switch (o.tip) {
      case 'GorevOlusturuldu': return 'Yeni görev';
      case 'GorevKabulEdildi': return 'Kabul edildi';
      case 'GorevReddedildi': return 'Reddedildi';
      case 'IsKaydiEklendi': return 'İş kaydı';
      case 'DurumDegisti': return durumAdi(veri(o, 'yeniDurum') || 'DevamEdiyor');
      case 'TerminDegisikligiIstendi': return 'Termin değişikliği isteği';
      case 'TerminDegistirildi': return 'Termin değişti';
      case 'GorevTamamlandi': return 'Tamamlandı';
      case 'GorevKapatildi': return 'Kapatıldı';
      case 'GorevYenidenAcildi': return 'Yeniden açıldı';
      case 'GorevIptalEdildi': return 'İptal edildi';
      case 'YorumEklendi': return 'Yorum';
      case 'AltAdimGuncellendi': return 'Alt adım güncellendi';
      case 'GorevDuzenlendi': return 'Görev düzenlendi';
    }
    return String(o.tip);
  }

  const konu = (g, o) => o.tip === 'GorevOlusturuldu' ? `${Sabitler.KonuOnEki} ${g.baslik}` : `[GÖREV:${kisaId(g.gorevId)}] ${g.baslik} — ${olayBasligi(o)}`;

  /** Konudaki kısa kimlik ("[GÖREV:AB12CD34] …"); yoksa null. */
  function konudanKisaId(k) {
    const m = /^\s*\[GÖREV:\s*([0-9A-Za-z]{8})\s*\]/i.exec(k || '');
    return m ? m[1].toUpperCase() : null;
  }
  const gorevMailiGibi = k => String(k || '').trimStart().toUpperCase().startsWith(Sabitler.KonuKoku);

  const E = htmlKodla;

  /** Maildeki işlem düğmeleri: gorev://<islem>/<guid> (Windows eklentisi) — web eklentisinde bölmedeki düğmeler kullanılır. */
  function dugmeler(g, o) {
    const liste = [];
    switch (o.tip) {
      case 'GorevOlusturuldu': liste.push(['kabul', 'Kabul Et', true], ['reddet', 'Reddet', false], ['iskaydi', 'İş Kaydı', false]); break;
      case 'GorevYenidenAcildi': case 'TerminDegistirildi': case 'GorevDuzenlendi': case 'GorevKabulEdildi':
        liste.push(['iskaydi', 'İş Kaydı', true], ['tamamla', 'Tamamla', false]); break;
      case 'GorevTamamlandi': liste.push(['kapat', 'Onayla ve Kapat', true], ['yenidenac', 'Yeniden Aç', false]); break;
      case 'TerminDegisikligiIstendi': liste.push(['termindegistir', 'Termini Değiştir', true]); break;
      case 'GorevKapatildi': case 'GorevIptalEdildi': break;
      default: liste.push(['yorum', 'Yorum', false]);
    }
    liste.push(['ac', 'Görevi Aç', liste.length === 0]);
    let sb = '<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 14px 0;border-collapse:separate"><tr>';
    for (const [islem, ad, birincil] of liste) {
      const zemin = birincil ? '#2b579a' : '#ffffff', yazi = birincil ? '#ffffff' : '#2b579a';
      sb += `<td align="center" valign="middle" bgcolor="${zemin}" style="background:${zemin};border:1px solid #2b579a;border-radius:3px;`;
      sb += 'padding:5px 14px;mso-padding-alt:5px 14px;line-height:16px;mso-line-height-rule:exactly;font-family:Segoe UI,Arial,sans-serif;font-size:10pt">';
      sb += `<a href="gorev://${islem}/${String(g.gorevId).toLowerCase()}" style="color:${yazi};text-decoration:none;font-weight:600;display:inline-block">${E(ad)}</a></td>`;
      sb += '<td width="8" style="width:8px;font-size:1px;line-height:1px">&nbsp;</td>';
    }
    return sb + '</tr></table>';
  }

  function olayOzeti(g, o) {
    const notEki = n => bos(n) ? '' : `<br>${E(n)}`;
    switch (o.tip) {
      case 'IsKaydiEklendi': {
        const v = o.veri || {};
        return `<b>${tarihGoster(v.tarih)}</b>` + (v.saat != null ? ` · ${sayi1(v.saat)} sa` : '') + (v.yuzde != null ? ` · %${v.yuzde}` : '') + (bos(v.not) ? '' : `<br>${E(v.not)}`);
      }
      case 'GorevReddedildi': case 'GorevIptalEdildi': case 'GorevYenidenAcildi': return `Gerekçe: ${E(veriStr(o, 'gerekce'))}`;
      case 'TerminDegistirildi': return `Yeni termin: <b>${tarihGoster(veriStr(o, 'yeniTermin'))}</b>` + notEki(veriStr(o, 'not'));
      case 'TerminDegisikligiIstendi': return `Önerilen termin: <b>${tarihGoster(veriStr(o, 'onerilenTermin'))}</b><br>Gerekçe: ${E(veriStr(o, 'gerekce'))}`;
      case 'YorumEklendi': return E(veriStr(o, 'metin'));
      case 'DurumDegisti': return `Yeni durum: <b>${durumAdi(veri(o, 'yeniDurum') || 'Yeni')}</b>` + notEki(veriStr(o, 'not'));
      default: return E(veriStr(o, 'not') || '');
    }
  }

  function govde(g, o) {
    const satir = (k, v) => `<tr><td style="color:#666;padding-right:12px">${k}</td><td>${v}</td></tr>`;
    let sb = '<html><body style="font-family:Segoe UI,Arial,sans-serif;font-size:10.5pt;color:#222">';
    sb += '<div style="border-left:4px solid #2b579a;padding:8px 12px;margin-bottom:12px;background:#f3f6fb">';
    sb += `<div style="font-size:13pt;font-weight:600">${E(g.baslik)}</div>`;
    sb += `<div style="color:#555">Görev No: ${kisaId(g.gorevId)} · ${olayBasligi(o)} · ${E((o.uretici && (o.uretici.ad || o.uretici.eposta)) || '')}</div></div>`;
    sb += dugmeler(g, o);
    if (o.tip !== 'GorevOlusturuldu') sb += `<div style="margin:0 0 12px 0;padding:8px 12px;border:1px solid #ddd">${olayOzeti(g, o)}</div>`;
    sb += '<table cellpadding="4" style="border-collapse:collapse">';
    sb += satir('Sahip', E(kisiMetin(g.sahip)));
    sb += satir(g.atamaModu === 'Ortak' ? 'Sorumlular (ortak)' : 'Sorumlu', E((g.sorumlular || []).map(kisiMetin).join(', ')));
    if ((g.bilgi || []).length > 0) sb += satir('Bilgi', E(g.bilgi.map(kisiMetin).join(', ')));
    sb += satir('Durum', durumAdi(g.durum) + (g.yuzde > 0 ? ` (%${g.yuzde})` : ''));
    sb += satir('Öncelik', oncelikAdi(g.oncelik));
    sb += satir('Başlangıç / Termin', `${tarihGoster(g.baslangic)} → <b>${tarihGoster(g.termin)}</b>`);
    if (!bos(g.proje)) sb += satir('Proje', E(g.proje));
    if (g.eforTakibi) sb += satir('Efor', `Tahmini ${g.tahminiSaat != null ? sayi1(g.tahminiSaat) : '-'} sa · Harcanan ${sayi1(g.harcananSaat || 0)} sa`);
    sb += '</table>';
    if (!bos(g.aciklamaHtml)) sb += `<div style="margin-top:12px">${htmlTemizle(g.aciklamaHtml) || ''}</div>`;
    if ((g.altAdimlar || []).length > 0) {
      sb += '<div style="margin-top:12px"><b>Alt adımlar</b><ul>';
      for (const a of g.altAdimlar) sb += `<li>${a.tamam ? '☑' : '☐'} ${E(a.metin)}</li>`;
      sb += '</ul></div>';
    }
    sb += '<hr style="border:0;border-top:1px solid #ddd;margin:16px 0">';
    sb += '<div style="color:#888;font-size:9pt">Bu ileti Görev Eklentisi tarafından oluşturulmuştur. Üstteki düğmeler Görev Eklentisi kurulu Windows Outlook\'ta çalışır; Mac, web ve yeni Outlook\'ta Görev eklentisi bölmesindeki düğmeler kullanılır. Eklenti yoksa görevi verene e-posta ile bilgi verilir.<br>Görev Eklentisi — NCU</div>';
    return sb + '</body></html>';
  }

  // ------------------------------------------------------------------ zarf: JSON ve gövdeye gömme
  /** C# tarafı null alanları yazmaz (NullValueHandling.Ignore); aynı biçim. */
  const jsonYaz = nesne => JSON.stringify(nesne, (k, v) => (v === null || v === undefined ? undefined : v));

  function utf8Kodla(s) { return new TextEncoder().encode(s); }
  function utf8Coz(b) { return new TextDecoder('utf-8').decode(b); }
  function b64Kodla(bayt) {
    let s = ''; for (let i = 0; i < bayt.length; i += 0x8000) s += String.fromCharCode.apply(null, bayt.subarray(i, i + 0x8000));
    return btoa(s);
  }
  function b64Coz(b64) {
    const s = atob(b64), b = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i);
    return b;
  }

  const ZARF_BAS = 'GOREVZARF1:', ZARF_SON = ':GOREVZARF';
  const ZARF_STIL = 'display:none;mso-hide:all;visibility:hidden;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;color:#ffffff';

  function zarfBlok(zarf) {
    const b64 = b64Kodla(utf8Kodla(jsonYaz(zarf))).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
    let parcali = '';
    for (let i = 0; i < b64.length; i += 76) parcali += b64.slice(i, i + 76) + ' ';
    return `<div style="${ZARF_STIL}">${ZARF_BAS}${parcali}${ZARF_SON}</div>`;
  }

  function zarfGom(html, zarf) {
    html = html || '';
    const i = html.toLowerCase().lastIndexOf('</body>');
    const blok = zarfBlok(zarf);
    return i < 0 ? html + blok : html.slice(0, i) + blok + html.slice(i);
  }

  /** Zarf nesnesini doğrular (boyut ve şema sürümü). */
  function zarfDogrula(z) {
    if (!z || !z.olay || !guidMi(z.olay.olayId) || !guidMi(z.olay.gorevId) || !z.olay.tip) return null;
    if ((z.surum || 1) > Sabitler.SemaSurumu) return null;
    z.olay.veri = z.olay.veri || {};
    z.olay.sira = z.olay.sira || 0;
    return z;
  }

  /** Gövdedeki ilk zarf bloğunu okur; yoksa ya da bozuksa null. */
  function zarfOku(html) {
    if (!html) return null;
    let a = html.indexOf(ZARF_BAS);
    if (a < 0) return null;
    a += ZARF_BAS.length;
    const b = html.indexOf(ZARF_SON, a);
    if (b < 0 || b - a > Sabitler.EkAzamiBoyut * 2) return null;
    try {
      let b64 = html.slice(a, b).replace(/<[^>]*>|[^A-Za-z0-9_-]/g, '').replace(/-/g, '+').replace(/_/g, '/');
      b64 += '='.repeat((4 - b64.length % 4) % 4);
      const bayt = b64Coz(b64);
      if (bayt.length === 0 || bayt.length > Sabitler.EkAzamiBoyut) return null;
      return zarfDogrula(JSON.parse(utf8Coz(bayt)));
    } catch (e) { return null; }
  }

  /** Eski biçim: gorev.json ekinin base64 içeriği. */
  function zarfOkuEk(base64) {
    try {
      const bayt = b64Coz(base64);
      if (bayt.length === 0 || bayt.length > Sabitler.EkAzamiBoyut) return null;
      return zarfDogrula(JSON.parse(utf8Coz(bayt).replace(/^\uFEFF/, '')));
    } catch (e) { return null; }
  }

  /** Yönlendirme: üretici hariç, rolüne göre karşı taraf(lar) + bilgi listesi. */
  function alicilar(g, o) {
    const ur = o.uretici, rol = rolBul(g, ur.eposta);
    const kime = [], bilgi = (g.bilgi || []).filter(b => !kisiEsit(b, ur));
    if (rol === 'Sahip') kime.push(...(g.sorumlular || []).filter(s => !kisiEsit(s, ur)));
    else {
      if (!kisiEsit(g.sahip, ur)) kime.push(g.sahip);
      if (g.atamaModu === 'Ortak') for (const s of g.sorumlular || []) if (!kisiEsit(s, ur) && !bilgi.some(b => kisiEsit(b, s))) bilgi.push(s);
    }
    return { kime, bilgi };
  }

  kok.GorevCekirdek = {
    Sabitler, bos, norm, kisiEsit, kisiMetin, kopya, guid, guidMi, kisaId, zamanAnahtar, simdiIso, bugunYerel, tarihGoster,
    gorevTamamla, rolBul, yetkili, gecisIzinli, hedefDurumIcinOlay, dogrulamaHatasi, islemIzinli,
    htmlTemizle, htmlKodla, htmlCoz, duzMetin, sirala, uygula, kur,
    durumAdi, oncelikAdi, olayBasligi, konu, konudanKisaId, gorevMailiGibi, govde, dugmeler,
    jsonYaz, zarfBlok, zarfGom, zarfOku, zarfOkuEk, zarfDogrula, alicilar, b64Kodla, b64Coz, utf8Kodla, utf8Coz
  };
})(typeof self !== 'undefined' ? self : globalThis);
