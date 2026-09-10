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
   * Create a menu
   *
   * @param {CreateMenuDto} createMenuDto - Data required to create a menu
   * @return {Promise<CreateMenuResponseDto>} - The created menu info
   */
  async createMenu(
    createMenuDto: CreateMenuDto,
  ): Promise<CreateMenuResponseDto> {
    const menu: CreateMenuDto & Menu =
      await this.menuRepository.save(createMenuDto);

    // Build the DTO used for the Swagger docs
    const createMenuResponseDto: CreateMenuResponseDto =
      new CreateMenuResponseDto();
    createMenuResponseDto.message = menu;

    return createMenuResponseDto;
  }

  /**
   * Menus (excluding deleted)
   *
   * @return {Promise<GetMenuResponseDto>}
   */
  async getMenuNotDeleted(): Promise<GetMenuResponseDto> {
    const menu: Menu[] = await this.menuRepository.find({
      order: { seq: 'asc' },
      withDeleted: false,
    });

    // Build the DTO used for the Swagger docs
    const getMenuResponseDto: GetMenuResponseDto = new GetMenuResponseDto();
    getMenuResponseDto.message = menu;

    return getMenuResponseDto;
  }

  /**
   * Deleted menus
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

    // Build the DTO used for the Swagger docs
    const getMenuResponseDto: GetMenuResponseDto = new GetMenuResponseDto();
    getMenuResponseDto.message = menu;

    return getMenuResponseDto;
  }

  /**
   * Update a menu by ID key
   *
   * @param {MenuIdDto} menuIdDto - Menu ID key
   * @param {UpdateMenuDto} updateMenuDto - Data required for the update
   * @return {Promise<UpdateMenuResponseDto>} - Update result
   */
  async updateMenuById(
    menuIdDto: MenuIdDto,
    updateMenuDto: UpdateMenuDto,
  ): Promise<UpdateMenuResponseDto> {
    // Throw an error if no update data was provided
    if (Object.keys(updateMenuDto).length === 0) {
      throw new BadRequestException({
        message: '요청 데이터가 없습니다.',
      });
    }

    // Look up the menu
    const menu: Menu = await this.menuRepository.findOneBy({
      id: menuIdDto.id,
    });

    // Throw an error if the menu does not exist
    if (menu === null) {
      throw new BadRequestException({
        message: '메뉴가 존재하지 않습니다.',
      });
    }

    // Update by ID key
    const result: UpdateResult = await this.menuRepository.update(
      { id: menuIdDto.id },
      { ...updateMenuDto },
    );

    // Build the DTO used for the Swagger docs
    const updateMenuResponseDto: UpdateMenuResponseDto =
      new UpdateMenuResponseDto();
    updateMenuResponseDto.message = { affectedRows: result.affected };

    return updateMenuResponseDto;
  }

  /**
   * Delete a menu by ID key<br/>
   * Only updates the deletedAt value
   *
   * @param {MenuIdDto} menuIdDto - Menu ID key
   * @return {Promise<UpdateMenuResponseDto>} - Delete result
   */
  async removeMenuById(menuIdDto: MenuIdDto): Promise<UpdateMenuResponseDto> {
    // Look up the menu
    const menu: Menu = await this.menuRepository.findOneBy({
      id: menuIdDto.id,
    });

    // Throw an error if the menu does not exist
    if (menu === null) {
      throw new BadRequestException({
        message: '메뉴가 존재하지 않습니다.',
      });
    }

    // Delete the menu by ID key
    const result: UpdateResult = await this.menuRepository.softDelete(
      menuIdDto.id,
    );

    // Build the DTO used for the Swagger docs
    const updateMenuResponseDto: UpdateMenuResponseDto =
      new UpdateMenuResponseDto();
    updateMenuResponseDto.message = { affectedRows: result.affected };

    return updateMenuResponseDto;
  }

  /**
   * Restore a deleted menu<br/>
   * Updates deletedAt back to null
   *
   * @param {MenuIdDto} menuIdDto - Menu ID key
   * @return {Promise<UpdateMenuResponseDto>}
   */
  async restoreMenuById(menuIdDto: MenuIdDto): Promise<UpdateMenuResponseDto> {
    // Look up the deleted menu
    const menu: Menu = await this.menuRepository.findOne({
      where: {
        id: menuIdDto.id,
        deletedAt: Not(IsNull()),
      },
      withDeleted: true,
    });

    // Throw an error if the menu does not exist
    if (menu === null) {
      throw new BadRequestException({
        message: '메뉴가 존재하지 않습니다.',
      });
    }

    // Restore the deleted menu
    const result: UpdateResult = await this.menuRepository.restore({
      id: menuIdDto.id,
    });

    // Build the DTO used for the Swagger docs
    const updateMenuResponseDto: UpdateMenuResponseDto =
      new UpdateMenuResponseDto();
    updateMenuResponseDto.message = { affectedRows: result.affected };

    return updateMenuResponseDto;
  }

  /**
   * Menu authority for the given member
   *
   * @param {MenuListByAuthorityDto} menuListByAuthorityDto - Data required to fetch a member's authorized menus
   * @return {Promise<MenuListResponseDto>}
   */
  async getMenuListByAuthority(
    menuListByAuthorityDto: MenuListByAuthorityDto,
  ): Promise<MenuListResponseDto> {
    // List of menus the member has authority over
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

    // Remove fields we don't want to keep around
    menu.filter((item: Menu) => {
      return delete item?.deletedAt;
    });

    // Build the DTO used for the Swagger docs
    const menuListResponseDto: MenuListResponseDto = new MenuListResponseDto();
    menuListResponseDto.message = menu;

    return menuListResponseDto;
  }
}
