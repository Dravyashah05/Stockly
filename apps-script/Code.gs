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
 */

/* ------------------------------ schema ------------------------------ */

var VERSION = '1.0.2';

/** Bound sheet ID override for standalone projects (set via configureSpreadsheet). */
var PROP_SHEET_ID = 'SPREADSHEET_ID';

var HEADERS = {
  Products: ['id', 'name', 'sku', 'categoryId', 'description', 'image',
    'costPrice', 'sellingPrice', 'currentStock', 'minimumStock',
    'supplierId', 'status', 'createdAt', 'updatedAt'],
  Categories: ['id', 'name', 'createdAt'],
  Suppliers: ['id', 'name', 'phone', 'email', 'address', 'notes', 'createdAt'],
  StockTransactions: ['id', 'productId', 'productName', 'type', 'quantity',
    'price', 'reason', 'supplierId', 'note', 'idempotencyKey', 'createdAt'],
  Settings: ['key', 'value']
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
  // NEVER wipe a tab that holds data: refuse and explain instead.
  if (sh.getLastRow() > 1) {
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
 * single-column scan of col J (idempotencyKey), then one row read on hit.
 * Used inside stockIn_/stockOut_ while the script lock is held, so the
 * lock window stays short even with thousands of transactions.
 */
function findTxByIdemKey_(idem) {
  if (!idem) return null;
  var sh = sheet_('StockTransactions');
  var last = sh.getLastRow();
  if (last < 2) return null;
  var keys = sh.getRange(2, 10, last - 1, 1).getValues();
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

/** Creates the five tabs with headers. Safe to re-run. */
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
    var catIds = {}, supIds = {};
    [['Groceries'], ['Beverages'], ['Household']].forEach(function (c) {
      var id = uid_('cat');
      sheet_('Categories').appendRow([id, c[0], nowIso_()]);
      catIds[c[0]] = id;
    });
    var sups = [
      ['Sharma Traders', '9876543210', 'sharma@example.com', 'Main Bazaar Road', 'Groceries wholesaler'],
      ['Fresh Dairy Co.', '9811112222', 'fresh@example.com', 'Dairy Mandi', 'Milk & bread daily']
    ];
    sups.forEach(function (sp) {
      var id = uid_('sup');
      sheet_('Suppliers').appendRow([id, sp[0], sp[1], sp[2], sp[3], sp[4], nowIso_()]);
      supIds[sp[0]] = id;
    });
    var t = nowIso_();
    var demo = [
      ['Basmati Rice 5kg', 'RICE-001', 'Groceries', 'Premium long-grain rice', '', 240, 320, 40, 10, 'Sharma Traders'],
      ['Whole Wheat Atta 10kg', 'ATTA-010', 'Groceries', 'Stone-ground atta', '', 380, 460, 25, 8, 'Sharma Traders'],
      ['Milk 1L', 'MILK-001', 'Beverages', 'Toned milk, daily stock', '', 55, 65, 30, 12, 'Fresh Dairy Co.'],
      ['Brown Bread', 'BREAD-002', 'Beverages', '', '', 35, 45, 4, 6, 'Fresh Dairy Co.'],
      ['Dish Soap 500ml', 'SOAP-005', 'Household', '', '', 80, 110, 0, 5, 'Sharma Traders']
    ];
    demo.forEach(function (d) {
      sheet_('Products').appendRow([
        uid_('prd'), d[0], d[1], catIds[d[2]] || '', d[3], d[4],
        d[5], d[6], d[7], d[8], supIds[d[9]] || '', 'active', t, t
      ]);
    });
    return 'Demo data inserted.';
  });
}

/* ------------------------------ lookups ------------------------------ */

function categoryMap_() {
  var m = {};
  rows_('Categories').forEach(function (c) { m[c.id] = c.name; });
  return m;
}

function supplierMap_() {
  var m = {};
  rows_('Suppliers').forEach(function (s) { m[s.id] = s.name; });
  return m;
}

function decorateProduct_(p, cats, sups) {
  p.costPrice = num_(p.costPrice, 0);
  p.sellingPrice = num_(p.sellingPrice, 0);
  p.currentStock = Math.floor(num_(p.currentStock, 0));
  p.minimumStock = Math.floor(num_(p.minimumStock, 0));
  p.categoryName = cats[p.categoryId] || '';
  p.supplierName = sups[p.supplierId] || '';
  if (p.createdAt instanceof Date) p.createdAt = p.createdAt.toISOString();
  if (p.updatedAt instanceof Date) p.updatedAt = p.updatedAt.toISOString();
  return p;
}

/* ------------------------------ reads ------------------------------ */

function listProducts_() {
  var cats = categoryMap_(), sups = supplierMap_();
  return rows_('Products').map(function (p) { return decorateProduct_(p, cats, sups); });
}

function listTransactions_(limit) {
  var sups = supplierMap_();
  var all = rows_('StockTransactions').map(function (t) {
    t.quantity = Math.floor(num_(t.quantity, 0));
    t.price = num_(t.price, 0);
    t.supplierName = sups[t.supplierId] || '';
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
 * of five makes refreshes and post-save updates much faster.
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
    categories: rows_('Categories'),
    suppliers: rows_('Suppliers'),
    transactions: tx,
    dashboard: dashboard_(products, tx)
  };
}

/* ------------------------------ validation ------------------------------ */

function checkProduct_(b, isNew, maps) {
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
  // Validate against preloaded maps when the caller already read them
  // (create/update do), avoiding two extra sheet reads per save.
  if (b.categoryId && String(b.categoryId)) {
    var catOk = maps && maps.cats
      ? Object.prototype.hasOwnProperty.call(maps.cats, String(b.categoryId))
      : rowIndexById_('Categories', b.categoryId) !== -1;
    if (!catOk) throw new Error('Unknown category.');
  }
  if (b.supplierId && String(b.supplierId)) {
    var supOk = maps && maps.sups
      ? Object.prototype.hasOwnProperty.call(maps.sups, String(b.supplierId))
      : rowIndexById_('Suppliers', b.supplierId) !== -1;
    if (!supOk) throw new Error('Unknown supplier.');
  }
}

/* ------------------------------ writes ------------------------------ */

function createProduct_(b) {
  return withLock_(function () {
    // Load lookup maps ONCE and reuse for validation + decoration.
    var cats = categoryMap_(), sups = supplierMap_();
    checkProduct_(b, true, { cats: cats, sups: sups });
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
      supplierId: String(b.supplierId || ''),
      status: 'active',
      createdAt: t,
      updatedAt: t
    };
    sheet_('Products').appendRow(objToRow_('Products', p));
    return decorateProduct_(p, cats, sups);
  });
}

function updateProduct_(b) {
  return withLock_(function () {
    if (!b.id) throw new Error('Product id is required.');
    var idx = rowIndexById_('Products', b.id);
    if (idx === -1) throw new Error('Product not found.');
    var sh = sheet_('Products');
    // Single batched read of the row (was one getValue per column).
    var row = sh.getRange(idx, 1, 1, HEADERS.Products.length).getValues()[0];
    var cur = {};
    HEADERS.Products.forEach(function (h, i) { cur[h] = row[i]; });
    var maps = { cats: categoryMap_(), sups: supplierMap_() };
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
      supplierId: b.supplierId !== undefined ? String(b.supplierId || '') : cur.supplierId,
      status: b.status !== undefined ? String(b.status) : cur.status
    };
    checkProduct_(next, false, maps);
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
    return decorateProduct_(merged, maps.cats, maps.sups);
  });
}

function deleteProduct_(id) {
  return withLock_(function () {
    if (!id) throw new Error('Product id is required.');
    var idx = rowIndexById_('Products', id);
    if (idx === -1) throw new Error('Product not found.');
    sheet_('Products').deleteRow(idx);
    return { deleted: String(id) };
  });
}

/**
 * Normalised category name: trimmed, internal whitespace collapsed.
 * Display keeps the user's casing; duplicates compare case-insensitively,
 * so "Electronics", " electronics " and "ELECTRONICS" are the same.
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

function createCategory_(name) {
  return withLock_(function () {
    name = normCatName_(name);
    if (!name) throw new Error('Category name is required.');
    // Single batched read, duplicate-safe under the script lock even when
    // two phones create the same name at the same moment.
    if (catNameTaken_(name, null)) throw new Error('Category already exists.');
    var c = { id: uid_('cat'), name: name, createdAt: nowIso_() };
    sheet_('Categories').appendRow(objToRow_('Categories', c));
    return c;
  });
}

function updateCategory_(id, name) {
  return withLock_(function () {
    if (!id) throw new Error('Category id is required.');
    name = normCatName_(name);
    if (!name) throw new Error('Category name is required.');
    var idx = rowIndexById_('Categories', id);
    if (idx === -1) throw new Error('Category not found.');
    // ID never changes on rename; exclude self from the duplicate check.
    if (catNameTaken_(name, id)) throw new Error('Category already exists.');
    sheet_('Categories').getRange(idx, 2).setValue(name);
    return { id: String(id), name: name };
  });
}

/**
 * Safe delete with two caller-chosen outcomes for assigned products:
 *  - reassignTo = '' (or omitted): move them to explicit Uncategorized.
 *  - reassignTo = <categoryId>: move them to that category (must exist).
 * Everything happens inside ONE script lock: one batched column read, one
 * RangeList write, then the row delete — no partial updates on failure
 * (any throw before deleteRow leaves products untouched... note the column
 * write itself precedes the delete, so validation runs first and the only
 * failure window after the write is the row delete, which cannot leave
 * products pointing at a live-but-wrong category: on deleteRow failure the
 * category still exists with products already moved — a safe state that a
 * retry completes idempotently).
 */
function deleteCategory_(id, reassignTo) {
  return withLock_(function () {
    if (!id) throw new Error('Category id is required.');
    var target = String(reassignTo || '');
    if (target && target === String(id)) throw new Error('Cannot reassign a category to itself.');
    if (target && rowIndexById_('Categories', target) === -1) {
      throw new Error('Reassignment category not found.');
    }
    var idx = rowIndexById_('Categories', id);
    if (idx === -1) throw new Error('Category not found.');
    var sh = sheet_('Products');
    var last = sh.getLastRow();
    var moved = 0;
    if (last >= 2) {
      // One batched column-D read (no getValue in a loop).
      var col = sh.getRange(2, 4, last - 1, 1).getValues();
      var targets = [];
      for (var r = 0; r < col.length; r++) {
        if (String(col[r][0]) === String(id)) targets.push('D' + (r + 2));
      }
      // One batched write: reassign or clear to Uncategorized.
      if (targets.length) {
        sh.getRangeList(targets).setValue(target);
        moved = targets.length;
      }
    }
    sheet_('Categories').deleteRow(idx);
    return { deleted: String(id), reassigned: moved };
  });
}

function createSupplier_(b) {
  return withLock_(function () {
    var name = String((b && b.name) || '').trim();
    if (!name) throw new Error('Supplier name is required.');
    if (b.email && String(b.email).trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(b.email).trim()))
      throw new Error('Invalid email address.');
    var s = {
      id: uid_('sup'), name: name,
      phone: String(b.phone || ''), email: String(b.email || '').trim(),
      address: String(b.address || ''), notes: String(b.notes || ''),
      createdAt: nowIso_()
    };
    sheet_('Suppliers').appendRow(objToRow_('Suppliers', s));
    return s;
  });
}

function updateSupplier_(b) {
  return withLock_(function () {
    if (!b.id) throw new Error('Supplier id is required.');
    var idx = rowIndexById_('Suppliers', b.id);
    if (idx === -1) throw new Error('Supplier not found.');
    if (b.email && String(b.email).trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(b.email).trim()))
      throw new Error('Invalid email address.');
    var sh = sheet_('Suppliers');
    // Batch the whole row in one read-modify-write instead of per-cell calls.
    var srow = sh.getRange(idx, 1, 1, HEADERS.Suppliers.length).getValues()[0];
    var names = ['name', 'phone', 'email', 'address', 'notes'];
    names.forEach(function (k, i) {
      if (b[k] !== undefined) srow[i + 1] = (k === 'name' ? String(b[k]).trim() : String(b[k] || ''));
    });
    sh.getRange(idx, 1, 1, HEADERS.Suppliers.length).setValues([srow]);
    var cur = {};
    HEADERS.Suppliers.forEach(function (h, i) { cur[h] = srow[i]; });
    return cur;
  });
}

function deleteSupplier_(id) {
  return withLock_(function () {
    if (!id) throw new Error('Supplier id is required.');
    var sh = sheet_('Products');
    var last = sh.getLastRow();
    if (last >= 2) {
      // One batched column read + one RangeList write (no per-row calls).
      var col = sh.getRange(2, 11, last - 1, 1).getValues();
      var targets = [];
      for (var r = 0; r < col.length; r++) {
        if (String(col[r][0]) === String(id)) targets.push('K' + (r + 2));
      }
      if (targets.length) sh.getRangeList(targets).setValue('');
    }
    var idx = rowIndexById_('Suppliers', id);
    if (idx === -1) throw new Error('Supplier not found.');
    sheet_('Suppliers').deleteRow(idx);
    return { deleted: String(id) };
  });
}

/** Stock IN: increases inventory; product update + transaction in one lock. */
function stockIn_(b) {
  return withLock_(function () {
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
      var cats0 = categoryMap_(), sups0 = supplierMap_();
      var cur0 = null;
      if (pIdx0 !== -1) {
        cur0 = decorateProduct_(readRow_(sheet_('Products'), 'Products', pIdx0), cats0, sups0);
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
      reason: '', supplierId: String(b.supplierId || ''),
      note: String(b.note || ''), idempotencyKey: idem, createdAt: t
    };
    sheet_('StockTransactions').appendRow(objToRow_('StockTransactions', tx));

    return { product: decorateProduct_(prow, categoryMap_(), supplierMap_()), transaction: tx };
  });
}

/** Stock OUT: decreases inventory, never below zero; atomic + idempotent. */
function stockOut_(b) {
  return withLock_(function () {
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
        cur0 = decorateProduct_(readRow_(sheet_('Products'), 'Products', pIdx0), categoryMap_(), supplierMap_());
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
      quantity: qty, price: '', reason: reason, supplierId: '',
      note: String(b.note || ''), idempotencyKey: idem, createdAt: nowIso_()
    };
    sheet_('StockTransactions').appendRow(objToRow_('StockTransactions', tx));

    return { product: decorateProduct_(prow, categoryMap_(), supplierMap_()), transaction: tx };
  });
}

/* ------------------------------ routing ------------------------------ */

function doGet(e) {
  try {
    var action = (e && e.parameter && e.parameter.action) || '';
    var data;
    switch (action) {
      case 'health':
        data = { time: nowIso_(), version: VERSION };
        break;
      case 'listProducts':
        data = listProducts_();
        break;
      case 'getProduct': {
        var id = e.parameter.id || '';
        var all = listProducts_().filter(function (p) { return String(p.id) === String(id); });
        if (!all.length) return fail_('Product not found.');
        data = all[0];
        break;
      }
      case 'listCategories':
        data = rows_('Categories');
        break;
      case 'listSuppliers':
        data = rows_('Suppliers');
        break;
      case 'listTransactions':
        data = listTransactions_(num_(e.parameter.limit, 200));
        break;
      case 'dashboard':
        data = dashboard_();
        break;
      case 'sync':
        data = sync_(e.parameter.txLimit);
        break;
      default:
        return fail_('Unknown action: ' + action);
    }
    return ok_(data);
  } catch (err) {
    return fail_(err && err.message ? err.message : err);
  }
}

function doPost(e) {
  try {
    var body = {};
    try {
      body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    } catch (parseErr) {
      return fail_('Invalid JSON body.');
    }
    var action = body.action || '';
    var data;
    switch (action) {
      case 'createProduct': data = createProduct_(body); break;
      case 'updateProduct': data = updateProduct_(body); break;
      case 'deleteProduct': data = deleteProduct_(body.id); break;
      case 'createCategory': data = createCategory_(body.name); break;
      case 'updateCategory': data = updateCategory_(body.id, body.name); break;
      case 'deleteCategory': data = deleteCategory_(body.id, body.reassignTo); break;
      case 'createSupplier': data = createSupplier_(body); break;
      case 'updateSupplier': data = updateSupplier_(body); break;
      case 'deleteSupplier': data = deleteSupplier_(body.id); break;
      case 'stockIn': data = stockIn_(body); break;
      case 'stockOut': data = stockOut_(body); break;
      default:
        return fail_('Unknown action: ' + action);
    }
    return ok_(data);
  } catch (err) {
    return fail_(err && err.message ? err.message : err);
  }
}
