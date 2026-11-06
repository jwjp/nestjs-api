const SENSITIVE_KEY =
  /pass(word|wd)?|pwd|secret|token|authorization|cookie|api[-_]?key/i;
const REDACTED = '[REDACTED]';

/**
 * Copy request data for logging with credential values removed
 */
export function redactSensitive(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(redactSensitive);
  }
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        SENSITIVE_KEY.test(key) ? REDACTED : redactSensitive(item),
      ]),
    );
  }
  return value;
}

/**
 * Remove tokens carried in the URL path before the path is logged
 */
export function redactPath(path: string): string {
  return path.replace(/(\/members\/validate\/)[^/?#]+/, `$1${REDACTED}`);
}
