import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Branch } from './entities/branch.entity';
import { IsNull, Not, Repository, UpdateResult } from 'typeorm';
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

@Injectable()
export class BranchService {
  constructor(
    @InjectRepository(Branch)
    private branchRepository: Repository<Branch>,
  ) {}

  /**
   * Create a branch
   *
   * @param {CreateBranchDto} createBranchDto - Data required to create a branch
   * @return {Promise<CreateBranchResponseDto>} - The created branch info
   */
  async createBranch(
    createBranchDto: CreateBranchDto,
  ): Promise<CreateBranchResponseDto> {
    const branch: CreateBranchDto & Branch =
      await this.branchRepository.save(createBranchDto);

    // Build the DTO used for the Swagger docs
    const createBranchResponseDto: CreateBranchResponseDto =
      new CreateBranchResponseDto();
    createBranchResponseDto.message = branch;

    return createBranchResponseDto;
  }

  /**
   * Check whether a branch exists by ID key
   *
   * @param {BranchIdDto} branchIdDto
   * @return {Promise<boolean>}
   */
  async isBranchExists(branchIdDto: BranchIdDto): Promise<boolean> {
    const count: number = await this.branchRepository.count({
      where: { id: branchIdDto.id },
      withDeleted: false,
    });

    return !!count;
  }

  /**
   * Branches (excluding deleted)
   *
   * @return {Promise<GetBranchResponseDto>}
   */
  async getBranchNotDeleted(): Promise<GetBranchResponseDto> {
    const branch: Branch[] = await this.branchRepository.find({
      order: { seq: 'asc' },
      withDeleted: false,
    });

    // Build the DTO used for the Swagger docs
    const getBranchResponseDto: GetBranchResponseDto =
      new GetBranchResponseDto();
    getBranchResponseDto.message = branch;

    return getBranchResponseDto;
  }

  /**
   * Deleted branches
   *
   * @return {Promise<GetBranchResponseDto>}
   */
  async getBranchDeleted(): Promise<GetBranchResponseDto> {
    const branch: Branch[] = await this.branchRepository.find({
      where: {
        deletedAt: Not(IsNull()),
      },
      order: { seq: 'asc' },
      withDeleted: true,
    });

    // Build the DTO used for the Swagger docs
    const getBranchResponseDto: GetBranchResponseDto =
      new GetBranchResponseDto();
    getBranchResponseDto.message = branch;

    return getBranchResponseDto;
  }

  /**
   * Update a branch by ID key
   *
   * @param {BranchIdDto} branchIdDto - Branch ID key
   * @param {UpdateBranchDto} updateBranchDto - Data required for the update
   * @return {Promise<UpdateBranchResponseDto>} - Update result
   */
  async updateBranchById(
    branchIdDto: BranchIdDto,
    updateBranchDto: UpdateBranchDto,
  ): Promise<UpdateBranchResponseDto> {
    // Throw an error if no update data was provided
    if (Object.keys(updateBranchDto).length === 0) {
      throw new BadRequestException({
        message: '요청 데이터가 없습니다.',
      });
    }

    // Look up the branch
    const branch: Branch = await this.branchRepository.findOneBy({
      id: branchIdDto.id,
    });

    // Throw an error if the branch does not exist
    if (branch === null) {
      throw new BadRequestException({
        message: '지점이 존재하지 않습니다.',
      });
    }

    // Update by ID key
    const result: UpdateResult = await this.branchRepository.update(
      { id: branchIdDto.id },
      { ...updateBranchDto },
    );

    // Build the DTO used for the Swagger docs
    const updateBranchResponseDto: UpdateBranchResponseDto =
      new UpdateBranchResponseDto();
    updateBranchResponseDto.message = { affectedRows: result.affected };

    return updateBranchResponseDto;
  }

  /**
   * Delete a branch by ID key<br/>
   * Only updates the deletedAt value
   *
   * @param {BranchIdDto} branchIdDto - Branch ID key
   * @return {Promise<UpdateBranchResponseDto>} - Delete result
   */
  async removeBranchById(
    branchIdDto: BranchIdDto,
  ): Promise<UpdateBranchResponseDto> {
    // Look up the branch
    const branch: Branch = await this.branchRepository.findOneBy({
      id: branchIdDto.id,
    });

    // Throw an error if the branch does not exist
    if (branch === null) {
      throw new BadRequestException({
        message: '지점이 존재하지 않습니다.',
      });
    }

    // Delete the branch by ID key
    const result: UpdateResult = await this.branchRepository.softDelete(
      branchIdDto.id,
    );

    // Build the DTO used for the Swagger docs
    const updateBranchResponseDto: UpdateBranchResponseDto =
      new UpdateBranchResponseDto();
    updateBranchResponseDto.message = { affectedRows: result.affected };

    return updateBranchResponseDto;
  }

  /**
   * Restore a deleted branch<br/>
   * Updates deletedAt back to null
   *
   * @param {BranchIdDto} branchIdDto - Branch ID key
   * @return {Promise<UpdateBranchResponseDto>}
   */
  async restoreBranchById(
    branchIdDto: BranchIdDto,
  ): Promise<UpdateBranchResponseDto> {
    // Look up the deleted branch
    const branch: Branch = await this.branchRepository.findOne({
      where: {
        id: branchIdDto.id,
        deletedAt: Not(IsNull()),
      },
      withDeleted: true,
    });

    // Throw an error if the branch does not exist
    if (branch === null) {
      throw new BadRequestException({
        message: '지점이 존재하지 않습니다.',
      });
    }

    // Restore the deleted branch
    const result: UpdateResult = await this.branchRepository.restore({
      id: branchIdDto.id,
    });

    // Build the DTO used for the Swagger docs
    const updateBranchResponseDto: UpdateBranchResponseDto =
      new UpdateBranchResponseDto();
    updateBranchResponseDto.message = { affectedRows: result.affected };

    return updateBranchResponseDto;
  }

  /**
   * Branch authority for the given member
   *
   * @param {BranchListByAuthorityDto} branchListByAuthorityDto - Data required to fetch a member's authorized branches
   * @return {Promise<BranchListResponseDto>}
   */
  async getBranchListByAuthority(
    branchListByAuthorityDto: BranchListByAuthorityDto,
  ): Promise<BranchListResponseDto> {
    // List of branches the member has authority over
    const branch: Branch[] = await this.branchRepository.find({
      select: {
        id: true,
        name: true,
        title: true,
        url: true,
        seq: true,
        isShow: true,
        deletedAt: false,
        authority: { id: false },
      },
      where: {
        authority: {
          memberId: branchListByAuthorityDto.memberId,
        },
      },
      relations: { authority: true },
      order: {
        seq: 'asc',
      },
    });

    // Remove fields we don't want to keep around
    branch.filter((item: Branch) => {
      return delete item?.deletedAt;
    });

    // Build the DTO used for the Swagger docs
    const branchListResponseDto: BranchListResponseDto =
      new BranchListResponseDto();
    branchListResponseDto.message = branch;

    return branchListResponseDto;
  }
}
