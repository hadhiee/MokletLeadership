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

/* ── Handle POST (login & saveProfile) ── */
function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    var data = JSON.parse(e.postData.contents);
    var sheet = getOrCreateSheet();

    if (data.action === 'login') {
      return handleLogin(sheet, data);
    } else if (data.action === 'saveProfile') {
      return handleSaveProfile(sheet, data);
    }

    return jsonResponse({ error: 'Unknown action' });
  } catch (err) {
    return jsonResponse({ error: err.message });
  } finally {
    lock.releaseLock();
  }
}

/* ── Handle GET (fetch all students for admin) ── */
function doGet(e) {
  var sheet = getOrCreateSheet();
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
  var ss = SpreadsheetApp.getActiveSpreadsheet();
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
