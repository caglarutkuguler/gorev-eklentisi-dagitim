/* Görev Eklentisi — dil desteği (Türkçe / English). Windows ve web eklentisinde ortaktır; diğer betiklerden önce yüklenir.
   Metinler kaynakta Türkçe yazılır ve T('…') ile çevrilir; anahtar Türkçe metnin kendisidir, {0} {1} … yer tutucudur.
   Statik HTML'de çevrilecek metin ve öznitelikler sayfaCevir() ile çevrilir; uzun içerik (yardım) iki dilde ayrı yazılır
   ve data-dil="tr" / data-dil="en" ile seçilir. Dil seçimi bu tarayıcıda saklanır; yoksa tarayıcı/Office dili kullanılır. */
(function (kok) {
  'use strict';
  const ANAHTAR = 'gorev-eklentisi:dil';
  const DILLER = ['tr', 'en'];

  function kayitli() { try { const k = kok.localStorage && kok.localStorage.getItem(ANAHTAR); return DILLER.includes(k) ? k : null; } catch (e) { return null; } }
  function ortamDili() {
    const n = kok.navigator ? ((kok.navigator.languages && kok.navigator.languages[0]) || kok.navigator.language || '') : '';
    return /^tr\b/i.test(n) ? 'tr' : n ? 'en' : 'tr';
  }
  let kod = kayitli() || ortamDili();

  const EN = kok.__GorevDilEN || {};

  /** Çeviri: T('Görev {0} gönderildi.', ad). Sözlükte yoksa Türkçe metin döner. */
  function T(metin, ...a) {
    let s = kod === 'en' && Object.prototype.hasOwnProperty.call(EN, metin) ? EN[metin] : metin;
    if (a.length) s = s.replace(/\{(\d+)\}/g, (m, i) => (a[+i] === undefined || a[+i] === null ? '' : String(a[+i])));
    return s;
  }

  const OZNITELIKLER = ['title', 'placeholder', 'aria-label', 'alt'];
  const tekBosluk = s => s.replace(/\s+/g, ' ').trim();

  /** Statik DOM'daki metin düğümlerini ve öznitelikleri çevirir (data-dil bloklarına ve betiklere girmez). */
  function sayfaCevir(kokDugum) {
    if (typeof document === 'undefined') return;
    kokDugum = kokDugum || document.body;
    document.documentElement.lang = kod;
    document.documentElement.dataset.dil = kod;
    if (kod === 'tr') return;
    const atla = e => e.closest('body [data-dil], script, style, code'); // html öğesinin kendi data-dil'i sayılmaz
    const w = document.createTreeWalker(kokDugum, NodeFilter.SHOW_TEXT);
    const dugumler = [];
    while (w.nextNode()) dugumler.push(w.currentNode);
    for (const d of dugumler) {
      const ham = d.nodeValue, ana = tekBosluk(ham);
      if (!ana || !d.parentElement || atla(d.parentElement)) continue;
      if (!Object.prototype.hasOwnProperty.call(EN, ana)) continue;
      const bas = /^\s*/.exec(ham)[0], son = /\s*$/.exec(ham)[0];
      d.nodeValue = bas + EN[ana] + son;
    }
    for (const e of kokDugum.querySelectorAll('[' + OZNITELIKLER.join('],[') + ']')) {
      if (atla(e)) continue;
      for (const o of OZNITELIKLER) {
        const v = e.getAttribute(o);
        if (v && Object.prototype.hasOwnProperty.call(EN, v.trim())) e.setAttribute(o, EN[v.trim()]);
      }
    }
    if (document.title && EN[document.title]) document.title = EN[document.title];
  }

  /** Dil değiştirir ve sayfayı yeniden yükler (bütün metinler seçilen dille kurulur). */
  function ayarla(yeni) {
    if (!DILLER.includes(yeni)) return;
    try { kok.localStorage.setItem(ANAHTAR, yeni); } catch (e) { /* saklanamazsa yalnızca bu açılış için */ }
    if (yeni === kod) return;
    kod = yeni;
    if (kok.location) kok.location.reload();
  }

  /** Henüz seçim yapılmamışsa Office arayüz dili (ör. "en-US") esas alınır. Değişirse true döner. */
  function officeDiliniUygula(officeDili) {
    if (kayitli() || !officeDili) return false;
    const yeni = /^tr\b/i.test(officeDili) ? 'tr' : 'en';
    if (yeni === kod) return false;
    try { kok.localStorage.setItem(ANAHTAR, yeni); } catch (e) { return false; }
    kod = yeni;
    return true;
  }

  const yerel = () => (kod === 'en' ? 'en-GB' : 'tr-TR');
  const AYLAR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  /** "2026-11-25" → "25.11.2026" (tr) / "25 Nov 2026" (en). */
  const tarih = t => {
    const m = /^(\d{4})-(\d\d)-(\d\d)/.exec(t || '');
    if (!m) return t || '';
    return kod === 'en' ? `${+m[3]} ${AYLAR[+m[2] - 1]} ${m[1]}` : `${m[3]}.${m[2]}.${m[1]}`;
  };
  /** Yüzde: "%40" (tr) / "40%" (en). */
  const yuzde = n => (kod === 'en' ? `${n}%` : `%${n}`);
  /** Ondalık sayı (en çok bir basamak): "1,5" (tr) / "1.5" (en). */
  const sayi = n => { const r = String(Math.round(Number(n) * 10) / 10); return kod === 'en' ? r : r.replace('.', ','); };
  /** Saat kısaltması: "sa" / "h". */
  const sa = () => (kod === 'en' ? 'h' : 'sa');

  kok.GorevDil = {
    get kod() { return kod; }, set kod(k) { if (DILLER.includes(k)) kod = k; }, // set: yalnızca testler
    T, sayfaCevir, ayarla, officeDiliniUygula, yerel, tarih, yuzde, sayi, sa, DILLER
  };
  kok.T = kok.T || T;

  if (typeof document !== 'undefined') {
    const calis = () => sayfaCevir();
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', calis, { once: true }); else calis();
  }
})(typeof self !== 'undefined' ? self : globalThis);
