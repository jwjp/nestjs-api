import {
  IsAlphanumeric,
  IsArray,
  IsEmail,
  IsJWT,
  IsNotEmpty,
  IsNumber,
  IsNumberString,
  IsOptional,
  IsString,
  IsStrongPassword,
  Length,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  IntersectionType,
  OmitType,
  PartialType,
  PickType,
} from '@nestjs/swagger';
import { Member } from '../entities/member.entity';
import { ResponseDto } from '../../common/auth/response.dto';
import { Authority } from '../entities/authority.entity';
import { Menu } from '../entities/menu.entity';
import { Branch } from '../entities/branch.entity';
import { Type } from 'class-transformer';

/**
 * Base DTO for the Member entity
 */
export class MemberDto {
  /**
   * ID used to log in
   * @example gildong
   */
  @IsAlphanumeric('en-US', {
    message: '아이디는 알파벳이나 숫자만 가능합니다.',
  })
  @IsNotEmpty({
    message: '아이디를 입력해주세요.',
  })
  @MaxLength(20, {
    message: '아이디는 최대 20자 까지 가능합니다.',
  })
  loginId: string;

  /**
   * Email address
   * @example example@example.com
   */
  @IsEmail(
    {},
    {
      message: '이메일 형식이 올바르지 않습니다.',
    },
  )
  @IsNotEmpty({
    message: '이메일을 입력해주세요.',
  })
  @MaxLength(50, {
    message: '이메일은 최대 50자 까지 가능합니다.',
  })
  email: string;

  /**
   * Member name
   * @example Hong Gildong
   */
  @IsString({
    message: '이름은 문자만 사용할 수 있습니다.',
  })
  @IsNotEmpty({
    message: '이름을 입력해주세요.',
  })
  @MaxLength(20, {
    message: '이름은 최대 20자 까지 가능합니다.',
  })
  username: string;

  /**
   * Password<br/>
   * Requires at least one number, one uppercase letter, one lowercase letter, and one special character
   *
   * @example P@ssw0rd
   */
  @IsStrongPassword(
    {
      minLength: 8,
      minNumbers: 1,
      minSymbols: 1,
      minLowercase: 1,
      minUppercase: 1,
    },
    {
      message: '숫자, 특수문자, 소문자, 대문자 각각 1개 이상 입력해주세요.',
    },
  )
  @IsNotEmpty({
    message: '패스워드는 빈 값이 올 수 없습니다.',
  })
  @Length(8, 100, {
    message: '패스워드는 최소 8자, 최대 100자 까지 가능합니다.',
  })
  password: string;
}

/**
 * Data required to sign up
 */
export class SignUpDto extends MemberDto {
  /**
   * Branch IDs
   * @example [1, 2, 3]
   */
  @IsArray({
    message: '지점 ID 값은 배열 형태이어야 합니다.',
  })
  @IsOptional()
  branchIds?: number[] = [];

  /**
   * Menu IDs
   * @example [1, 2, 3]
   */
  @IsArray({
    message: '메뉴 ID 값은 배열 형태이어야 합니다.',
  })
  @IsOptional()
  menuIds?: number[] = [];
}

/**
 * (Swagger) Sign-up response message
 */
class SignUpResponseMessage extends IntersectionType(
  OmitType(Member, ['password']),
  OmitType(SignUpDto, ['password']),
) {}

/**
 * (Swagger) Sign-up response message, including the interceptor response
 */
export class SignUpResponseDto extends PartialType(ResponseDto) {
  result: boolean;
  statusCode: number;
  request: string;
  timestamp: string;
  message: SignUpResponseMessage;
}

/**
 * DTO for sending the email verification token
 */
export class SendValidationDto extends PickType(MemberDto, [
  'email',
  'username',
]) {}

/**
 * DTO for the email send result
 */
export class EmailResultDto {
  /**
   * List of successfully sent emails
   * @example ['example01@example.com', 'example02@example.com']
   */
  @IsEmail({}, { each: true, message: '이메일 형식이 올바르지 않습니다.' })
  accepted: string[];

  /**
   * List of failed emails
   * @example ['example01@example.com', 'example02@example.com']
   */
  @IsEmail({}, { each: true, message: '이메일 형식이 올바르지 않습니다.' })
  rejected: string[];

  /**
   * Time taken to send the email
   */
  @IsNumber()
  messageTile: number;

  /**
   * Size of the sent email
   */
  @IsNumber()
  messageSize: number;

  /**
   * Result message
   */
  @IsString()
  response: string;
}

/**
 * (Swagger) Email verification token send result, including the interceptor response
 */
export class SendValidationResponseDto extends PartialType(ResponseDto) {
  result: boolean;
  statusCode: number;
  request: string;
  timestamp: string;
  message: EmailResultDto;
}

/**
 * Email verification DTO
 */
export class EmailValidateDto {
  @IsJWT({
    message: '이메일 검증 토큰이 jwt 형태가 아닙니다.',
  })
  token: string;
}

/**
 * (Swagger) Update result after email verification, including the interceptor response
 */
export class EmailValidateResponseDto extends PartialType(ResponseDto) {
  result: boolean;
  statusCode: number;
  request: string;
  timestamp: string;
  message: { affectedRows: number };
}

/**
 * Login DTO
 */
export class LoginDto extends PickType(MemberDto, ['loginId', 'password']) {}

/**
 * (Swagger) Login result, including the interceptor response
 */
export class LoginResponseDto extends PartialType(ResponseDto) {
  result: boolean;
  statusCode: number;
  request: string;
  timestamp: string;
  message: { accessToken: string; refreshToken: string };
}

/**
 * DTO for checking login ID duplicates (including deleted rows)
 */
export class ConfirmIdDto extends PickType(MemberDto, ['loginId']) {}

/**
 * (Swagger) Login ID duplicate check result (including deleted rows), including the interceptor response
 */
export class ConfirmIdResponseDto extends PartialType(ResponseDto) {
  result: boolean;
  statusCode: number;
  request: string;
  timestamp: string;
  message: { isDuplicated: boolean };
}

/**
 * DTO for checking email duplicates (including deleted rows)
 */
export class ConfirmEmailDto extends PickType(MemberDto, ['email']) {}

/**
 * (Swagger) Email duplicate check result (including deleted rows), including the interceptor response
 */
export class ConfirmEmailResponseDto extends PartialType(ResponseDto) {
  result: boolean;
  statusCode: number;
  request: string;
  timestamp: string;
  message: { isDuplicated: boolean };
}

/**
 * (Swagger) Member count result, including the interceptor response
 */
export class MemberCountResponseDto extends PartialType(ResponseDto) {
  result: boolean;
  statusCode: number;
  request: string;
  timestamp: string;
  message: { count: number };
}

/**
 * (Swagger) Member list result, including the interceptor response
 */
export class MemberListResponseDto extends PartialType(ResponseDto) {
  result: boolean;
  statusCode: number;
  request: string;
  timestamp: string;
  message: Member[];
}

/**
 * Menu authority within the member info
 */
class AuthorityMenuResponse extends PickType(Menu, [
  'id',
  'title',
  'link',
  'seq',
]) {}

/**
 * Branch authority within the member info
 */
class AuthorityBranchResponse extends PickType(Branch, [
  'id',
  'name',
  'title',
  'url',
  'seq',
]) {}

/**
 * Authority details within the member info
 */
class AuthorityResponseMessage extends PickType(Authority, ['id']) {
  id: number;
  menu: AuthorityMenuResponse;
  branch: AuthorityBranchResponse;
}

/**
 * Member and authority info
 */
class MemberResponseMessage extends OmitType(Member, ['authority']) {
  id: number;
  loginId: string;
  username: string;
  password: string;
  role: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null = null;
  authority: AuthorityResponseMessage[];
}

/**
 * (Swagger) Member info result, including the interceptor response
 */
export class MemberResponseDto extends PartialType(ResponseDto) {
  result: boolean;
  statusCode: number;
  request: string;
  timestamp: string;
  message: MemberResponseMessage;
}

/**
 * DTO for updating a member
 */
export class UpdateMemberDto extends PartialType(
  OmitType(SignUpDto, ['loginId']),
) {}

/**
 * (Swagger) Member update result, including the interceptor response
 */
export class UpdateMemberResponseDto extends PartialType(ResponseDto) {
  result: boolean;
  statusCode: number;
  request: string;
  timestamp: string;
  message: { affectedRows: number };
}

/**
 * DTO for looking up a member by ID
 */
export class MemberIdDto {
  /**
   * Member ID
   * @example 1
   */
  @IsNumberString(
    { no_symbols: true },
    {
      message: '멤버 ID 값은 숫자 형태의 문자만 가능합니다.',
    },
  )
  @IsNotEmpty({
    message: '멤버 ID 값은 빈 값이 올 수 없습니다.',
  })
  id: number;
}

/**
 * DTO for paginating the member list
 */
export class MemberListPageDto {
  /**
   * Page number (minimum 1)
   * @example 1
   */
  @IsOptional()
  @IsNumber(
    {
      allowNaN: false,
      allowInfinity: false,
    },
    {
      message: '페이지 번호는 숫자 형태만 올 수 있습니다.',
    },
  )
  @Type(() => Number)
  @Min(1, {
    message: '최소 1 이상으로 입력해야 합니다.',
  })
  page?: number = 1;

  /**
   * Items per page (minimum 1, maximum 100)
   * @example 10
   */
  @IsOptional()
  @IsNumber(
    {
      allowNaN: false,
      allowInfinity: false,
    },
    {
      message: '페이지 당 표시 할 개수는 숫자 형태만 올 수 있습니다.',
    },
  )
  @Type(() => Number)
  @Min(1, {
    message: '최소 1 까지 입력 가능합니다.',
  })
  @Max(100, {
    message: '최대 100 까지 입력 가능합니다.',
  })
  perPage?: number = 10;
}

/**
 * DTO for requesting an access token refresh
 */
export class MemberRefreshDto {
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
  id: number;

  /**
   * Refresh token issued at login
   */
  @IsJWT({
    message: '리프레시 토큰이 jwt 형태가 아닙니다.',
  })
  refreshToken: string;
}

/**
 * (Swagger) Access token refresh result, including the interceptor response
 */
export class MemberRefreshResponseDto extends PartialType(ResponseDto) {
  result: boolean;
  statusCode: number;
  request: string;
  timestamp: string;
  message: { accessToken: string };
}
