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
 * Helper to detect continuous sequential ascending or descending digits (e.g. 12345, 54321)
 */
const hasSequentialDigits = (numStr, minLength = 5) => {
  let ascCount = 1;
  let descCount = 1;

  for (let i = 0; i < numStr.length - 1; i++) {
    const current = Number(numStr[i]);
    const next = Number(numStr[i + 1]);

    if (next === current + 1) {
      ascCount++;
      if (ascCount >= minLength) return true;
    } else {
      ascCount = 1;
    }

    if (next === current - 1) {
      descCount++;
      if (descCount >= minLength) return true;
    } else {
      descCount = 1;
    }
  }
  return false;
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
  // Check for any digit repeated more than 4 times in a row (e.g. 00000, 11111, 99999)
  if (/(\d)\1{4,}/.test(digits)) {
    return { isValid: false, error: 'Mobile number cannot contain the same digit repeated more than 4 times in a row.' };
  }
  // Check for continuous sequential numbers of 5 or more digits (e.g. 12345, 56789, 98765, 54321)
  if (hasSequentialDigits(digits, 5)) {
    return { isValid: false, error: 'Mobile number cannot contain continuous sequential numbers (e.g. 12345... or 98765...).' };
  }
  // Check for low unique digits (e.g. 9898989898, 1212121212, only 1-3 unique digits)
  const uniqueDigits = new Set(digits.split(''));
  if (uniqueDigits.size < 4) {
    return { isValid: false, error: 'Please enter a valid, active mobile number (too few unique digits).' };
  }
  // Common 2-digit repetitive patterns (e.g. 98989898, 91919191)
  if (/(\d{2})\1{3,}/.test(digits)) {
    return { isValid: false, error: 'Please enter a valid mobile number (repeating patterns are not allowed).' };
  }

  return { isValid: true, error: '', cleanNumber: digits };
};

const parseDateSafe = (dateStr) => {
  if (!dateStr) return null;
  if (dateStr instanceof Date) return isNaN(dateStr.getTime()) ? null : dateStr;
  let str = String(dateStr).trim();
  // If it's a standard ISO string without timezone indicator, treat as UTC
  if (/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/.test(str)) {
    str = str.replace(' ', 'T');
    if (!str.endsWith('Z') && !/[+-]\d{2}:?\d{2}$/.test(str)) {
      str += 'Z';
    }
  }
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
};

/**
 * Format Booking Date (e.g. "29 Aug 2026")
 */
export const formatBookingDate = (dateStr) => {
  if (!dateStr) return '—';
  try {
    const d = parseDateSafe(dateStr);
    if (!d) return String(dateStr);
    return d.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch (_) {
    return String(dateStr);
  }
};

/**
 * Format Booking Time (e.g. "03:07 PM")
 */
export const formatBookingTime = (dateStr) => {
  if (!dateStr) return '';
  try {
    const d = parseDateSafe(dateStr);
    if (!d) return '';
    return d.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  } catch (_) {
    return '';
  }
};

/**
 * Format Booking Date & Time (e.g. "29 Aug 2026, 03:07 PM")
 */
export const formatBookingDateTime = (dateStr) => {
  if (!dateStr) return '—';
  try {
    const d = parseDateSafe(dateStr);
    if (!d) return String(dateStr);
    const dateFormatted = d.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
    const timeFormatted = d.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
    return `${dateFormatted}, ${timeFormatted}`;
  } catch (_) {
    return String(dateStr);
  }
};

/**
 * Validate Email Address
 * Rules:
 * 1. Username (before @) must be between 6 and 30 characters.
 * 2. Allowed characters in username: letters, numbers, ., _, %, +, -
 * 3. Username cannot start/end with a dot or contain consecutive dots (..).
 * 4. Must contain a valid domain with a valid extension (e.g. gmail.com, outlook.com).
 * 5. Rejects dummy repeating patterns.
 */
export const validateEmail = (email) => {
  if (!email || !String(email).trim()) {
    return { isValid: false, error: 'Email address is required.' };
  }
  const clean = String(email).trim().toLowerCase();

  if (clean.includes(' ')) {
    return { isValid: false, error: 'Email address cannot contain spaces.' };
  }

  const parts = clean.split('@');
  if (parts.length !== 2) {
    return { isValid: false, error: 'Please enter a valid email address (e.g. username@gmail.com).' };
  }

  const [localPart, domainPart] = parts;

  if (localPart.length < 6) {
    return { isValid: false, error: `Email username must be at least 6 characters (${localPart.length}/6 entered).` };
  }
  if (localPart.length > 30) {
    return { isValid: false, error: `Email username cannot exceed 30 characters (${localPart.length}/30 entered).` };
  }

  if (!/[a-z]/.test(localPart)) {
    return { isValid: false, error: 'Email username must contain at least one or more letter / character (a-z). Only numbers are not allowed.' };
  }

  if (!/^[a-z0-9._%+-]+$/.test(localPart)) {
    return { isValid: false, error: 'Email username can only contain letters, numbers, and standard symbols (. _ % + -).' };
  }

  if (localPart.startsWith('.') || localPart.endsWith('.')) {
    return { isValid: false, error: 'Email username cannot start or end with a period (.).' };
  }

  if (localPart.includes('..')) {
    return { isValid: false, error: 'Email username cannot contain consecutive periods (..).' };
  }

  if (/^([a-z0-9])\1{5,}$/.test(localPart)) {
    return { isValid: false, error: 'Please enter a valid email address (dummy repeating characters are not allowed).' };
  }

  if (!domainPart || !domainPart.includes('.')) {
    return { isValid: false, error: 'Please enter a valid email domain (e.g. @gmail.com).' };
  }

  const domainLabels = domainPart.split('.');
  if (domainLabels.some((l) => !l)) {
    return { isValid: false, error: 'Please enter a valid email domain format.' };
  }

  const tld = domainLabels[domainLabels.length - 1];
  if (tld.length < 2 || !/^[a-z]+$/.test(tld)) {
    return { isValid: false, error: 'Email domain must have a valid extension (e.g. .com, .in, .org).' };
  }

  for (const label of domainLabels) {
    if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(label)) {
      return { isValid: false, error: `Invalid email domain format '${domainPart}'.` };
    }
  }

  if (!/^[a-z0-9._%+-]{6,30}@[a-z0-9.-]+\.[a-z]{2,}$/.test(clean)) {
    return { isValid: false, error: 'Please enter a valid email address.' };
  }

  return { isValid: true, error: '', cleanEmail: clean, localPart, domainPart };
};



