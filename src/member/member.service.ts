import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  LoggerService,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Member } from './entities/member.entity';
import {
  DataSource,
  In,
  IsNull,
  Not,
  QueryFailedError,
  QueryRunner,
  Repository,
  UpdateResult,
} from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import {
  ConfirmEmailDto,
  ConfirmEmailResponseDto,
  ConfirmIdDto,
  ConfirmIdResponseDto,
  EmailResultDto,
  EmailValidateDto,
  EmailValidateResponseDto,
  MemberCountResponseDto,
  MemberIdDto,
  MemberListPageDto,
  MemberListResponseDto,
  MemberResponseDto,
  SendValidationDto,
  SendValidationResponseDto,
  SignUpDto,
  SignUpResponseDto,
  UpdateMemberDto,
  UpdateMemberResponseDto,
  UpdateMemberRoleDto,
} from './dto/member.dto';
import { Authority } from './entities/authority.entity';
import { validate } from 'class-validator';
import { AuthorityDto } from './dto/authority.dto';
import { plainToInstance } from 'class-transformer';
import { Menu } from './entities/menu.entity';
import { Branch } from './entities/branch.entity';
import { SlackService } from '../common/chat/slack.service';
import { EmailService } from '../common/chat/email.service';
import { ConfigService } from '@nestjs/config';
import { RolesEnum } from '../common/auth/roles.enum';
import { canCompleteEmailValidation, changesEmail } from './email-validation';
import {
  buildValidationEmail,
  escapeHtml,
  revokedSessions,
} from './member-credentials';
import { roleChangeRejection } from './member-role';

@Injectable()
export class MemberService {
  constructor(
    @InjectRepository(Member)
    private memberRepository: Repository<Member>,
    private jwtService: JwtService,
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
    private readonly emailService: EmailService,
    private readonly slackService: SlackService,
    @Inject(Logger) private readonly logger: LoggerService,
  ) {}

  /**
   * Sign up
   *
   * @param {SignUpDto} signUpDto - Data required to sign up
   * @return {Promise<SignUpResponseDto>}
   */
  async signUp(signUpDto: SignUpDto): Promise<SignUpResponseDto> {
    signUpDto.password = await bcrypt.hash(signUpDto.password, 10);

    // Access to branches and menus is assigned later by an administrator
    const createdMember: SignUpDto & Member =
      await this.memberRepository.save(signUpDto);

    // Remove the field we don't want to keep around
    delete createdMember.password;

    // Build the DTO used for the Swagger docs
    const signUpResponseDto: SignUpResponseDto = new SignUpResponseDto();
    signUpResponseDto.message = createdMember;

    return signUpResponseDto;
  }

  /**
   * Send the email verification token
   *
   * @param {SendValidationDto} sendValidationDto
   * @return {Promise<SendValidationResponseDto>}
   */
  async sendValidation(
    sendValidationDto: SendValidationDto,
  ): Promise<SendValidationResponseDto> {
    // Look up the member
    const member: Member = await this.memberRepository.findOne({
      select: { id: true, email: true, username: true },
      where: {
        email: sendValidationDto.email,
        username: sendValidationDto.username,
      },
    });

    // If the member does not exist
    if (!member) {
      throw new BadRequestException({
        message: '멤버가 삭제되었거나 존재하지 않습니다.',
      });
    }

    // Build the DTO used for the Swagger docs
    const sendValidationResponseDto: SendValidationResponseDto =
      new SendValidationResponseDto();
    sendValidationResponseDto.message = await this.sendValidationEmail(member);

    return sendValidationResponseDto;
  }

  /**
   * Issue a verification token and email it to the member
   *
   * @param {Pick<Member, 'id' | 'email' | 'username'>} member
   * @return {Promise<EmailResultDto>}
   */
  async sendValidationEmail(
    member: Pick<Member, 'id' | 'email' | 'username'>,
  ): Promise<EmailResultDto> {
    const publicBaseUrl = this.configService.get<string>('PUBLIC_BASE_URL');
    if (!publicBaseUrl) {
      throw new ServiceUnavailableException({
        message:
          'PUBLIC_BASE_URL이 설정되지 않아 인증 메일을 보낼 수 없습니다.',
        public: true,
      });
    }

    const validationToken = await this.jwtService.signAsync(
      { id: member.id, email: member.email },
      {
        secret: this.configService.get('JWT_EMAIL_VALIDATION_SECRET_KEY'),
        expiresIn: this.configService.get('JWT_EMAIL_VALIDATION_EXPIRES_TIME'),
      },
    );

    const appName = this.configService.get<string>('APP_NAME');

    return this.emailService.sendEmail(
      member.email,
      `[${appName}] Confirm your email address`,
      buildValidationEmail(
        appName,
        member.username,
        publicBaseUrl,
        validationToken,
      ),
    );
  }

  /**
   * Verify the email
   *
   * @param {EmailValidateDto} emailValidateDto
   * @return {Promise<EmailValidateResponseDto>}
   */
  async emailValidate(
    emailValidateDto: EmailValidateDto,
  ): Promise<EmailValidateResponseDto> {
    // Token payload
    const validationTokenPayload = await this.jwtService.verifyAsync(
      emailValidateDto.token,
      {
        secret: this.configService.get<string>(
          'JWT_EMAIL_VALIDATION_SECRET_KEY',
        ),
      },
    );

    // If the token has expired
    if (validationTokenPayload.exp < Date.now() / 1000) {
      throw new UnauthorizedException({
        message: '토큰이 만료되었습니다. 다시 시도해주세요.',
      });
    }

    // Complete the email verification
    const member: Member = await this.memberRepository.findOne({
      select: { id: true, email: true, role: true, emailValidateAt: true },
      where: { id: validationTokenPayload.id },
    });

    if (!canCompleteEmailValidation(member, validationTokenPayload.email)) {
      throw new UnauthorizedException({
        message: '유효하지 않은 이메일 인증 요청입니다.',
      });
    }

    const updateResult: UpdateResult = await this.memberRepository.update(
      {
        id: member.id,
        email: member.email,
        role: Not(RolesEnum.deny),
        emailValidateAt: IsNull(),
      },
      { emailValidateAt: new Date() },
    );

    // Build the DTO used for the Swagger docs
    const emailValidateResponseDto: EmailValidateResponseDto =
      new EmailValidateResponseDto();
    emailValidateResponseDto.message = { affectedRows: updateResult.affected };

    return emailValidateResponseDto;
  }

  /**
   * Check login ID duplicates (including deleted rows)
   *
   * @param {ConfirmIdDto} confirmId - Data required for the duplicate check
   * @return {Promise<ConfirmIdResponseDto>} - Whether it is duplicated
   */
  async idDuplicatedId(confirmId: ConfirmIdDto): Promise<ConfirmIdResponseDto> {
    // Look up the login ID, including deleted rows
    const idCount: number = await this.memberRepository.count({
      where: {
        loginId: confirmId.loginId,
      },
      withDeleted: true,
    });

    // Build the DTO used for the Swagger docs
    const confirmIdResponseDto: ConfirmIdResponseDto =
      new ConfirmIdResponseDto();
    confirmIdResponseDto.message = { isDuplicated: !!idCount };

    return confirmIdResponseDto;
  }

  /**
   * Check email duplicates (including deleted rows)
   *
   * @param {ConfirmEmailDto} confirmEmail - Data required for the duplicate check
   * @return {Promise<ConfirmEmailResponseDto>} - Whether it is duplicated
   */
  async idDuplicatedEmail(
    confirmEmail: ConfirmEmailDto,
  ): Promise<ConfirmEmailResponseDto> {
    // Look up the email, including deleted rows
    const emailCount: number = await this.memberRepository.count({
      where: {
        email: confirmEmail.email,
      },
      withDeleted: true,
    });

    // Build the DTO used for the Swagger docs
    const confirmEmailResponseDto: ConfirmEmailResponseDto =
      new ConfirmEmailResponseDto();
    confirmEmailResponseDto.message = { isDuplicated: !!emailCount };

    return confirmEmailResponseDto;
  }

  /**
   * Member info
   * Also includes menu and branch authority info
   *
   * @param {MemberIdDto} memberIdDto - Member ID key
   * @return {Promise<MemberResponseDto>}
   */
  async getMemberById(memberIdDto: MemberIdDto): Promise<MemberResponseDto> {
    // Look up the member
    const member = await this.memberRepository.findOne({
      select: {
        authority: {
          id: true,
          menu: {
            id: true,
            title: true,
            link: true,
            seq: true,
          },
          branch: {
            id: true,
            name: true,
            title: true,
            url: true,
            seq: true,
          },
        },
      },
      where: { id: memberIdDto.id },
      // Menu and branch authority info
      relations: { authority: { menu: true, branch: true } },
      withDeleted: true,
    });

    // Throw an error if the member does not exist
    if (member === null) {
      throw new BadRequestException({
        message: '멤버가 존재하지 않습니다.',
      });
    }

    // Build the DTO used for the Swagger docs
    const memberResponseDto: MemberResponseDto = new MemberResponseDto();
    memberResponseDto.message = member;

    return memberResponseDto;
  }

  /**
   * Count of members not deleted
   *
   * @return {Promise<MemberCountResponseDto>}
   */
  async getMemberCount(): Promise<MemberCountResponseDto> {
    // Count of members not deleted
    const memberCount: number = await this.memberRepository.count();

    // Build the DTO used for the Swagger docs
    const memberCountResponseDto: MemberCountResponseDto =
      new MemberCountResponseDto();
    memberCountResponseDto.message = { count: memberCount };

    // Count of members not deleted
    return memberCountResponseDto;
  }

  /**
   * Count of deleted members
   *
   * @return {Promise<MemberCountResponseDto>}
   */
  async getDeletedMemberCount(): Promise<MemberCountResponseDto> {
    // Count of deleted members
    const memberCount = await this.memberRepository.count({
      where: {
        deletedAt: Not(IsNull()),
      },
      withDeleted: true,
    });

    // Build the DTO used for the Swagger docs
    const memberCountResponseDto: MemberCountResponseDto =
      new MemberCountResponseDto();
    memberCountResponseDto.message = { count: memberCount };

    // Count of deleted members
    return memberCountResponseDto;
  }

  /**
   * Paginated member list (excluding deleted members)
   *
   * @param {MemberListPageDto} memberListPageDto - Page number and items per page
   * @return {Promise<MemberListResponseDto>}
   */
  async getMemberListPerPage(
    memberListPageDto: MemberListPageDto,
  ): Promise<MemberListResponseDto> {
    // Starting from the {offset}th item
    const offset = memberListPageDto.perPage * (memberListPageDto.page - 1);

    // Up to the {limit}th item
    // Member list
    const memberList: Member[] = await this.memberRepository.find({
      withDeleted: false,
      skip: offset,
      take: memberListPageDto.perPage,
    });

    // Build the DTO used for the Swagger docs
    const memberListResponseDto: MemberListResponseDto =
      new MemberListResponseDto();
    memberListResponseDto.message = memberList;

    return memberListResponseDto;
  }

  /**
   * Paginated list of deleted members
   *
   * @param {MemberListPageDto} memberListPageDto - Page number and items per page
   * @return {Promise<MemberListResponseDto>}
   */
  async getDeletedMemberListPerPage(
    memberListPageDto: MemberListPageDto,
  ): Promise<MemberListResponseDto> {
    // Starting from the {offset}th item
    const offset = memberListPageDto.perPage * (memberListPageDto.page - 1);

    // Up to the {limit}th item
    // Member list
    const memberList: Member[] = await this.memberRepository.find({
      where: {
        deletedAt: Not(IsNull()),
      },
      withDeleted: true,
      skip: offset,
      take: memberListPageDto.perPage,
    });

    // Build the DTO used for the Swagger docs
    const memberListResponseDto: MemberListResponseDto =
      new MemberListResponseDto();
    memberListResponseDto.message = memberList;

    return memberListResponseDto;
  }

  /**
   * Update a member by ID key
   *
   * @param {MemberIdDto} memberIdDto - Member ID key
   * @param {UpdateMemberDto} updateMemberDto - Data required for the update
   * @return {Promise<UpdateMemberResponseDto>} - Update result
   */
  async updateMemberById(
    memberIdDto: MemberIdDto,
    updateMemberDto: UpdateMemberDto,
  ): Promise<UpdateMemberResponseDto> {
    // Throw an error if no update data was provided
    if (Object.keys(updateMemberDto).length === 0) {
      throw new BadRequestException({
        message: '요청 데이터가 없습니다.',
      });
    }

    // Look up the member
    const member: Member = await this.memberRepository.findOne({
      where: { id: memberIdDto.id },
      withDeleted: true,
    });

    // Throw an error if the member does not exist
    if (member === null) {
      throw new BadRequestException({
        message: '멤버가 존재하지 않습니다.',
      });
    }

    const shouldUpdateAuthority =
      updateMemberDto.branchIds !== undefined ||
      updateMemberDto.menuIds !== undefined;
    const branchIds = updateMemberDto.branchIds ?? [];
    const menuIds = updateMemberDto.menuIds ?? [];

    if (updateMemberDto.password) {
      updateMemberDto.password = await bcrypt.hash(
        updateMemberDto.password,
        10,
      );
      Object.assign(updateMemberDto, revokedSessions());
    }

    // Remove fields not part of the update entity
    delete updateMemberDto.branchIds;
    delete updateMemberDto.menuIds;

    const queryRunner: QueryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();

    // Start the transaction
    await queryRunner.startTransaction();

    try {
      if (shouldUpdateAuthority) {
        // Build the authority array (for validation and insertion)
        const authority: AuthorityDto[] = [];

        // If branches were given without menus, or menus without branches
        if (
          (branchIds.length && !menuIds.length) ||
          (!branchIds.length && menuIds.length)
        ) {
          throw new BadRequestException({
            message: '지점과 메뉴를 1개 이상 선택해주세요.',
          });
        }

        // Populate the authority array
        for (const i in branchIds) {
          for (const j in menuIds) {
            // Entries for validation and insertion
            authority.push({
              branchId: branchIds[i],
              menuId: menuIds[j],
              memberId: member.id,
            });
          }
        }

        // Instantiate for authority array validation
        const authorityInstance = plainToInstance(AuthorityDto, authority, {
          excludeExtraneousValues: true,
        });

        // Validate the authority array
        for (const auth of authorityInstance) {
          const { constraints } = (await validate(auth)).pop() || {};
          if (constraints) {
            throw new BadRequestException({
              message: Object.values(constraints),
            });
          }
        }

        // Count of branches that are not deleted
        const branchIdCount: number = await queryRunner.manager.countBy(
          Branch,
          {
            id: In(branchIds),
          },
        );

        // Throw an error if any branch ID is deleted or does not exist
        if (branchIdCount !== branchIds.length) {
          throw new BadRequestException({
            message: '삭제되었거나 존재하지 않는 지점을 선택하였습니다.',
          });
        }

        // Count of menus that are not deleted
        const menuIdCount: number = await queryRunner.manager.countBy(Menu, {
          id: In(menuIds),
        });

        // Throw an error if any menu ID is deleted or does not exist
        if (menuIdCount !== menuIds.length) {
          throw new BadRequestException({
            message: '삭제되었거나 존재하지 않는 메뉴를 선택하였습니다.',
          });
        }

        // Remove the existing authority rows
        await queryRunner.manager.delete(Authority, {
          memberId: member.id,
        });

        // Insert the new authority rows
        if (authority.length) {
          await queryRunner.manager.insert(Authority, authority);
        }
      }

      // A new address has to be verified again
      if (changesEmail(member.email, updateMemberDto.email)) {
        updateMemberDto['emailValidateAt'] = null;
      }

      // An update of only branches and menus leaves no member columns to set
      let affectedRows = 1;
      if (Object.keys(updateMemberDto).length > 0) {
        // Update the member info
        const result: UpdateResult = await queryRunner.manager.update(
          Member,
          {
            id: member.id,
          },
          updateMemberDto,
        );
        affectedRows = result.affected;
      }

      // Commit the transaction
      await queryRunner.commitTransaction();

      // Build the DTO used for the Swagger docs
      const updateMemberResponseDto: UpdateMemberResponseDto =
        new UpdateMemberResponseDto();
      updateMemberResponseDto.message = { affectedRows };

      return updateMemberResponseDto;
    } catch (err) {
      // Roll back the transaction
      await queryRunner.rollbackTransaction();

      if (err instanceof BadRequestException) {
        throw new BadRequestException(err.getResponse());
      } else if (err instanceof QueryFailedError) {
        throw new QueryFailedError(err.query, err.parameters, err.driverError);
      }

      throw new ServiceUnavailableException({
        name: err.name,
        message: err.message,
      });
    } finally {
      // Release the DB connection
      await queryRunner.release();
    }
  }

  /**
   * Change a member's role
   *
   * @param {MemberIdDto} memberIdDto - Member ID key
   * @param {UpdateMemberRoleDto} updateMemberRoleDto - New role
   * @param {number} requesterId - Member making the change
   * @return {Promise<UpdateMemberResponseDto>} - Update result
   */
  async updateMemberRoleById(
    memberIdDto: MemberIdDto,
    updateMemberRoleDto: UpdateMemberRoleDto,
    requesterId: number,
  ): Promise<UpdateMemberResponseDto> {
    const member: Member = await this.memberRepository.findOne({
      select: { id: true, emailValidateAt: true },
      where: { id: memberIdDto.id },
    });

    if (member === null) {
      throw new BadRequestException({
        message: '멤버가 존재하지 않습니다.',
      });
    }

    const rejection = roleChangeRejection({
      targetId: member.id,
      requesterId,
      nextRole: updateMemberRoleDto.role,
      emailValidateAt: member.emailValidateAt,
    });
    if (rejection) {
      throw new BadRequestException({ message: rejection });
    }

    const result: UpdateResult = await this.memberRepository.update(
      { id: member.id },
      { role: updateMemberRoleDto.role },
    );

    // Build the DTO used for the Swagger docs
    const updateMemberResponseDto: UpdateMemberResponseDto =
      new UpdateMemberResponseDto();
    updateMemberResponseDto.message = { affectedRows: result.affected };

    return updateMemberResponseDto;
  }

  /**
   * Delete a member by ID key<br/>
   * Only updates the deletedAt value
   *
   * @param {MemberIdDto} memberIdDto - Member ID key
   * @param {number} requesterId - Member making the change
   * @return {Promise<UpdateMemberResponseDto>} - Delete result
   */
  async removeMemberById(
    memberIdDto: MemberIdDto,
    requesterId: number,
  ): Promise<UpdateMemberResponseDto> {
    // Keeps the last administrator from locking everyone out
    if (Number(memberIdDto.id) === requesterId) {
      throw new BadRequestException({
        message: '자신의 계정은 삭제할 수 없습니다.',
      });
    }

    // Look up the member
    const member: Member = await this.memberRepository.findOneBy({
      id: memberIdDto.id,
    });

    // Throw an error if the member does not exist
    if (member === null) {
      throw new BadRequestException({
        message: '멤버가 존재하지 않습니다.',
      });
    }

    // Tokens issued before the removal must not work again after a restore
    await this.memberRepository.update(
      { id: member.id },
      {
        ...revokedSessions(),
        ...(member.role !== RolesEnum.deny ? { emailValidateAt: null } : {}),
      },
    );

    // Delete the member by ID key
    const result: UpdateResult = await this.memberRepository.softDelete(
      memberIdDto.id,
    );

    if (result.affected > 0) {
      this.notifyMemberRemoved(member, requesterId);
    }

    // Build the DTO used for the Swagger docs
    const updateMemberResponseDto: UpdateMemberResponseDto =
      new UpdateMemberResponseDto();
    updateMemberResponseDto.message = { affectedRows: result.affected };

    return updateMemberResponseDto;
  }

  /**
   * The removal already happened, so a failed notification is only logged
   */
  private notifyMemberRemoved(member: Member, requesterId: number): void {
    const appName = this.configService.get<string>('APP_NAME');
    const text = `${member.username}(${member.id}) member removed by member ${requesterId}`;
    const adminEmail = this.configService.get<string>('ADMIN_EMAIL');

    const notifications: Promise<unknown>[] = [
      this.slackService.sendSlack(
        this.configService.get<string>('SLACK_WEBHOOK'),
        this.configService.get<string>('SLACK_CHANNEL'),
        `[${appName}]\n${text}`,
        this.configService.get<string>('SLACK_TOKEN'),
      ),
    ];

    if (adminEmail) {
      notifications.push(
        this.emailService.sendEmail(
          adminEmail,
          `[${appName}] Member removed`,
          escapeHtml(text),
        ),
      );
    }

    void Promise.allSettled(notifications).then((results) => {
      for (const result of results) {
        if (result.status === 'rejected') {
          this.logger.error(
            'Member removal notification failed',
            result.reason?.stack,
          );
        }
      }
    });
  }

  /**
   * Restore a deleted member<br/>
   * Updates deletedAt back to null
   *
   * @param {MemberIdDto} memberIdDto - Member ID key
   * @return {Promise<UpdateMemberResponseDto>}
   */
  async restoreMemberById(
    memberIdDto: MemberIdDto,
  ): Promise<UpdateMemberResponseDto> {
    // Look up the deleted member
    const member: Member = await this.memberRepository.findOne({
      where: {
        id: memberIdDto.id,
        deletedAt: Not(IsNull()),
      },
      withDeleted: true,
    });

    // Throw an error if the member does not exist
    if (member === null) {
      throw new BadRequestException({
        message: '멤버가 존재하지 않습니다.',
      });
    }

    // Restore the deleted member
    const result = await this.memberRepository.restore({
      id: memberIdDto.id,
    });

    // Build the DTO used for the Swagger docs
    const updateMemberResponseDto: UpdateMemberResponseDto =
      new UpdateMemberResponseDto();
    updateMemberResponseDto.message = { affectedRows: result.affected };

    return updateMemberResponseDto;
  }
}
