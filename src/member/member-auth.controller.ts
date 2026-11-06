import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import {
  AuthenticatedMember,
  CurrentMember,
  Public,
  Roles,
} from '../common/auth/auth.decorator';
import {
  ChangePasswordDto,
  EmailResultDto,
  ForgotPasswordDto,
  LoginDto,
  LoginResponseDto,
  MemberRefreshDto,
  MemberRefreshResponseDto,
  MemberResponseDto,
  ResetPasswordDto,
  UpdateMemberResponseDto,
  UpdateMyProfileDto,
} from './dto/member.dto';
import { MemberAuthService } from './member-auth.service';
import { MemberService } from './member.service';

// Credential endpoints get a stricter limit than the global one
const AUTH_THROTTLE = {
  default: {
    limit: () => Number(process.env.AUTH_THROTTLE_LIMIT) || 10,
    ttl: 60000,
  },
};

/**
 * Registered before MemberController, so /members/me is not read as /members/:id
 */
@ApiTags('Members')
@Controller('members')
export class MemberAuthController {
  constructor(
    private readonly memberAuthService: MemberAuthService,
    private readonly memberService: MemberService,
  ) {}

  /**
   * Log in
   *
   * @param {LoginDto} loginDto - Data required to log in
   * @return {Promise<LoginResponseDto>} - Issues tokens
   */
  @ApiOperation({ security: [], summary: 'Log in' })
  @Public()
  @Throttle(AUTH_THROTTLE)
  @Post('login')
  login(@Body() loginDto: LoginDto): Promise<LoginResponseDto> {
    return this.memberAuthService.login(loginDto);
  }

  /**
   * Exchange a refresh token for a new pair of tokens<br/>
   * Store the returned refresh token, because the used one stops working
   *
   * @param {MemberRefreshDto} memberRefreshDto
   * @return {Promise<MemberRefreshResponseDto>}
   */
  @ApiOperation({ security: [], summary: 'Refresh tokens' })
  @Public()
  @Throttle(AUTH_THROTTLE)
  @Post('refresh')
  refresh(
    @Body() memberRefreshDto: MemberRefreshDto,
  ): Promise<MemberRefreshResponseDto> {
    return this.memberAuthService.refresh(memberRefreshDto);
  }

  /**
   * Log out of every session
   */
  @ApiOperation({ summary: 'Log out' })
  @Roles('admin', 'user')
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  logout(
    @CurrentMember() member: AuthenticatedMember,
  ): Promise<UpdateMemberResponseDto> {
    return this.memberAuthService.logout(member.id);
  }

  /**
   * Request a password reset email<br/>
   * Answers the same whether or not the address is registered
   */
  @ApiOperation({ security: [], summary: 'Request a password reset email' })
  @Public()
  @Throttle(AUTH_THROTTLE)
  @Post('password/forgot')
  @HttpCode(HttpStatus.OK)
  forgotPassword(
    @Body() forgotPasswordDto: ForgotPasswordDto,
  ): Promise<{ accepted: boolean }> {
    return this.memberAuthService.forgotPassword(forgotPasswordDto);
  }

  /**
   * Set a new password with a token from the reset email
   */
  @ApiOperation({ security: [], summary: 'Reset a password' })
  @Public()
  @Throttle(AUTH_THROTTLE)
  @Post('password/reset')
  @HttpCode(HttpStatus.OK)
  resetPassword(
    @Body() resetPasswordDto: ResetPasswordDto,
  ): Promise<UpdateMemberResponseDto> {
    return this.memberAuthService.resetPassword(resetPasswordDto);
  }

  /**
   * Your own profile, with menu and branch authority
   */
  @ApiOperation({ summary: 'My profile' })
  @Roles('admin', 'user')
  @Get('me')
  getMe(
    @CurrentMember() member: AuthenticatedMember,
  ): Promise<MemberResponseDto> {
    return this.memberService.getMemberById({ id: member.id });
  }

  /**
   * Update your own username or email
   */
  @ApiOperation({ summary: 'Update my profile' })
  @Roles('admin', 'user')
  @Patch('me')
  updateMe(
    @CurrentMember() member: AuthenticatedMember,
    @Body() updateMyProfileDto: UpdateMyProfileDto,
  ): Promise<UpdateMemberResponseDto> {
    return this.memberAuthService.updateProfile(member.id, updateMyProfileDto);
  }

  /**
   * Change your own password and end every session
   */
  @ApiOperation({ summary: 'Change my password' })
  @Roles('admin', 'user')
  @Patch('me/password')
  changePassword(
    @CurrentMember() member: AuthenticatedMember,
    @Body() changePasswordDto: ChangePasswordDto,
  ): Promise<UpdateMemberResponseDto> {
    return this.memberAuthService.changePassword(member.id, changePasswordDto);
  }

  /**
   * Send a verification email for your own address
   */
  @ApiOperation({ summary: 'Verify my email' })
  @Roles('admin', 'user')
  @Throttle(AUTH_THROTTLE)
  @Post('me/validation')
  @HttpCode(HttpStatus.OK)
  sendOwnValidation(
    @CurrentMember() member: AuthenticatedMember,
  ): Promise<EmailResultDto> {
    return this.memberAuthService.sendOwnValidation(member.id);
  }
}
