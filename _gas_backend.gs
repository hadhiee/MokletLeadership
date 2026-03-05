/*
 * ═══════════════════════════════════════════════════════
 *  MOLESH — Google Apps Script Backend
 * ═══════════════════════════════════════════════════════
 *
 *  CARA SETUP:
 *  1. Buka https://docs.google.com/spreadsheets/create
 *     (Buat Google Sheet baru, beri nama "MOLESH Data")
 *  2. Klik Extensions → Apps Script
 *  3. Hapus kode default, paste SEMUA kode di file ini
 *  4. Klik Deploy → New deployment
 *     - Type: Web app
 *     - Execute as: Me
 *     - Who has access: Anyone
 *  5. Klik Deploy, lalu copy URL yang muncul
 *  6. Paste URL tersebut di config.js → APPS_SCRIPT_URL
 *  7. Done! Data siswa akan otomatis tersimpan di Sheet.
 *
 *  CATATAN:
 *  - Jika kamu mengubah kode, klik Deploy → Manage deployments
 *    → Edit (ikon pensil) → Version: New version → Deploy
 *  - Sheet "Students" akan otomatis dibuat saat pertama kali dipanggil
 * ═══════════════════════════════════════════════════════
 */

var SHEET_NAME = 'Students';
var CHECKIN_SETTINGS_SHEET = 'CheckIn_Settings';
var CHECKIN_LOG_SHEET = 'CheckIn_Log';
var REFLECTIONS_SHEET = 'Reflections';
var SHEET_ID = '1T0Bu-46xgInjUK1VxE8WeeMJ8V-REsKXET5KdyjWlgo'; // MOLESH Data spreadsheet

/* ── Handle POST (login, saveProfile, checkin actions) ── */
function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    var raw = e.postData.contents;
    var data = JSON.parse(raw);

    if (data.action === 'login') {
      return handleLogin(getOrCreateSheet(), data);
    } else if (data.action === 'saveProfile') {
      return handleSaveProfile(getOrCreateSheet(), data);
    } else if (data.action === 'saveCheckinSetting') {
      return handleSaveCheckinSetting(data);
    } else if (data.action === 'deleteCheckinSetting') {
      return handleDeleteCheckinSetting(data);
    } else if (data.action === 'doCheckin') {
      return handleDoCheckin(data);
    } else if (data.action === 'saveReflection') {
      return handleSaveReflection(data);
    }

    return jsonResponse({ error: 'Unknown action' });
  } catch (err) {
    return jsonResponse({ error: err.message });
  } finally {
    lock.releaseLock();
  }
}

/* ── Handle GET ── */
function doGet(e) {
  var type = (e && e.parameter && e.parameter.type) ? e.parameter.type : 'students';

  if (type === 'students') {
    return getSheetAsJSON(getOrCreateSheet());
  } else if (type === 'checkinSettings') {
    return getSheetAsJSON(getOrCreateCheckinSettings());
  } else if (type === 'checkinLog') {
    return getSheetAsJSON(getOrCreateCheckinLog());
  } else if (type === 'activeCheckin') {
    return getActiveCheckin();
  } else if (type === 'reflections') {
    return getSheetAsJSON(getOrCreateReflections());
  }
  return jsonResponse([]);
}

/* ── Generic sheet → JSON array ── */
function getSheetAsJSON(sheet) {
  var data = sheet.getDataRange().getValues();
  if (data.length <= 1) return jsonResponse([]);
  var headers = data[0];
  var result = [];
  for (var i = 1; i < data.length; i++) {
    var obj = {};
    for (var j = 0; j < headers.length; j++) {
      obj[headers[j]] = data[i][j];
    }
    result.push(obj);
  }
  return jsonResponse(result);
}

/* ── Get or create the Students sheet ── */
function getOrCreateSheet() {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow([
      'email', 'googleName', 'picture',
      'nama', 'kelas', 'absen',
      'firstLogin', 'lastLogin', 'profileUpdated'
    ]);
    sheet.setFrozenRows(1);
    sheet.getRange('A1:I1').setFontWeight('bold');
  }
  return sheet;
}

/* ── Login handler ── */
function handleLogin(sheet, data) {
  var emails = sheet.getRange('A:A').getValues().flat();
  var rowIndex = emails.indexOf(data.email);
  var now = new Date().toISOString();

  if (rowIndex > 0) {
    var row = rowIndex + 1;
    sheet.getRange(row, 2).setValue(data.googleName || '');
    sheet.getRange(row, 3).setValue(data.picture || '');
    sheet.getRange(row, 8).setValue(now);
  } else {
    sheet.appendRow([
      data.email,
      data.googleName || '',
      data.picture || '',
      '', '', '',
      now, now, ''
    ]);
  }
  return jsonResponse({ status: 'ok' });
}

/* ── Save profile handler ── */
function handleSaveProfile(sheet, data) {
  var emails = sheet.getRange('A:A').getValues().flat();
  var rowIndex = emails.indexOf(data.email);
  var now = new Date().toISOString();

  if (rowIndex > 0) {
    var row = rowIndex + 1;
    sheet.getRange(row, 4).setValue(data.nama || '');
    sheet.getRange(row, 5).setValue(data.kelas || '');
    sheet.getRange(row, 6).setValue(data.absen || '');
    sheet.getRange(row, 9).setValue(now);
  } else {
    sheet.appendRow([
      data.email,
      data.googleName || '',
      data.picture || '',
      data.nama || '',
      data.kelas || '',
      data.absen || '',
      now, now, now
    ]);
  }
  return jsonResponse({ status: 'ok' });
}

/* ── JSON response helper ── */
function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

/* ══════════════════════════════════════════════════════
   CHECK-IN SETTINGS (new sheet)
   ══════════════════════════════════════════════════════ */

function getOrCreateCheckinSettings() {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sheet = ss.getSheetByName(CHECKIN_SETTINGS_SHEET);
  if (!sheet) {
    sheet = ss.insertSheet(CHECKIN_SETTINGS_SHEET);
    sheet.appendRow(['id', 'tanggal', 'deskripsi', 'status', 'createdAt']);
    sheet.setFrozenRows(1);
    sheet.getRange('A1:E1').setFontWeight('bold');
  }
  return sheet;
}

function getOrCreateCheckinLog() {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sheet = ss.getSheetByName(CHECKIN_LOG_SHEET);
  if (!sheet) {
    sheet = ss.insertSheet(CHECKIN_LOG_SHEET);
    sheet.appendRow(['checkinId', 'tanggal', 'deskripsi', 'email', 'googleName', 'nama', 'kelas', 'absen', 'checkinTime']);
    sheet.setFrozenRows(1);
    sheet.getRange('A1:I1').setFontWeight('bold');
  }
  return sheet;
}

/* Save a new check-in setting (admin) */
function handleSaveCheckinSetting(data) {
  var sheet = getOrCreateCheckinSettings();
  
  /* Check for duplicate (same tanggal + deskripsi within last 5 seconds) to prevent double-submit */
  var allData = sheet.getDataRange().getValues();
  var now = new Date();
  for (var i = 1; i < allData.length; i++) {
    var existingTanggal = allData[i][1];
    if (existingTanggal instanceof Date) {
      existingTanggal = Utilities.formatDate(existingTanggal, Session.getScriptTimeZone(), 'yyyy-MM-dd');
    }
    var existingDesc = allData[i][2];
    var existingTime = new Date(allData[i][4]);
    var timeDiff = (now - existingTime) / 1000; /* seconds */
    
    if (existingTanggal === data.tanggal && existingDesc === (data.deskripsi || '') && timeDiff < 5) {
      /* Duplicate detected within 5 seconds */
      return jsonResponse({ status: 'duplicate', id: allData[i][0] });
    }
  }
  
  var id = 'ci_' + now.getTime();
  var nowISO = now.toISOString();
  sheet.appendRow([id, data.tanggal, data.deskripsi || '', data.status || 'aktif', nowISO]);
  return jsonResponse({ status: 'ok', id: id });
}

/* Delete a check-in setting (admin) */
function handleDeleteCheckinSetting(data) {
  var sheet = getOrCreateCheckinSettings();
  var ids = sheet.getRange('A:A').getValues().flat();
  var rowIndex = ids.indexOf(data.id);
  if (rowIndex > 0) {
    sheet.deleteRow(rowIndex + 1);
    return jsonResponse({ status: 'ok' });
  }
  return jsonResponse({ error: 'Not found' });
}

/* Get currently active check-in (for students) */
function getActiveCheckin() {
  var sheet = getOrCreateCheckinSettings();
  var data = sheet.getDataRange().getValues();
  if (data.length <= 1) return jsonResponse([]);
  var headers = data[0];
  var today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
  var active = [];
  for (var i = 1; i < data.length; i++) {
    var obj = {};
    for (var j = 0; j < headers.length; j++) {
      obj[headers[j]] = data[i][j];
    }
    // Format tanggal field if it's a Date object
    if (obj.tanggal instanceof Date) {
      obj.tanggal = Utilities.formatDate(obj.tanggal, Session.getScriptTimeZone(), 'yyyy-MM-dd');
    }
    if (obj.status === 'aktif' && obj.tanggal === today) {
      active.push(obj);
    }
  }
  return jsonResponse(active);
}

/* Student does a check-in */
function handleDoCheckin(data) {
  var logSheet = getOrCreateCheckinLog();
  // Prevent duplicate check-in (same email + checkinId)
  var logData = logSheet.getDataRange().getValues();
  for (var i = 1; i < logData.length; i++) {
    if (logData[i][0] === data.checkinId && logData[i][3] === data.email) {
      return jsonResponse({ status: 'already', message: 'Kamu sudah check-in untuk sesi ini.' });
    }
  }
  var now = new Date().toISOString();
  logSheet.appendRow([
    data.checkinId, data.tanggal || '', data.deskripsi || '',
    data.email, data.googleName || '', data.nama || '',
    data.kelas || '', data.absen || '', now
  ]);
  return jsonResponse({ status: 'ok' });
}

/* ══════════════════════════════════════════════════════════
   REFLECTIONS (new sheet)
   ══════════════════════════════════════════════════════════ */

function getOrCreateReflections() {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sheet = ss.getSheetByName(REFLECTIONS_SHEET);
  if (!sheet) {
    sheet = ss.insertSheet(REFLECTIONS_SHEET);
    sheet.appendRow(['sesi', 'email', 'googleName', 'nama', 'kelas', 'absen', 'refleksi', 'submittedAt']);
    sheet.setFrozenRows(1);
    sheet.getRange('A1:H1').setFontWeight('bold');
  }
  return sheet;
}

/* Save a student reflection */
function handleSaveReflection(data) {
  var sheet = getOrCreateReflections();
  // Prevent duplicate (same email + sesi) — update existing
  var allData = sheet.getDataRange().getValues();
  for (var i = 1; i < allData.length; i++) {
    if (String(allData[i][0]) == String(data.sesi) && allData[i][1] === data.email) {
      var row = i + 1;
      sheet.getRange(row, 7).setValue(data.refleksi || '');
      sheet.getRange(row, 8).setValue(new Date().toISOString());
      return jsonResponse({ status: 'updated' });
    }
  }
  var now = new Date().toISOString();
  sheet.appendRow([
    data.sesi || '', data.email || '', data.googleName || '',
    data.nama || '', data.kelas || '', data.absen || '',
    data.refleksi || '', now
  ]);
  return jsonResponse({ status: 'ok' });
}
