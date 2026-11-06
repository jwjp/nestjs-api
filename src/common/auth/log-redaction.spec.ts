import { redactPath, redactSensitive } from './log-redaction';

describe('request log redaction', () => {
  it('removes credentials at any depth and keeps other fields', () => {
    const redacted = JSON.stringify(
      redactSensitive({
        loginId: 'member',
        password: 'plain-password',
        refreshToken: 'refresh-value',
        nested: [{ accessToken: 'access-value', page: 1 }],
      }),
    );

    expect(redacted).toContain('member');
    expect(redacted).toContain('"page":1');
    expect(redacted).not.toContain('plain-password');
    expect(redacted).not.toContain('refresh-value');
    expect(redacted).not.toContain('access-value');
  });

  it('passes through empty and primitive request data', () => {
    expect(redactSensitive(undefined)).toBeUndefined();
    expect(redactSensitive(null)).toBeNull();
    expect(redactSensitive('text')).toBe('text');
  });

  it('removes the email validation token from logged paths', () => {
    expect(redactPath('/members/validate/header.payload.signature')).toBe(
      '/members/validate/[REDACTED]',
    );
    expect(redactPath('/members/1')).toBe('/members/1');
  });
});
