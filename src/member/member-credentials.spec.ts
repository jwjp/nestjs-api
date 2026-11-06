import { buildValidationEmail, hashRefreshToken } from './member-credentials';

describe('hashRefreshToken', () => {
  it('stores a stable digest instead of the token', () => {
    const digest = hashRefreshToken('refresh-value');
    expect(digest).toMatch(/^[0-9a-f]{64}$/);
    expect(digest).not.toContain('refresh-value');
    expect(hashRefreshToken('refresh-value')).toBe(digest);
    expect(hashRefreshToken('other-value')).not.toBe(digest);
  });
});

describe('buildValidationEmail', () => {
  it('links to the configured origin without a doubled slash', () => {
    expect(
      buildValidationEmail('member', 'https://api.example.com/', 'a.b.c'),
    ).toContain('https://api.example.com/members/validate/a.b.c<br/>');
  });

  it('renders the member name as text', () => {
    const body = buildValidationEmail(
      '<img src=x onerror="alert(1)">',
      'https://api.example.com',
      'a.b.c',
    );
    expect(body).not.toContain('<img');
    expect(body).toContain('&lt;img src=x onerror=&quot;alert(1)&quot;&gt;');
  });
});
