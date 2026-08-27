/**
 * Formatting Utilities for MAXSHOW
 */

export const escapeHtml = (value) => {
  return String(value ?? '').replace(/[&<>'"]/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;',
  }[char] || char));
};

export const formatPrice = (price) => {
  const num = Number(price);
  if (isNaN(num) || num === 0) return 'Free entry';
  return `₹${num.toLocaleString('en-IN')}`;
};

/**
 * Robust Event Date/Time Formatter
 * Converts raw datetime strings like "2026-08-25 20:00" or ISO timestamps
 * into friendly human-readable strings like "Tuesday, 8:00 PM" or "Tonight, 8:00 PM".
 */
export const formatEventTime = (timeStr, day = '') => {
  if (!timeStr) return '';
  const str = String(timeStr).trim();

  // Check if it's an ISO / SQL datetime string like "2026-08-25 20:00" or "2026-08-25T20:00"
  const isDatePattern = /^\d{4}-\d{2}-\d{2}/.test(str);
  if (!isDatePattern) {
    return str;
  }

  try {
    const normalized = str.replace(' ', 'T');
    const d = new Date(normalized);
    if (isNaN(d.getTime())) return str;

    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const dayName = days[d.getDay()];
    const monthName = months[d.getMonth()];
    const dateNum = d.getDate();

    let hours = d.getHours();
    const minutes = d.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    const minutesStr = minutes < 10 ? '0' + minutes : minutes;
    const timeFormatted = `${hours}:${minutesStr} ${ampm}`;

    if (!str.includes(':')) {
      return `${dayName}, ${monthName} ${dateNum}`;
    }

    if (day === 'today') {
      return `Tonight, ${timeFormatted}`;
    } else if (day === 'tomorrow') {
      return `Tomorrow, ${timeFormatted}`;
    }

    return `${dayName}, ${timeFormatted}`;
  } catch (_) {
    return str;
  }
};
