/**
 * Proxy headers can be forged unless a known proxy overwrites them, so they are
 * only trusted when configured, e.g. TRUST_PROXY=1 behind a single Nginx server
 */
export function parseTrustProxy(value?: string): boolean | number | string {
  const setting = value?.trim();
  if (!setting || setting === 'false') {
    return false;
  }
  return /^\d+$/.test(setting) ? Number(setting) : setting;
}
