/* Görev Eklentisi — English strings. Key: the Turkish source text (see dil.js). {0} {1} … are placeholders.
   Windows and web add-in share this file; it is loaded before dil.js. */
(function (kok) {
  'use strict';
  kok.__GorevDilEN = {
    // ---- statuses, priorities, events
    'Yeni': 'New', 'Kabul edildi': 'Accepted', 'Devam ediyor': 'In progress', 'Beklemede': 'On hold', 'Tamamlandı': 'Completed',
    'Kapatıldı': 'Closed', 'Reddedildi': 'Declined', 'İptal edildi': 'Cancelled',
    'Düşük': 'Low', 'Normal': 'Normal', 'Yüksek': 'High', 'Kritik': 'Critical',
    'Yeni görev': 'New task', 'Termin değişikliği isteği': 'Due date change request', 'Termin değişti': 'Due date changed',
    'Yeniden açıldı': 'Reopened', 'Alt adım güncellendi': 'Checklist updated', 'Görev düzenlendi': 'Task edited',

    // ---- main window
    'Görevler': 'Tasks', 'Görev': 'Task', 'Görev Eklentisi': 'Task Tracker', 'Kullanım kılavuzu': 'User guide',
    'Liste': 'List', 'Kanban': 'Kanban', 'Gantt': 'Gantt', 'Yük': 'Workload', '? Yardım': '? Help',
    'Hesap (birden çok görev alanı açıkken)': 'Account (when several task workspaces are enabled)', 'Kapsam': 'Scope',
    'Tüm görevler': 'All tasks', 'Verdiklerim': 'Assigned by me', 'Üzerimdekiler': 'Assigned to me', 'İzlediklerim': 'Following',
    'Açık olanlar': 'Open', 'Tüm durumlar': 'All statuses', 'Kişi': 'Person', 'Gecikmiş': 'Overdue', 'Ara…': 'Search…',
    'Yenile': 'Refresh', 'CSV dışa aktar': 'Export to CSV', '+ Yeni Görev': '+ New Task', 'Kapat': 'Close',
    'Ölçek': 'Scale', 'Gün': 'Day', 'Hafta': 'Week', 'Ay': 'Month', 'Grupla': 'Group by',
    'Hata': 'Error', 'sürüm {0}': 'version {0}', 'Tüm hesaplar': 'All accounts', 'Tüm projeler': 'All projects', 'Tüm kişiler': 'All people',
    'Filtreye uyan görev yok.': 'No tasks match the filter.', 'Gösterilecek görev yok.': 'No tasks to show.', 'Veri yok.': 'No data.',
    'No': 'No.', 'Başlık': 'Title', 'Sahip': 'Owner', 'Sorumlu': 'Assignee', 'Sorumlular': 'Assignees', 'Durum': 'Status',
    'Öncelik': 'Priority', 'Başlangıç': 'Start', 'Termin': 'Due date', 'Proje': 'Project', 'Efor (sa)': 'Effort (h)', 'Hesap': 'Account',
    'Yüzde': 'Percent', 'Tahmini saat': 'Estimated hours', 'Harcanan saat': 'Hours spent',
    '(projesiz)': '(no project)', '(sorumlu yok)': '(no assignee)', 'Bugün': 'Today',
    'Açık': 'Open', 'Tamamlanan': 'Completed', 'Tahmini (sa)': 'Estimated (h)', 'Harcanan (sa)': 'Spent (h)', 'Kalan (sa)': 'Remaining (h)',
    'grup': 'group', 'Maili aç': 'Open e-mail', 'Sorumlular (ortak)': 'Assignees (shared)', 'Bilgi': 'CC (info)', 'Tarihler': 'Dates',
    '(istek: {0})': '(requested: {0})', 'Efor': 'Effort', 'Harcanan {0} sa / tahmini {1} sa': '{0} h spent / {1} h estimated',
    'Red gerekçesi': 'Reason for declining', 'Açıklama': 'Description', 'Alt adımlar ({0}/{1})': 'Checklist ({0}/{1})', 'Alt adımlar': 'Checklist',
    'İş kayıtları': 'Work logs', 'Yorumlar': 'Comments', 'CSV kaydedildi.': 'CSV saved.',
    'Kabul et': 'Accept', 'Reddet': 'Decline', 'İş kaydı': 'Work log', 'Tamamla': 'Complete', 'Beklet': 'Put on hold', 'Termin iste': 'Request due date',
    'Devam et': 'Resume', 'Kapat (onayla)': 'Close (approve)', 'Yeniden aç': 'Reopen', 'Termin değiştir': 'Change due date', 'İptal et': 'Cancel', 'Yorum': 'Comment',
    '(tarayıcı)': '(browser)', 'Tarayıcı geliştirme modunda "{0}" desteklenmez.': '"{0}" is not supported in browser preview mode.',
    // sample data (browser preview, store screenshots)
    'Veri topla': 'Collect data', 'Rapor yaz': 'Write report', 'Fatura mutabakat raporu': 'Invoice reconciliation report', 'Kapanış': 'Month-end close',
    'Sunucu bakım planı': 'Server maintenance plan', 'Altyapı': 'Infrastructure', 'Eğitim materyali güncelleme': 'Update training material', 'Eğitim': 'Training',
    'Tedarikçi sözleşme revizyonu': 'Supplier contract revision', 'Yıl sonu envanter': 'Year-end inventory',

    // ---- rules / validation (core)
    'Gerekçe zorunludur.': 'A reason is required.', 'İş kaydı tarihi zorunludur.': 'The work log date is required.',
    'Bu görevde efor takibi açık: harcanan saat zorunludur.': 'Effort tracking is on for this task: hours spent are required.',
    'Yüzde 0–100 aralığında olmalıdır.': 'Percent must be between 0 and 100.', 'Yeni termin zorunludur.': 'A new due date is required.',
    'Önerilen termin zorunludur.': 'A proposed due date is required.', 'Yorum boş olamaz.': 'The comment cannot be empty.',
    'Yetkisiz üretici.': 'Not authorized for this task.', '{0} durumunda {1} izinli değil.': '{1} is not allowed in status {0}.',

    // ---- task e-mail
    'Kabul Et': 'Accept', 'İş Kaydı': 'Work Log', 'Onayla ve Kapat': 'Approve and Close', 'Yeniden Aç': 'Reopen', 'Termini Değiştir': 'Change Due Date',
    'Görevi Aç': 'Open Task', 'sa': 'h', 'Gerekçe': 'Reason', 'Yeni termin': 'New due date', 'Önerilen termin': 'Proposed due date', 'Yeni durum': 'New status',
    'Görev No': 'Task No.', 'Başlangıç / Termin': 'Start / Due date', 'Tahmini {0} sa · Harcanan {1} sa': 'Estimated {0} h · Spent {1} h',
    "Bu ileti Görev Eklentisi tarafından oluşturulmuştur. Üstteki düğmeler Görev Eklentisi kurulu Windows Outlook'ta çalışır; Mac, web ve yeni Outlook'ta Görev eklentisi bölmesindeki düğmeler kullanılır. Eklenti yoksa görevi verene e-posta ile bilgi verilir.":
      'This message was created by Task Tracker. The buttons above work in Outlook for Windows with Task Tracker installed; in Outlook for Mac, on the web and in the new Outlook, use the buttons in the Task Tracker pane. Without the add-in, reply to the task owner by e-mail.',

    // ---- forms
    'Zorunlu': 'Required', 'dosya boş': 'the file is empty', "dosya {0} MB'tan büyük": 'the file is larger than {0} MB', 'dosya adı geçersiz': 'invalid file name',
    '.{0} türündeki dosyalar güvenlik nedeniyle eklenemez': '.{0} files cannot be attached for security reasons',
    'dosya içeriği yürütülebilir program (uzantısı değiştirilmiş olabilir)': 'the file is an executable program (its extension may have been changed)',
    'dosya içeriği yürütülebilir program': 'the file is an executable program', 'dosya içeriği betik': 'the file is a script',
    'zip içinde izin verilmeyen dosya var: {0}': 'the zip contains a file that is not allowed: {0}',
    'ad ya da e-posta; birden çok kişi için ; ya da Enter': 'name or e-mail; use ; or Enter for several people', 'Kaldır': 'Remove',
    'Yeni Görev': 'New Task', 'Gönderen: {0}': 'From: {0}', 'Sorumlu(lar)': 'Assignee(s)',
    'K': 'B', 'T': 'I', 'A': 'U', 'Kalın (Ctrl+B)': 'Bold (Ctrl+B)', 'İtalik (Ctrl+I)': 'Italic (Ctrl+I)', 'Altı çizili (Ctrl+U)': 'Underline (Ctrl+U)',
    '• Liste': '• List', 'Madde işaretli liste': 'Bulleted list', '1. Liste': '1. List', 'Numaralı liste': 'Numbered list',
    'Proje / kategori': 'Project / category', "Alt adım yazıp Ekle'ye basılır": 'Type a checklist item and press Add', 'Yeni alt adım': 'New checklist item',
    'Alt adım metni yazılır.': 'Type the checklist item.', 'En fazla 50 alt adım eklenebilir.': 'At most 50 checklist items can be added.',
    'Alt adım geçersiz karakter içeriyor.': 'The checklist item contains invalid characters.', '"{0}" alt adımı listede zaten var.': '"{0}" is already in the checklist.',
    'Dosya ekle…': 'Attach file…', 'En fazla {0} dosya eklenebilir.': 'At most {0} files can be attached.',
    "Eklerin toplamı {0} MB'ı geçemez (şu an {1} MB).": 'Attachments cannot exceed {0} MB in total (currently {1} MB).',
    '{0}: "{1}" bir e-posta adresi olarak çözülemedi.': '{0}: "{1}" could not be resolved to an e-mail address.',
    'En az bir sorumlu seçilmelidir.': 'Select at least one assignee.', '{0}: en fazla 50 kişi.': '{0}: at most 50 people.',
    'Başlık zorunludur.': 'The title is required.', 'Başlık en fazla 200 karakter olabilir.': 'The title can be at most 200 characters.',
    'Başlık geçersiz karakter içeriyor.': 'The title contains invalid characters.', 'Başlangıç geçerli bir tarih değil.': 'Start is not a valid date.',
    'Başlangıç seçilmelidir.': 'Select a start date.', 'Termin geçerli bir tarih değil.': 'Due date is not a valid date.', 'Termin seçilmelidir.': 'Select a due date.',
    'Termin bugünden önce olamaz.': 'The due date cannot be before today.', 'Termin, başlangıç tarihinden önce olamaz.': 'The due date cannot be before the start date.',
    '{0} sayı olmalıdır{1}.': '{0} must be a number{1}.', '{0} {1}–{2} arasında olmalıdır.': '{0} must be between {1} and {2}.',
    'Proje / kategori en fazla 100 karakter olabilir.': 'Project / category can be at most 100 characters.',
    'Proje / kategori geçersiz karakter içeriyor.': 'Project / category contains invalid characters.',
    'Açıklama en fazla 8000 karakter olabilir (şu an {0}).': 'The description can be at most 8000 characters (currently {0}).',
    'Atama': 'Assignment', 'Her biri için ayrı görev': 'Separate task for each', 'Ortak tek görev': 'One shared task',
    'Efor takibi (iş kayıtlarında harcanan saat zorunlu)': 'Effort tracking (hours required in work logs)', 'Ekle': 'Add', 'Ekler': 'Attachments',
    'En çok {0} dosya, toplam {1} MB. Çalıştırılabilir dosyalar eklenemez.': 'Up to {0} files, {1} MB in total. Executable files cannot be attached.',
    'Gönder': 'Send', 'Vazgeç': 'Cancel', 'Gönderiliyor…': 'Sending…', 'Tamam': 'OK',
    'Görevi Kabul Et': 'Accept Task', 'Görevi Reddet': 'Decline Task', 'İş Kaydı Ekle': 'Add Work Log', 'Görevi Tamamla': 'Complete Task',
    'Görevi Kapat (Onayla)': 'Close Task (Approve)', 'Görevi Yeniden Aç': 'Reopen Task', 'Görevi İptal Et': 'Cancel Task', 'Yorum Ekle': 'Add Comment',
    'Termin Değişikliği İste': 'Request Due Date Change', 'Beklemeye Al': 'Put On Hold', 'Devam Et': 'Resume',
    '"{0}" bu görev için şu an yapılamaz (durum: {1}).': '"{0}" is not possible for this task right now (status: {1}).',
    'Not': 'Note', 'Tarih': 'Date', 'İlerleme yüzdesi': 'Progress percent', 'İlerleme %': 'Progress %', 'şu an {0}': 'currently {0}',
    '{0} zorunludur{1}.': '{0} is required{1}.', '{0} en fazla 4000 karakter olabilir.': '{0} can be at most 4000 characters.',
    '{0} geçersiz karakter içeriyor.': '{0} contains invalid characters.', 'Tarih seçilmelidir.': 'Select a date.',
    'İş kaydı tarihi ileri bir gün olamaz.': 'The work log date cannot be in the future.', 'Yeni termin mevcut terminle aynı.': 'The new due date is the same as the current one.',

    // ---- web add-in (bridge, sign-in, sync)
    'Görevlerin tutulduğu posta kutusu': 'Mailbox that holds the tasks', 'Kanban, Gantt ve yük görünümleri için geniş pencere': 'Wide window for Kanban, Gantt and Workload views',
    'Tarayıcıda aç ↗': 'Open in browser ↗', 'Çıkış': 'Sign out', 'Yükleniyor…': 'Loading…', 'Kurulum tamamlanmadı': 'Setup is not complete',
    'Eklentinin Microsoft hesabıyla çalışabilmesi için uygulama kaydı kimliği henüz tanımlanmamış.\nYönetici: KURULUM belgesindeki "Uygulama kaydı" adımı.':
      'The application registration ID that lets the add-in work with a Microsoft account has not been set yet.\nAdministrator: see the "App registration" step in the setup document.',
    'Bu Outlook sürümünde açılamıyor': 'Cannot open in this version of Outlook', 'Görevleri tarayıcıda aç': 'Open tasks in the browser',
    'Oturum başlatılamadı': 'Could not start the session', 'Yeniden dene': 'Try again',
    'Görevler posta kutusunda tutulur. Devam etmek için görevlerin gönderilip alınacağı Microsoft 365 / Outlook.com hesabıyla oturum açılır.':
      'Tasks are kept in your mailbox. To continue, sign in with the Microsoft 365 / Outlook.com account that sends and receives the tasks.',
    'Microsoft hesabıyla oturum aç': 'Sign in with Microsoft',
    'Outlook içinde kullanmak için eklenti dosyası indirme sayfasından alınır. İstenen izinler: profil, e-postaları okuma/taşıma, e-posta gönderme, kişi önerileri. Veriler yalnızca bu tarayıcıda ve posta kutusunda durur; başka bir sunucuya gönderilmez.':
      'To use it inside Outlook, install the add-in from Microsoft AppSource or from the download page. Permissions requested: profile, read/move e-mail, send e-mail, people suggestions. Data stays only in this browser and in your mailbox; it is not sent to any other server.',
    'Bu hesabın posta kutusuna ulaşılamadı': "This account's mailbox could not be reached",
    '{0} hesabıyla oturum açıldı, ancak bu hesabın Microsoft 365 / Outlook.com posta kutusu bulunamadı ({1}).': 'Signed in as {0}, but no Microsoft 365 / Outlook.com mailbox was found for this account ({1}).',
    'Oturum açıldı, ancak bu hesabın Microsoft 365 / Outlook.com posta kutusu bulunamadı ({0}).': 'Signed in, but no Microsoft 365 / Outlook.com mailbox was found for this account ({0}).',
    "Web eklentisi yalnızca postası Microsoft 365 ya da Outlook.com üzerinde duran hesaplarla çalışır. Postası başka bir sağlayıcıda (IMAP, Gmail vb.) olan adresler için Windows'ta klasik Outlook eklentisi kullanılır.":
      'The web add-in works only with accounts whose mail is hosted on Microsoft 365 or Outlook.com. For addresses hosted elsewhere (IMAP, Gmail, etc.), use the classic Outlook add-in on Windows.',
    'Başka hesapla oturum aç': 'Sign in with another account', 'Hesap okunamadı': 'Could not read the account',
    'Eşitleniyor…': 'Syncing…', 'Eşitlenemedi: {0}': 'Sync failed: {0}', '{0} işlem gönderilmeyi bekliyor': '{0} action(s) waiting to be sent', 'Güncel · {0}': 'Up to date · {0}',
    'Görev bulunamadı.': 'Task not found.', 'İşlem kaydedildi; bağlantı gelince gönderilecek.': 'Action saved; it will be sent when the connection is back.',
    'Bu geçiş izinli değil.': 'This move is not allowed.', 'Görev kaydedildi; bağlantı gelince gönderilecek.': 'Task saved; it will be sent when the connection is back.',
    '{0} görev gönderildi.': '{0} tasks sent.', 'Görev gönderildi.': 'Task sent.', 'Veritabanını Yeniden Kur': 'Rebuild Database',
    'Bu tarayıcıdaki görev kayıtları silinip posta kutusundaki görev maillerinden (Gelen Kutusu, Görevler klasörü, Gönderilmiş Öğeler) yeniden kurulacak.\nGönderilmeyi bekleyen işlemler korunur. Devam edilsin mi?':
      'The task records in this browser will be deleted and rebuilt from the task e-mails in your mailbox (Inbox, task folder, Sent Items).\nActions waiting to be sent are kept. Continue?',
    'Yeniden kur': 'Rebuild', 'Görev hesabı': 'Task account', 'Görevler şu posta kutusunda tutulur: {0}': 'Tasks are kept in this mailbox: {0}',
    "Outlook'ta başka bir hesabın görevleri için o hesabın posta kutusunda eklenti açılır; her posta kutusunun görevleri ayrıdır.":
      "For another account's tasks in Outlook, open the add-in in that account's mailbox; each mailbox has its own tasks.",
    'Başka bir hesabın görevleri için sağ üstteki Çıkış ile oturum kapatılıp o hesapla açılır; her posta kutusunun görevleri ayrıdır.':
      "For another account's tasks, sign out and sign in with that account; each mailbox has its own tasks.",
    'Bu göreve ait mail bulunamadı.': 'No e-mail was found for this task.', 'Mail posta kutusunda bulunamadı (silinmiş olabilir).': 'The e-mail was not found in the mailbox (it may have been deleted).',
    'Bu işlem web sürümünde desteklenmiyor: {0}': 'This action is not supported in the web version: {0}', 'Açılamadı': 'Could not open', 'Geçersiz bağlantı.': 'Invalid link.',
    'Gönderilemedi': 'Could not send', 'Görev gönderilemedi: {0}': 'The task could not be sent: {0}', 'Termin zorunludur.': 'The due date is required.',
    'Bilinmeyen işlem.': 'Unknown action.',
    'Eklenti henüz yapılandırılmamış: Microsoft Entra uygulama kimliği (istemciKimligi) tanımlı değil.': 'The add-in is not configured yet: the Microsoft Entra application ID is not set.',
    'Oturum kitaplığı yüklenemedi.': 'The sign-in library could not be loaded.',
    'Bu Outlook sürümü eklentinin oturum yöntemini (Nested App Authentication) desteklemiyor. Görevler tarayıcıda kullanılabilir.':
      "This version of Outlook does not support the add-in's sign-in method (Nested App Authentication). Tasks can be used in the browser.",
    'Oturum açılamadı: {0}': 'Sign-in failed: {0}', 'Hesabın e-posta adresi okunamadı.': "The account's e-mail address could not be read.",
    'Ek yüklenemedi ({0}): HTTP {1}': 'Attachment could not be uploaded ({0}): HTTP {1}',
    'Oturum yenilenemedi; sayfa yeniden açılıp tekrar oturum açılır.': 'The session could not be renewed; reload the page and sign in again.'
  };
})(typeof self !== 'undefined' ? self : globalThis);
