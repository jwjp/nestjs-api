import { Roles } from '../common/auth/auth.decorator';
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
} from '@nestjs/common';
import { BranchService } from './branch.service';
import {
  BranchIdDto,
  BranchListByAuthorityDto,
  GetBranchResponseDto,
  CreateBranchDto,
  CreateBranchResponseDto,
  UpdateBranchDto,
  UpdateBranchResponseDto,
  BranchListResponseDto,
} from './dto/branch.dto';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ResponseDto, ResponseErrorDto } from '../common/auth/response.dto';

@ApiTags('Branch')
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
@Controller('branch')
export class BranchController {
  constructor(private readonly branchService: BranchService) {}

  /**
   * Create a branch
   *
   * @param {CreateBranchDto} createBranchDto - Data required to create a branch
   * @return {Promise<CreateBranchResponseDto>} - The created branch info
   */
  @ApiOperation({ summary: 'Create a branch' })
  @Post()
  createbranch(
    @Body() createBranchDto: CreateBranchDto,
  ): Promise<CreateBranchResponseDto> {
    return this.branchService.createBranch(createBranchDto);
  }

  /**
   * Branches (excluding deleted)
   *
   * @return {Promise<GetBranchResponseDto>}
   */
  @ApiOperation({ summary: 'Branches (excluding deleted)' })
  @Get()
  getBranchNotDeleted(): Promise<GetBranchResponseDto> {
    return this.branchService.getBranchNotDeleted();
  }

  /**
   * Deleted branches
   *
   * @return {Promise<GetBranchResponseDto>}
   */
  @ApiOperation({ summary: 'Deleted branches' })
  @Get('/deleted')
  getBranchDeleted(): Promise<GetBranchResponseDto> {
    return this.branchService.getBranchDeleted();
  }

  /**
   * Update a branch by ID key
   *
   * @param {BranchIdDto} branchIdDto - Branch ID key
   * @param {UpdateBranchDto} updateBranchDto - Data required for the update
   * @return {Promise<UpdateBranchResponseDto>} - Update result
   */
  @ApiOperation({ summary: 'Update branch' })
  @Patch(':id')
  updateBranchById(
    @Param() branchIdDto: BranchIdDto,
    @Body() updateBranchDto: UpdateBranchDto,
  ): Promise<UpdateBranchResponseDto> {
    return this.branchService.updateBranchById(branchIdDto, updateBranchDto);
  }

  /**
   * Delete a branch by ID key<br/>
   * Only updates the deletedAt value
   *
   * @param {BranchIdDto} branchIdDto - Branch ID key
   * @return {Promise<UpdateBranchResponseDto>} - Delete result
   */
  @ApiOperation({ summary: 'Delete branch' })
  @Delete(':id')
  removeBranchById(
    @Param() branchIdDto: BranchIdDto,
  ): Promise<UpdateBranchResponseDto> {
    return this.branchService.removeBranchById(branchIdDto);
  }

  /**
   * Restore a deleted branch<br/>
   * Updates deletedAt back to null
   *
   * @param {BranchIdDto} branchIdDto - Branch ID key
   * @return {Promise<UpdateBranchResponseDto>}
   */
  @ApiOperation({ summary: 'Restore deleted branch' })
  @Patch('/:id/restore')
  restoreBranchById(
    @Param() branchIdDto: BranchIdDto,
  ): Promise<UpdateBranchResponseDto> {
    return this.branchService.restoreBranchById(branchIdDto);
  }

  /**
   * Branch authority for the given member
   *
   * @param {BranchListByAuthorityDto} branchListByAuthorityDto - Data required to fetch a member's authorized branches
   * @return {Promise<BranchListResponseDto>}
   */
  @ApiOperation({ summary: "The given member's branch authority" })
  @Post('/member')
  @HttpCode(HttpStatus.OK)
  getBranchListByAuthority(
    @Body() branchListByAuthorityDto: BranchListByAuthorityDto,
  ): Promise<BranchListResponseDto> {
    return this.branchService.getBranchListByAuthority(
      branchListByAuthorityDto,
    );
  }
}
