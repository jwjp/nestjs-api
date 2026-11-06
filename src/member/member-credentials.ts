import { createHash } from 'crypto';

/**
 * Refresh tokens are long random JWTs, so a plain digest is enough to keep a
 * database leak from yielding usable tokens
 */
export function hashRefreshToken(refreshToken: string): string {
  return createHash('sha256').update(refreshToken).digest('hex');
}

function escapeHtml(value: string): string {
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
  username: string,
  publicBaseUrl: string,
  validationToken: string,
): string {
  const origin = escapeHtml(publicBaseUrl.replace(/\/+$/, ''));
  const token = encodeURIComponent(validationToken);
  return (
    `Hi ${escapeHtml(username)},<br/>` +
    'We just need to verify your email address before you can access {SAMPLE_DOMAIN}<br/><br/>' +
    `Verify your email address ${origin}/members/validate/${token}<br/><br/>` +
    'Thanks!'
  );
}
