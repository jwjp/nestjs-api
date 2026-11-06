import {
  buildPasswordResetEmail,
  buildValidationEmail,
  hashRefreshToken,
  passwordFingerprint,
} from './member-credentials';

describe('hashRefreshToken', () => {
  it('stores a stable digest instead of the token', () => {
    const digest = hashRefreshToken('refresh-value');
    expect(digest).toMatch(/^[0-9a-f]{64}$/);
    expect(digest).not.toContain('refresh-value');
    expect(hashRefreshToken('refresh-value')).toBe(digest);
    expect(hashRefreshToken('other-value')).not.toBe(digest);
  });
});

describe('passwordFingerprint', () => {
  it('changes with the password and hides the hash', () => {
    const fingerprint = passwordFingerprint('$2b$10$hash');
    expect(fingerprint).not.toContain('hash');
    expect(passwordFingerprint('$2b$10$other')).not.toBe(fingerprint);
  });
});

describe('buildValidationEmail', () => {
  it('links to the configured origin without a doubled slash', () => {
    expect(
      buildValidationEmail(
        'App',
        'member',
        'https://api.example.com/',
        'a.b.c',
      ),
    ).toContain('https://api.example.com/members/validate/a.b.c<br/>');
  });

  it('renders the member name as text', () => {
    const body = buildValidationEmail(
      'App',
      '<img src=x onerror="alert(1)">',
      'https://api.example.com',
      'a.b.c',
    );
    expect(body).not.toContain('<img');
    expect(body).toContain('&lt;img src=x onerror=&quot;alert(1)&quot;&gt;');
  });
});

describe('buildPasswordResetEmail', () => {
  it('adds the token to the configured page', () => {
    expect(
      buildPasswordResetEmail(
        'App',
        'member',
        'https://app.example.com/reset?from=mail',
        'a.b.c',
      ),
    ).toContain('https://app.example.com/reset?from=mail&amp;token=a.b.c');
  });

  it('renders the member name as text', () => {
    expect(
      buildPasswordResetEmail(
        'App',
        '<b>x</b>',
        'https://app.example.com/reset',
        'a.b.c',
      ),
    ).not.toContain('<b>');
  });
});
