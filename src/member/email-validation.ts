import { RolesEnum } from '../common/auth/roles.enum';

interface ValidationCandidate {
  email: string;
  role: string;
  emailValidateAt: Date | null;
}

/**
 * A token only applies to the unverified address it was issued for, so a
 * reused link cannot confirm an address the member no longer uses
 */
export function canCompleteEmailValidation(
  member: ValidationCandidate | null,
  tokenEmail: unknown,
): boolean {
  return (
    typeof tokenEmail === 'string' &&
    member?.email === tokenEmail &&
    member.role !== RolesEnum.deny &&
    !member.emailValidateAt
  );
}

/**
 * A partial update leaves out the email unless it is being changed
 */
export function changesEmail(current: string, next: string | undefined) {
  return next !== undefined && next !== current;
}
