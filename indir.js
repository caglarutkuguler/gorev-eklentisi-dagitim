/* İndirme sayfası: ziyaretçinin işletim sistemine uygun kartı öne çıkarır. Yalnızca tarayıcının bildirdiği platform
   bilgisine bakar; hiçbir yere veri göndermez. */
(function () {
  'use strict';
  var ua = navigator.userAgent || '', platform = (navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || '';
  var mobil = /Android|iPhone|iPad|iPod/i.test(ua);
  var tur = mobil ? null : /Win/i.test(platform) || /Windows/i.test(ua) ? 'windows' : /Mac/i.test(platform) || /Macintosh/i.test(ua) ? 'mac' : /Linux|CrOS|X11/i.test(platform + ' ' + ua) ? 'linux' : null;
  var metin = {
    windows: 'Bu bilgisayar Windows. Klasik Outlook (üst menüde Dosya sekmesi olan) için kurulum dosyası; yeni Outlook için ortadaki eklenti dosyası indirilir.',
    mac: 'Bu bilgisayar Mac. Outlook için ortadaki eklenti dosyası indirilir.',
    linux: 'Bu bilgisayarda masaüstü Outlook yok. Tarayıcı sürümü ya da Outlook web için eklenti dosyası kullanılır.'
  };
  var kutu = document.getElementById('oneri');
  if (mobil) { kutu.textContent = 'Telefon ve tabletlerde eklenti kurulamaz; tarayıcı sürümü kullanılabilir.'; kutu.hidden = false; return; }
  if (!tur) return;
  var kart = document.querySelector('.kart[data-platform="' + tur + '"]');
  if (kart) kart.classList.add('onerilen');
  kutu.textContent = metin[tur]; kutu.hidden = false;
})();
