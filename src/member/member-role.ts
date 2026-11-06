import { RolesEnum } from '../common/auth/roles.enum';

interface RoleChange {
  targetId: number;
  requesterId: number;
  nextRole: string;
  emailValidateAt: Date | null;
}

/**
 * Returns why a role change is refused, or null when it is allowed
 */
export function roleChangeRejection(change: RoleChange): string | null {
  // Keeps the last administrator from locking everyone out
  if (change.targetId === change.requesterId) {
    return '자신의 역할은 변경할 수 없습니다.';
  }

  if (change.nextRole === RolesEnum.admin && !change.emailValidateAt) {
    return '이메일 인증을 완료한 멤버만 관리자로 지정할 수 있습니다.';
  }

  return null;
}
