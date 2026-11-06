import { RolesEnum } from '../common/auth/roles.enum';

interface ValidationCandidate {
  email: string;
  role: string;
  emailValidateAt: Date | null;
}

/**
 * A token only applies to the unverified address it was issued for, so a
 * reused link cannot restore access after a demotion or an email change
 */
export function canCompleteEmailValidation(
  member: ValidationCandidate | null,
  tokenEmail: unknown,
): boolean {
  return (
    typeof tokenEmail === 'string' &&
    member?.email === tokenEmail &&
    member.role === RolesEnum.user &&
    !member.emailValidateAt
  );
}
