/* Görev Eklentisi (web) — oturum ve Microsoft Graph erişimi.
   İki çalışma biçimi:
     • Outlook içinde (web, yeni Outlook, Mac, klasik): Office.js + iç içe uygulama kimlik doğrulaması (NAA). Kullanıcı
       Outlook'taki oturumuyla tanınır; ayrı parola sorulmaz (ilk kullanımda izin onayı çıkar).
     • Tarayıcıda tek başına (Linux dahil her platform): MSAL yönlendirmeli oturum açma.
   İzinler (delegated): User.Read, Mail.ReadWrite, Mail.Send, People.Read. Sunucu bileşeni yoktur; belirteç yalnızca
   tarayıcıda durur ve yalnızca graph.microsoft.com'a gönderilir. */
(function (kok) {
  'use strict';
  const C = kok.GorevCekirdek;
  const KAPSAMLAR = ['User.Read', 'Mail.ReadWrite', 'Mail.Send', 'People.Read'];
  const GRAPH = 'https://graph.microsoft.com/v1.0';

  const yapi = () => kok.GorevYapilandirma || {};
  const yapilandirildi = () => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(yapi().istemciKimligi || '');

  // ------------------------------------------------------------------ Office ortamı
  let officeSoz = null;
  /** Office.js yüklüyse ve sayfa bir Office uygulaması içinde açıldıysa ortam bilgisini, değilse null döner. */
  function officeHazir() {
    if (officeSoz) return officeSoz;
    officeSoz = new Promise(coz => {
      if (!kok.Office || !kok.Office.onReady) return coz(null);
      let bitti = false;
      const bitir = v => { if (!bitti) { bitti = true; coz(v); } };
      // Office dışında (düz tarayıcı sekmesi) onReady host=null ile döner; hiç dönmezse 4 sn sonra tarayıcı kipine geçilir.
      setTimeout(() => bitir(null), 4000);
      try { kok.Office.onReady(bilgi => bitir(bilgi && bilgi.host ? bilgi : null)); } catch (e) { bitir(null); }
    });
    return officeSoz;
  }

  // ------------------------------------------------------------------ oturum (MSAL)
  let pca = null, hesap = null, icIce = false;

  async function oturumBaslat() {
    if (!yapilandirildi()) throw Object.assign(new Error('Eklenti henüz yapılandırılmamış: Microsoft Entra uygulama kimliği (istemciKimligi) tanımlı değil.'), { kod: 'yapilandirma' });
    if (!kok.msal) throw new Error('Oturum kitaplığı yüklenemedi.');
    const office = await officeHazir();
    const ayar = { auth: { clientId: yapi().istemciKimligi, authority: 'https://login.microsoftonline.com/' + (yapi().kiraci || 'common') }, cache: { cacheLocation: 'localStorage' } };

    const naa = office && kok.Office.context && kok.Office.context.requirements && kok.Office.context.requirements.isSetSupported('NestedAppAuth', '1.1');
    if (naa) {
      pca = await kok.msal.createNestablePublicClientApplication(ayar);
      icIce = true;
      hesap = pca.getActiveAccount() || pca.getAllAccounts()[0] || null;
      return { office: true, oturumVar: true }; // NAA: belirteç ilk istekte sessizce (gerekirse açılır pencereyle) alınır
    }
    if (office) throw Object.assign(new Error('Bu Outlook sürümü eklentinin oturum yöntemini (Nested App Authentication) desteklemiyor. Görevler tarayıcıda kullanılabilir.'), { kod: 'naa-yok' });

    ayar.auth.redirectUri = new URL('index.html', location.href).href; // Entra kaydındaki SPA yönlendirme adresi
    pca = new kok.msal.PublicClientApplication(ayar);
    await pca.initialize();
    const donus = await pca.handleRedirectPromise().catch(e => { throw new Error('Oturum açılamadı: ' + e.message); });
    hesap = (donus && donus.account) || pca.getActiveAccount() || pca.getAllAccounts()[0] || null;
    if (hesap) pca.setActiveAccount(hesap);
    return { office: false, oturumVar: !!hesap };
  }

  /** Tarayıcı kipinde oturum açma sayfasına gider (sayfa yeniden yüklenir). */
  const oturumAc = () => pca.loginRedirect({ scopes: KAPSAMLAR, prompt: 'select_account' });
  const oturumKapat = () => pca.logoutRedirect({ account: hesap, postLogoutRedirectUri: new URL('index.html', location.href).href });

  async function belirtec() {
    const istek = { scopes: KAPSAMLAR, account: hesap || undefined };
    try {
      const r = await pca.acquireTokenSilent(istek);
      hesap = r.account || hesap;
      return r.accessToken;
    } catch (e) {
      if (icIce) { const r = await pca.acquireTokenPopup(istek); hesap = r.account || hesap; return r.accessToken; }
      if (e instanceof kok.msal.InteractionRequiredAuthError) { await pca.acquireTokenRedirect(istek); return new Promise(() => { }); }
      throw e;
    }
  }

  // ------------------------------------------------------------------ Graph çağrısı
  async function cagir(yol, secenek) {
    secenek = secenek || {};
    const url = yol.startsWith('https://') ? yol : GRAPH + yol;
    if (!url.startsWith('https://graph.microsoft.com/')) throw new Error('Beklenmeyen adres.');
    for (let deneme = 0; ; deneme++) {
      const yanit = await fetch(url, {
        method: secenek.yontem || 'GET',
        headers: Object.assign({ Authorization: 'Bearer ' + await belirtec() }, secenek.govde !== undefined ? { 'Content-Type': 'application/json' } : {}, secenek.basliklar || {}),
        body: secenek.govde !== undefined ? JSON.stringify(secenek.govde) : undefined
      });
      if ((yanit.status === 429 || yanit.status === 503 || yanit.status === 504) && deneme < 3) {
        const bekle = Math.min(30, parseInt(yanit.headers.get('Retry-After') || '2', 10) || 2);
        await new Promise(r => setTimeout(r, bekle * 1000));
        continue;
      }
      if (yanit.status === 204 || yanit.status === 202) return null;
      const metin = await yanit.text();
      let veri = null; try { veri = metin ? JSON.parse(metin) : null; } catch (e) { /* JSON değil */ }
      if (!yanit.ok) {
        const ileti = (veri && veri.error && veri.error.message) || ('HTTP ' + yanit.status);
        throw Object.assign(new Error(ileti), { durum: yanit.status, kod: veri && veri.error && veri.error.code });
      }
      return veri;
    }
  }

  async function ben() {
    const v = await cagir('/me?$select=displayName,mail,userPrincipalName,id');
    const eposta = v.mail || v.userPrincipalName;
    if (!eposta) throw new Error('Hesabın e-posta adresi okunamadı.');
    return { ad: v.displayName || eposta, eposta, kimlik: v.id };
  }

  // ------------------------------------------------------------------ posta bağdaştırıcısı (servis.js)
  const alici = k => ({ emailAddress: { address: k.eposta, name: C.bos(k.ad) ? k.eposta : k.ad } });
  const ODATA = s => encodeURIComponent(String(s).replace(/'/g, "''"));
  let gorevKlasoruId = null;

  async function gorevKlasoru(olustur) {
    if (gorevKlasoruId) return gorevKlasoruId;
    const v = await cagir(`/me/mailFolders/inbox/childFolders?$filter=displayName eq '${ODATA(C.Sabitler.GorevKlasoru)}'&$select=id`);
    if (v.value && v.value.length) return (gorevKlasoruId = v.value[0].id);
    if (!olustur) return null;
    const y = await cagir('/me/mailFolders/inbox/childFolders', { yontem: 'POST', govde: { displayName: C.Sabitler.GorevKlasoru } });
    return (gorevKlasoruId = y.id);
  }

  const Posta = {
    /** Görev mailini gönderir: taslak → ekler → gönder (büyük ekler parça parça yüklenir). */
    async gonder(m) {
      const taslak = await cagir('/me/messages', {
        yontem: 'POST',
        govde: {
          subject: m.konu, body: { contentType: 'html', content: m.html },
          toRecipients: m.kime.map(alici), ccRecipients: m.bilgi.map(alici),
          internetMessageHeaders: (m.basliklar || []).map(([name, value]) => ({ name, value }))
        }
      });
      try {
        for (const ek of m.ekler || []) {
          if (ek.bayt.length <= 2.5 * 1024 * 1024) {
            await cagir(`/me/messages/${taslak.id}/attachments`, {
              yontem: 'POST',
              govde: { '@odata.type': '#microsoft.graph.fileAttachment', name: ek.ad, contentType: ek.tur || 'application/octet-stream', contentBytes: C.b64Kodla(ek.bayt) }
            });
          } else {
            const oturum = await cagir(`/me/messages/${taslak.id}/attachments/createUploadSession`, {
              yontem: 'POST', govde: { AttachmentItem: { attachmentType: 'file', name: ek.ad, size: ek.bayt.length, contentType: ek.tur || 'application/octet-stream' } }
            });
            const PARCA = 3 * 1024 * 1024;
            for (let bas = 0; bas < ek.bayt.length; bas += PARCA) {
              const son = Math.min(bas + PARCA, ek.bayt.length);
              const y = await fetch(oturum.uploadUrl, { method: 'PUT', headers: { 'Content-Type': 'application/octet-stream', 'Content-Range': `bytes ${bas}-${son - 1}/${ek.bayt.length}` }, body: ek.bayt.subarray(bas, son) });
              if (!y.ok) throw new Error(`Ek yüklenemedi (${ek.ad}): HTTP ${y.status}`);
            }
          }
        }
        await cagir(`/me/messages/${taslak.id}/send`, { yontem: 'POST' });
      } catch (e) {
        try { await cagir(`/me/messages/${taslak.id}`, { yontem: 'DELETE' }); } catch (e2) { /* taslak kalırsa kullanıcı Taslaklar'da görür */ }
        throw e;
      }
    },

    /** Klasördeki görev maillerini (konu "[GÖREV" ile başlayan) eskiden yeniye sayfa sayfa verir. */
    async tara(klasor, sonraIso, herSayfa) {
      let kimlik = klasor === 'gelen' ? 'inbox' : klasor === 'gonderilen' ? 'sentitems' : await gorevKlasoru(false);
      if (!kimlik) return; // Görevler klasörü henüz yok
      const sonra = sonraIso || '2000-01-01T00:00:00Z';
      let url = `/me/mailFolders/${kimlik}/messages?$filter=receivedDateTime ge ${sonra} and startswith(subject,'${ODATA(C.Sabitler.KonuKoku)}')` +
        '&$orderby=receivedDateTime asc&$top=25&$select=id,subject,from,sender,receivedDateTime,internetMessageId,hasAttachments,body';
      for (let sayfa = 0; url && sayfa < 80; sayfa++) {
        const v = await cagir(url, { basliklar: { Prefer: 'outlook.body-content-type="html", outlook.allow-unsafe-html' } });
        await herSayfa((v.value || []).map(x => ({
          id: x.id, konu: x.subject || '', internetId: x.internetMessageId || null, alinma: x.receivedDateTime, ekVar: !!x.hasAttachments,
          gonderen: (x.from && x.from.emailAddress && x.from.emailAddress.address) || (x.sender && x.sender.emailAddress && x.sender.emailAddress.address) || '',
          html: (x.body && x.body.content) || ''
        })));
        url = v['@odata.nextLink'] || null;
      }
    },

    /** Eski sürümlerin gorev.json eki (base64); yoksa null. */
    async ekZarfi(mesajId) {
      const v = await cagir(`/me/messages/${mesajId}/attachments?$select=id,name,size`);
      const ek = (v.value || []).find(a => String(a.name || '').toLowerCase() === C.Sabitler.EkAdi && a.size <= C.Sabitler.EkAzamiBoyut * 2);
      if (!ek) return null;
      const tam = await cagir(`/me/messages/${mesajId}/attachments/${ek.id}`);
      return tam.contentBytes || null;
    },

    async gorevKlasorureTasi(mesajId) {
      const hedef = await gorevKlasoru(true);
      const y = await cagir(`/me/messages/${mesajId}/move`, { yontem: 'POST', govde: { destinationId: hedef } });
      return y && y.id;
    },

    /** Mailin Outlook web bağlantısı (internet message id ile); bulunamazsa null. */
    async mailBaglantisi(internetId) {
      const v = await cagir(`/me/messages?$filter=internetMessageId eq '${ODATA(internetId)}'&$select=webLink&$top=1`);
      return v.value && v.value.length ? v.value[0].webLink : null;
    },

    /** Alıcı önerileri (sık yazışılanlar + dizin). İzin verilmediyse boş döner. */
    async kisiAra(metin) {
      try {
        const v = await cagir(`/me/people?$search="${encodeURIComponent(String(metin).replace(/"/g, ''))}"&$top=8&$select=displayName,scoredEmailAddresses`);
        return (v.value || []).map(p => ({ ad: p.displayName, eposta: p.scoredEmailAddresses && p.scoredEmailAddresses[0] && p.scoredEmailAddresses[0].address })).filter(k => k.eposta && k.eposta.includes('@'));
      } catch (e) { return []; }
    }
  };

  kok.GorevGraph = { yapilandirildi, officeHazir, oturumBaslat, oturumAc, oturumKapat, ben, cagir, Posta, KAPSAMLAR };
})(typeof self !== 'undefined' ? self : globalThis);
