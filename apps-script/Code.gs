/**
 * Stockly — Google Apps Script backend (Google Sheets as database).
 *
 * SETUP
 * 1. Create a new Google Sheet.
 * 2. Extensions → Apps Script → paste this whole file → Save.
 * 3. Run `setupDatabase` once (authorise when asked).
 * 4. Optionally run `setupDemoData` for sample rows.
 * 5. Deploy → New deployment → Web app → Execute as: Me,
 *    Who has access: Anyone → Deploy → copy the /exec URL into
 *    the Stockly app (Settings → Cloud database).
 *
 * All responses are JSON: { success: true, data } or
 * { success: false, error }.
 *
 * NOTE v1.4.0: linked-device sessions. Inventory writes may carry
 * `deviceId` + `deviceSession` (issued by the trusted /api/devices
 * backend); verified via HMAC plus a live revocation check when
 * DEVICE_VALIDATE_URL is configured. Writes without device fields keep
 * working (legacy setups).
 *
 * NOTE v1.3.0: adds a `Users` tab for registered user profiles
 * (userId, name, email, accountStatus, createdAt, updatedAt, lastLoginAt).
 * No passwords, tokens, or secrets are ever stored here — profiles only.
 * Inventory writes optionally carry `userId`; when present the backend
 * rejects the write for unknown / suspended / deactivated accounts.
 * The private admin spreadsheet is a SEPARATE spreadsheet accessed only
 * through the server-side admin API — never through this script.
 *
 * NOTE v1.2.0: products carry an optional categoryId (Categories tab).
 * Suppliers remain removed; an old Suppliers tab (if any) is left unused.
 */

/* ------------------------------ schema ------------------------------ */

var VERSION = '1.5.0';

/** Bound sheet ID override for standalone projects (set via configureSpreadsheet). */
var PROP_SHEET_ID = 'SPREADSHEET_ID';

var HEADERS = {
  Products: ['id', 'name', 'sku', 'description', 'image',
    'costPrice', 'sellingPrice', 'currentStock', 'minimumStock',
    'status', 'createdAt', 'updatedAt', 'categoryId'],
  Categories: ['id', 'name', 'createdAt'],
  StockTransactions: ['id', 'productId', 'productName', 'type', 'quantity',
    'price', 'reason', 'note', 'idempotencyKey', 'createdAt'],
  Settings: ['key', 'value'],
  /* User database: registered app-user profiles. No passwords, session
   * tokens, API keys, or other secrets are stored in this tab — ever.
   * accountStatus is mirrored FROM the admin system; the admin sheet is
   * authoritative for status, this tab is authoritative for profile data. */
  Users: ['userId', 'name', 'email', 'accountStatus',
    'createdAt', 'updatedAt', 'lastLoginAt']
};

var STOCK_OUT_REASONS = ['Sale', 'Damaged', 'Lost', 'Return', 'Other'];

/* ------------------------------ helpers ------------------------------ */

function ss_() {
  var active = null;
  try {
    active = SpreadsheetApp.getActiveSpreadsheet();
  } catch (e) {
    active = null; // standalone project: no active spreadsheet
  }
  if (active) return active;
  var id = null;
  try {
    id = PropertiesService.getScriptProperties().getProperty(PROP_SHEET_ID);
  } catch (e) {
    id = null;
  }
  if (id) {
    try {
      return SpreadsheetApp.openById(id);
    } catch (e) {
      throw new Error('Cannot open spreadsheet "' + id + '". Check the ID and that the script account can access it. Details: ' + (e && e.message ? e.message : e));
    }
  }
  throw new Error('No spreadsheet connected. If this script lives inside your Sheet (Extensions > Apps Script), open the Sheet once and re-run. For a standalone project, run configureSpreadsheet("PASTE_SHEET_ID_HERE") first.');
}

/**
 * Standalone projects only: point the script at a Sheet by ID
 * (the long key in the Sheet URL between /d/ and /edit).
 */
function configureSpreadsheet(spreadsheetId) {
  if (!spreadsheetId || !String(spreadsheetId).trim()) {
    throw new Error('Pass the Sheet ID, e.g. configureSpreadsheet("1AbC...xyz").');
  }
  var s = SpreadsheetApp.openById(String(spreadsheetId).trim());
  PropertiesService.getScriptProperties().setProperty(PROP_SHEET_ID, s.getId());
  return 'Connected to spreadsheet: ' + s.getName() + ' (' + s.getId() + ')';
}

/** Read-only diagnostics: run this and share the output when reporting backend errors. */
function diagnose() {
  var s = ss_();
  var tabs = {};
  Object.keys(HEADERS).forEach(function (name) {
    var sh = s.getSheetByName(name);
    tabs[name] = sh ? Math.max(sh.getLastRow() - 1, 0) + ' rows' : 'MISSING';
  });
  return {
    version: VERSION,
    spreadsheet: s.getName(),
    spreadsheetId: s.getId(),
    tabs: tabs
  };
}

function sheet_(name) {
  var sh = ss_().getSheetByName(name);
  if (!sh) throw new Error('Missing tab "' + name + '". Run setupDatabase first.');
  return sh;
}

function ensureHeaders_(sh, headers) {
  var width = Math.max(headers.length, sh.getLastColumn());
  var first = width > 0 ? sh.getRange(1, 1, 1, width).getValues()[0] : [];
  var same = headers.every(function (h, i) { return String(first[i]) === h; });
  if (same) {
    if (sh.getFrozenRows() === 0) sh.setFrozenRows(1);
    return 'ok';
  }
  // Safe auto-migration: when the existing headers match the new schema
  // positionally and the schema only APPENDS columns, extend the header row
  // in place (old rows read '' for the new columns). Anything else still
  // refuses rather than risking data.
  if (sh.getLastRow() > 1) {
    var existingCols = sh.getLastColumn();
    if (existingCols > 0 && existingCols < headers.length) {
      var prefixOk = true;
      for (var i = 0; i < existingCols; i++) {
        if (String(first[i]) !== headers[i]) { prefixOk = false; break; }
      }
      if (prefixOk) {
        sh.getRange(1, 1, 1, headers.length).setValues([headers]);
        if (sh.getFrozenRows() === 0) sh.setFrozenRows(1);
        return 'migrated';
      }
    }
    throw new Error(
      'Tab "' + sh.getName() + '" has data rows but different headers — refusing to clear it. ' +
      'Rename this tab (or back it up and empty it) and run setupDatabase again.');
  }
  sh.getRange(1, 1, 1, headers.length).setValues([headers]);
  sh.setFrozenRows(1);
  return 'created';
}

function uid_(prefix) {
  return prefix + '_' +
    Utilities.getUuid().replace(/-/g, '').slice(0, 12) +
    Date.now().toString(36);
}

function nowIso_() {
  return new Date().toISOString();
}

function num_(v, fallback) {
  var n = Number(v);
  return isFinite(n) ? n : fallback;
}

function rows_(name) {
  var sh = sheet_(name);
  var last = sh.getLastRow();
  if (last < 2) return [];
  var width = HEADERS[name].length;
  var vals = sh.getRange(2, 1, last - 1, width).getValues();
  return vals
    .filter(function (r) { return String(r[0]) !== ''; })
    .map(function (r) {
      var o = {};
      HEADERS[name].forEach(function (h, i) { o[h] = r[i]; });
      return o;
    });
}

function rowIndexById_(name, id) {
  var sh = sheet_(name);
  var last = sh.getLastRow();
  if (last < 2) return -1;
  var ids = sh.getRange(2, 1, last - 1, 1).getValues();
  for (var i = 0; i < ids.length; i++) {
    if (String(ids[i][0]) === String(id)) return i + 2; // 1-based + header
  }
  return -1;
}

function objToRow_(name, o) {
  return HEADERS[name].map(function (h) {
    var v = o[h];
    return v === undefined || v === null ? '' : v;
  });
}

/** Read one full row in a single call (avoids one getValue per column). */
function readRow_(sh, tabName, idx) {
  var vals = sh.getRange(idx, 1, 1, HEADERS[tabName].length).getValues()[0];
  var o = {};
  HEADERS[tabName].forEach(function (h, i) { o[h] = vals[i]; });
  return o;
}

/**
 * Idempotency lookup WITHOUT reading the whole transaction table:
 * single-column scan of col I (idempotencyKey), then one row read on hit.
 * Used inside stockIn_/stockOut_ while the script lock is held, so the
 * lock window stays short even with thousands of transactions.
 */
function findTxByIdemKey_(idem) {
  if (!idem) return null;
  var sh = sheet_('StockTransactions');
  var last = sh.getLastRow();
  if (last < 2) return null;
  var keys = sh.getRange(2, 9, last - 1, 1).getValues();
  for (var i = 0; i < keys.length; i++) {
    if (String(keys[i][0]) === String(idem) && String(keys[i][0]) !== '') {
      return readRow_(sh, 'StockTransactions', i + 2);
    }
  }
  return null;
}

/**
 * SKU uniqueness WITHOUT reading full product rows: single-column scans
 * of col A (id) + col C (sku). Case-insensitive, optional id exclusion
 * for updates.
 */
function skuTaken_(sku, excludeId) {
  var sh = sheet_('Products');
  var last = sh.getLastRow();
  if (last < 2) return false;
  var ids = sh.getRange(2, 1, last - 1, 1).getValues();
  var skus = sh.getRange(2, 3, last - 1, 1).getValues();
  var want = String(sku).toLowerCase();
  for (var i = 0; i < skus.length; i++) {
    if (String(skus[i][0]).toLowerCase() === want &&
        String(ids[i][0]) !== String(excludeId || '')) {
      return true;
    }
  }
  return false;
}

/** Write one full row object in a single call. */
function writeRow_(sh, tabName, idx, o) {
  sh.getRange(idx, 1, 1, HEADERS[tabName].length).setValues([objToRow_(tabName, o)]);
}

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

function withLock_(fn) {
  var lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    return fn();
  } finally {
    lock.releaseLock();
  }
}

/* ------------------------------ setup ------------------------------ */

/** Creates the tabs with headers. Safe to re-run. */
function setupDatabase() {
  var s = ss_();
  Object.keys(HEADERS).forEach(function (name) {
    var sh = s.getSheetByName(name) || s.insertSheet(name);
    ensureHeaders_(sh, HEADERS[name]);
  });
  // Seed a settings row so the tab is not empty.
  var st = s.getSheetByName('Settings');
  if (st.getLastRow() < 2) {
    st.appendRow(['installedAt', nowIso_()]);
  }
  return 'Stockly database ready: ' + Object.keys(HEADERS).join(', ');
}

/** Inserts small-business demo data. Run AFTER setupDatabase. */
function setupDemoData() {
  return withLock_(function () {
    var t = nowIso_();
    var catIds = {};
    ['Groceries', 'Beverages', 'Household'].forEach(function (name) {
      var id = uid_('cat');
      sheet_('Categories').appendRow([id, name, t]);
      catIds[name] = id;
    });
    var demo = [
      ['Basmati Rice 5kg', 'RICE-001', 'Premium long-grain rice', '', 240, 320, 40, 10, 'Groceries'],
      ['Whole Wheat Atta 10kg', 'ATTA-010', 'Stone-ground atta', '', 380, 460, 25, 8, 'Groceries'],
      ['Milk 1L', 'MILK-001', 'Toned milk, daily stock', '', 55, 65, 30, 12, 'Beverages'],
      ['Brown Bread', 'BREAD-002', '', '', 35, 45, 4, 6, 'Beverages'],
      ['Dish Soap 500ml', 'SOAP-005', '', '', 80, 110, 0, 5, 'Household']
    ];
    demo.forEach(function (d) {
      sheet_('Products').appendRow([
        uid_('prd'), d[0], d[1], d[2], d[3],
        d[4], d[5], d[6], d[7], 'active', t, t, catIds[d[8]] || ''
      ]);
    });
    return 'Demo data inserted.';
  });
}

/* ------------------------------ lookups ------------------------------ */

function categoryMap_() {
  try {
    var m = {};
    rows_('Categories').forEach(function (c) { m[c.id] = c.name; });
    return m;
  } catch (e) {
    return {}; // tab predates Categories — treat every product as uncategorised
  }
}

function decorateProduct_(p, cats) {
  if (!cats) cats = categoryMap_();
  p.costPrice = num_(p.costPrice, 0);
  p.sellingPrice = num_(p.sellingPrice, 0);
  p.currentStock = Math.floor(num_(p.currentStock, 0));
  p.minimumStock = Math.floor(num_(p.minimumStock, 0));
  p.categoryName = (cats || {})[p.categoryId] || '';
  if (p.createdAt instanceof Date) p.createdAt = p.createdAt.toISOString();
  if (p.updatedAt instanceof Date) p.updatedAt = p.updatedAt.toISOString();
  return p;
}

/* ------------------------------ reads ------------------------------ */

function listProducts_() {
  var cats = categoryMap_();
  return rows_('Products').map(function (p) { return decorateProduct_(p, cats); });
}

function listCategories_() {
  try {
    return rows_('Categories');
  } catch (e) {
    return [];
  }
}

function listTransactions_(limit) {
  var all = rows_('StockTransactions').map(function (t) {
    t.quantity = Math.floor(num_(t.quantity, 0));
    t.price = num_(t.price, 0);
    if (t.createdAt instanceof Date) t.createdAt = t.createdAt.toISOString();
    return t;
  });
  all.sort(function (a, b) { return String(b.createdAt) < String(a.createdAt) ? -1 : 1; });
  return all.slice(0, Math.min(Math.max(limit || 200, 1), 1000));
}

function dashboard_(preProducts, preTx) {
  var products = preProducts || listProducts_();
  var totalUnits = 0, costValue = 0, retailValue = 0;
  var low = [], out = [];
  products.forEach(function (p) {
    totalUnits += p.currentStock;
    costValue += p.currentStock * p.costPrice;
    retailValue += p.currentStock * p.sellingPrice;
    if (p.currentStock <= 0) out.push(p);
    else if (p.currentStock <= p.minimumStock) low.push(p);
  });
  var tx = preTx || listTransactions_(200);
  return {
    totalProducts: products.length,
    totalUnits: totalUnits,
    lowStockCount: low.length,
    outOfStockCount: out.length,
    inventoryCostValue: Math.round(costValue * 100) / 100,
    inventoryRetailValue: Math.round(retailValue * 100) / 100,
    recentMovements: tx.slice(0, 6),
    lowStockItems: out.concat(low).slice(0, 8)
  };
}

/**
 * Single-call sync: everything the app needs in ONE execution.
 * Apps Script calls are slow (~1-3s each), so one round trip instead
 * of several makes refreshes and post-save updates much faster.
 * txLimit bounds the transaction payload (dashboard needs ~6 rows;
 * History pages older rows on demand). Defaults to 200 so older app
 * versions that send no limit behave exactly as before.
 */
function sync_(txLimit) {
  var lim = Number(txLimit) > 0 ? Math.min(Math.floor(Number(txLimit)), 1000) : 200;
  var products = listProducts_();
  var tx = listTransactions_(lim);
  return {
    products: products,
    categories: listCategories_(),
    transactions: tx,
    dashboard: dashboard_(products, tx)
  };
}

/* ------------------------------ validation ------------------------------ */

function checkProduct_(b, isNew) {
  if (!b.name || !String(b.name).trim()) throw new Error('Product name is required.');
  if (!b.sku || !String(b.sku).trim()) throw new Error('SKU is required.');
  var cost = Number(b.costPrice), sell = Number(b.sellingPrice);
  if (!isFinite(cost) || cost < 0) throw new Error('Cost price must be 0 or more.');
  if (!isFinite(sell) || sell < 0) throw new Error('Selling price must be 0 or more.');
  var stock = Number(b.currentStock), min = Number(b.minimumStock);
  if (isNew && (!isFinite(stock) || Math.floor(stock) !== stock || stock < 0))
    throw new Error('Opening stock must be a whole number ≥ 0.');
  if (!isFinite(min) || Math.floor(min) !== min || min < 0)
    throw new Error('Minimum stock must be a whole number ≥ 0.');
  if (b.categoryId && String(b.categoryId)) {
    try {
      if (rowIndexById_('Categories', b.categoryId) === -1) throw new Error('Unknown category.');
    } catch (e) {
      if (/Unknown category/.test(e && e.message ? e.message : '')) throw e;
      // No Categories tab yet — accept the value rather than blocking saves.
    }
  }
  // Image may be an http(s) URL, blank, or a small base64 data URL produced
  // by the app's photo upload (JPEG/PNG/WebP/GIF). Sheet cells hold max
  // 50k chars, so data URLs are capped well under that.
  var imgTrim = String((b && b.image) || '').trim();
  if (imgTrim) {
    if (/^data:image\/(jpeg|png|webp|gif);base64,/i.test(imgTrim)) {
      if (imgTrim.length > 45000) throw new Error('Photo is too large — pick a smaller photo or paste a link.');
    } else if (!/^https?:\/\//i.test(imgTrim)) {
      throw new Error('Image must be an uploaded photo or a valid http(s) URL, or left blank.');
    }
  }
}

/* ------------------------------ writes ------------------------------ */

function createProduct_(b) {
  return withLock_(function () {
    requireActiveUser_(b.userId);
    requireDevice_(b);
    checkProduct_(b, true);
    var sku = String(b.sku).trim();
    if (skuTaken_(sku, null)) throw new Error('SKU already exists. Use a unique SKU.');
    var t = nowIso_();
    var p = {
      id: uid_('prd'),
      name: String(b.name).trim(),
      sku: sku,
      categoryId: String(b.categoryId || ''),
      description: String(b.description || ''),
      image: String(b.image || '').trim(),
      costPrice: Number(b.costPrice),
      sellingPrice: Number(b.sellingPrice),
      currentStock: Math.floor(Number(b.currentStock)),
      minimumStock: Math.floor(Number(b.minimumStock)),
      status: 'active',
      createdAt: t,
      updatedAt: t
    };
    sheet_('Products').appendRow(objToRow_('Products', p));
    return decorateProduct_(p);
  });
}

function updateProduct_(b) {
  return withLock_(function () {
    requireActiveUser_(b.userId);
    requireDevice_(b);
    if (!b.id) throw new Error('Product id is required.');
    var idx = rowIndexById_('Products', b.id);
    if (idx === -1) throw new Error('Product not found.');
    var sh = sheet_('Products');
    // Single batched read of the row (was one getValue per column).
    var row = sh.getRange(idx, 1, 1, HEADERS.Products.length).getValues()[0];
    var cur = {};
    HEADERS.Products.forEach(function (h, i) { cur[h] = row[i]; });
    var next = {
      name: b.name !== undefined ? String(b.name).trim() : cur.name,
      sku: b.sku !== undefined ? String(b.sku).trim() : cur.sku,
      categoryId: b.categoryId !== undefined ? String(b.categoryId || '') : cur.categoryId,
      description: b.description !== undefined ? String(b.description || '') : cur.description,
      image: b.image !== undefined ? String(b.image || '').trim() : cur.image,
      costPrice: b.costPrice !== undefined ? Number(b.costPrice) : num_(cur.costPrice, 0),
      sellingPrice: b.sellingPrice !== undefined ? Number(b.sellingPrice) : num_(cur.sellingPrice, 0),
      currentStock: b.currentStock !== undefined ? Math.floor(Number(b.currentStock)) : Math.floor(num_(cur.currentStock, 0)),
      minimumStock: b.minimumStock !== undefined ? Math.floor(Number(b.minimumStock)) : Math.floor(num_(cur.minimumStock, 0)),
      status: b.status !== undefined ? String(b.status) : cur.status
    };
    checkProduct_(next, false);
    if (!isFinite(next.currentStock) || next.currentStock < 0) throw new Error('Stock cannot be negative.');
    var sku = next.sku;
    if (skuTaken_(sku, b.id)) throw new Error('SKU already used by another product.');
    next.updatedAt = nowIso_();
    var merged = {};
    HEADERS.Products.forEach(function (h) {
      merged[h] = next[h] !== undefined ? next[h] : cur[h];
    });
    merged.id = cur.id;
    merged.createdAt = cur.createdAt instanceof Date ? cur.createdAt.toISOString() : cur.createdAt;
    sh.getRange(idx, 1, 1, HEADERS.Products.length).setValues([objToRow_('Products', merged)]);
    merged.createdAt = String(merged.createdAt);
    return decorateProduct_(merged);
  });
}

function deleteProduct_(b) {
  return withLock_(function () {
    var id = (b && typeof b === 'object') ? b.id : b;
    requireActiveUser_(b && typeof b === 'object' ? b.userId : undefined);
    requireDevice_(b);
    if (!id) throw new Error('Product id is required.');
    var idx = rowIndexById_('Products', id);
    if (idx === -1) throw new Error('Product not found.');
    sheet_('Products').deleteRow(idx);
    return { deleted: String(id) };
  });
}

/**
 * Normalised category name: trimmed, internal whitespace collapsed.
 * Duplicates compare case-insensitively.
 */
function normCatName_(name) {
  return String(name || '').trim().replace(/\s+/g, ' ');
}

function catNameTaken_(name, excludeId) {
  var want = normCatName_(name).toLowerCase();
  var rows = rows_('Categories');
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i].name).trim().toLowerCase() === want &&
        String(rows[i].id) !== String(excludeId || '')) {
      return true;
    }
  }
  return false;
}

function createCategory_(name, ctx) {
  return withLock_(function () {
    var userId = ctx && typeof ctx === 'object' ? ctx.userId : ctx;
    requireActiveUser_(userId);
    requireDevice_(ctx && typeof ctx === 'object' ? ctx : {});
    name = normCatName_(name);
    if (!name) throw new Error('Category name is required.');
    if (catNameTaken_(name, null)) throw new Error('Category already exists.');
    var c = { id: uid_('cat'), name: name, createdAt: nowIso_() };
    sheet_('Categories').appendRow(objToRow_('Categories', c));
    return c;
  });
}

function updateCategory_(id, name, ctx) {
  return withLock_(function () {
    var userId = ctx && typeof ctx === 'object' ? ctx.userId : ctx;
    requireActiveUser_(userId);
    requireDevice_(ctx && typeof ctx === 'object' ? ctx : {});
    if (!id) throw new Error('Category id is required.');
    name = normCatName_(name);
    if (!name) throw new Error('Category name is required.');
    var idx = rowIndexById_('Categories', id);
    if (idx === -1) throw new Error('Category not found.');
    if (catNameTaken_(name, id)) throw new Error('Category already exists.');
    sheet_('Categories').getRange(idx, 2).setValue(name);
    return { id: String(id), name: name };
  });
}

/**
 * Delete a category and move its products to Uncategorized (blank
 * categoryId). categoryId lives in the last Products column.
 */
function deleteCategory_(id, ctx) {
  return withLock_(function () {
    var userId = ctx && typeof ctx === 'object' ? ctx.userId : ctx;
    requireActiveUser_(userId);
    requireDevice_(ctx && typeof ctx === 'object' ? ctx : {});
    if (!id) throw new Error('Category id is required.');
    var idx = rowIndexById_('Categories', id);
    if (idx === -1) throw new Error('Category not found.');
    var cleared = 0;
    var sh = sheet_('Products');
    var last = sh.getLastRow();
    var catCol = HEADERS.Products.length; // categoryId is appended last
    if (last >= 2) {
      var col = sh.getRange(2, catCol, last - 1, 1).getValues();
      var targets = [];
      for (var r = 0; r < col.length; r++) {
        if (String(col[r][0]) === String(id)) targets.push(r + 2);
      }
      if (targets.length) {
        targets.forEach(function (row) { sh.getRange(row, catCol).setValue(''); });
        cleared = targets.length;
      }
    }
    sheet_('Categories').deleteRow(idx);
    return { deleted: String(id), cleared: cleared };
  });
}

/* ------------------------------ users ------------------------------ */

var USER_ID_RE = /^[A-Za-z0-9_-]{8,64}$/;
var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
var USER_STATUS_RE = /^(active|suspended|deactivated)$/;

function normEmail_(email) {
  return String(email || '').trim().toLowerCase();
}

function checkUserFields_(name, email) {
  var n = String(name || '').trim().replace(/\s+/g, ' ');
  if (!n) throw new Error('Name is required.');
  if (n.length > 80) throw new Error('Name is too long (max 80 characters).');
  var e = normEmail_(email);
  if (!e) throw new Error('Email is required.');
  if (e.length > 254 || !EMAIL_RE.test(e)) throw new Error('Enter a valid email address.');
  return { name: n, email: e };
}

function findUserRow_(userId) {
  var sh = sheet_('Users');
  var last = sh.getLastRow();
  if (last < 2) return null;
  var ids = sh.getRange(2, 1, last - 1, 1).getValues();
  for (var i = 0; i < ids.length; i++) {
    if (String(ids[i][0]) === String(userId)) {
      return readRow_(sh, 'Users', i + 2);
    }
  }
  return null;
}

function findUserRowIndex_(sh, userId) {
  var last = sh.getLastRow();
  if (last < 2) return -1;
  var ids = sh.getRange(2, 1, last - 1, 1).getValues();
  for (var i = 0; i < ids.length; i++) {
    if (String(ids[i][0]) === String(userId)) return i + 2;
  }
  return -1;
}

function emailTaken_(email, excludeUserId) {
  var sh = sheet_('Users');
  var last = sh.getLastRow();
  if (last < 2) return false;
  var width = HEADERS.Users.length;
  var vals = sh.getRange(2, 1, last - 1, width).getValues();
  var want = normEmail_(email);
  for (var i = 0; i < vals.length; i++) {
    if (String(vals[i][0]) === '') continue;
    if (String(vals[i][2]).trim().toLowerCase() === want &&
        String(vals[i][0]) !== String(excludeUserId || '')) {
      return true;
    }
  }
  return false;
}

/**
 * Guard for writes carrying a userId. Unknown / suspended / deactivated
 * accounts are rejected HERE (backend), never only in the UI. A missing
 * userId is allowed for backwards compatibility with pre-registration
 * sheets and single-owner setups.
 */
function requireActiveUser_(userId) {
  if (userId === undefined || userId === null || String(userId).trim() === '' || String(userId).trim() === 'user_default') return null;
  var u;
  try {
    u = findUserRow_(String(userId));
  } catch (e) {
    return null; // No Users tab yet (old sheet) — don't block legacy writes.
  }
  var sh = sheet_('Users');
  if (sh.getLastRow() < 2) return null; // No enrolled users yet — don't block writes.
  if (!u) return null; // Not explicitly enrolled in this sheet — allow verified caller.
  var st = String(u.accountStatus || 'active');
  if (st === 'suspended') throw new Error('Account is suspended. Contact the owner to reactivate.');
  if (st === 'deactivated') throw new Error('Account is deactivated. Contact the owner.');
  if (!USER_STATUS_RE.test(st)) throw new Error('Account is not active. Contact the owner.');
  return u;
}

/** Register a new user profile. Never accepts passwords/tokens/roles. */
function registerUser_(b) {
  return withLock_(function () {
    sheet_('Users'); // throws with setup guidance when missing
    var checked = checkUserFields_(b.name, b.email);
    if (emailTaken_(checked.email, null)) throw new Error('This email is already registered.');
    var userId = String(b.userId || '').trim();
    if (userId) {
      if (!USER_ID_RE.test(userId)) throw new Error('Invalid user ID format.');
      if (findUserRow_(userId)) throw new Error('User ID already exists.');
    } else {
      userId = uid_('usr');
    }
    var t = nowIso_();
    var u = {
      userId: userId, name: checked.name, email: checked.email,
      accountStatus: 'active', createdAt: t, updatedAt: t, lastLoginAt: t
    };
    sheet_('Users').appendRow(objToRow_('Users', u));
    return u;
  });
}

/** Update own profile (name/email). Suspended accounts cannot write. */
function updateUserProfile_(b) {
  return withLock_(function () {
    var userId = String(b.userId || '').trim();
    if (!userId) throw new Error('userId is required.');
    requireActiveUser_(userId);
    var sh = sheet_('Users');
    var idx = findUserRowIndex_(sh, userId);
    if (idx === -1) throw new Error('User not found.');
    var cur = readRow_(sh, 'Users', idx);
    var next = {
      name: b.name !== undefined ? String(b.name).trim().replace(/\s+/g, ' ') : String(cur.name),
      email: b.email !== undefined ? normEmail_(b.email) : normEmail_(cur.email)
    };
    var checked = checkUserFields_(next.name, next.email);
    if (emailTaken_(checked.email, userId)) throw new Error('This email is already registered.');
    cur.name = checked.name;
    cur.email = checked.email;
    cur.updatedAt = nowIso_();
    writeRow_(sh, 'Users', idx, cur);
    return cur;
  });
}

/** Record a login. Rejected for suspended/deactivated accounts. */
function reportLogin_(userId) {
  return withLock_(function () {
    var id = String(userId || '').trim();
    if (!id) throw new Error('userId is required.');
    var u = requireActiveUser_(id);
    if (!u) throw new Error('User not found.');
    var sh = sheet_('Users');
    var idx = findUserRowIndex_(sh, id);
    if (idx === -1) throw new Error('User not found.');
    var cur = readRow_(sh, 'Users', idx);
    cur.lastLoginAt = nowIso_();
    cur.updatedAt = cur.lastLoginAt;
    writeRow_(sh, 'Users', idx, cur);
    return cur;
  });
}

function getUser_(userId) {
  var id = String(userId || '').trim();
  if (!id) throw new Error('userId is required.');
  var u = findUserRow_(id);
  if (!u) throw new Error('User not found.');
  return u;
}

function getUserByEmail_(email) {
  var e = normEmail_(email);
  if (!e) throw new Error('Email is required.');
  var sh = sheet_('Users');
  var last = sh.getLastRow();
  if (last < 2) throw new Error('User not found.');
  var width = HEADERS.Users.length;
  var vals = sh.getRange(2, 1, last - 1, width).getValues();
  for (var i = 0; i < vals.length; i++) {
    if (String(vals[i][2]).trim().toLowerCase() === e && String(vals[i][0]) !== '') {
      var o = {};
      HEADERS.Users.forEach(function (h, j) { o[h] = vals[i][j]; });
      return o;
    }
  }
  throw new Error('User not found.');
}

/** Stock IN: increases inventory; product update + transaction in one lock. */
function stockIn_(b) {
  return withLock_(function () {
    requireActiveUser_(b.userId);
    requireDevice_(b);
    var productId = String(b.productId || '');
    var qty = Math.floor(Number(b.quantity));
    if (!productId) throw new Error('Product is required.');
    if (!isFinite(qty) || qty <= 0) throw new Error('Quantity must be a whole number greater than 0.');
    var price = b.price === undefined || b.price === '' ? NaN : Number(b.price);
    if (b.price !== undefined && b.price !== '' && (!isFinite(price) || price < 0))
      throw new Error('Purchase price must be 0 or more.');
    var idem = String(b.idempotencyKey || '').trim();
    if (!idem) throw new Error('idempotencyKey is required.');

    // Idempotent replay: single-column lookup (no full-table scan under lock).
    // Returns the original result instead of double-adding.
    var existing = findTxByIdemKey_(idem);
    if (existing) {
      var pIdx0 = rowIndexById_('Products', existing.productId);
      var cur0 = null;
      if (pIdx0 !== -1) {
        cur0 = decorateProduct_(readRow_(sheet_('Products'), 'Products', pIdx0));
      }
      return { product: cur0, transaction: existing, replayed: true };
    }

    var pIdx = rowIndexById_('Products', productId);
    if (pIdx === -1) throw new Error('Product not found.');
    var psh = sheet_('Products');
    // One batched row read, modify in memory, one batched write.
    var prow = readRow_(psh, 'Products', pIdx);
    var stock = Math.floor(num_(prow.currentStock, 0));
    var newStock = stock + qty;
    prow.currentStock = newStock;
    prow.updatedAt = nowIso_();
    if (isFinite(price)) prow.costPrice = price; // refresh cost price
    writeRow_(psh, 'Products', pIdx, prow);

    var t = nowIso_();
    var tx = {
      id: uid_('txn'), productId: productId, productName: String(prow.name), type: 'IN',
      quantity: qty, price: isFinite(price) ? price : '',
      reason: '',
      note: String(b.note || ''), idempotencyKey: idem, createdAt: t
    };
    sheet_('StockTransactions').appendRow(objToRow_('StockTransactions', tx));

    return { product: decorateProduct_(prow), transaction: tx };
  });
}

/** Stock OUT: decreases inventory, never below zero; atomic + idempotent. */
function stockOut_(b) {
  return withLock_(function () {
    requireActiveUser_(b.userId);
    requireDevice_(b);
    var productId = String(b.productId || '');
    var qty = Math.floor(Number(b.quantity));
    if (!productId) throw new Error('Product is required.');
    if (!isFinite(qty) || qty <= 0) throw new Error('Quantity must be a whole number greater than 0.');
    var reason = String(b.reason || 'Sale');
    if (STOCK_OUT_REASONS.indexOf(reason) === -1) throw new Error('Invalid reason.');
    var idem = String(b.idempotencyKey || '').trim();
    if (!idem) throw new Error('idempotencyKey is required.');

    // Idempotent replay: single-column lookup (no full-table scan under lock).
    var existing = findTxByIdemKey_(idem);
    if (existing) {
      var pIdx0 = rowIndexById_('Products', existing.productId);
      var cur0 = null;
      if (pIdx0 !== -1) {
        cur0 = decorateProduct_(readRow_(sheet_('Products'), 'Products', pIdx0));
      }
      return { product: cur0, transaction: existing, replayed: true };
    }

    var pIdx = rowIndexById_('Products', productId);
    if (pIdx === -1) throw new Error('Product not found.');
    var psh = sheet_('Products');
    // One batched row read, modify in memory, one batched write.
    var prow = readRow_(psh, 'Products', pIdx);
    var stock = Math.floor(num_(prow.currentStock, 0));
    if (qty > stock) throw new Error('Insufficient stock. Only ' + stock + ' available.');
    prow.currentStock = stock - qty;
    prow.updatedAt = nowIso_();
    writeRow_(psh, 'Products', pIdx, prow);

    var tx = {
      id: uid_('txn'), productId: productId, productName: String(prow.name), type: 'OUT',
      quantity: qty, price: '', reason: reason,
      note: String(b.note || ''), idempotencyKey: idem, createdAt: nowIso_()
    };
    sheet_('StockTransactions').appendRow(objToRow_('StockTransactions', tx));

    return { product: decorateProduct_(prow), transaction: tx };
  });
}

/* ------------------------------ admin status mirror ------------------------------ */

/**
 * Trusted status mirror (admin → user sheet). The private admin spreadsheet
 * is authoritative for accountStatus; this tab mirrors it so inventory
 * writes can be rejected locally via requireActiveUser_.
 *
 * The envelope {userId, accountStatus, issuedAt, signature} is created by
 * the server-side admin API, which holds the mirror secret. This script
 * holds the SAME secret in Script Properties (never in code, never in the
 * frontend). signature = hex(HMAC_SHA256(secret, userId|status|issuedAt)).
 * Replay protection: per-user last-applied issuedAt in Settings
 * (`mirror_<userId>`); older envelopes are rejected.
 */
var PROP_SYNC_SECRET = 'USER_SYNC_SECRET';

function getSyncSecret_() {
  try {
    return String(PropertiesService.getScriptProperties().getProperty(PROP_SYNC_SECRET) || '').trim();
  } catch (e) {
    return '';
  }
}

function hex_(bytes) {
  return bytes.map(function (b) {
    var v = (b < 0 ? b + 256 : b).toString(16);
    return v.length === 1 ? '0' + v : v;
  }).join('');
}

function verifyMirrorSignature_(secret, userId, status, issuedAt, signature) {
  var msg = String(userId) + '|' + String(status) + '|' + String(issuedAt);
  var mac = Utilities.computeHmacSha256Signature(msg, secret);
  var expect = hex_(mac).toLowerCase();
  var got = String(signature || '').trim().toLowerCase();
  if (got.length !== expect.length || got.length < 32) return false;
  var diff = 0;
  for (var i = 0; i < expect.length; i++) {
    diff |= expect.charCodeAt(i) ^ got.charCodeAt(i);
  }
  return diff === 0;
}

function getSetting_(key) {
  var sh = sheet_('Settings');
  var last = sh.getLastRow();
  if (last < 2) return '';
  var vals = sh.getRange(2, 1, last - 1, 2).getValues();
  for (var i = 0; i < vals.length; i++) {
    if (String(vals[i][0]) === String(key)) return vals[i][1];
  }
  return '';
}

function setSetting_(key, value) {
  var sh = sheet_('Settings');
  var last = sh.getLastRow();
  if (last >= 2) {
    var keys = sh.getRange(2, 1, last - 1, 1).getValues();
    for (var i = 0; i < keys.length; i++) {
      if (String(keys[i][0]) === String(key)) {
        sh.getRange(i + 2, 2).setValue(value);
        return;
      }
    }
  }
  sh.appendRow([String(key), value]);
}

function mirrorStatus_(b) {
  return withLock_(function () {
    var secret = getSyncSecret_();
    if (!secret) throw new Error('Status sync is not configured on this database. Ask the owner to set USER_SYNC_SECRET in Apps Script → Project Settings → Script Properties.');
    var userId = String(b.userId || '').trim();
    var status = String(b.accountStatus || '').trim();
    var issuedAt = String(b.issuedAt || '').trim();
    if (!userId) throw new Error('userId is required.');
    if (!USER_STATUS_RE.test(status)) throw new Error('Invalid account status.');
    if (!/^\d{4}-\d{2}-\d{2}T/.test(issuedAt)) throw new Error('Invalid envelope timestamp.');
    if (issuedAt > new Date(Date.now() + 5 * 60 * 1000).toISOString()) {
      throw new Error('Envelope timestamp is in the future.');
    }
    if (!verifyMirrorSignature_(secret, userId, status, issuedAt, b.signature)) {
      throw new Error('Invalid status envelope signature.');
    }
    var markerKey = 'mirror_' + userId;
    var lastApplied = String(getSetting_(markerKey) || '');
    if (lastApplied && issuedAt <= lastApplied) {
      var cur = findUserRow_(userId);
      return { user: cur, replayed: true };
    }
    var sh = sheet_('Users');
    var idx = findUserRowIndex_(sh, userId);
    if (idx === -1) throw new Error('User not found.');
    var row = readRow_(sh, 'Users', idx);
    row.accountStatus = status;
    row.updatedAt = nowIso_();
    writeRow_(sh, 'Users', idx, row);
    setSetting_(markerKey, issuedAt);
    return { user: row, replayed: false };
  });
}

/**
 * Shop-owner setup helper: stores the shared mirror secret in Script
 * Properties. Run manually once (it never ships in code or the frontend):
 *   setSyncSecret("a-long-random-string-also-saved-as-ADMIN_MIRROR_SECRET")
 */
function setSyncSecret(secret) {
  if (!secret || String(secret).trim().length < 16) {
    throw new Error('Pass a secret of at least 16 characters.');
  }
  PropertiesService.getScriptProperties().setProperty(PROP_SYNC_SECRET, String(secret).trim());
  return 'Mirror secret saved in Script Properties (value is not shown back).';
}

/* ------------------------------ linked-device sessions ------------------------------ */
/**
 * Enforcement for linked-device sessions on inventory writes. The trusted
 * backend (Vercel /api/devices) issues device sessions; this script
 * verifies them WITHOUT ever storing live tokens:
 *  1. Local HMAC check with DEVICE_SESSION_SECRET (Script Properties).
 *  2. Live revocation check against /api/devices validateDevice when
 *     DEVICE_VALIDATE_URL is configured (fail-closed).
 * Writes WITHOUT device fields are still allowed for backwards
 * compatibility with legacy single-device setups (documented limitation:
 * set both Script Properties for full revocation enforcement).
 */
var PROP_DEVICE_SECRET = 'DEVICE_SESSION_SECRET';
var PROP_VALIDATE_URL = 'DEVICE_VALIDATE_URL';

function getDeviceSecret_() {
  try {
    return String(PropertiesService.getScriptProperties().getProperty(PROP_DEVICE_SECRET) || '').trim();
  } catch (e) {
    return '';
  }
}

function getValidateUrl_() {
  try {
    return String(PropertiesService.getScriptProperties().getProperty(PROP_VALIDATE_URL) || '').trim();
  } catch (e) {
    return '';
  }
}

function b64UrlDecode_(s) {
  s = String(s || '').replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  return Utilities.base64Decode(s);
}

function parseDeviceSession_(sessionToken, secret) {
  try {
    if (!sessionToken || !secret) return null;
    var parts = String(sessionToken).split('.');
    if (parts.length !== 2) return null;
    var mac = Utilities.computeHmacSha256Signature(parts[0], secret);
    var got = b64UrlDecode_(parts[1]);
    if (got.length !== mac.length) return null;
    var diff = 0;
    for (var i = 0; i < mac.length; i++) diff |= (mac[i] ^ (got[i] < 0 ? got[i] + 256 : got[i]));
    if (diff !== 0) return null;
    var payload = JSON.parse(Utilities.newBlob(b64UrlDecode_(parts[0])).getDataAsString());
    if (!payload || !payload.userId || !payload.deviceId || !payload.exp) return null;
    if (Date.now() > Number(payload.exp)) return null;
    return { userId: String(payload.userId), deviceId: String(payload.deviceId) };
  } catch (e) {
    return null;
  }
}

function validateDeviceLive_(userId, deviceId, sessionToken) {
  var url = getValidateUrl_();
  if (!url) return { mode: 'unconfigured' };
  try {
    var res = UrlFetchApp.fetch(url, {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify({ action: 'validateDevice', userId: userId, deviceId: deviceId, sessionToken: sessionToken }),
      muteHttpExceptions: true
    });
    var data = JSON.parse(res.getContentText() || '{}');
    if (data && data.success && data.data) return { mode: 'live', valid: !!data.data.valid, reason: String(data.data.reason || '') };
    return { mode: 'live', valid: false, reason: 'unavailable' };
  } catch (e) {
    throw new Error('Could not verify this device right now. Check your connection and try again.');
  }
}

function requireDevice_(b) {
  var ds = b && typeof b === 'object' ? String(b.deviceSession || '') : '';
  var dd = b && typeof b === 'object' ? String(b.deviceId || '') : '';
  if (!ds && !dd) return null; // legacy write without device info
  if (!ds || !dd) throw new Error('Device session is incomplete. Re-link this device from Settings.');
  var secret = getDeviceSecret_();
  if (!secret) return null; // device checks not configured on this database
  var local = parseDeviceSession_(ds, secret);
  if (!local || local.deviceId !== dd) {
    throw new Error('This device is not linked to Stockly. Re-link it from Settings.');
  }
  if (b.userId && String(b.userId) !== local.userId) {
    throw new Error('Device and account do not match. Re-link this device from Settings.');
  }
  var live = validateDeviceLive_(local.userId, local.deviceId, ds);
  if (live.mode === 'live' && !live.valid) {
    if (live.reason === 'revoked') throw new Error('This device was unlinked. Link it again to continue.');
    if (live.reason === 'suspended') throw new Error('Account is suspended. Contact the owner to reactivate.');
    throw new Error('This device session is no longer valid. Re-link this device from Settings.');
  }
  return local;
}

/**
 * Shop-owner setup helper for device enforcement. Run manually once:
 *   setDeviceSecrets("same-value-as-DEVICE_SESSION_SECRET", "https://your-app.vercel.app/api/devices")
 * The URL is optional (without it only the local signature is checked).
 */
function setDeviceSecrets(secret, validateUrl) {
  if (!secret || String(secret).trim().length < 16) {
    throw new Error('Pass a secret of at least 16 characters.');
  }
  var props = PropertiesService.getScriptProperties();
  props.setProperty(PROP_DEVICE_SECRET, String(secret).trim());
  if (validateUrl && String(validateUrl).trim()) {
    props.setProperty(PROP_VALIDATE_URL, String(validateUrl).trim());
  }
  return 'Device secrets saved in Script Properties (values are not shown back).';
}

/**
 * Backend introspection for the trusted sheet-gateway (Vercel /api/sheets).
 * Returns the bound spreadsheet id, backend version, and tab names so the
 * server can verify structure and record the association. Contains no
 * row data, secrets, or credentials.
 */
function describe_() {
  var s = ss_();
  var tabs = [];
  try {
    s.getSheets().forEach(function (sh) { tabs.push(sh.getName()); });
  } catch (e) {
    tabs = [];
  }
  return { spreadsheetId: s.getId(), version: VERSION, tabs: tabs };
}

/* ------------------------------ routing ------------------------------ */

function doGet(e) {
  try {
    var p = (e && e.parameter) || {};
    var action = p.action || '';
    var data;
    switch (action) {
      case 'health': data = { time: nowIso_(), version: VERSION }; break;
      case 'listProducts': data = listProducts_(); break;
      case 'getProduct': {
        var products = listProducts_().filter(function (product) { return String(product.id) === String(p.id || ''); });
        if (!products.length) return fail_('Product not found.');
        data = products[0]; break;
      }
      case 'listCategories': data = listCategories_(); break;
      case 'listTransactions': data = listTransactions_(num_(p.limit, 200)); break;
      case 'dashboard': data = dashboard_(); break;
      case 'sync': data = sync_(p.txLimit); break;
      case 'getUser': data = getUser_(p.userId); break;
      case 'getUserByEmail': data = getUserByEmail_(p.email); break;
      case 'describe': data = describe_(); break;
      default: return fail_('Unknown action: ' + action);
    }
    return ok_(data);
  } catch (err) {
    return fail_(err && err.message ? err.message : err);
  }
}

function doPost(e) {
  try {
    var body = {};
    try { body = JSON.parse((e && e.postData && e.postData.contents) || '{}'); }
    catch (parseErr) { return fail_('Invalid JSON body.'); }
    var action = body.action || '';
    var data;
    switch (action) {
      case 'createProduct': data = createProduct_(body); break;
      case 'updateProduct': data = updateProduct_(body); break;
      case 'deleteProduct': data = deleteProduct_(body); break;
      case 'createCategory': data = createCategory_(body.name, body); break;
      case 'updateCategory': data = updateCategory_(body.id, body.name, body); break;
      case 'deleteCategory': data = deleteCategory_(body.id, body); break;
      case 'stockIn': data = stockIn_(body); break;
      case 'stockOut': data = stockOut_(body); break;
      case 'registerUser': data = registerUser_(body); break;
      case 'updateUserProfile': data = updateUserProfile_(body); break;
      case 'reportLogin': data = reportLogin_(body.userId); break;
      case 'mirrorStatus': data = mirrorStatus_(body); break;
      case 'setupDatabase': data = { ready: setupDatabase() }; break;
      default: return fail_('Unknown action: ' + action);
    }
    return ok_(data);
  } catch (err) {
    return fail_(err && err.message ? err.message : err);
  }
}
