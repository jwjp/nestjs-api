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
   * 회원가입
   *
   * @param {SignUpDto} signUpDto - 회원가입에 필요한 데이터
   * @return {Promise<SignUpResponseDto>}
   */
  async signUp(signUpDto: SignUpDto): Promise<SignUpResponseDto> {
    const { branchIds, menuIds } = signUpDto;
    signUpDto.password = await bcrypt.hash(signUpDto.password, 10);

    const queryRunner: QueryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();

    // 트랜잭션 시작
    await queryRunner.startTransaction();

    try {
      // 멤버 추가
      const createdMember: SignUpDto & Member = await queryRunner.manager.save(
        Member,
        signUpDto,
      );

      // 사용하지 않는 객체 제거
      delete createdMember.password;

      // 권한 배열 생성 (데이터 검증 및 insert 배열)
      const authority: AuthorityDto[] = [];

      // 지점은 있는데 메뉴가 없거나, 메뉴는 있는데 지점이 없는 경우
      if (
        (branchIds.length && !menuIds.length) ||
        (!branchIds.length && menuIds.length)
      ) {
        throw new BadRequestException({
          message: '지점과 메뉴를 1개 이상 선택해주세요.',
        });
      }

      // 권한 배열 데이터 추가
      for (const i in branchIds) {
        for (const j in menuIds) {
          // 데이터 검증 및 insert 배열
          authority.push({
            branchId: branchIds[i],
            menuId: menuIds[j],
            memberId: createdMember.id,
          });
        }
      }

      // 권한 배열 데이터 검증을 위한 인스턴스화
      const authorityInstance = plainToInstance(AuthorityDto, authority, {
        excludeExtraneousValues: true,
      });

      // 권한 배열 데이터 검증
      for (const auth of authorityInstance) {
        const { constraints } = (await validate(auth)).pop() || {};
        if (constraints) {
          throw new BadRequestException({
            message: Object.values(constraints),
          });
        }
      }

      // 삭제되지 않은 지점 수
      const branchIdCount: number = await queryRunner.manager.countBy(Branch, {
        id: In(branchIds),
      });

      // 삭제되었거나 존재하지 않는 지점 ID 값이 있다면 예외처리
      if (branchIdCount !== branchIds.length) {
        throw new BadRequestException({
          message: '삭제되었거나 존재하지 않는 지점을 선택하였습니다.',
        });
      }

      // 삭제되지 않은 메뉴 수
      const menuIdCount: number = await queryRunner.manager.countBy(Menu, {
        id: In(menuIds),
      });

      // 삭제되었거나 존재하지 않는 지점 ID 값이 있다면 예외처리
      if (menuIdCount !== menuIds.length) {
        throw new BadRequestException({
          message: '삭제되었거나 존재하지 않는 메뉴를 선택하였습니다.',
        });
      }

      // 권한 추가
      if (authority.length) {
        await queryRunner.manager.insert(Authority, authority);
      }

      // 트랜잭션 커밋
      await queryRunner.commitTransaction();

      // Swagger 문서 적용을 위한 DTO 생성
      const signUpResponseDto: SignUpResponseDto = new SignUpResponseDto();
      signUpResponseDto.message = createdMember;

      return signUpResponseDto;
    } catch (err) {
      // 트랜잭션 롤백
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
      // DB커넥션 릴리즈
      await queryRunner.release();
    }
  }

  /**
   * 이메일 검증 토큰 발송
   *
   * @param {SendValidationDto} sendValidationDto
   * @param {Request} request
   * @return {Promise<SendValidationResponseDto>}
   */
  async sendValidation(
    sendValidationDto: SendValidationDto,
    request: Request,
  ): Promise<SendValidationResponseDto> {
    // 멤버 검색
    const member: Member = await this.memberRepository.findOne({
      select: { id: true },
      where: {
        email: sendValidationDto.email,
        username: sendValidationDto.username,
      },
    });

    // 멤버가 없는 경우
    if (!member) {
      throw new BadRequestException({
        message: '멤버가 삭제되었거나 존재하지 않습니다.',
      });
    }

    // jwt 토큰 발급
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

    // Swagger 문서 적용을 위한 DTO 생성
    const sendValidationResponseDto: SendValidationResponseDto =
      new SendValidationResponseDto();
    sendValidationResponseDto.message = emailResult;

    return sendValidationResponseDto;
  }

  /**
   * 이메일 검증
   *
   * @param {EmailValidateDto} emailValidateDto
   * @return {Promise<EmailValidateResponseDto>}
   */
  async emailValidate(
    emailValidateDto: EmailValidateDto,
  ): Promise<EmailValidateResponseDto> {
    // 토큰 정보
    const validationTokenPayload = await this.jwtService.verifyAsync(
      emailValidateDto.token,
      {
        secret: this.configService.get<string>(
          'JWT_EMAIL_VALIDATION_SECRET_KEY',
        ),
      },
    );

    // 토큰이 만료 된 경우
    if (validationTokenPayload.exp < Date.now() / 1000) {
      throw new UnauthorizedException({
        message: '토큰이 만료되었습니다. 다시 시도해주세요.',
      });
    }

    // 이메일 검증 완료
    const updateResult: UpdateResult = await this.memberRepository.update(
      { id: validationTokenPayload.id },
      { role: RolesEnum.admin, emailValidateAt: new Date() },
    );

    // Swagger 문서 적용을 위한 DTO 생성
    const emailValidateResponseDto: EmailValidateResponseDto =
      new EmailValidateResponseDto();
    emailValidateResponseDto.message = { affectedRows: updateResult.affected };

    return emailValidateResponseDto;
  }

  /**
   * 로그인
   *
   * @param {LoginDto} loginDto - 로그인에 필요한 데이터
   * @return {Promise<LoginResponseDto>} - 토큰 발급
   */
  async login(loginDto: LoginDto): Promise<LoginResponseDto> {
    // 멤버 검색
    const member: Member = await this.memberRepository.findOne({
      select: { id: true, username: true, role: true, password: true },
      where: { loginId: loginDto.loginId },
      withDeleted: false,
    });

    // 멤버가 없는 경우 예외처리
    if (member === null) {
      throw new BadRequestException({
        message: '멤버가 존재하지 않습니다.',
      });
    }

    // 입력한 비밀번호와 실제 비밀번호 비교
    const passwordCompare: boolean = await bcrypt.compare(
      loginDto.password,
      member.password,
    );

    // 비밀번호가 일치하지 않으면 예외처리
    if (!passwordCompare) {
      throw new UnauthorizedException({
        message: '패스워드가 일치하지 않습니다.',
      });
    }

    // id, username, role 값을 담아서 jwt 토큰 발급
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

    // 액세스 토큰 재발급을 하기 위한 리프레시 토큰
    const refreshToken = await this.jwtService.signAsync(
      {},
      {
        secret: this.configService.get('JWT_REFRESH_SECRET_KEY'),
        expiresIn: this.configService.get('JWT_REFRESH_EXPIRES_TIME'),
      },
    );

    // 리프레시 토큰 업데이트
    await this.memberRepository.update({ id: member.id }, { refreshToken });

    // Swagger 문서 적용을 위한 DTO 생성
    const loginResponseDto: LoginResponseDto = new LoginResponseDto();
    loginResponseDto.message = { accessToken, refreshToken };

    return loginResponseDto;
  }

  /**
   * 액세스 토큰 재발급 요청<br/>
   * 리프레시 토큰이 유효한 경우에 재발급
   *
   * @param {MemberRefreshDto} memberRefreshDto - 멤버 ID 키 값
   * @return {Promise<MemberRefreshResponseDto>} - 액세스 토큰 재발급
   */
  async refresh(
    memberRefreshDto: MemberRefreshDto,
  ): Promise<MemberRefreshResponseDto> {
    // 멤버 검색
    const member = await this.memberRepository.findOne({
      select: { id: true, username: true, role: true, refreshToken: true },
      where: {
        id: memberRefreshDto.id,
      },
    });

    // 멤버가 없는 경우
    if (!member) {
      throw new BadRequestException({
        message: '멤버가 삭제되었거나 존재하지 않습니다.',
      });
    }

    // 멤버에 리프레시 토큰이 없는 경우
    if (!member.refreshToken) {
      throw new UnauthorizedException({
        message: '리프레시 토큰이 존재하지 않습니다. 다시 로그인해주세요.',
      });
    }

    // 리프레시 토큰이 일치하지 않는 경우
    if (member.refreshToken !== memberRefreshDto.refreshToken) {
      throw new UnauthorizedException({
        message: '리프레시 토큰이 일치하지 않습니다.',
      });
    }

    // 리프레시 토큰 정보
    const refreshTokenPayload = await this.jwtService.verifyAsync(
      member.refreshToken,
      {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET_KEY'),
      },
    );

    // 리프레시 토큰이 만료 된 경우
    if (refreshTokenPayload.exp < Date.now() / 1000) {
      throw new UnauthorizedException({
        message: '리프레시 토큰이 만료되었습니다. 다시 로그인해주세요.',
      });
    }

    // 액세스 토큰 재발급
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

    // Swagger 문서 적용을 위한 DTO 생성
    const memberRefreshResponseDto: MemberRefreshResponseDto =
      new MemberRefreshResponseDto();
    memberRefreshResponseDto.message = { accessToken: newAccessToken };

    return memberRefreshResponseDto;
  }

  /**
   * 아이디 중복체크 (삭제 포함)
   *
   * @param {ConfirmIdDto} confirmId - 중복체크에 필요한 데이터
   * @return {Promise<ConfirmIdResponseDto>} - 중복 여부
   */
  async idDuplicatedId(confirmId: ConfirmIdDto): Promise<ConfirmIdResponseDto> {
    // 삭제한 데이터 포함 아이디 검색
    const idCount: number = await this.memberRepository.count({
      where: {
        loginId: confirmId.loginId,
      },
      withDeleted: true,
    });

    // Swagger 문서 적용을 위한 DTO 생성
    const confirmIdResponseDto: ConfirmIdResponseDto =
      new ConfirmIdResponseDto();
    confirmIdResponseDto.message = { isDuplicated: !!idCount };

    return confirmIdResponseDto;
  }

  /**
   * 이메일 중복체크 (삭제 포함)
   *
   * @param {ConfirmEmailDto} confirmEmail - 중복체크에 필요한 데이터
   * @return {Promise<ConfirmEmailResponseDto>} - 중복 여부
   */
  async idDuplicatedEmail(
    confirmEmail: ConfirmEmailDto,
  ): Promise<ConfirmEmailResponseDto> {
    // 삭제한 데이터 포함 이메일 검색
    const emailCount: number = await this.memberRepository.count({
      where: {
        email: confirmEmail.email,
      },
      withDeleted: true,
    });

    // Swagger 문서 적용을 위한 DTO 생성
    const confirmEmailResponseDto: ConfirmEmailResponseDto =
      new ConfirmEmailResponseDto();
    confirmEmailResponseDto.message = { isDuplicated: !!emailCount };

    return confirmEmailResponseDto;
  }

  /**
   * 멤버 정보
   * 메뉴 및 지점 권한 정보도 포함
   *
   * @param {MemberIdDto} memberIdDto - 멤버 ID 키 값
   * @return {Promise<MemberResponseDto>}
   */
  async getMemberById(memberIdDto: MemberIdDto): Promise<MemberResponseDto> {
    // 멤버 검색
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
      // 메뉴 및 지점 권한 정보
      relations: { authority: { menu: true, branch: true } },
      withDeleted: true,
    });

    // 멤버가 없는 경우 예외처리
    if (member === null) {
      throw new BadRequestException({
        message: '멤버가 존재하지 않습니다.',
      });
    }

    // Swagger 문서 적용을 위한 DTO 생성
    const memberResponseDto: MemberResponseDto = new MemberResponseDto();
    memberResponseDto.message = member;

    return memberResponseDto;
  }

  /**
   * ID 키 값을 이용한 멤버 정보 (쿼리빌더 사용)
   * 메뉴 및 지점 권한 정보도 포함
   *
   * @param {MemberIdDto} memberIdDto - 멤버 ID 키 값
   * @return {Promise<Member[]>}
   */
  async getMemberByIdUsingBuilder(memberIdDto: MemberIdDto): Promise<Member[]> {
    // 멤버 검색 (1개 행이 1개의 객체로 각각 나옴)
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

    // 검색 된 멤버가 없는 경우 예외처리
    if (member.length === 0) {
      throw new BadRequestException({
        message: '멤버가 존재하지 않습니다.',
      });
    }

    return member;
  }

  /**
   * 삭제되지 않은 멤버 수
   *
   * @return {Promise<MemberCountResponseDto>}
   */
  async getMemberCount(): Promise<MemberCountResponseDto> {
    // 삭제되지 않은 멤버 수
    const memberCount: number = await this.memberRepository.count();

    // Swagger 문서 적용을 위한 DTO 생성
    const memberCountResponseDto: MemberCountResponseDto =
      new MemberCountResponseDto();
    memberCountResponseDto.message = { count: memberCount };

    // 삭제되지 않은 멤버 수
    return memberCountResponseDto;
  }

  /**
   * 삭제 된 멤버 수
   *
   * @return {Promise<MemberCountResponseDto>}
   */
  async getDeletedMemberCount(): Promise<MemberCountResponseDto> {
    // 삭제 된 멤버 수
    const memberCount = await this.memberRepository.count({
      where: {
        deletedAt: Not(IsNull()),
      },
      withDeleted: true,
    });

    // Swagger 문서 적용을 위한 DTO 생성
    const memberCountResponseDto: MemberCountResponseDto =
      new MemberCountResponseDto();
    memberCountResponseDto.message = { count: memberCount };

    // 삭제 된 멤버 수
    return memberCountResponseDto;
  }

  /**
   * 페이지당 멤버 리스트 (삭제 멤버 제외)
   *
   * @param {MemberListPageDto} memberListPageDto - 페이지 번호 및 페이지당 표시 할 멤버 수
   * @return {Promise<MemberListResponseDto>}
   */
  async getMemberListPerPage(
    memberListPageDto: MemberListPageDto,
  ): Promise<MemberListResponseDto> {
    // {offset}번째 부터
    const offset = memberListPageDto.perPage * (memberListPageDto.page - 1);

    // {limit}번째 까지
    // 멤버 리스트
    const memberList: Member[] = await this.memberRepository.find({
      withDeleted: false,
      skip: offset,
      take: memberListPageDto.perPage,
    });

    // Swagger 문서 적용을 위한 DTO 생성
    const memberListResponseDto: MemberListResponseDto =
      new MemberListResponseDto();
    memberListResponseDto.message = memberList;

    return memberListResponseDto;
  }

  /**
   * 페이지당 삭제 멤버 리스트
   *
   * @param {MemberListPageDto} memberListPageDto - 페이지 번호 및 페이지당 표시 할 멤버 수
   * @return {Promise<MemberListResponseDto>}
   */
  async getDeletedMemberListPerPage(
    memberListPageDto: MemberListPageDto,
  ): Promise<MemberListResponseDto> {
    // {offset}번째 부터
    const offset = memberListPageDto.perPage * (memberListPageDto.page - 1);

    // {limit}번째 까지
    // 멤버 리스트
    const memberList: Member[] = await this.memberRepository.find({
      where: {
        deletedAt: Not(IsNull()),
      },
      withDeleted: true,
      skip: offset,
      take: memberListPageDto.perPage,
    });

    // Swagger 문서 적용을 위한 DTO 생성
    const memberListResponseDto: MemberListResponseDto =
      new MemberListResponseDto();
    memberListResponseDto.message = memberList;

    return memberListResponseDto;
  }

  /**
   * ID 키 값을 이용한 멤버 업데이트
   *
   * @param {MemberIdDto} memberIdDto - 멤버 ID 키 값
   * @param {UpdateMemberDto} updateMemberDto - 업데이트에 필요한 데이터
   * @return {Promise<UpdateMemberResponseDto>} - 업데이트 결과
   */
  async updateMemberById(
    memberIdDto: MemberIdDto,
    updateMemberDto: UpdateMemberDto,
  ): Promise<UpdateMemberResponseDto> {
    // 업데이트 데이터가 넘어오지 않으면 예외처리
    if (Object.keys(updateMemberDto).length === 0) {
      throw new BadRequestException({
        message: '요청 데이터가 없습니다.',
      });
    }

    // 멤버 검색
    const member: Member = await this.memberRepository.findOne({
      where: { id: memberIdDto.id },
      withDeleted: true,
    });

    // 멤버가 없는 경우 예외처리
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

    // 업데이트 엔티티에 포함되지 않는 객체 삭제
    delete updateMemberDto.branchIds;
    delete updateMemberDto.menuIds;

    const queryRunner: QueryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();

    // 트랜잭션 시작
    await queryRunner.startTransaction();

    try {
      if (shouldUpdateAuthority) {
        // 권한 배열 생성 (데이터 검증 및 insert 배열)
        const authority: AuthorityDto[] = [];

        // 지점은 있는데 메뉴가 없거나, 메뉴는 있는데 지점이 없는 경우
        if (
          (branchIds.length && !menuIds.length) ||
          (!branchIds.length && menuIds.length)
        ) {
          throw new BadRequestException({
            message: '지점과 메뉴를 1개 이상 선택해주세요.',
          });
        }

        // 권한 배열 데이터 추가
        for (const i in branchIds) {
          for (const j in menuIds) {
            // 데이터 검증 및 insert 배열
            authority.push({
              branchId: branchIds[i],
              menuId: menuIds[j],
              memberId: member.id,
            });
          }
        }

        // 권한 배열 데이터 검증을 위한 인스턴스화
        const authorityInstance = plainToInstance(AuthorityDto, authority, {
          excludeExtraneousValues: true,
        });

        // 권한 배열 데이터 검증
        for (const auth of authorityInstance) {
          const { constraints } = (await validate(auth)).pop() || {};
          if (constraints) {
            throw new BadRequestException({
              message: Object.values(constraints),
            });
          }
        }

        // 삭제되지 않은 지점 수
        const branchIdCount: number = await queryRunner.manager.countBy(
          Branch,
          {
            id: In(branchIds),
          },
        );

        // 삭제되었거나 존재하지 않는 지점 ID 값이 있다면 예외처리
        if (branchIdCount !== branchIds.length) {
          throw new BadRequestException({
            message: '삭제되었거나 존재하지 않는 지점을 선택하였습니다.',
          });
        }

        // 삭제되지 않은 메뉴 수
        const menuIdCount: number = await queryRunner.manager.countBy(Menu, {
          id: In(menuIds),
        });

        // 삭제되었거나 존재하지 않는 지점 ID 값이 있다면 예외처리
        if (menuIdCount !== menuIds.length) {
          throw new BadRequestException({
            message: '삭제되었거나 존재하지 않는 메뉴를 선택하였습니다.',
          });
        }

        // 기존 권한 삭제
        await queryRunner.manager.delete(Authority, {
          memberId: member.id,
        });

        // 신규 권한 추가
        if (authority.length) {
          await queryRunner.manager.insert(Authority, authority);
        }
      }

      // deny 상태가 아니고 && 이메일을 변경하는 경우
      if (
        member.role !== RolesEnum.deny &&
        member.email !== updateMemberDto.email
      ) {
        // 권한을 user 로 변경
        updateMemberDto['role'] = RolesEnum.user;

        // 이메일 재인증하도록 변경
        updateMemberDto['emailValidateAt'] = null;
      }

      // 멤버 정보 수정
      const result: UpdateResult = await queryRunner.manager.update(
        Member,
        {
          id: member.id,
        },
        updateMemberDto,
      );

      // 트랜잭션 커밋
      await queryRunner.commitTransaction();

      // Swagger 문서 적용을 위한 DTO 생성
      const updateMemberResponseDto: UpdateMemberResponseDto =
        new UpdateMemberResponseDto();
      updateMemberResponseDto.message = { affectedRows: result.affected };

      return updateMemberResponseDto;
    } catch (err) {
      // 트랜잭션 롤백
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
      // DB커넥션 릴리즈
      await queryRunner.release();
    }
  }

  /**
   * ID 키 값을 이용한 멤버 삭제<br/>
   * deletedAt 값만 업데이트
   *
   * @param {MemberIdDto} memberIdDto - 멤버 ID 키 값
   * @param {string} authorization
   * @return {Promise<UpdateMemberResponseDto>} - 삭제 결과
   */
  async removeMemberById(
    memberIdDto: MemberIdDto,
    authorization: string,
  ): Promise<UpdateMemberResponseDto> {
    // 멤버 검색
    const member: Member = await this.memberRepository.findOneBy({
      id: memberIdDto.id,
    });

    // 멤버가 없는 경우 예외처리
    if (member === null) {
      throw new BadRequestException({
        message: '멤버가 존재하지 않습니다.',
      });
    }

    // 멤버 정보 수정 결과
    let validationUpdateResult: UpdateResult;

    // deny 상태가 아닌 경우에만 권한 변경
    if (member.role !== RolesEnum.deny) {
      // 멤버 정보 수정
      validationUpdateResult = await this.memberRepository.update(
        { id: member.id },
        {
          role: RolesEnum.user,
          emailValidateAt: null,
        },
      );
    }

    // 멤버 정보 수정 실패
    if (validationUpdateResult?.affected === 0) {
      throw new ServiceUnavailableException({
        message: '멤버 정보 수정에 실패했습니다.',
      });
    }

    // ID 키 값을 이용한 멤버 삭제
    const result: UpdateResult = await this.memberRepository.softDelete(
      memberIdDto.id,
    );

    // 알림이 필요한 경우 사용
    if (result.affected > 0) {
      // JWT 토큰 타입과 코드 분리
      const [type, token] = authorization?.split(' ') ?? [];
      const jwtToken = type === 'Bearer' ? token : undefined;

      // 서비스 요청한 멤버 정보(토큰 값 사용)
      const payload = await this.jwtService.verifyAsync(jwtToken, {
        secret: this.configService.get<string>('JWT_ACCESS_SECRET_KEY'),
      });

      // 이메일 발송
      await this.emailService.sendEmail(
        'example@example.com',
        '[SAMPLE] Member removed in NestJS API',
        `${member.username}(${member.id}) member removed by ${payload?.username}(${payload?.id})`,
      );

      // 슬랙 발송
      await this.slackService.sendSlack(
        this.configService.get<string>('SLACK_WEBHOOK'),
        this.configService.get<string>('SLACK_CHANNEL'),
        `[SAMPLE]\n` +
          `Member removed in NestJS API\n` +
          `${member.username}(${member.id}) member removed by ${payload?.username}(${payload?.id})`,
        this.configService.get<string>('SLACK_TOKEN'),
      );
    }

    // Swagger 문서 적용을 위한 DTO 생성
    const updateMemberResponseDto: UpdateMemberResponseDto =
      new UpdateMemberResponseDto();
    updateMemberResponseDto.message = { affectedRows: result.affected };

    return updateMemberResponseDto;
  }

  /**
   * 삭제 멤버 복구<br/>
   * deletedAt 값을 null 값으로 업데이트
   *
   * @param {MemberIdDto} memberIdDto - 멤버 ID 키 값
   * @return {Promise<UpdateMemberResponseDto>}
   */
  async restoreMemberById(
    memberIdDto: MemberIdDto,
  ): Promise<UpdateMemberResponseDto> {
    // 삭제 된 멤버 검색
    const member: Member = await this.memberRepository.findOne({
      where: {
        id: memberIdDto.id,
        deletedAt: Not(IsNull()),
      },
      withDeleted: true,
    });

    // 멤버가 없는 경우 예외처리
    if (member === null) {
      throw new BadRequestException({
        message: '멤버가 존재하지 않습니다.',
      });
    }

    // 멤버 정보 수정 결과
    let validationUpdateResult: UpdateResult;

    // deny 상태가 아닌 경우에만 권한 변경
    if (member.role !== RolesEnum.deny) {
      // 멤버 정보 수정
      validationUpdateResult = await this.memberRepository.update(
        { id: member.id },
        {
          role: RolesEnum.user,
          emailValidateAt: null,
        },
      );
    }

    // 멤버 정보 수정 실패
    if (validationUpdateResult?.affected === 0) {
      throw new ServiceUnavailableException({
        message: '멤버 정보 수정에 실패했습니다.',
      });
    }

    // 삭제 멤버 복구
    const result = await this.memberRepository.restore({
      id: memberIdDto.id,
    });

    // Swagger 문서 적용을 위한 DTO 생성
    const updateMemberResponseDto: UpdateMemberResponseDto =
      new UpdateMemberResponseDto();
    updateMemberResponseDto.message = { affectedRows: result.affected };

    return updateMemberResponseDto;
  }
}
