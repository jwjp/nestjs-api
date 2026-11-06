import { RolesEnum } from '../common/auth/roles.enum';
import { canCompleteEmailValidation, changesEmail } from './email-validation';

const EMAIL = 'member@example.com';
const member = { email: EMAIL, role: RolesEnum.user, emailValidateAt: null };

describe('canCompleteEmailValidation', () => {
  it.each([
    ['an unverified member', member],
    ['an unverified administrator', { ...member, role: RolesEnum.admin }],
  ])('accepts %s for the address in the token', (_name, candidate) => {
    expect(canCompleteEmailValidation(candidate, EMAIL)).toBe(true);
  });

  it.each([
    ['a token without an address', member, undefined],
    ['a changed address', { ...member, email: 'new@example.com' }, EMAIL],
    ['a verified member', { ...member, emailValidateAt: new Date() }, EMAIL],
    ['a denied member', { ...member, role: RolesEnum.deny }, EMAIL],
    ['a removed member', null, EMAIL],
  ])('rejects %s', (_name, candidate, tokenEmail) => {
    expect(canCompleteEmailValidation(candidate, tokenEmail)).toBe(false);
  });
});

describe('changesEmail', () => {
  it('ignores an update without an email', () => {
    expect(changesEmail(EMAIL, undefined)).toBe(false);
  });

  it('ignores the current email', () => {
    expect(changesEmail(EMAIL, EMAIL)).toBe(false);
  });

  it('detects a new email', () => {
    expect(changesEmail(EMAIL, 'new@example.com')).toBe(true);
  });
});
