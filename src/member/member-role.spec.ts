import { RolesEnum } from '../common/auth/roles.enum';
import { roleChangeRejection } from './member-role';

const change = {
  targetId: 2,
  requesterId: 1,
  nextRole: RolesEnum.admin as string,
  emailValidateAt: new Date(),
};

describe('roleChangeRejection', () => {
  it('allows promoting a verified member', () => {
    expect(roleChangeRejection(change)).toBeNull();
  });

  it('refuses changing your own role', () => {
    expect(roleChangeRejection({ ...change, targetId: 1 })).not.toBeNull();
  });

  it('refuses promoting an unverified member', () => {
    expect(
      roleChangeRejection({ ...change, emailValidateAt: null }),
    ).not.toBeNull();
  });

  it.each([RolesEnum.user, RolesEnum.deny])(
    'allows setting %s without verification',
    (nextRole) => {
      expect(
        roleChangeRejection({ ...change, nextRole, emailValidateAt: null }),
      ).toBeNull();
    },
  );
});
