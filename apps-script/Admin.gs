/**
 * Stockly — private admin backend (bound to the PRIVATE admin spreadsheet).
 *
 * This script is the ONLY process that touches the admin spreadsheet.
 * The Vercel backend (api/*) calls it server-to-server; browsers never
 * see this URL or the token below.
 *
 * SETUP (owner only, once):
 * 1. Create a NEW Google spreadsheet (it may be completely empty).
 * 2. Extensions → Apps Script → paste this whole file → Save.
 * 3. In the editor, run:
 *      setAdminScriptToken("a-long-random-secret-also-saved-as-ADMIN_SCRIPT_TOKEN")
 *    (stored in Script Properties — never in code, never in the frontend).
 * 4. Deploy → New deployment → Web app → Execute as: Me,
 *    Who has access: Anyone → Deploy → copy the /exec URL.
 * 5. In Vercel env set ADMIN_SCRIPT_URL=<that /exec URL> and
 *    ADMIN_SCRIPT_TOKEN=<same secret>, then redeploy.
 * 6. The first API call runs setupSchema automatically: all tabs appear
 *    with exact headers; existing tabs and rows are never modified.
 *
 * All data responses are JSON: { success: true, data } or
 * { success: false, error }. No passwords, session tokens, or linking
 * secrets are ever stored — only hashes, summaries, and metadata.
 */

var ADMIN_SCHEMA = {
  AdminUsers: ['adminId', 'email', 'role', 'status', 'createdAt', 'updatedAt'],
  UserRegistry: ['userId', 'name', 'email', 'accountStatus', 'registeredAt', 'lastLoginAt', 'updatedAt'],
  AdminLogs: ['logId', 'adminId', 'action', 'targetUserId', 'previousValue', 'newValue', 'timestamp'],
  AppSettings: ['key', 'value', 'updatedAt'],
  DeviceLinks: ['linkId', 'userId', 'tokenHash', 'method', 'status', 'expiresAt', 'attempts', 'claimant', 'createdAt', 'updatedAt'],
  Devices: ['deviceId', 'userId', 'name', 'platform', 'appInfo', 'status', 'linkedAt', 'lastActiveAt'],
  UserAuth: ['userId', 'email', 'name', 'passwordHash', 'providers', 'createdAt', 'updatedAt'],
  UserSheets: ['userId', 'spreadsheetId', 'execUrl', 'status', 'verifiedAt', 'updatedAt']
};

var PROP_TOKEN = 'ADMIN_SCRIPT_TOKEN';
var VERSION = '1.0.0';

/* ------------------------------ auth ------------------------------ */

/**
 * Owner setup helper: stores the server-to-server token in Script
 * Properties. Run manually once from the editor (it never ships in code
 * or the frontend, and the value is never shown back).
 */
function setAdminScriptToken(token) {
  if (!token || String(token).trim().length < 24) {
    throw new Error('Pass a token of at least 24 characters.');
  }
  PropertiesService.getScriptProperties().setProperty(PROP_TOKEN, String(token).trim());
  return 'Admin script token saved in Script Properties (value is not shown back).';
}

function serverToken_() {
  try {
    return String(PropertiesService.getScriptProperties().getProperty(PROP_TOKEN) || '').trim();
  } catch (e) {
    return '';
  }
}

/** Every data action must present the server token. Constant-time compare. */
function requireToken_(token) {
  var expect = serverToken_();
  var got = String(token || '');
  if (!expect || !got || got.length !== expect.length) {
    throw new Error('Unauthorized.');
  }
  var diff = 0;
  for (var i = 0; i < expect.length; i++) {
    diff |= expect.charCodeAt(i) ^ got.charCodeAt(i);
  }
  if (diff !== 0) throw new Error('Unauthorized.');
}

/* ------------------------------ tables ------------------------------ */

function ss_() {
  var s = null;
  try {
    s = SpreadsheetApp.getActiveSpreadsheet();
  } catch (e) {
    s = null;
  }
  if (!s) throw new Error('No spreadsheet bound. Open the admin Sheet once and re-run.');
  return s;
}

function sheet_(name) {
  if (!ADMIN_SCHEMA[name]) throw new Error('Unknown tab "' + name + '".');
  var sh = ss_().getSheetByName(name);
  if (!sh) throw new Error('Missing tab "' + name + '". Call setupSchema first.');
  return sh;
}

function withLock_(fn) {
  var lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    return fn();
  } finally {
    lock.releaseLock();
  }
}

function checkRow_(tab, row) {
  var headers = ADMIN_SCHEMA[tab];
  if (!row || row.length !== headers.length) {
    throw new Error('Row for "' + tab + '" must have exactly ' + headers.length + ' columns.');
  }
  return row.map(function (v) { return v === undefined || v === null ? '' : v; });
}

/** Creates missing tabs with exact headers. Existing tabs/rows untouched. */
function setupSchema_() {
  return withLock_(function () {
    var s = ss_();
    var created = [];
    Object.keys(ADMIN_SCHEMA).forEach(function (name) {
      var sh = s.getSheetByName(name);
      if (!sh) {
        sh = s.insertSheet(name);
        sh.getRange(1, 1, 1, ADMIN_SCHEMA[name].length).setValues([ADMIN_SCHEMA[name]]);
        sh.setFrozenRows(1);
        created.push(name);
      } else if (sh.getLastRow() === 0) {
        sh.getRange(1, 1, 1, ADMIN_SCHEMA[name].length).setValues([ADMIN_SCHEMA[name]]);
        sh.setFrozenRows(1);
        created.push(name);
      }
    });
    return { created: created, version: VERSION };
  });
}

/** Whole tab as { headers, rows } (arrays only — the server maps them). */
function readTab_(tab) {
  var sh = sheet_(tab);
  var headers = ADMIN_SCHEMA[tab];
  var last = sh.getLastRow();
  if (last < 2) return { headers: headers, rows: [] };
  var vals = sh.getRange(2, 1, last - 1, headers.length).getValues();
  var rows = [];
  vals.forEach(function (r) {
    var cells = r.map(function (v) { return v === undefined || v === null ? '' : String(v); });
    var empty = cells.every(function (v) { return v === ''; });
    if (!empty) rows.push(cells);
  });
  return { headers: headers, rows: rows };
}

function appendRow_(tab, row) {
  return withLock_(function () {
    sheet_(tab).appendRow(checkRow_(tab, row));
    return { appended: true };
  });
}

/** Update the row whose FIRST column equals id. Throws when missing. */
function updateRow_(tab, id, row) {
  return withLock_(function () {
    var sh = sheet_(tab);
    var clean = checkRow_(tab, row);
    var last = sh.getLastRow();
    for (var r = 2; r <= last; r++) {
      if (String(sh.getRange(r, 1).getValue()) === String(id)) {
        sh.getRange(r, 1, 1, clean.length).setValues([clean]);
        return { updated: true };
      }
    }
    throw new Error('Row not found in "' + tab + '".');
  });
}

/* ------------------------------ routing ------------------------------ */

function ok_(data) {
  return ContentService
    .createTextOutput(JSON.stringify({ success: true, data: data }))
    .setMimeType(ContentService.MimeType.JSON);
}

function fail_(msg) {
  return ContentService
    .createTextOutput(JSON.stringify({ success: false, error: String(msg) }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doGet() {
  return ok_({ app: 'stockly-admin', version: VERSION });
}

function doPost(e) {
  try {
    var body = {};
    try { body = JSON.parse((e && e.postData && e.postData.contents) || '{}'); }
    catch (parseErr) { return fail_('Invalid JSON body.'); }
    requireToken_(body.token);
    var action = body.action || '';
    var data;
    switch (action) {
      case 'setupSchema': data = setupSchema_(); break;
      case 'readTab': data = readTab_(String(body.tab || '')); break;
      case 'appendRow': data = appendRow_(String(body.tab || ''), body.row); break;
      case 'updateRow': data = updateRow_(String(body.tab || ''), body.id, body.row); break;
      default: return fail_('Unknown action: ' + action);
    }
    return ok_(data);
  } catch (err) {
    return fail_(err && err.message ? err.message : err);
  }
}
