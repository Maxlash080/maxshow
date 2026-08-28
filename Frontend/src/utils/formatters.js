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

/**
 * Validate Indian Mobile Number (10 digits, starting with 6-9, non-dummy/non-sequential)
 */
export const validateIndianMobile = (phone) => {
  if (!phone) return { isValid: true, error: '' };
  const clean = String(phone).replace(/\D/g, '');
  const digits = clean.length === 12 && clean.startsWith('91') ? clean.slice(2) : clean;

  if (digits.length === 0) {
    return { isValid: true, error: '' };
  }
  if (digits.length < 10) {
    return { isValid: false, error: 'Mobile number must be exactly 10 digits.' };
  }
  if (digits.length > 10) {
    return { isValid: false, error: 'Mobile number cannot exceed 10 digits.' };
  }
  if (!/^[6-9]/.test(digits)) {
    return { isValid: false, error: 'Mobile number must start with 6, 7, 8, or 9.' };
  }
  // Check for all identical digits (e.g. 1111111111, 9999999999, 8888888888, 0000000000)
  if (/^(\d)\1{9}$/.test(digits)) {
    return { isValid: false, error: 'Please enter a valid mobile number (dummy repeating numbers are not allowed).' };
  }
  // Check for 6+ consecutive same digits (e.g. 9999991234)
  if (/(\d)\1{5,}/.test(digits)) {
    return { isValid: false, error: 'Please enter a valid mobile number.' };
  }
  // Common sequential/dummy patterns
  const dummyPatterns = [
    '1234567890', '0123456789', '2345678901', '1234567892', '1234567891',
    '9876543210', '8765432109', '7654321098', '6543210987',
    '9898989898', '9191919191', '9090909090', '8989898989', '7878787878', '6767676767'
  ];
  if (dummyPatterns.includes(digits)) {
    return { isValid: false, error: 'Please enter a valid, active mobile number.' };
  }

  return { isValid: true, error: '', cleanNumber: digits };
};

