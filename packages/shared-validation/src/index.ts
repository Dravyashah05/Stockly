/* Pure validation rules shared by the mobile app, the website, and the
 * backend. No I/O, no environment access — safe for browsers, Node,
 * Capacitor, and the serverless functions.
 *
 * The backend keeps its historical export names (isValidAuthEmail,
 * normalizeAuthEmail, …) by re-exporting these functions, so every caller
 * and test observes exactly one implementation of each rule. */

/* ------------------------------ accounts ------------------------------ */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USER_ID_RE = /^[A-Za-z0-9_-]{8,64}$/;

export function normalizeEmail(email: unknown): string {
  return String(email ?? '').trim().toLowerCase();
}

export function isValidEmail(email: unknown): boolean {
  const e = normalizeEmail(email);
  return e.length > 0 && e.length <= 254 && EMAIL_RE.test(e);
}

export function isValidUserId(id: unknown): boolean {
  return typeof id === 'string' && USER_ID_RE.test(id.trim());
}

/** Returns the trimmed, whitespace-collapsed name or throws with an
 *  actionable message (same behaviour the API has always enforced). */
export function validateDisplayName(name: unknown): string {
  const n = String(name ?? '').trim().replace(/\s+/g, ' ');
  if (!n) throw new Error('Enter your name.');
  if (n.length > 80) throw new Error('Name is too long (max 80 characters).');
  return n;
}

/** Same rules as the server: ≥8 chars, ≤256, letters AND numbers.
 *  Throws with an actionable message — use the *Error helpers for
 *  non-throwing form validation. */
export function validatePassword(password: unknown): string {
  const p = String(password ?? '');
  if (p.length < 8) throw new Error('Password must be at least 8 characters.');
  if (p.length > 256) throw new Error('Password is too long (max 256 characters).');
  if (!/[A-Za-z]/.test(p) || !/[0-9]/.test(p)) {
    throw new Error('Password must include both letters and numbers.');
  }
  return p;
}

/** Non-throwing form helpers (return null when valid, else the message). */
export function displayNameError(name: unknown): string | null {
  try {
    validateDisplayName(name);
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : 'Enter your name.';
  }
}

export function passwordError(password: unknown): string | null {
  try {
    validatePassword(password);
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : 'Invalid password.';
  }
}

export function emailError(email: unknown): string | null {
  return isValidEmail(email) ? null : 'Enter a valid email address.';
}

/* ------------------------- Apps Script endpoint ------------------------- */

/** Accept only the deployed Apps Script Web App URL format used by Stockly.
 *  (The endpoint itself is a public URL; the private admin script URL and
 *  token never reach client code.) */
export function isAppsScriptExecUrl(value: string): boolean {
  try {
    const url = new URL(value.trim());
    return (
      url.protocol === 'https:' &&
      url.hostname === 'script.google.com' &&
      !url.port &&
      /^\/macros\/s\/[^/]+\/exec\/?$/.test(url.pathname) &&
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash
    );
  } catch {
    return false;
  }
}

/* ------------------------ products & stock ------------------------ */

/** The numeric fields validated before a product is saved. Kept
 *  structurally compatible with the full form input type so the same
 *  rule serves create and edit on both frontends. */
export interface ProductInputFields {
  name: string;
  sku: string;
  costPrice: number;
  sellingPrice: number;
  currentStock: number;
  minimumStock: number;
  /** Optional on purpose: forms pass their whole state object, and these
   *  fields are validated by the save flow itself, not this rule. */
  categoryId?: string;
  description?: string;
  image?: string;
}

/** Returns null when valid, otherwise an actionable message. */
export function validateProductInput(v: ProductInputFields, opts: { isNew: boolean }): string | null {
  if (!v.name.trim()) return 'Product name is required.';
  if (!v.sku.trim()) return 'SKU is required.';
  if (!Number.isFinite(v.costPrice) || v.costPrice < 0) return 'Cost price must be 0 or more.';
  if (!Number.isFinite(v.sellingPrice) || v.sellingPrice < 0) return 'Selling price must be 0 or more.';
  if (!Number.isInteger(v.currentStock) || v.currentStock < 0)
    return opts.isNew ? 'Opening stock must be a whole number ≥ 0.' : 'Current stock must be a whole number ≥ 0.';
  if (!Number.isInteger(v.minimumStock) || v.minimumStock < 0) return 'Minimum stock must be a whole number ≥ 0.';
  return null;
}

export type StockLevel = 'out' | 'low' | 'ok';

export function stockStatus(product: { currentStock: number; minimumStock: number }): StockLevel {
  if (product.currentStock <= 0) return 'out';
  if (product.currentStock <= product.minimumStock) return 'low';
  return 'ok';
}

/** Stock movement quantity must be a finite whole number > 0
 *  (the backend enforces the same rule under its script lock). */
export function validateStockQuantity(quantity: unknown): string | null {
  if (typeof quantity !== 'number' || !Number.isFinite(quantity)) return 'Enter a quantity.';
  if (!Number.isInteger(quantity) || quantity <= 0) return 'Quantity must be a whole number greater than 0.';
  return null;
}

/** Stock-out must never exceed what is on hand. Returns null when valid. */
export function validateStockAvailability(quantity: number, available: number): string | null {
  const qErr = validateStockQuantity(quantity);
  if (qErr) return qErr;
  if (quantity > available) return `Insufficient stock. Only ${available} available.`;
  return null;
}
