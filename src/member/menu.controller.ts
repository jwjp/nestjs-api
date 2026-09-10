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
import { MenuService } from './menu.service';
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
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ResponseDto, ResponseErrorDto } from '../common/auth/response.dto';

@ApiTags('Menu')
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
@Controller('menu')
export class MenuController {
  constructor(private readonly menuService: MenuService) {}

  /**
   * Create a menu
   *
   * @param {CreateMenuDto} createMenuDto - Data required to create a menu
   * @return {Promise<CreateMenuResponseDto>} - The created menu info
   */
  @ApiOperation({ summary: 'Create a menu' })
  @Post()
  createMenu(
    @Body() createMenuDto: CreateMenuDto,
  ): Promise<CreateMenuResponseDto> {
    return this.menuService.createMenu(createMenuDto);
  }

  /**
   * Menus (excluding deleted)
   *
   * @return {Promise<GetMenuResponseDto>}
   */
  @ApiOperation({ summary: 'Menus (excluding deleted)' })
  @Get()
  getMenuNotDeleted(): Promise<GetMenuResponseDto> {
    return this.menuService.getMenuNotDeleted();
  }

  /**
   * Deleted menus
   *
   * @return {Promise<GetMenuResponseDto>}
   */
  @ApiOperation({ summary: 'Deleted menus' })
  @Get('/deleted')
  getMenuDeleted(): Promise<GetMenuResponseDto> {
    return this.menuService.getMenuDeleted();
  }

  /**
   * Update a menu by ID key
   *
   * @param {MenuIdDto} menuIdDto - Menu ID key
   * @param {UpdateMenuDto} updateMenuDto - Data required for the update
   * @return {Promise<UpdateMenuResponseDto>} - Update result
   */
  @ApiOperation({ summary: 'Update menu' })
  @Patch(':id')
  updateMenuById(
    @Param() menuIdDto: MenuIdDto,
    @Body() updateMenuDto: UpdateMenuDto,
  ): Promise<UpdateMenuResponseDto> {
    return this.menuService.updateMenuById(menuIdDto, updateMenuDto);
  }

  /**
   * Delete a menu by ID key<br/>
   * Only updates the deletedAt value
   *
   * @param {MenuIdDto} menuIdDto - Menu ID key
   * @return {Promise<UpdateMenuResponseDto>} - Delete result
   */
  @ApiOperation({ summary: 'Delete menu' })
  @Delete(':id')
  removeMenuById(
    @Param() menuIdDto: MenuIdDto,
  ): Promise<UpdateMenuResponseDto> {
    return this.menuService.removeMenuById(menuIdDto);
  }

  /**
   * Restore a deleted menu<br/>
   * Updates deletedAt back to null
   *
   * @param {MenuIdDto} menuIdDto - Menu ID key
   * @return {Promise<UpdateMenuResponseDto>}
   */
  @ApiOperation({ summary: 'Restore deleted menu' })
  @Patch('/:id/restore')
  restoreMenuById(
    @Param() menuIdDto: MenuIdDto,
  ): Promise<UpdateMenuResponseDto> {
    return this.menuService.restoreMenuById(menuIdDto);
  }

  /**
   * Menu authority for the given member
   *
   * @param {MenuListByAuthorityDto} menuListByAuthorityDto - Data required to fetch a member's authorized menus
   * @return {Promise<MenuListResponseDto>}
   */
  @ApiOperation({ summary: "The given member's menu authority" })
  @Post('/member')
  @HttpCode(HttpStatus.OK)
  getMenuListByAuthority(
    @Body() menuListByAuthorityDto: MenuListByAuthorityDto,
  ): Promise<MenuListResponseDto> {
    return this.menuService.getMenuListByAuthority(menuListByAuthorityDto);
  }
}
