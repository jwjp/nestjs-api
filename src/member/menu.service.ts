import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Not, Repository, UpdateResult } from 'typeorm';
import { Menu } from './entities/menu.entity';
import {
  CreateMenuDto,
  CreateMenuResponseDto,
  GetMenuResponseDto,
  MenuIdDto,
  MenuListByAuthorityDto,
  MenuListResponseDto,
  UpdateMenuDto,
  UpdateMenuResponseDto,
} from './dto/menu.dto';

@Injectable()
export class MenuService {
  constructor(
    @InjectRepository(Menu)
    private menuRepository: Repository<Menu>,
  ) {}

  /**
   * 메뉴 생성
   *
   * @param {CreateMenuDto} createMenuDto - 메뉴 생성에 필요한 데이터
   * @return {Promise<CreateMenuResponseDto>} - 생성한 메뉴 정보
   */
  async createMenu(
    createMenuDto: CreateMenuDto,
  ): Promise<CreateMenuResponseDto> {
    const menu: CreateMenuDto & Menu =
      await this.menuRepository.save(createMenuDto);

    // Swagger 문서 적용을 위한 DTO 생성
    const createMenuResponseDto: CreateMenuResponseDto =
      new CreateMenuResponseDto();
    createMenuResponseDto.message = menu;

    return createMenuResponseDto;
  }

  /**
   * 메뉴 (삭제 제외)
   *
   * @return {Promise<GetMenuResponseDto>}
   */
  async getMenuNotDeleted(): Promise<GetMenuResponseDto> {
    const menu: Menu[] = await this.menuRepository.find({
      order: { seq: 'asc' },
      withDeleted: false,
    });

    // Swagger 문서 적용을 위한 DTO 생성
    const getMenuResponseDto: GetMenuResponseDto = new GetMenuResponseDto();
    getMenuResponseDto.message = menu;

    return getMenuResponseDto;
  }

  /**
   * 삭제 된 메뉴
   *
   * @return {Promise<GetMenuResponseDto>}
   */
  async getMenuDeleted(): Promise<GetMenuResponseDto> {
    const menu: Menu[] = await this.menuRepository.find({
      where: {
        deletedAt: Not(IsNull()),
      },
      order: { seq: 'asc' },
      withDeleted: true,
    });

    // Swagger 문서 적용을 위한 DTO 생성
    const getMenuResponseDto: GetMenuResponseDto = new GetMenuResponseDto();
    getMenuResponseDto.message = menu;

    return getMenuResponseDto;
  }

  /**
   * ID 키 값을 이용한 메뉴 업데이트
   *
   * @param {MenuIdDto} menuIdDto - 메뉴 ID 키 값
   * @param {UpdateMenuDto} updateMenuDto - 업데이트에 필요한 데이터
   * @return {Promise<UpdateMenuResponseDto>} - 업데이트 결과
   */
  async updateMenuById(
    menuIdDto: MenuIdDto,
    updateMenuDto: UpdateMenuDto,
  ): Promise<UpdateMenuResponseDto> {
    // 업데이트 데이터가 넘어오지 않으면 예외처리
    if (Object.keys(updateMenuDto).length === 0) {
      throw new BadRequestException({
        message: '요청 데이터가 없습니다.',
      });
    }

    // 메뉴 검색
    const menu: Menu = await this.menuRepository.findOneBy({
      id: menuIdDto.id,
    });

    // 메뉴가 없는 경우 예외처리
    if (menu === null) {
      throw new BadRequestException({
        message: '메뉴가 존재하지 않습니다.',
      });
    }

    // ID 키 값을 이용한 업데이트
    const result: UpdateResult = await this.menuRepository.update(
      { id: menuIdDto.id },
      { ...updateMenuDto },
    );

    // Swagger 문서 적용을 위한 DTO 생성
    const updateMenuResponseDto: UpdateMenuResponseDto =
      new UpdateMenuResponseDto();
    updateMenuResponseDto.message = { affectedRows: result.affected };

    return updateMenuResponseDto;
  }

  /**
   * ID 키 값을 이용한 메뉴 삭제<br/>
   * deletedAt 값만 업데이트
   *
   * @param {MenuIdDto} menuIdDto - 메뉴 ID 키 값
   * @return {Promise<UpdateMenuResponseDto>} - 삭제 결과
   */
  async removeMenuById(menuIdDto: MenuIdDto): Promise<UpdateMenuResponseDto> {
    // 메뉴 검색
    const menu: Menu = await this.menuRepository.findOneBy({
      id: menuIdDto.id,
    });

    // 메뉴가 없는 경우 예외처리
    if (menu === null) {
      throw new BadRequestException({
        message: '메뉴가 존재하지 않습니다.',
      });
    }

    // ID 키 값을 이용한 메뉴 삭제
    const result: UpdateResult = await this.menuRepository.softDelete(
      menuIdDto.id,
    );

    // Swagger 문서 적용을 위한 DTO 생성
    const updateMenuResponseDto: UpdateMenuResponseDto =
      new UpdateMenuResponseDto();
    updateMenuResponseDto.message = { affectedRows: result.affected };

    return updateMenuResponseDto;
  }

  /**
   * 삭제 메뉴 복구<br/>
   * deletedAt 값을 null 값으로 업데이트
   *
   * @param {MenuIdDto} menuIdDto - 메뉴 ID 키 값
   * @return {Promise<UpdateMenuResponseDto>}
   */
  async restoreMenuById(menuIdDto: MenuIdDto): Promise<UpdateMenuResponseDto> {
    // 삭제 된 메뉴 검색
    const menu: Menu = await this.menuRepository.findOne({
      where: {
        id: menuIdDto.id,
        deletedAt: Not(IsNull()),
      },
      withDeleted: true,
    });

    // 메뉴가 없는 경우 예외처리
    if (menu === null) {
      throw new BadRequestException({
        message: '메뉴가 존재하지 않습니다.',
      });
    }

    // 삭제 된 메뉴 복구
    const result: UpdateResult = await this.menuRepository.restore({
      id: menuIdDto.id,
    });

    // Swagger 문서 적용을 위한 DTO 생성
    const updateMenuResponseDto: UpdateMenuResponseDto =
      new UpdateMenuResponseDto();
    updateMenuResponseDto.message = { affectedRows: result.affected };

    return updateMenuResponseDto;
  }

  /**
   * 해당 멤버의 메뉴 권한
   *
   * @param {MenuListByAuthorityDto} menuListByAuthorityDto - 멤버의 권한 메뉴를 가져오는 데 필요한 데이터
   * @return {Promise<MenuListResponseDto>}
   */
  async getMenuListByAuthority(
    menuListByAuthorityDto: MenuListByAuthorityDto,
  ): Promise<MenuListResponseDto> {
    // 권한이 있는 메뉴 리스트
    const menu: Menu[] = await this.menuRepository.find({
      select: {
        id: true,
        title: true,
        link: true,
        seq: true,
        deletedAt: false,
        authority: { id: false },
      },
      where: {
        authority: {
          memberId: menuListByAuthorityDto.memberId,
          branchId: menuListByAuthorityDto.branchId,
        },
      },
      relations: { authority: true },
      order: {
        seq: 'asc',
      },
    });

    // 불필요한 객체 삭제
    menu.filter((item: Menu) => {
      return delete item?.deletedAt;
    });

    // Swagger 문서 적용을 위한 DTO 생성
    const menuListResponseDto: MenuListResponseDto = new MenuListResponseDto();
    menuListResponseDto.message = menu;

    return menuListResponseDto;
  }
}
