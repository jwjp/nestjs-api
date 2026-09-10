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
  LoginDto,
  LoginResponseDto,
  MemberCountResponseDto,
  MemberIdDto,
  MemberListPageDto,
  MemberListResponseDto,
  MemberRefreshDto,
  MemberRefreshResponseDto,
  MemberResponseDto,
  SendValidationDto,
  SendValidationResponseDto,
  SignUpDto,
  SignUpResponseDto,
  UpdateMemberDto,
  UpdateMemberResponseDto,
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
import { Request } from 'express';

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
    const { branchIds, menuIds } = signUpDto;
    signUpDto.password = await bcrypt.hash(signUpDto.password, 10);

    const queryRunner: QueryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();

    // Start the transaction
    await queryRunner.startTransaction();

    try {
      // Insert the member
      const createdMember: SignUpDto & Member = await queryRunner.manager.save(
        Member,
        signUpDto,
      );

      // Remove the field we don't want to keep around
      delete createdMember.password;

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
            memberId: createdMember.id,
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
      const branchIdCount: number = await queryRunner.manager.countBy(Branch, {
        id: In(branchIds),
      });

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

      // Insert the authority rows
      if (authority.length) {
        await queryRunner.manager.insert(Authority, authority);
      }

      // Commit the transaction
      await queryRunner.commitTransaction();

      // Build the DTO used for the Swagger docs
      const signUpResponseDto: SignUpResponseDto = new SignUpResponseDto();
      signUpResponseDto.message = createdMember;

      return signUpResponseDto;
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
   * Send the email verification token
   *
   * @param {SendValidationDto} sendValidationDto
   * @param {Request} request
   * @return {Promise<SendValidationResponseDto>}
   */
  async sendValidation(
    sendValidationDto: SendValidationDto,
    request: Request,
  ): Promise<SendValidationResponseDto> {
    // Look up the member
    const member: Member = await this.memberRepository.findOne({
      select: { id: true },
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

    // Issue the JWT token
    const validationToken = await this.jwtService.signAsync(
      { id: member.id },
      {
        secret: this.configService.get('JWT_EMAIL_VALIDATION_SECRET_KEY'),
        expiresIn: this.configService.get('JWT_EMAIL_VALIDATION_EXPIRES_TIME'),
      },
    );

    const emailResult: EmailResultDto = await this.emailService.sendEmail(
      sendValidationDto.email,
      '[SAMPLE] Confirm your email address',
      `Hi ${sendValidationDto.username},<br/>` +
        'We just need to verify your email address before you can access {SAMPLE_DOMAIN}<br/><br/>' +
        `Verify your email address ${request.protocol}://${request.get(
          'Host',
        )}/members/validate/${validationToken}<br/><br/>` +
        'Thanks!',
    );

    // Build the DTO used for the Swagger docs
    const sendValidationResponseDto: SendValidationResponseDto =
      new SendValidationResponseDto();
    sendValidationResponseDto.message = emailResult;

    return sendValidationResponseDto;
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
    const updateResult: UpdateResult = await this.memberRepository.update(
      { id: validationTokenPayload.id },
      { role: RolesEnum.admin, emailValidateAt: new Date() },
    );

    // Build the DTO used for the Swagger docs
    const emailValidateResponseDto: EmailValidateResponseDto =
      new EmailValidateResponseDto();
    emailValidateResponseDto.message = { affectedRows: updateResult.affected };

    return emailValidateResponseDto;
  }

  /**
   * Log in
   *
   * @param {LoginDto} loginDto - Data required to log in
   * @return {Promise<LoginResponseDto>} - Issues tokens
   */
  async login(loginDto: LoginDto): Promise<LoginResponseDto> {
    // Look up the member
    const member: Member = await this.memberRepository.findOne({
      select: { id: true, username: true, role: true, password: true },
      where: { loginId: loginDto.loginId },
      withDeleted: false,
    });

    // Throw an error if the member does not exist
    if (member === null) {
      throw new BadRequestException({
        message: '멤버가 존재하지 않습니다.',
      });
    }

    // Compare the given password against the stored one
    const passwordCompare: boolean = await bcrypt.compare(
      loginDto.password,
      member.password,
    );

    // Throw an error if the password does not match
    if (!passwordCompare) {
      throw new UnauthorizedException({
        message: '패스워드가 일치하지 않습니다.',
      });
    }

    // Issue a JWT token carrying id, username, and role
    const accessToken = await this.jwtService.signAsync(
      {
        id: member.id,
        username: member.username,
        role: member.role,
      },
      {
        secret: this.configService.get('JWT_ACCESS_SECRET_KEY'),
        expiresIn: this.configService.get('JWT_ACCESS_EXPIRES_TIME'),
      },
    );

    // Refresh token used to reissue the access token
    const refreshToken = await this.jwtService.signAsync(
      {},
      {
        secret: this.configService.get('JWT_REFRESH_SECRET_KEY'),
        expiresIn: this.configService.get('JWT_REFRESH_EXPIRES_TIME'),
      },
    );

    // Update the stored refresh token
    await this.memberRepository.update({ id: member.id }, { refreshToken });

    // Build the DTO used for the Swagger docs
    const loginResponseDto: LoginResponseDto = new LoginResponseDto();
    loginResponseDto.message = { accessToken, refreshToken };

    return loginResponseDto;
  }

  /**
   * Request an access token refresh<br/>
   * Refreshed only if the refresh token is valid
   *
   * @param {MemberRefreshDto} memberRefreshDto - Member ID key
   * @return {Promise<MemberRefreshResponseDto>} - Access token refresh
   */
  async refresh(
    memberRefreshDto: MemberRefreshDto,
  ): Promise<MemberRefreshResponseDto> {
    // Look up the member
    const member = await this.memberRepository.findOne({
      select: { id: true, username: true, role: true, refreshToken: true },
      where: {
        id: memberRefreshDto.id,
      },
    });

    // If the member does not exist
    if (!member) {
      throw new BadRequestException({
        message: '멤버가 삭제되었거나 존재하지 않습니다.',
      });
    }

    // If the member has no refresh token
    if (!member.refreshToken) {
      throw new UnauthorizedException({
        message: '리프레시 토큰이 존재하지 않습니다. 다시 로그인해주세요.',
      });
    }

    // If the refresh token does not match
    if (member.refreshToken !== memberRefreshDto.refreshToken) {
      throw new UnauthorizedException({
        message: '리프레시 토큰이 일치하지 않습니다.',
      });
    }

    // Refresh token payload
    const refreshTokenPayload = await this.jwtService.verifyAsync(
      member.refreshToken,
      {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET_KEY'),
      },
    );

    // If the refresh token has expired
    if (refreshTokenPayload.exp < Date.now() / 1000) {
      throw new UnauthorizedException({
        message: '리프레시 토큰이 만료되었습니다. 다시 로그인해주세요.',
      });
    }

    // Reissue the access token
    const newAccessToken = await this.jwtService.signAsync(
      {
        id: member.id,
        username: member.username,
        role: member.role,
      },
      {
        secret: this.configService.get('JWT_ACCESS_SECRET_KEY'),
        expiresIn: this.configService.get('JWT_ACCESS_EXPIRES_TIME'),
      },
    );

    // Build the DTO used for the Swagger docs
    const memberRefreshResponseDto: MemberRefreshResponseDto =
      new MemberRefreshResponseDto();
    memberRefreshResponseDto.message = { accessToken: newAccessToken };

    return memberRefreshResponseDto;
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
   * Member info by ID key (using the query builder)
   * Also includes menu and branch authority info
   *
   * @param {MemberIdDto} memberIdDto - Member ID key
   * @return {Promise<Member[]>}
   */
  async getMemberByIdUsingBuilder(memberIdDto: MemberIdDto): Promise<Member[]> {
    // Look up the member (each row comes back as its own object)
    const member: Member[] = await this.memberRepository
      .createQueryBuilder('member')
      .leftJoin(Authority, 'auth', 'member.id = auth.memberId')
      .leftJoin(Menu, 'menu', 'auth.menuId = menu.id')
      .leftJoin(Branch, 'branch', 'auth.branchId = branch.id')
      .select([
        'member.id AS memberId',
        'member.loginId AS loginId',
        'member.username AS username',
        'member.role AS role',
        'branch.id AS branchId',
        'branch.name AS branchName',
        'menu.id AS menuId',
        'menu.title AS menuTitle',
      ])
      .where('member.id = :id', { id: memberIdDto.id })
      .withDeleted()
      .getRawMany();

    // Throw an error if no member was found
    if (member.length === 0) {
      throw new BadRequestException({
        message: '멤버가 존재하지 않습니다.',
      });
    }

    return member;
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

      // If not in the deny state && the email is being changed
      if (
        member.role !== RolesEnum.deny &&
        member.email !== updateMemberDto.email
      ) {
        // Downgrade the role to user
        updateMemberDto['role'] = RolesEnum.user;

        // Require the email to be re-verified
        updateMemberDto['emailValidateAt'] = null;
      }

      // Update the member info
      const result: UpdateResult = await queryRunner.manager.update(
        Member,
        {
          id: member.id,
        },
        updateMemberDto,
      );

      // Commit the transaction
      await queryRunner.commitTransaction();

      // Build the DTO used for the Swagger docs
      const updateMemberResponseDto: UpdateMemberResponseDto =
        new UpdateMemberResponseDto();
      updateMemberResponseDto.message = { affectedRows: result.affected };

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
   * Delete a member by ID key<br/>
   * Only updates the deletedAt value
   *
   * @param {MemberIdDto} memberIdDto - Member ID key
   * @param {string} authorization
   * @return {Promise<UpdateMemberResponseDto>} - Delete result
   */
  async removeMemberById(
    memberIdDto: MemberIdDto,
    authorization: string,
  ): Promise<UpdateMemberResponseDto> {
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

    // Result of the member info update
    let validationUpdateResult: UpdateResult;

    // Only change the role if not already in the deny state
    if (member.role !== RolesEnum.deny) {
      // Update the member info
      validationUpdateResult = await this.memberRepository.update(
        { id: member.id },
        {
          role: RolesEnum.user,
          emailValidateAt: null,
        },
      );
    }

    // Member info update failed
    if (validationUpdateResult?.affected === 0) {
      throw new ServiceUnavailableException({
        message: '멤버 정보 수정에 실패했습니다.',
      });
    }

    // Delete the member by ID key
    const result: UpdateResult = await this.memberRepository.softDelete(
      memberIdDto.id,
    );

    // Used when a notification is needed
    if (result.affected > 0) {
      // Split the JWT token type and value
      const [type, token] = authorization?.split(' ') ?? [];
      const jwtToken = type === 'Bearer' ? token : undefined;

      // Info of the member who made the request (from the token)
      const payload = await this.jwtService.verifyAsync(jwtToken, {
        secret: this.configService.get<string>('JWT_ACCESS_SECRET_KEY'),
      });

      // Send the email
      await this.emailService.sendEmail(
        'example@example.com',
        '[SAMPLE] Member removed in NestJS API',
        `${member.username}(${member.id}) member removed by ${payload?.username}(${payload?.id})`,
      );

      // Send the Slack message
      await this.slackService.sendSlack(
        this.configService.get<string>('SLACK_WEBHOOK'),
        this.configService.get<string>('SLACK_CHANNEL'),
        `[SAMPLE]\n` +
          `Member removed in NestJS API\n` +
          `${member.username}(${member.id}) member removed by ${payload?.username}(${payload?.id})`,
        this.configService.get<string>('SLACK_TOKEN'),
      );
    }

    // Build the DTO used for the Swagger docs
    const updateMemberResponseDto: UpdateMemberResponseDto =
      new UpdateMemberResponseDto();
    updateMemberResponseDto.message = { affectedRows: result.affected };

    return updateMemberResponseDto;
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

    // Result of the member info update
    let validationUpdateResult: UpdateResult;

    // Only change the role if not already in the deny state
    if (member.role !== RolesEnum.deny) {
      // Update the member info
      validationUpdateResult = await this.memberRepository.update(
        { id: member.id },
        {
          role: RolesEnum.user,
          emailValidateAt: null,
        },
      );
    }

    // Member info update failed
    if (validationUpdateResult?.affected === 0) {
      throw new ServiceUnavailableException({
        message: '멤버 정보 수정에 실패했습니다.',
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
