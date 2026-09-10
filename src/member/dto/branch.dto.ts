import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsNumberString,
  IsString,
  IsUrl,
  Length,
  MaxLength,
} from 'class-validator';
import { PartialType, PickType } from '@nestjs/swagger';
import { Branch } from '../entities/branch.entity';
import { ResponseDto } from '../../common/auth/response.dto';

/**
 * Base DTO for the Branch entity
 */
export class BranchDto {
  /**
   * Branch name
   * @example 'Suwon Branch'
   */
  @IsString({
    message: '지점명은 문자만 사용할 수 있습니다.',
  })
  @IsNotEmpty({
    message: '지점명은 빈 값이 올 수 없습니다.',
  })
  @Length(5, 20, {
    message: '지점명은 최소 5자, 최대 20자 까지 가능합니다.',
  })
  name: string;

  /**
   * Main display name
   * @example 'Seoul Gangnam Branch'
   */
  @IsString({
    message: '메인 표시명은 문자만 사용할 수 있습니다.',
  })
  @IsNotEmpty({
    message: '메인 표시명은 빈 값이 올 수 없습니다.',
  })
  @Length(5, 20, {
    message: '메인 표시명은 최소 5자, 최대 20자 까지 가능합니다.',
  })
  title: string;

  /**
   * Homepage URL
   * @example https://docs.nestjs.com
   */
  @IsString({
    message: 'URL은 문자만 사용할 수 있습니다.',
  })
  @IsUrl(
    {
      require_protocol: true,
      protocols: ['http', 'https'],
      require_tld: true,
    },
    {
      message: 'URL은 https 를 포함한 전체 경로를 입력해주세요.',
    },
  )
  @IsNotEmpty({
    message: 'URL은 빈 값이 올 수 없습니다.',
  })
  @MaxLength(100, {
    message: 'URL은 최대 100자 까지 가능합니다.',
  })
  url: string;

  /**
   * Branch display order
   * @example 1
   */
  @IsInt({
    message: '지점 순서는 숫자만 가능합니다.',
  })
  seq: number;

  /**
   * Whether it is shown
   * @example true | false
   */
  @IsBoolean({
    message: '노출 여부는 논리 자료형(Boolean)만 가능합니다.',
  })
  isShow: boolean = false;
}

/**
 * DTO for creating a branch
 */
export class CreateBranchDto extends BranchDto {}

/**
 * (Swagger) Branch creation result, including the interceptor response
 */
export class CreateBranchResponseDto extends PartialType(ResponseDto) {
  result: boolean;
  statusCode: number;
  request: string;
  timestamp: string;
  message: Branch;
}

/**
 * (Swagger) Branch search result, including the interceptor response
 */
export class GetBranchResponseDto extends PartialType(ResponseDto) {
  result: boolean;
  statusCode: number;
  request: string;
  timestamp: string;
  message: Branch[];
}

/**
 * Branch update
 */
export class UpdateBranchDto extends PartialType(BranchDto) {}

/**
 * (Swagger) Branch update result, including the interceptor response
 */
export class UpdateBranchResponseDto extends PartialType(ResponseDto) {
  result: boolean;
  statusCode: number;
  request: string;
  timestamp: string;
  message: { affectedRows: number };
}

/**
 * DTO for a member's branch authority request
 */
export class BranchListByAuthorityDto {
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
}

/**
 * Fields needed from the branch authority
 */
class BranchListResponse extends PickType(Branch, [
  'id',
  'name',
  'title',
  'url',
  'seq',
  'isShow',
]) {}

/**
 * (Swagger) Member branch authority request result, including the interceptor response
 */
export class BranchListResponseDto extends PartialType(ResponseDto) {
  result: boolean;
  statusCode: number;
  request: string;
  timestamp: string;
  message: BranchListResponse[];
}

/**
 * DTO for looking up a branch by ID
 */
export class BranchIdDto {
  /**
   * Branch ID
   * @example 1
   */
  @IsNumberString(
    { no_symbols: true },
    {
      message: '지점 ID 값은 숫자 형태의 문자만 가능합니다.',
    },
  )
  @IsNotEmpty({
    message: '지점 ID 값은 빈 값이 올 수 없습니다.',
  })
  id: number;
}
