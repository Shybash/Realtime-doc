/**
 * Shared date parsing and formatting utilities.
 * Used by DocumentList, VersionHistoryModal, and CommentSidebar.
 *
 * Handles all Firestore timestamp formats:
 *   - Firestore Admin SDK:  { _seconds, _nanoseconds }
 *   - Firestore Client SDK: { seconds, nanoseconds } / .toDate()
 *   - Plain JS Date / ISO string
 */

/**
 * Converts any Firestore or JS date value into a standard JS Date.
 * @param {*} val
 * @returns {Date}
 */
export function parseDate(val) {
  if (!val) return new Date();

  // Firestore Admin SDK timestamp: { _seconds, _nanoseconds }
  // Firestore Client SDK timestamp: { seconds, nanoseconds }
  if (typeof val === 'object' && !Array.isArray(val)) {
    const seconds = val._seconds ?? val.seconds;
    if (seconds !== undefined) return new Date(seconds * 1000);

    // Firestore Client SDK Timestamp with .toDate()
    if (typeof val.toDate === 'function') return val.toDate();
  }

  const d = new Date(val);
  return isNaN(d.getTime()) ? new Date() : d;
}

/**
 * Formats a date value into a Notion-style relative string.
 *
 * Examples:
 *   Today at 3:14 PM
 *   Yesterday at 9:00 AM
 *   3 days ago
 *   Jun 19, 2025
 *   Jun 19, 2025 at 3:14 PM  (when showTime = true for older dates)
 *
 * @param {*} dateValue   — any value accepted by parseDate()
 * @param {boolean} [showTimeForOld=false] — include time for dates older than 7 days
 * @returns {string}
 */
export function formatDate(dateValue, showTimeForOld = false) {
  const date = parseDate(dateValue);
  const now = new Date();

  const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dateMidnight = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  const diffDays = Math.round((todayMidnight - dateMidnight) / 86_400_000);
  const timeStr = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  if (diffDays === 0) return `Today at ${timeStr}`;
  if (diffDays === 1) return `Yesterday at ${timeStr}`;
  if (diffDays > 1 && diffDays < 7) return `${diffDays} days ago`;
  return showTimeForOld ? `${dateStr} at ${timeStr}` : dateStr;
}
