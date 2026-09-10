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
   * 지점 생성
   *
   * @param {CreateBranchDto} createBranchDto - 지점 생성에 필요한 데이터
   * @return {Promise<CreateBranchResponseDto>} - 생성한 지점 정보
   */
  async createBranch(
    createBranchDto: CreateBranchDto,
  ): Promise<CreateBranchResponseDto> {
    const branch: CreateBranchDto & Branch =
      await this.branchRepository.save(createBranchDto);

    // Swagger 문서 적용을 위한 DTO 생성
    const createBranchResponseDto: CreateBranchResponseDto =
      new CreateBranchResponseDto();
    createBranchResponseDto.message = branch;

    return createBranchResponseDto;
  }

  /**
   * ID 키 값을 이용한 지점 존재유무 검색
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
   * 지점 (삭제 제외)
   *
   * @return {Promise<GetBranchResponseDto>}
   */
  async getBranchNotDeleted(): Promise<GetBranchResponseDto> {
    const branch: Branch[] = await this.branchRepository.find({
      order: { seq: 'asc' },
      withDeleted: false,
    });

    // Swagger 문서 적용을 위한 DTO 생성
    const getBranchResponseDto: GetBranchResponseDto =
      new GetBranchResponseDto();
    getBranchResponseDto.message = branch;

    return getBranchResponseDto;
  }

  /**
   * 삭제 지점
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

    // Swagger 문서 적용을 위한 DTO 생성
    const getBranchResponseDto: GetBranchResponseDto =
      new GetBranchResponseDto();
    getBranchResponseDto.message = branch;

    return getBranchResponseDto;
  }

  /**
   * ID 키 값을 이용한 지점 업데이트
   *
   * @param {BranchIdDto} branchIdDto - 지점 ID 키 값
   * @param {UpdateBranchDto} updateBranchDto - 업데이트에 필요한 데이터
   * @return {Promise<UpdateBranchResponseDto>} - 업데이트 결과
   */
  async updateBranchById(
    branchIdDto: BranchIdDto,
    updateBranchDto: UpdateBranchDto,
  ): Promise<UpdateBranchResponseDto> {
    // 업데이트 데이터가 넘어오지 않으면 예외처리
    if (Object.keys(updateBranchDto).length === 0) {
      throw new BadRequestException({
        message: '요청 데이터가 없습니다.',
      });
    }

    // 지점 검색
    const branch: Branch = await this.branchRepository.findOneBy({
      id: branchIdDto.id,
    });

    // 지점이 없는 경우 예외처리
    if (branch === null) {
      throw new BadRequestException({
        message: '지점이 존재하지 않습니다.',
      });
    }

    // ID 키 값을 이용한 업데이트
    const result: UpdateResult = await this.branchRepository.update(
      { id: branchIdDto.id },
      { ...updateBranchDto },
    );

    // Swagger 문서 적용을 위한 DTO 생성
    const updateBranchResponseDto: UpdateBranchResponseDto =
      new UpdateBranchResponseDto();
    updateBranchResponseDto.message = { affectedRows: result.affected };

    return updateBranchResponseDto;
  }

  /**
   * ID 키 값을 이용한 지점 정보 삭제<br/>
   * deletedAt 값만 업데이트
   *
   * @param {BranchIdDto} branchIdDto - 지점 ID 키 값
   * @return {Promise<UpdateBranchResponseDto>} - 삭제 결과
   */
  async removeBranchById(
    branchIdDto: BranchIdDto,
  ): Promise<UpdateBranchResponseDto> {
    // 지점 검색
    const branch: Branch = await this.branchRepository.findOneBy({
      id: branchIdDto.id,
    });

    // 지점이 없는 경우 예외처리
    if (branch === null) {
      throw new BadRequestException({
        message: '지점이 존재하지 않습니다.',
      });
    }

    // ID 키 값을 이용한 지점 삭제
    const result: UpdateResult = await this.branchRepository.softDelete(
      branchIdDto.id,
    );

    // Swagger 문서 적용을 위한 DTO 생성
    const updateBranchResponseDto: UpdateBranchResponseDto =
      new UpdateBranchResponseDto();
    updateBranchResponseDto.message = { affectedRows: result.affected };

    return updateBranchResponseDto;
  }

  /**
   * 삭제 지점 복구<br/>
   * deletedAt 값을 null 값으로 업데이트
   *
   * @param {BranchIdDto} branchIdDto - 지점 ID 키 값
   * @return {Promise<UpdateBranchResponseDto>}
   */
  async restoreBranchById(
    branchIdDto: BranchIdDto,
  ): Promise<UpdateBranchResponseDto> {
    // 삭제 된 지점 검색
    const branch: Branch = await this.branchRepository.findOne({
      where: {
        id: branchIdDto.id,
        deletedAt: Not(IsNull()),
      },
      withDeleted: true,
    });

    // 지점이 없는 경우 예외처리
    if (branch === null) {
      throw new BadRequestException({
        message: '지점이 존재하지 않습니다.',
      });
    }

    // 삭제 된 지점 복구
    const result: UpdateResult = await this.branchRepository.restore({
      id: branchIdDto.id,
    });

    // Swagger 문서 적용을 위한 DTO 생성
    const updateBranchResponseDto: UpdateBranchResponseDto =
      new UpdateBranchResponseDto();
    updateBranchResponseDto.message = { affectedRows: result.affected };

    return updateBranchResponseDto;
  }

  /**
   * 해당 멤버의 지점 권한
   *
   * @param {BranchListByAuthorityDto} branchListByAuthorityDto - 멤버의 권한 지점을 가져오는 데 필요한 데이터
   * @return {Promise<BranchListResponseDto>}
   */
  async getBranchListByAuthority(
    branchListByAuthorityDto: BranchListByAuthorityDto,
  ): Promise<BranchListResponseDto> {
    // 권한 있는 지점 리스트
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

    // 불필요한 객체 삭제
    branch.filter((item: Branch) => {
      return delete item?.deletedAt;
    });

    // Swagger 문서 적용을 위한 DTO 생성
    const branchListResponseDto: BranchListResponseDto =
      new BranchListResponseDto();
    branchListResponseDto.message = branch;

    return branchListResponseDto;
  }
}
