/* Site dili (Türkçe / English). <head> içinde erken yüklenir; sayfa çizilmeden html[data-dil] belirlenir.
   Öncelik: adres (?lang=en|tr) → önceki seçim (localStorage) → tarayıcı dili (tr ise Türkçe, değilse İngilizce).
   İki dildeki içerik data-dil="tr" / data-dil="en" ile işaretlidir; diğeri CSS ile gizlenir. Hiçbir yere veri gönderilmez. */
(function () {
  'use strict';
  var ANAHTAR = 'gorev-site:dil', kok = document.documentElement, dil;
  try {
    var q = /[?&](?:lang|dil)=(en|tr)(?:&|$)/i.exec(location.search);
    dil = q ? q[1].toLowerCase() : localStorage.getItem(ANAHTAR);
  } catch (e) { /* depolama kapalı olabilir */ }
  if (dil !== 'en' && dil !== 'tr') dil = /^tr\b/i.test(navigator.language || '') ? 'tr' : 'en';

  function uygula() {
    kok.setAttribute('data-dil', dil);
    kok.lang = dil;
    var b = kok.getAttribute('data-baslik-' + dil);
    if (b) document.title = b;
    var d = document.querySelectorAll('[data-dil-sec]');
    for (var i = 0; i < d.length; i++) d[i].setAttribute('aria-pressed', String(d[i].getAttribute('data-dil-sec') === dil));
    document.dispatchEvent(new CustomEvent('dil-degisti', { detail: dil }));
  }
  function sec(yeni) {
    dil = yeni;
    try { localStorage.setItem(ANAHTAR, yeni); } catch (e) { /* yok sayılır */ }
    uygula();
  }
  kok.setAttribute('data-dil', dil);
  kok.lang = dil;
  window.GorevSiteDili = function () { return dil; };
  document.addEventListener('DOMContentLoaded', function () {
    if (!kok.getAttribute('data-baslik-tr')) kok.setAttribute('data-baslik-tr', document.title);
    var d = document.querySelectorAll('[data-dil-sec]');
    for (var i = 0; i < d.length; i++) d[i].addEventListener('click', function (e) { e.preventDefault(); sec(this.getAttribute('data-dil-sec')); });
    uygula();
  });
})();
