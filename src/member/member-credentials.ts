import { createHash } from 'crypto';

/**
 * Refresh tokens are long random JWTs, so a plain digest is enough to keep a
 * database leak from yielding usable tokens
 */
export function hashRefreshToken(refreshToken: string): string {
  return createHash('sha256').update(refreshToken).digest('hex');
}

/**
 * Carried in a password reset token, which makes the token single-use: it stops
 * matching as soon as the password changes
 */
export function passwordFingerprint(passwordHash: string): string {
  return createHash('sha256').update(passwordHash).digest('hex');
}

/**
 * Member columns that end every existing session
 */
export function revokedSessions() {
  return {
    refreshToken: null,
    tokenVersion: () => '`tokenVersion` + 1',
  };
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * The link uses the configured origin because the Host header of a request is
 * client-controlled
 */
export function buildValidationEmail(
  appName: string,
  username: string,
  publicBaseUrl: string,
  validationToken: string,
): string {
  const origin = escapeHtml(publicBaseUrl.replace(/\/+$/, ''));
  const token = encodeURIComponent(validationToken);
  return (
    `Hi ${escapeHtml(username)},<br/>` +
    `We just need to verify your email address for ${escapeHtml(
      appName,
    )}.<br/><br/>` +
    `Verify your email address ${origin}/members/validate/${token}<br/><br/>` +
    'Thanks!'
  );
}

export function buildPasswordResetEmail(
  appName: string,
  username: string,
  resetUrl: string,
  resetToken: string,
): string {
  const url = new URL(resetUrl);
  url.searchParams.set('token', resetToken);
  return (
    `Hi ${escapeHtml(username)},<br/>` +
    `A password reset was requested for your ${escapeHtml(
      appName,
    )} account.<br/><br/>` +
    `Reset your password ${escapeHtml(url.toString())}<br/><br/>` +
    'If this was not you, you can ignore this email.'
  );
}
