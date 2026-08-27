/**
 * Centralized API Fetcher Wrapper
 */

export const apiRequest = async (url, options = {}) => {
  const defaultHeaders = {
    'Accept': 'application/json',
    ...(options.body && typeof options.body === 'string' ? { 'Content-Type': 'application/json' } : {}),
  };

  const response = await fetch(url, {
    credentials: 'same-origin',
    ...options,
    headers: {
      ...defaultHeaders,
      ...options.headers,
    },
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 405) {
      throw new Error('Method not allowed (405). Please ensure the backend server has been restarted with the latest code.');
    }
    let errorMsg = data.message || data.detail;
    if (Array.isArray(data.detail) && data.detail.length > 0) {
      const err = data.detail[0];
      const field = err.loc ? err.loc[err.loc.length - 1] : 'field';
      errorMsg = err.msg ? `${field}: ${err.msg}` : 'Validation error';
    } else if (typeof data.detail === 'string') {
      errorMsg = data.detail;
    }
    throw new Error(errorMsg || `Request failed (${response.status}).`);
  }
  return data;
};
