const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USER_ID_RE = /^[A-Za-z0-9_-]{8,64}$/;
function normalizeEmail(email) {
  return String(email ?? "").trim().toLowerCase();
}
function isValidEmail(email) {
  const e = normalizeEmail(email);
  return e.length > 0 && e.length <= 254 && EMAIL_RE.test(e);
}
function isValidUserId(id) {
  return typeof id === "string" && USER_ID_RE.test(id.trim());
}
function validateDisplayName(name) {
  const n = String(name ?? "").trim().replace(/\s+/g, " ");
  if (!n) throw new Error("Enter your name.");
  if (n.length > 80) throw new Error("Name is too long (max 80 characters).");
  return n;
}
function validatePassword(password) {
  const p = String(password ?? "");
  if (p.length < 8) throw new Error("Password must be at least 8 characters.");
  if (p.length > 256) throw new Error("Password is too long (max 256 characters).");
  if (!/[A-Za-z]/.test(p) || !/[0-9]/.test(p)) {
    throw new Error("Password must include both letters and numbers.");
  }
  return p;
}
function displayNameError(name) {
  try {
    validateDisplayName(name);
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : "Enter your name.";
  }
}
function passwordError(password) {
  try {
    validatePassword(password);
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : "Invalid password.";
  }
}
function emailError(email) {
  return isValidEmail(email) ? null : "Enter a valid email address.";
}
function isAppsScriptExecUrl(value) {
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" && url.hostname === "script.google.com" && !url.port && /^\/macros\/s\/[^/]+\/exec\/?$/.test(url.pathname) && !url.username && !url.password && !url.search && !url.hash;
  } catch {
    return false;
  }
}
function validateProductInput(v, opts) {
  if (!v.name.trim()) return "Product name is required.";
  if (!v.sku.trim()) return "SKU is required.";
  if (!Number.isFinite(v.costPrice) || v.costPrice < 0) return "Cost price must be 0 or more.";
  if (!Number.isFinite(v.sellingPrice) || v.sellingPrice < 0) return "Selling price must be 0 or more.";
  if (!Number.isInteger(v.currentStock) || v.currentStock < 0)
    return opts.isNew ? "Opening stock must be a whole number \u2265 0." : "Current stock must be a whole number \u2265 0.";
  if (!Number.isInteger(v.minimumStock) || v.minimumStock < 0) return "Minimum stock must be a whole number \u2265 0.";
  return null;
}
function stockStatus(product) {
  if (product.currentStock <= 0) return "out";
  if (product.currentStock <= product.minimumStock) return "low";
  return "ok";
}
function validateStockQuantity(quantity) {
  if (typeof quantity !== "number" || !Number.isFinite(quantity)) return "Enter a quantity.";
  if (!Number.isInteger(quantity) || quantity <= 0) return "Quantity must be a whole number greater than 0.";
  return null;
}
function validateStockAvailability(quantity, available) {
  const qErr = validateStockQuantity(quantity);
  if (qErr) return qErr;
  if (quantity > available) return `Insufficient stock. Only ${available} available.`;
  return null;
}
export {
  displayNameError,
  emailError,
  isAppsScriptExecUrl,
  isValidEmail,
  isValidUserId,
  normalizeEmail,
  passwordError,
  stockStatus,
  validateDisplayName,
  validatePassword,
  validateProductInput,
  validateStockAvailability,
  validateStockQuantity
};
