import {
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsNumberString,
  IsString,
  MaxLength,
} from 'class-validator';
import { PartialType, PickType } from '@nestjs/swagger';
import { Menu } from '../entities/menu.entity';
import { ResponseDto } from '../../common/auth/response.dto';

/**
 * Base DTO for the Menu entity
 */
export class MenuDto {
  /**
   * Menu name
   * @example Branch Management
   */
  @IsString({
    message: '메뉴명은 문자만 사용할 수 있습니다.',
  })
  @IsNotEmpty({
    message: '메뉴명은 빈 값이 올 수 없습니다.',
  })
  @MaxLength(20, {
    message: '메뉴명은 최대 20자 까지 가능합니다.',
  })
  title: string;

  /**
   * Link address
   * @example /branch
   */
  @IsString({
    message: '링크 주소는 문자만 사용할 수 있습니다.',
  })
  @IsNotEmpty({
    message: '링크 주소는 빈 값이 올 수 없습니다.',
  })
  @MaxLength(20, {
    message: '링크 주소는 최대 20자 까지 가능합니다.',
  })
  link: string;

  /**
   * Menu order
   * @example 1
   */
  @IsInt({
    message: '메뉴 순서는 숫자값만 올 수 있습니다.',
  })
  seq: number;
}

/**
 * DTO for creating a menu
 */
export class CreateMenuDto extends MenuDto {}

/**
 * (Swagger) Menu creation result, including the interceptor response
 */
export class CreateMenuResponseDto extends PartialType(ResponseDto) {
  result: boolean;
  statusCode: number;
  request: string;
  timestamp: string;
  message: Menu;
}

/**
 * (Swagger) Menu lookup result, including the interceptor response
 */
export class GetMenuResponseDto extends PartialType(ResponseDto) {
  result: boolean;
  statusCode: number;
  request: string;
  timestamp: string;
  message: Menu[];
}

/**
 * DTO for updating a menu
 */
export class UpdateMenuDto extends PartialType(MenuDto) {}

/**
 * (Swagger) Menu update result, including the interceptor response
 */
export class UpdateMenuResponseDto extends PartialType(ResponseDto) {
  result: boolean;
  statusCode: number;
  request: string;
  timestamp: string;
  message: { affectedRows: number };
}

/**
 * DTO for a member's menu authority request
 */
export class MenuListByAuthorityDto {
  /**
   * Member ID
   * @example 1
   */
  @IsNumber(
    {
      allowNaN: false,
      allowInfinity: false,
    },
    {
      message: '멤버 ID 값은 숫자 형태만 올 수 있습니다.',
    },
  )
  @IsNotEmpty({
    message: '멤버 ID 값은 빈 값이 올 수 없습니다.',
  })
  memberId: number;

  /**
   * Branch ID
   * @example 1
   */
  @IsNumber(
    {
      allowNaN: false,
      allowInfinity: false,
    },
    {
      message: '지점 ID 값은 숫자 형태만 올 수 있습니다.',
    },
  )
  @IsNotEmpty({
    message: '지점 ID 값은 빈 값이 올 수 없습니다.',
  })
  branchId: number;
}

/**
 * Fields needed from the menu authority
 */
class MenuListResponse extends PickType(Menu, ['id', 'title', 'link', 'seq']) {}

/**
 * (Swagger) Member menu authority request result, including the interceptor response
 */
export class MenuListResponseDto extends PartialType(ResponseDto) {
  result: boolean;
  statusCode: number;
  request: string;
  timestamp: string;
  message: MenuListResponse[];
}

/**
 * DTO for looking up a menu by ID
 */
export class MenuIdDto {
  /**
   * Menu ID
   * @example 1
   */
  @IsNumberString(
    { no_symbols: true },
    {
      message: '메뉴 ID 값은 숫자 형태의 문자만 가능합니다.',
    },
  )
  @IsNotEmpty({
    message: '메뉴 ID 값은 빈 값이 올 수 없습니다.',
  })
  id: number;
}
