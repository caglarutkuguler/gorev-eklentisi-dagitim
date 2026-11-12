/* Görev Eklentisi (web) — yerel depo. Bellekte çalışır; her yazma IndexedDB'ye de işlenir (tarayıcı kapanınca kalsın diye).
   Asıl veri posta kutusundaki görev mailleridir: depo silinse de eşitleme (servis.esitle) her şeyi maillerden yeniden kurar.
   Posta kutusu (hesap) başına ayrı veritabanı açılır. */
(function (kok) {
  'use strict';
  const C = kok.GorevCekirdek;
  const DEPOLAR = ['olaylar', 'gorevler', 'kuyruk', 'ayarlar'];

  /** Kalıcılık yok (testler, IndexedDB'siz ortam). */
  const bellekKalici = () => ({ yaz() { }, sil() { }, temizle() { }, hepsiniOku: async () => ({ olaylar: [], gorevler: [], kuyruk: [], ayarlar: [] }) });

  function indexedDbKalici(ad, gunluk) {
    let dbSoz = null;
    const ac = () => dbSoz || (dbSoz = new Promise((coz, red) => {
      const istek = kok.indexedDB.open(ad, 1);
      istek.onupgradeneeded = () => { for (const d of DEPOLAR) if (!istek.result.objectStoreNames.contains(d)) istek.result.createObjectStore(d); };
      istek.onsuccess = () => coz(istek.result);
      istek.onerror = () => red(istek.error);
    }));
    const islem = async (depo, fn) => {
      try {
        const db = await ac();
        await new Promise((coz, red) => {
          const tx = db.transaction(depo, 'readwrite');
          fn(tx.objectStore(depo));
          tx.oncomplete = coz; tx.onerror = () => red(tx.error); tx.onabort = () => red(tx.error);
        });
      } catch (e) { gunluk && gunluk('Yerel depo yazılamadı (' + depo + '): ' + (e && e.message)); }
    };
    return {
      yaz: (depo, anahtar, deger) => islem(depo, s => s.put(deger, anahtar)),
      sil: (depo, anahtar) => islem(depo, s => s.delete(anahtar)),
      temizle: async () => { for (const d of DEPOLAR) await islem(d, s => s.clear()); },
      hepsiniOku: async () => {
        const sonuc = {};
        try {
          const db = await ac();
          for (const d of DEPOLAR)
            sonuc[d] = await new Promise((coz, red) => {
              const tx = db.transaction(d, 'readonly'), s = tx.objectStore(d), kayitlar = [];
              const imlec = s.openCursor();
              imlec.onsuccess = () => { const c = imlec.result; if (c) { kayitlar.push([c.key, c.value]); c.continue(); } else coz(kayitlar); };
              imlec.onerror = () => red(imlec.error);
            });
        } catch (e) {
          gunluk && gunluk('Yerel depo okunamadı, boş başlanıyor: ' + (e && e.message));
          for (const d of DEPOLAR) sonuc[d] = sonuc[d] || [];
        }
        return sonuc;
      }
    };
  }

  /** IOlayDeposu karşılığı. Okumalar eşzamanlıdır (bellek); yazmalar arka planda kalıcıya gider. */
  function Depo(kalici) {
    kalici = kalici || bellekKalici();
    const olaylar = new Map();   // olayId → { olay, mailId }
    const gorevler = new Map();  // gorevId → gorev
    const kuyruk = new Map();    // olayId → zarf
    const ayarlar = new Map();   // anahtar → değer
    const k = s => String(s).toLowerCase();

    return {
      async yukle() {
        const v = await kalici.hepsiniOku();
        for (const [a, d] of v.olaylar) olaylar.set(a, d);
        for (const [a, d] of v.gorevler) gorevler.set(a, d);
        for (const [a, d] of v.kuyruk) kuyruk.set(a, d);
        for (const [a, d] of v.ayarlar) ayarlar.set(a, d);
      },
      olayIslendiMi: olayId => olaylar.has(k(olayId)),
      olayKaydet(olay, mailId) {
        const kayit = { olay, mailId: mailId || null };
        olaylar.set(k(olay.olayId), kayit); kalici.yaz('olaylar', k(olay.olayId), kayit);
      },
      gorevOlaylari: gorevId => [...olaylar.values()].filter(x => k(x.olay.gorevId) === k(gorevId)).map(x => x.olay),
      gorevGetir: gorevId => { const g = gorevler.get(k(gorevId)); return g ? C.kopya(g) : null; },
      gorevKaydet(g) { gorevler.set(k(g.gorevId), C.kopya(g)); kalici.yaz('gorevler', k(g.gorevId), g); },
      tumGorevler: () => [...gorevler.values()].map(C.kopya),
      kisaIdIleGetir(kisa) { for (const g of gorevler.values()) if (C.kisaId(g.gorevId) === String(kisa).toUpperCase()) return C.kopya(g); return null; },
      sonrakiSira(gorevId, eposta) {
        let enBuyuk = 0;
        for (const x of olaylar.values())
          if (k(x.olay.gorevId) === k(gorevId) && C.norm(x.olay.uretici && x.olay.uretici.eposta) === C.norm(eposta)) enBuyuk = Math.max(enBuyuk, x.olay.sira || 0);
        return enBuyuk + 1;
      },
      ilkMailId(gorevId) {
        const sirali = C.sirala([...olaylar.values()].filter(x => k(x.olay.gorevId) === k(gorevId) && x.mailId).map(x => Object.assign({ _m: x.mailId }, x.olay)));
        return sirali.length ? sirali[0]._m : null;
      },
      mailIdGuncelle(olayId, mailId) { const x = olaylar.get(k(olayId)); if (x) { x.mailId = mailId; kalici.yaz('olaylar', k(olayId), x); } },
      gidenKuyrugaEkle(zarf) { kuyruk.set(k(zarf.olay.olayId), zarf); kalici.yaz('kuyruk', k(zarf.olay.olayId), zarf); },
      gidenKuyruk: () => [...kuyruk.values()],
      gidenKuyruktanSil(olayId) { kuyruk.delete(k(olayId)); kalici.sil('kuyruk', k(olayId)); },
      ayarOku: (anahtar, varsayilan) => ayarlar.has(anahtar) ? ayarlar.get(anahtar) : varsayilan,
      ayarYaz(anahtar, deger) { ayarlar.set(anahtar, deger); kalici.yaz('ayarlar', anahtar, deger); },
      async sifirla() { olaylar.clear(); gorevler.clear(); const t = ayarlar.get('tercihler'); ayarlar.clear(); await kalici.temizle(); for (const z of kuyruk.values()) kalici.yaz('kuyruk', k(z.olay.olayId), z); if (t) this.ayarYaz('tercihler', t); }
    };
  }

  kok.GorevDepo = { Depo, bellekKalici, indexedDbKalici };
})(typeof self !== 'undefined' ? self : globalThis);
