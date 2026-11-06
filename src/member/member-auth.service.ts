import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  LoggerService,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { Repository } from 'typeorm';
import { EmailService } from '../common/chat/email.service';
import { RolesEnum } from '../common/auth/roles.enum';
import {
  ChangePasswordDto,
  EmailResultDto,
  ForgotPasswordDto,
  LoginDto,
  LoginResponseDto,
  MemberRefreshDto,
  MemberRefreshResponseDto,
  ResetPasswordDto,
  UpdateMemberResponseDto,
  UpdateMyProfileDto,
} from './dto/member.dto';
import { changesEmail } from './email-validation';
import { Member } from './entities/member.entity';
import {
  buildPasswordResetEmail,
  hashRefreshToken,
  passwordFingerprint,
  revokedSessions,
} from './member-credentials';
import { MemberService } from './member.service';

// Compared when the login ID is unknown so both failures take the same time
const UNKNOWN_MEMBER_PASSWORD_HASH = bcrypt.hashSync(randomUUID(), 10);

type TokenSubject = Pick<Member, 'id' | 'username' | 'role' | 'tokenVersion'>;

@Injectable()
export class MemberAuthService {
  constructor(
    @InjectRepository(Member)
    private readonly memberRepository: Repository<Member>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly emailService: EmailService,
    private readonly memberService: MemberService,
    @Inject(Logger) private readonly logger: LoggerService,
  ) {}

  /**
   * Log in
   *
   * @param {LoginDto} loginDto - Data required to log in
   * @return {Promise<LoginResponseDto>} - Issues tokens
   */
  async login(loginDto: LoginDto): Promise<LoginResponseDto> {
    const member: Member = await this.memberRepository.findOne({
      select: {
        id: true,
        username: true,
        role: true,
        password: true,
        tokenVersion: true,
      },
      where: { loginId: loginDto.loginId },
      withDeleted: false,
    });

    const passwordCompare: boolean = await bcrypt.compare(
      loginDto.password,
      member?.password ?? UNKNOWN_MEMBER_PASSWORD_HASH,
    );

    // The same response for an unknown ID and a wrong password
    if (!member || !passwordCompare) {
      throw new UnauthorizedException({
        message: '아이디 또는 패스워드가 일치하지 않습니다.',
      });
    }

    this.assertNotDenied(member);

    const refreshToken = await this.signRefreshToken();
    await this.memberRepository.update(
      { id: member.id },
      { refreshToken: hashRefreshToken(refreshToken) },
    );

    const loginResponseDto: LoginResponseDto = new LoginResponseDto();
    loginResponseDto.message = {
      accessToken: await this.signAccessToken(member),
      refreshToken,
    };

    return loginResponseDto;
  }

  /**
   * Exchange a refresh token for a new pair of tokens<br/>
   * The refresh token can only be used once
   *
   * @param {MemberRefreshDto} memberRefreshDto
   * @return {Promise<MemberRefreshResponseDto>}
   */
  async refresh(
    memberRefreshDto: MemberRefreshDto,
  ): Promise<MemberRefreshResponseDto> {
    await this.jwtService.verifyAsync(memberRefreshDto.refreshToken, {
      secret: this.configService.get<string>('JWT_REFRESH_SECRET_KEY'),
    });

    const currentHash = hashRefreshToken(memberRefreshDto.refreshToken);
    const member: Member = await this.memberRepository.findOne({
      select: {
        id: true,
        username: true,
        role: true,
        refreshToken: true,
        tokenVersion: true,
      },
      where: { id: memberRefreshDto.id },
    });

    if (!member?.refreshToken || member.refreshToken !== currentHash) {
      throw new UnauthorizedException({
        message: '리프레시 토큰이 일치하지 않습니다. 다시 로그인해주세요.',
      });
    }

    this.assertNotDenied(member);

    const refreshToken = await this.signRefreshToken();

    // Conditional on the old value, so two concurrent requests cannot both win
    const { affected } = await this.memberRepository.update(
      { id: member.id, refreshToken: currentHash },
      { refreshToken: hashRefreshToken(refreshToken) },
    );

    if (affected !== 1) {
      throw new UnauthorizedException({
        message: '리프레시 토큰이 일치하지 않습니다. 다시 로그인해주세요.',
      });
    }

    const memberRefreshResponseDto: MemberRefreshResponseDto =
      new MemberRefreshResponseDto();
    memberRefreshResponseDto.message = {
      accessToken: await this.signAccessToken(member),
      refreshToken,
    };

    return memberRefreshResponseDto;
  }

  /**
   * End every session of the member
   *
   * @param {number} memberId
   * @return {Promise<UpdateMemberResponseDto>}
   */
  async logout(memberId: number): Promise<UpdateMemberResponseDto> {
    const { affected } = await this.memberRepository.update(
      { id: memberId },
      revokedSessions(),
    );

    const updateMemberResponseDto: UpdateMemberResponseDto =
      new UpdateMemberResponseDto();
    updateMemberResponseDto.message = { affectedRows: affected };

    return updateMemberResponseDto;
  }

  /**
   * Update your own username or email<br/>
   * A new email has to be verified again
   *
   * @param {number} memberId
   * @param {UpdateMyProfileDto} updateMyProfileDto
   * @return {Promise<UpdateMemberResponseDto>}
   */
  async updateProfile(
    memberId: number,
    updateMyProfileDto: UpdateMyProfileDto,
  ): Promise<UpdateMemberResponseDto> {
    if (Object.keys(updateMyProfileDto).length === 0) {
      throw new BadRequestException({
        message: '요청 데이터가 없습니다.',
      });
    }

    const member: Member = await this.memberRepository.findOne({
      select: { id: true, email: true },
      where: { id: memberId },
    });

    const { affected } = await this.memberRepository.update(
      { id: memberId },
      {
        ...updateMyProfileDto,
        ...(changesEmail(member.email, updateMyProfileDto.email)
          ? { emailValidateAt: null }
          : {}),
      },
    );

    const updateMemberResponseDto: UpdateMemberResponseDto =
      new UpdateMemberResponseDto();
    updateMemberResponseDto.message = { affectedRows: affected };

    return updateMemberResponseDto;
  }

  /**
   * Change your own password and end every session
   *
   * @param {number} memberId
   * @param {ChangePasswordDto} changePasswordDto
   * @return {Promise<UpdateMemberResponseDto>}
   */
  async changePassword(
    memberId: number,
    changePasswordDto: ChangePasswordDto,
  ): Promise<UpdateMemberResponseDto> {
    const member: Member = await this.memberRepository.findOne({
      select: { id: true, password: true },
      where: { id: memberId },
    });

    const matches = await bcrypt.compare(
      changePasswordDto.currentPassword,
      member.password,
    );

    if (!matches) {
      throw new BadRequestException({
        message: '현재 패스워드가 일치하지 않습니다.',
      });
    }

    return this.setPassword(memberId, changePasswordDto.password);
  }

  /**
   * Send a verification email for your own address
   *
   * @param {number} memberId
   * @return {Promise<EmailResultDto>}
   */
  async sendOwnValidation(memberId: number): Promise<EmailResultDto> {
    const member: Member = await this.memberRepository.findOne({
      select: { id: true, email: true, username: true, emailValidateAt: true },
      where: { id: memberId },
    });

    if (member.emailValidateAt) {
      throw new BadRequestException({
        message: '이미 인증된 이메일입니다.',
      });
    }

    return this.memberService.sendValidationEmail(member);
  }

  /**
   * Email a password reset link<br/>
   * The response and its timing do not reveal whether the address is registered
   *
   * @param {ForgotPasswordDto} forgotPasswordDto
   * @return {Promise<object>}
   */
  async forgotPassword(
    forgotPasswordDto: ForgotPasswordDto,
  ): Promise<{ accepted: boolean }> {
    const member: Member = await this.memberRepository.findOne({
      select: {
        id: true,
        email: true,
        username: true,
        role: true,
        password: true,
      },
      where: { email: forgotPasswordDto.email },
    });

    if (member && member.role !== RolesEnum.deny) {
      void this.sendResetEmail(member).catch((err) =>
        this.logger.error('Password reset email failed', err?.stack),
      );
    }

    return { accepted: true };
  }

  /**
   * Set a new password with a token from the reset email
   *
   * @param {ResetPasswordDto} resetPasswordDto
   * @return {Promise<UpdateMemberResponseDto>}
   */
  async resetPassword(
    resetPasswordDto: ResetPasswordDto,
  ): Promise<UpdateMemberResponseDto> {
    const payload = await this.jwtService.verifyAsync(resetPasswordDto.token, {
      secret: this.configService.get<string>('JWT_PASSWORD_RESET_SECRET_KEY'),
    });

    const member: Member = await this.memberRepository.findOne({
      select: { id: true, role: true, password: true },
      where: { id: payload.id },
    });

    if (
      !member ||
      member.role === RolesEnum.deny ||
      passwordFingerprint(member.password) !== payload.fp
    ) {
      throw new UnauthorizedException({
        message: '유효하지 않은 패스워드 재설정 요청입니다.',
      });
    }

    return this.setPassword(member.id, resetPasswordDto.password);
  }

  private async sendResetEmail(member: Member): Promise<void> {
    const resetUrl = this.configService.get<string>('PASSWORD_RESET_URL');

    if (!resetUrl) {
      this.logger.warn('PASSWORD_RESET_URL is not set; no reset email sent');
      return;
    }

    const token = await this.jwtService.signAsync(
      { id: member.id, fp: passwordFingerprint(member.password) },
      {
        secret: this.configService.get('JWT_PASSWORD_RESET_SECRET_KEY'),
        expiresIn: this.configService.get('JWT_PASSWORD_RESET_EXPIRES_TIME'),
      },
    );

    const appName = this.configService.get<string>('APP_NAME');

    await this.emailService.sendEmail(
      member.email,
      `[${appName}] Reset your password`,
      buildPasswordResetEmail(appName, member.username, resetUrl, token),
    );
  }

  private async setPassword(
    memberId: number,
    password: string,
  ): Promise<UpdateMemberResponseDto> {
    const { affected } = await this.memberRepository.update(
      { id: memberId },
      { password: await bcrypt.hash(password, 10), ...revokedSessions() },
    );

    const updateMemberResponseDto: UpdateMemberResponseDto =
      new UpdateMemberResponseDto();
    updateMemberResponseDto.message = { affectedRows: affected };

    return updateMemberResponseDto;
  }

  private assertNotDenied(member: Pick<Member, 'role'>): void {
    if (member.role === RolesEnum.deny) {
      throw new ForbiddenException({
        message: '이용이 제한된 계정입니다.',
      });
    }
  }

  private signAccessToken(member: TokenSubject): Promise<string> {
    return this.jwtService.signAsync(
      {
        id: member.id,
        username: member.username,
        role: member.role,
        ver: member.tokenVersion,
      },
      {
        secret: this.configService.get('JWT_ACCESS_SECRET_KEY'),
        expiresIn: this.configService.get('JWT_ACCESS_EXPIRES_TIME'),
      },
    );
  }

  private signRefreshToken(): Promise<string> {
    return this.jwtService.signAsync(
      { jti: randomUUID() },
      {
        secret: this.configService.get('JWT_REFRESH_SECRET_KEY'),
        expiresIn: this.configService.get('JWT_REFRESH_EXPIRES_TIME'),
      },
    );
  }
}
