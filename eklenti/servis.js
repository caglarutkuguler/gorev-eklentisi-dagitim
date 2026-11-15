/* Görev Eklentisi (web) — görev servisi (GorevServisi.cs karşılığı) ve posta kutusu eşitlemesi.
   Olay üretir, uygular, saklar, mail olarak dağıtır; gelen ve gönderilmiş görev maillerini okuyup yerel depoyu kurar.
   Posta erişimi "posta" bağdaştırıcısı üzerindendir (graph.js: Microsoft Graph; testlerde sahte):
     posta.gonder({ konu, html, kime, bilgi, basliklar, ekler }) → Promise
     posta.tara(klasor, sonraIso, herSayfa) → Promise           klasor: 'gelen' | 'gorevler' | 'gonderilen'
     posta.ekZarfi(mesajId) → Promise<base64 | null>            (eski sürümlerin gorev.json eki)
     posta.gorevKlasorureTasi(mesajId) → Promise<yeniId | null> */
(function (kok) {
  'use strict';
  const C = kok.GorevCekirdek;

  const VARSAYILAN_TERCIH = () => ({
    varsayilanAtamaModu: 'AyriAyri', varsayilanEforTakibi: true, varsayilanOncelik: 'Normal', gelenGoreviTasi: true,
    hatirlatmaEsigiGun: 2, sonProjeler: [], gizliProjeler: [], sonAlicilar: []
  });

  function Servis(ben, depo, posta, gunluk) {
    gunluk = gunluk || { bilgi() { }, uyari() { }, hata() { } };
    const dinleyiciler = [];
    const degisti = g => { for (const d of dinleyiciler) try { d(g); } catch (e) { gunluk.hata('Dinleyici', e); } };
    const hata = m => ({ basarili: false, mesaj: m, gorevler: [] });

    // ---------------------------------------------------------------- tercihler
    const tercihler = () => Object.assign(VARSAYILAN_TERCIH(), depo.ayarOku('tercihler', {}));
    function tercihKaydet(t) { depo.ayarYaz('tercihler', t); }
    function sonSecimleriGuncelle(mod, efor, oncelik, proje, alicilar) {
      const t = tercihler();
      t.varsayilanAtamaModu = mod; t.varsayilanEforTakibi = efor; t.varsayilanOncelik = oncelik;
      if (!C.bos(proje)) {
        proje = proje.trim();
        const ayni = p => p.toLocaleLowerCase('tr') === proje.toLocaleLowerCase('tr');
        t.gizliProjeler = t.gizliProjeler.filter(p => !ayni(p));
        t.sonProjeler = [proje, ...t.sonProjeler.filter(p => !ayni(p))].slice(0, 20);
      }
      for (const a of alicilar || []) t.sonAlicilar = [a, ...t.sonAlicilar.filter(x => !C.kisiEsit(x, a))];
      t.sonAlicilar = t.sonAlicilar.slice(0, 50);
      tercihKaydet(t);
    }
    /** Proje önerileri: son kullanılanlar ∪ görevlerdeki projeler − gizlenenler. */
    function tumProjeler() {
      const t = tercihler(), gizli = new Set(t.gizliProjeler.map(p => p.toLocaleLowerCase('tr'))), gorulen = new Set(), sonuc = [];
      for (const p of [...t.sonProjeler, ...depo.tumGorevler().map(g => g.proje)]) {
        if (C.bos(p)) continue;
        const a = p.trim().toLocaleLowerCase('tr');
        if (gizli.has(a) || gorulen.has(a)) continue;
        gorulen.add(a); sonuc.push(p.trim());
      }
      return sonuc;
    }

    // ---------------------------------------------------------------- olay üretimi
    const yeniOlay = (gorevId, tip, veri) => ({
      olayId: C.guid(), gorevId, tip, uretici: { ad: ben.ad, eposta: ben.eposta },
      sira: depo.sonrakiSira(gorevId, ben.eposta), zaman: C.simdiIso(), kaynak: C.Sabitler.KaynakWeb, veri: veri || {}
    });

    async function postala(zarf, g, ekler) {
      const { kime, bilgi } = C.alicilar(g, zarf.olay);
      if (kime.length + bilgi.length === 0) return true;
      try {
        await posta.gonder({
          konu: C.konu(g, zarf.olay), html: C.zarfGom(C.govde(g, zarf.olay), zarf), kime, bilgi, ekler: ekler || [],
          basliklar: [
            [C.Sabitler.BaslikSurum, String(zarf.surum)], [C.Sabitler.BaslikGorevId, String(zarf.olay.gorevId)],
            [C.Sabitler.BaslikOlay, String(zarf.olay.tip)], [C.Sabitler.BaslikOlayId, String(zarf.olay.olayId)]
          ]
        });
        return true;
      } catch (e) { gunluk.uyari('Mail gönderilemedi: ' + (e && e.message)); return e || new Error('Gönderilemedi'); }
    }

    async function uygulaVeDagit(mevcut, o, olusturmaAnlik, ekler) {
      const s = C.uygula(mevcut, o, olusturmaAnlik);
      if (!s.uygulandi) return hata(s.neden);
      const zarf = { surum: C.Sabitler.SemaSurumu, olay: o, gorevAnlik: s.gorev };
      // Ekli görev (oluşturma): mail gitmeden görev kaydedilmez — ekler kuyruğa alınamaz, kullanıcı formda kalıp yeniden dener.
      if (ekler && ekler.length) {
        const r = await postala(zarf, s.gorev, ekler);
        if (r !== true) return hata('Görev gönderilemedi: ' + r.message);
        depo.olayKaydet(o, null); depo.gorevKaydet(s.gorev);
      } else {
        depo.olayKaydet(o, null); depo.gorevKaydet(s.gorev);
        const r = await postala(zarf, s.gorev, null);
        if (r !== true) depo.gidenKuyrugaEkle(zarf);
      }
      degisti(s.gorev);
      return { basarili: true, gorevler: [s.gorev], kuyrukta: depo.gidenKuyruk().some(z => z.olay.olayId === o.olayId) };
    }

    async function gorevOlustur(t) {
      if (C.bos(t.baslik)) return hata('Başlık zorunludur.');
      if (C.bos(t.termin)) return hata('Termin zorunludur.');
      if (!t.sorumlular || t.sorumlular.length === 0) return hata('En az bir sorumlu seçilmelidir.');
      const sonuc = { basarili: true, gorevler: [], kuyrukta: false };
      const ayri = t.atamaModu === 'AyriAyri';
      const grupId = ayri && t.sorumlular.length > 1 ? C.guid() : undefined;
      const gruplar = ayri ? t.sorumlular.map(s => [s]) : [t.sorumlular.slice()];
      for (const sorumlular of gruplar) {
        const anlik = C.gorevTamamla({
          gorevId: C.guid(), grupId, atamaModu: t.atamaModu, eforTakibi: !!t.eforTakibi,
          baslik: t.baslik.trim(), aciklamaHtml: C.htmlTemizle(t.aciklamaHtml) || undefined,
          sahip: { ad: ben.ad, eposta: ben.eposta }, sorumlular,
          bilgi: (t.bilgi || []).filter(b => !sorumlular.some(s => C.kisiEsit(s, b)) && !C.kisiEsit(b, ben)),
          baslangic: C.bos(t.baslangic) ? C.bugunYerel() : t.baslangic, termin: t.termin, oncelik: t.oncelik || 'Normal',
          proje: C.bos(t.proje) ? undefined : t.proje.trim(),
          tahminiSaat: t.eforTakibi && t.tahminiSaat != null ? t.tahminiSaat : undefined,
          altAdimlar: (t.altAdimlar || []).map(a => ({ id: C.guid(), metin: a.metin, tamam: false })),
          olusturma: C.simdiIso(), sonOlayZamani: C.simdiIso()
        });
        const olay = yeniOlay(anlik.gorevId, 'GorevOlusturuldu', { anlik: C.kopya(anlik) });
        const r = await uygulaVeDagit(null, olay, anlik, t.ekler);
        if (!r.basarili) return Object.assign(r, { gorevler: sonuc.gorevler });
        sonuc.gorevler.push(...r.gorevler); sonuc.kuyrukta = sonuc.kuyrukta || r.kuyrukta;
      }
      return sonuc;
    }

    async function olay(gorevId, tip, veri) {
      const g = depo.gorevGetir(gorevId);
      if (!g) return hata('Görev bulunamadı.');
      return uygulaVeDagit(g, yeniOlay(gorevId, tip, veri), null, null);
    }

    /** Arayüz işlem türünü (Kabul, IsKaydi…) olaya çevirir. v: { not, termin, tarih, saat, yuzde } */
    function islem(gorevId, tur, v) {
      v = v || {};
      const not = C.bos(v.not) ? undefined : String(v.not).trim();
      switch (tur) {
        case 'Kabul': return olay(gorevId, 'GorevKabulEdildi', { not });
        case 'Reddet': return olay(gorevId, 'GorevReddedildi', { gerekce: not });
        case 'Tamamla': return olay(gorevId, 'GorevTamamlandi', { not });
        case 'Kapat': return olay(gorevId, 'GorevKapatildi', { not });
        case 'YenidenAc': return olay(gorevId, 'GorevYenidenAcildi', { gerekce: not });
        case 'Iptal': return olay(gorevId, 'GorevIptalEdildi', { gerekce: not });
        case 'Yorum': return olay(gorevId, 'YorumEklendi', { metin: not });
        case 'Beklet': return olay(gorevId, 'DurumDegisti', { yeniDurum: 'Beklemede', not });
        case 'DevamEt': return olay(gorevId, 'DurumDegisti', { yeniDurum: 'DevamEdiyor', not });
        case 'TerminDegistir': return olay(gorevId, 'TerminDegistirildi', { yeniTermin: v.termin, not });
        case 'TerminIste': return olay(gorevId, 'TerminDegisikligiIstendi', { onerilenTermin: v.termin, gerekce: not });
        case 'IsKaydi': {
          const veri = { tarih: v.tarih, not };
          if (v.saat != null) veri.saat = v.saat;
          if (v.yuzde != null) veri.yuzde = Math.trunc(v.yuzde);
          return olay(gorevId, 'IsKaydiEklendi', veri);
        }
      }
      return Promise.resolve(hata('Bilinmeyen işlem.'));
    }

    const altAdimIsaretle = (gorevId, altAdimId, tamam) => olay(gorevId, 'AltAdimGuncellendi', { altAdimId, tamam: !!tamam });
    const duzenle = (gorevId, alanlar) => olay(gorevId, 'GorevDuzenlendi', { alanlar });

    function kanbanIslemi(gorevId, hedef) {
      const g = depo.gorevGetir(gorevId);
      if (!g) return null;
      const tip = C.hedefDurumIcinOlay(g.durum, hedef, C.rolBul(g, ben.eposta));
      switch (tip) {
        case 'GorevKabulEdildi': return 'Kabul';
        case 'GorevReddedildi': return 'Reddet';
        case 'IsKaydiEklendi': return 'IsKaydi';
        case 'GorevTamamlandi': return 'Tamamla';
        case 'GorevKapatildi': return 'Kapat';
        case 'GorevYenidenAcildi': return 'YenidenAc';
        case 'GorevIptalEdildi': return 'Iptal';
        case 'DurumDegisti': return hedef === 'Beklemede' ? 'Beklet' : 'DevamEt';
      }
      return null;
    }

    // ---------------------------------------------------------------- gelen mail
    function yenidenKur(gorevId) {
      const olaylar = depo.gorevOlaylari(gorevId);
      const olusturma = olaylar.find(x => x.tip === 'GorevOlusturuldu');
      const temel = olusturma ? null : depo.gorevGetir(gorevId);
      if (!olusturma && !temel) return null;
      const { gorev, atlananlar } = C.kur(temel, olaylar);
      for (const a of atlananlar) gunluk.uyari('Yeniden kurma, atlandı: ' + a);
      if (gorev) depo.gorevKaydet(gorev);
      return gorev;
    }

    /** Gelen (ya da Gönderilmiş Öğeler'deki) görev mailini işler. */
    function gelenZarfIsle(zarf, gonderenEposta, mailId) {
      if (!zarf || !zarf.olay) return hata('Zarf boş.');
      const o = zarf.olay;
      if (depo.olayIslendiMi(o.olayId)) return { basarili: true, mesaj: 'Zaten işlendi.', gorevler: [] };

      // Gönderen doğrulaması: maili gönderen = olayı üreten olmalı.
      if (!C.bos(gonderenEposta) && C.norm(gonderenEposta) !== C.norm(o.uretici && o.uretici.eposta)) {
        gunluk.uyari(`Gönderen (${gonderenEposta}) ile olay üreticisi (${o.uretici && o.uretici.eposta}) uyuşmuyor; olay yok sayıldı. ${o.olayId}`);
        return hata('Gönderen doğrulanamadı.');
      }

      const mevcut = depo.gorevGetir(o.gorevId);
      const anlik = zarf.gorevAnlik ? C.gorevTamamla(zarf.gorevAnlik) : null;

      if (!mevcut && o.tip !== 'GorevOlusturuldu') {
        if (!anlik) return hata('Görev bilinmiyor ve anlık görüntü yok.');
        if (C.rolBul(anlik, ben.eposta) === 'Yok') return hata('Bu görevin tarafı değilsiniz.');
        anlik.gorevId = o.gorevId;
        anlik.aciklamaHtml = C.htmlTemizle(anlik.aciklamaHtml) || undefined;
        depo.olayKaydet(o, mailId); depo.gorevKaydet(anlik);
        degisti(anlik);
        return { basarili: true, mesaj: 'Anlık görüntüden kuruldu.', gorevler: [anlik] };
      }

      if (o.tip === 'GorevOlusturuldu') {
        const ilk = anlik || (o.veri && o.veri.anlik ? C.gorevTamamla(o.veri.anlik) : null);
        if (!ilk) return hata('Oluşturma görüntüsü yok.');
        if (C.rolBul(ilk, ben.eposta) === 'Yok') return hata('Bu görevin tarafı değilsiniz.');
        if (mevcut && C.norm(mevcut.sahip && mevcut.sahip.eposta) !== C.norm(o.uretici && o.uretici.eposta)) return hata('Mevcut görevin sahibi farklı.');
      }

      depo.olayKaydet(o, mailId);
      const g = yenidenKur(o.gorevId);
      if (!g) return hata('Görev kurulamadı.');
      degisti(g);
      return { basarili: true, gorevler: [g] };
    }

    // ---------------------------------------------------------------- giden kuyruk
    async function kuyrukGonder() {
      let n = 0;
      for (const z of depo.gidenKuyruk()) {
        const g = depo.gorevGetir(z.olay.gorevId) || z.gorevAnlik;
        if (!g) { depo.gidenKuyruktanSil(z.olay.olayId); continue; }
        if (await postala(z, g, null) === true) { depo.gidenKuyruktanSil(z.olay.olayId); n++; } else break;
      }
      return n;
    }

    // ---------------------------------------------------------------- eşitleme (posta kutusu → yerel depo)
    let esitleniyor = null;

    /**
     * Gelen Kutusu, Görevler klasörü ve Gönderilmiş Öğeler'deki görev maillerini okur. Gönderilmiş Öğeler, aynı posta
     * kutusundan başka bir cihazda (Windows eklentisi, başka tarayıcı) yapılan işlemleri de getirir. Klasör başına son
     * okunan zaman saklanır; sonraki eşitlemeler yalnızca yenileri çeker. bastan: imleçleri sıfırlar (yeniden kurma).
     */
    function esitle(bastan) {
      if (esitleniyor) return esitleniyor;
      esitleniyor = (async () => {
        const ozet = { okunan: 0, islenen: 0, hatalar: [] };
        try { ozet.gonderilen = await kuyrukGonder(); } catch (e) { ozet.hatalar.push('Kuyruk: ' + e.message); }
        const tasi = tercihler().gelenGoreviTasi;
        for (const klasor of ['gonderilen', 'gorevler', 'gelen']) {
          const imlecAnahtar = 'imlec:' + klasor;
          let sonra = bastan ? null : depo.ayarOku(imlecAnahtar, null);
          // Küçük örtüşme: teslim sırası ile alınma zamanı birebir değildir.
          if (sonra) sonra = new Date(new Date(sonra).getTime() - 10 * 60 * 1000).toISOString();
          let enYeni = depo.ayarOku(imlecAnahtar, null);
          try {
            await posta.tara(klasor, sonra, async mesajlar => {
              for (const m of mesajlar) {
                ozet.okunan++;
                if (m.alinma && (!enYeni || m.alinma > enYeni)) enYeni = m.alinma;
                if (!C.gorevMailiGibi(m.konu)) continue;
                const iz = m.internetId ? 'mail:' + m.internetId : null;
                if (iz && depo.ayarOku(iz, null)) continue; // bu mail daha önce işlendi
                let zarf = C.zarfOku(m.html);
                if (!zarf && m.ekVar) { try { const b = await posta.ekZarfi(m.id); if (b) zarf = C.zarfOkuEk(b); } catch (e) { gunluk.uyari('Ek okunamadı: ' + e.message); } }
                if (!zarf) { if (iz) depo.ayarYaz(iz, { gorev: null }); continue; } // eklentisiz kullanıcıdan düz yanıt
                const r = gelenZarfIsle(zarf, m.gonderen, m.internetId || m.id);
                if (!r.basarili) { gunluk.uyari(`Görev maili işlenemedi: ${m.konu} — ${r.mesaj}`); continue; }
                if (iz) depo.ayarYaz(iz, { gorev: zarf.olay.gorevId });
                if (r.mesaj !== 'Zaten işlendi.') ozet.islenen++;
                if (klasor === 'gelen' && tasi) { try { await posta.gorevKlasorureTasi(m.id); } catch (e) { gunluk.uyari('Mail taşınamadı: ' + e.message); } }
              }
            });
            if (enYeni) depo.ayarYaz(imlecAnahtar, enYeni);
          } catch (e) { ozet.hatalar.push(`${klasor}: ${e.message}`); gunluk.hata('Eşitleme (' + klasor + ')', e); }
        }
        depo.ayarYaz('sonEsitleme', C.simdiIso());
        return ozet;
      })().finally(() => { esitleniyor = null; });
      return esitleniyor;
    }

    /** Yerel depoyu silip posta kutusundan baştan kurar (gönderilmeyi bekleyenler korunur). */
    async function yenidenKurHepsi() { await depo.sifirla(); return esitle(true); }

    /** Mailin (internet message id) ait olduğu görev kimliği; bilinmiyorsa null. */
    const maildenGorevId = internetId => { const k = internetId ? depo.ayarOku('mail:' + internetId, null) : null; return k ? k.gorev : null; };

    return {
      ben, depo, dinle: fn => dinleyiciler.push(fn), tercihler, tercihKaydet, sonSecimleriGuncelle, tumProjeler,
      gorevOlustur, olay, islem, altAdimIsaretle, duzenle, kanbanIslemi, gelenZarfIsle, yenidenKur, kuyrukGonder,
      esitle, yenidenKurHepsi, maildenGorevId
    };
  }

  kok.GorevServis = { Servis };
})(typeof self !== 'undefined' ? self : globalThis);
