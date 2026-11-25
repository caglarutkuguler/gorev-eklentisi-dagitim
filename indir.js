/* İndirme sayfası: ziyaretçinin işletim sistemine uygun kartı öne çıkarır. Yalnızca tarayıcının bildirdiği platform
   bilgisine bakar; hiçbir yere veri göndermez. İleti seçili dilde (dil.js) gösterilir. */
(function () {
  'use strict';
  var ua = navigator.userAgent || '', platform = (navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || '';
  var mobil = /Android|iPhone|iPad|iPod/i.test(ua);
  var tur = mobil ? 'mobil' : /Win/i.test(platform) || /Windows/i.test(ua) ? 'windows' : /Mac/i.test(platform) || /Macintosh/i.test(ua) ? 'mac' : /Linux|CrOS|X11/i.test(platform + ' ' + ua) ? 'linux' : null;
  var metin = {
    tr: {
      windows: 'Bu bilgisayar Windows. Klasik Outlook (üst menüde Dosya sekmesi olan) için kurulum dosyası; yeni Outlook için ortadaki eklenti dosyası indirilir.',
      mac: 'Bu bilgisayar Mac. Outlook için ortadaki eklenti dosyası indirilir.',
      linux: 'Bu bilgisayarda masaüstü Outlook yok. Tarayıcı sürümü ya da Outlook web için eklenti dosyası kullanılır.',
      mobil: 'Telefon ve tabletlerde eklenti kurulamaz; tarayıcı sürümü kullanılabilir.'
    },
    en: {
      windows: 'This computer runs Windows. Download the installer for classic Outlook (with a File tab in the top menu), or the add-in file in the middle for new Outlook.',
      mac: 'This computer is a Mac. Download the add-in file in the middle for Outlook.',
      linux: 'There is no desktop Outlook on this computer. Use the browser edition or the add-in file for Outlook on the web.',
      mobil: 'The add-in cannot be installed on phones and tablets; the browser edition can be used.'
    }
  };
  var kutu = document.getElementById('oneri');
  if (!tur) return;
  if (tur !== 'mobil') {
    var kart = document.querySelector('.kart[data-platform="' + tur + '"]');
    if (kart) kart.classList.add('onerilen');
  }
  function yaz() {
    var dil = window.GorevSiteDili ? window.GorevSiteDili() : 'tr';
    kutu.textContent = (metin[dil] || metin.tr)[tur];
    kutu.hidden = false;
  }
  yaz();
  document.addEventListener('dil-degisti', yaz);
})();
