import { parseTrustProxy } from './trust-proxy';

describe('parseTrustProxy', () => {
  it('does not trust proxy headers by default', () => {
    expect(parseTrustProxy(undefined)).toBe(false);
    expect(parseTrustProxy('')).toBe(false);
    expect(parseTrustProxy('false')).toBe(false);
  });

  it('accepts hop counts and address lists', () => {
    expect(parseTrustProxy('1')).toBe(1);
    expect(parseTrustProxy('loopback')).toBe('loopback');
  });
});
