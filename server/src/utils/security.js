import mongoose from "mongoose";

/**
 * Escapes special regular expression characters in a string
 * to prevent ReDoS (Regular Expression Denial of Service) and regex syntax errors in MongoDB $regex queries.
 *
 * @param {string} str - Raw user input string
 * @returns {string} Safe escaped regex pattern string
 */
export function escapeRegex(str) {
  if (typeof str !== "string") return "";
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Validates whether a value is a valid MongoDB ObjectId.
 *
 * @param {*} value - The value to inspect
 * @returns {boolean} True if value is a valid 24-character hex ObjectId
 */
export function isSafeObjectId(value) {
  if (!value || typeof value !== "string") return false;
  return mongoose.Types.ObjectId.isValid(value) && /^[0-9a-fA-F]{24}$/.test(value);
}

/**
 * Safely parses a date string or timestamp into a valid Date object.
 * Returns null if the value is invalid or produces NaN.
 *
 * @param {*} value - Date string, number, or Date instance
 * @returns {Date|null} Valid Date or null
 */
export function safeDate(value) {
  if (!value) return null;
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Builds a safe MongoDB $gte / $lte date range filter object.
 *
 * @param {*} startDate - Start date input
 * @param {*} endDate - End date input
 * @returns {Object} { createdAt?: { $gte?: Date, $lte?: Date } } or {}
 */
export function buildDateRangeFilter(startDate, endDate) {
  const filter = {};
  const start = safeDate(startDate);
  const end = safeDate(endDate);

  if (start || end) {
    filter.createdAt = {};
    if (start) filter.createdAt.$gte = start;
    if (end) filter.createdAt.$lte = end;
  }
  return filter;
}
