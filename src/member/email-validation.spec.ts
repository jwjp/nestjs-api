import { RolesEnum } from '../common/auth/roles.enum';
import { canCompleteEmailValidation } from './email-validation';

const EMAIL = 'member@example.com';
const member = { email: EMAIL, role: RolesEnum.user, emailValidateAt: null };

describe('canCompleteEmailValidation', () => {
  it('accepts an unverified member for the address in the token', () => {
    expect(canCompleteEmailValidation(member, EMAIL)).toBe(true);
  });

  it.each([
    ['a token without an address', member, undefined],
    ['a changed address', { ...member, email: 'new@example.com' }, EMAIL],
    ['a verified member', { ...member, emailValidateAt: new Date() }, EMAIL],
    ['a denied member', { ...member, role: RolesEnum.deny }, EMAIL],
    ['an administrator', { ...member, role: RolesEnum.admin }, EMAIL],
    ['a removed member', null, EMAIL],
  ])('rejects %s', (_name, candidate, tokenEmail) => {
    expect(canCompleteEmailValidation(candidate, tokenEmail)).toBe(false);
  });
});
