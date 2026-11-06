import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { MemberService } from './member.service';
import {
  AuthenticatedMember,
  CurrentMember,
  Public,
  Roles,
} from '../common/auth/auth.decorator';
import {
  ConfirmEmailDto,
  ConfirmEmailResponseDto,
  ConfirmIdDto,
  ConfirmIdResponseDto,
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
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ResponseDto, ResponseErrorDto } from '../common/auth/response.dto';

@ApiTags('Members')
@ApiResponse({
  status: '4XX',
  type: ResponseErrorDto,
  description:
    '4XX and 5XX error messages can be found in the message.error object<br/>Sensitive error messages are not described in detail',
})
@ApiResponse({
  status: '2XX',
  type: ResponseDto,
  description: '2XX response values can be found in the message object',
})
@Roles('admin')
@Controller('members')
export class MemberController {
  constructor(private readonly memberService: MemberService) {}

  /**
   * Sign up
   *
   * @param {SignUpDto} signUpDto - Data required to sign up
   * @return {Promise<SignUpResponseDto>}
   */
  @ApiOperation({ security: [], summary: 'Sign up' })
  @Public()
  @Post()
  async signUp(@Body() signUpDto: SignUpDto): Promise<SignUpResponseDto> {
    return await this.memberService.signUp(signUpDto);
  }

  /**
   * Send the email verification token
   *
   * @param {SendValidationDto} sendValidationDto
   * @return {Promise<SendValidationResponseDto>}
   */
  @ApiOperation({ summary: 'Send the email verification token' })
  @Post('validation')
  async sendValidation(
    @Body() sendValidationDto: SendValidationDto,
  ): Promise<SendValidationResponseDto> {
    return await this.memberService.sendValidation(sendValidationDto);
  }

  /**
   * Verify the email
   *
   * @param {EmailValidateDto} emailValidateDto
   * @return {Promise<EmailValidateResponseDto>}
   */
  @ApiOperation({ security: [], summary: 'Verify the email' })
  @Public()
  @Get('validate/:token')
  async emailValidate(
    @Param() emailValidateDto: EmailValidateDto,
  ): Promise<EmailValidateResponseDto> {
    return await this.memberService.emailValidate(emailValidateDto);
  }

  /**
   * Check login ID duplicates (including deleted rows)
   *
   * @param {ConfirmIdDto} confirmId - Data required for the duplicate check
   * @return {Promise<ConfirmIdResponseDto>} - Whether it is duplicated
   */
  @ApiOperation({ security: [], summary: 'Check login ID duplicate' })
  @Public()
  @Post('/duplicated/id')
  @HttpCode(HttpStatus.OK)
  idDuplicatedId(
    @Body() confirmId: ConfirmIdDto,
  ): Promise<ConfirmIdResponseDto> {
    return this.memberService.idDuplicatedId(confirmId);
  }

  /**
   * Check email duplicates (including deleted rows)
   *
   * @param {ConfirmEmailDto} confirmEmail - Data required for the duplicate check
   * @return {Promise<ConfirmEmailResponseDto>} - Whether it is duplicated
   */
  @ApiOperation({ security: [], summary: 'Check email duplicate' })
  @Public()
  @Post('/duplicated/email')
  @HttpCode(HttpStatus.OK)
  idDuplicated(
    @Body() confirmEmail: ConfirmEmailDto,
  ): Promise<ConfirmEmailResponseDto> {
    return this.memberService.idDuplicatedEmail(confirmEmail);
  }

  /**
   * Count of members not deleted
   *
   * @return {Promise<MemberCountResponseDto>}
   */
  @ApiOperation({ summary: 'Count of members not deleted' })
  @Get('/count')
  getMemberCount(): Promise<MemberCountResponseDto> {
    return this.memberService.getMemberCount();
  }

  /**
   * Count of deleted members
   *
   * @return {Promise<MemberCountResponseDto>}
   */
  @ApiOperation({ summary: 'Count of deleted members' })
  @Get('/count/deleted')
  getDeletedMemberCount(): Promise<MemberCountResponseDto> {
    return this.memberService.getDeletedMemberCount();
  }

  /**
   * Paginated member list (excluding deleted members)
   *
   * @param {MemberListPageDto} memberListPageDto - Page number and items per page
   * @return {Promise<MemberListResponseDto>}
   */
  @ApiOperation({
    summary: 'Paginated member list (excluding deleted members)',
  })
  @Get()
  getMemberListPerPage(
    @Query() memberListPageDto: MemberListPageDto,
  ): Promise<MemberListResponseDto> {
    return this.memberService.getMemberListPerPage(memberListPageDto);
  }

  /**
   * Paginated list of deleted members
   *
   * @param {MemberListPageDto} memberListPageDto - Page number and items per page
   * @return {Promise<MemberListResponseDto>}
   */
  @ApiOperation({ summary: 'Paginated list of deleted members' })
  @Get('/deleted')
  getDeletedMemberListPerPage(
    @Query() memberListPageDto: MemberListPageDto,
  ): Promise<MemberListResponseDto> {
    return this.memberService.getDeletedMemberListPerPage(memberListPageDto);
  }

  /**
   * Member info<br/>
   * Also includes menu and branch authority info
   *
   * @param {MemberIdDto} memberIdDto - Member ID key
   * @return {Promise<MemberResponseDto>}
   */
  @ApiOperation({ summary: 'Member info' })
  @Get(':id')
  getMemberById(@Param() memberIdDto: MemberIdDto): Promise<MemberResponseDto> {
    return this.memberService.getMemberById(memberIdDto);
  }

  /**
   * Update a member by ID key
   *
   * @param {MemberIdDto} memberIdDto - Member ID key
   * @param {UpdateMemberDto} updateMemberDto - Data required for the update
   * @return {Promise<UpdateMemberResponseDto>} - Update result
   */
  @ApiOperation({ summary: 'Update member' })
  @Patch(':id')
  updateMemberById(
    @Param() memberIdDto: MemberIdDto,
    @Body() updateMemberDto: UpdateMemberDto,
  ): Promise<UpdateMemberResponseDto> {
    return this.memberService.updateMemberById(memberIdDto, updateMemberDto);
  }

  /**
   * Change a member's role<br/>
   * Only a member with a verified email can become an administrator
   *
   * @param {MemberIdDto} memberIdDto - Member ID key
   * @param {UpdateMemberRoleDto} updateMemberRoleDto - New role
   * @param {AuthenticatedMember} requester
   * @return {Promise<UpdateMemberResponseDto>} - Update result
   */
  @ApiOperation({ summary: 'Change member role' })
  @Patch('/:id/role')
  updateMemberRoleById(
    @Param() memberIdDto: MemberIdDto,
    @Body() updateMemberRoleDto: UpdateMemberRoleDto,
    @CurrentMember() requester: AuthenticatedMember,
  ): Promise<UpdateMemberResponseDto> {
    return this.memberService.updateMemberRoleById(
      memberIdDto,
      updateMemberRoleDto,
      requester.id,
    );
  }

  /**
   * Delete a member by ID key<br/>
   * Only updates the deletedAt value
   *
   * @param {MemberIdDto} memberIdDto - Member ID key
   * @param {AuthenticatedMember} requester
   * @return {Promise<UpdateMemberResponseDto>} - Delete result
   */
  @ApiOperation({ summary: 'Delete member' })
  @Delete(':id')
  removeMemberById(
    @Param() memberIdDto: MemberIdDto,
    @CurrentMember() requester: AuthenticatedMember,
  ): Promise<UpdateMemberResponseDto> {
    return this.memberService.removeMemberById(memberIdDto, requester.id);
  }

  /**
   * Restore a deleted member<br/>
   * Updates deletedAt back to null
   *
   * @param {MemberIdDto} memberIdDto - Member ID key
   * @return {Promise<UpdateMemberResponseDto>}
   */
  @ApiOperation({ summary: 'Restore deleted member' })
  @Patch('/:id/restore')
  restoreMemberById(
    @Param() memberIdDto: MemberIdDto,
  ): Promise<UpdateMemberResponseDto> {
    return this.memberService.restoreMemberById(memberIdDto);
  }
}
