export const ERROR_BUFFER_LIMIT = 20;

export const errors = [];

export const report = (error) => {
  errors.push(error);
  if (errors.length > ERROR_BUFFER_LIMIT) {
    errors.splice(0, errors.length - ERROR_BUFFER_LIMIT)
  }
}
export const showLast = () => {
  // Print the last error from the error history,
  // and remove it from the history
  const err = errors.pop();
  if (err) {
    console.error(err);
  } else {
    console.log('No errors to report');
  }
}

/**
 * The Puter API rejects with plain objects rather than Error instances, e.g.
 * `{ status: 401, message: 'Unauthorized' }`. Node renders such a value as the
 * useless "#<Object>", so normalize everything to a real Error before it is
 * shown or rethrown.
 *
 * @param {*} error - Any thrown or rejected value
 * @returns {Error} An Error carrying the original `status`/`code` when present
 */
export const normalizeError = (error) => {
  if (error instanceof Error) return error;

  if (error && typeof error === 'object') {
    // Puter nests driver failures one level down as `{ error: { code, message } }`.
    const detail = error.error && typeof error.error === 'object' ? error.error : error;
    const message = detail.message || detail.code || JSON.stringify(error);
    const normalized = new Error(message);
    if (detail.code !== undefined) normalized.code = detail.code;
    if (error.status !== undefined) normalized.status = error.status;
    return normalized;
  }

  return new Error(String(error ?? 'Unknown error'));
};

// Server codes that mean "this token will not work again", as opposed to a
// transient failure worth retrying.
const AUTH_ERROR_CODES = [
  'token_auth_failed',
  'token_unsupported',
  'invalid_token',
  'auth_failed',
];

/**
 * Whether an error means the stored token is no longer usable and the user has
 * to log in again.
 *
 * @param {*} error - Any thrown or rejected value
 * @returns {boolean} True if the session is invalid
 */
export const isAuthError = (error) => {
  const status = error?.status ?? error?.response?.status;
  if (status === 401 || status === 403) return true;

  const code = String(error?.code ?? error?.error?.code ?? '').toLowerCase();
  if (AUTH_ERROR_CODES.includes(code)) return true;

  const message = String(error?.message ?? '').toLowerCase();
  return AUTH_ERROR_CODES.some(c => message.includes(c))
    || message.includes('unauthorized')
    || message.includes('invalid token');
};

/**
 * A single-line, human-readable description of any thrown value.
 * @param {*} error - Any thrown or rejected value
 * @returns {string} The message to display
 */
export const formatError = (error) => normalizeError(error).message;
