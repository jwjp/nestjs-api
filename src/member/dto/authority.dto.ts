import { IsInt, IsNotEmpty } from 'class-validator';
import { Expose } from 'class-transformer';

/**
 * Base DTO for a member's branch and menu authority
 */
export class AuthorityDto {
  /**
   * Branch ID primary key
   * @example 1
   */
  @Expose()
  @IsInt({
    message: '지점 ID 값은 숫자이어야 합니다.',
  })
  @IsNotEmpty({
    message: '지점 ID 값은 빈 값이 올 수 없습니다.',
  })
  branchId: number;

  /**
   * Menu ID primary key
   * @example 1
   */
  @Expose()
  @IsInt({
    message: '메뉴 ID 값은 숫자이어야 합니다.',
  })
  @IsNotEmpty({
    message: '메뉴 ID 값은 빈 값이 올 수 없습니다.',
  })
  menuId: number;

  /**
   * Member ID primary key
   * @example 1
   */
  @Expose()
  @IsInt({
    message: '멤버 ID 값은 숫자이어야 합니다.',
  })
  @IsNotEmpty({
    message: '멤버 ID 값은 빈 값이 올 수 없습니다.',
  })
  memberId: number;
}
