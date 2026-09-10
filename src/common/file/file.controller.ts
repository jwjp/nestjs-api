import { ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FileService } from './file.service';
import { Public } from '../auth/auth.decorator';
import { FilesInterceptor } from '@nestjs/platform-express';
import {
  GetS3FileByBranchId,
  GetS3FileByFileId,
  S3FileListPageDto,
  UploadS3FilesDto,
} from './dto/file.dto';

@ApiTags('Files')
@Public()
@Controller('files')
export class FileController {
  constructor(private readonly fileService: FileService) {}

  /**
   * S3 file upload
   *
   * @param {UploadS3FilesDto} uploadS3FilesDto
   * @param {Array<Express.Multer.File>} files
   */
  @ApiOperation({ summary: 'S3 file upload' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FilesInterceptor('files', 10, {
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  )
  @Post('/s3')
  async s3UploadFiles(
    @Body() uploadS3FilesDto: UploadS3FilesDto,
    @UploadedFiles() files: Array<Express.Multer.File>,
  ) {
    uploadS3FilesDto.files = files;
    return await this.fileService.s3UploadFiles(uploadS3FilesDto);
  }

  @Get()
  async getS3FileListPerPage(@Query() s3FileListPageDto: S3FileListPageDto) {
    return await this.fileService.getS3FileListPerPage(s3FileListPageDto);
  }

  @Get(':id')
  async getS3FileByUniqueKey(
    @Query() getS3FileByBranchId: GetS3FileByBranchId,
    @Param() getS3FileByFileId: GetS3FileByFileId,
  ) {
    return await this.fileService.getS3FileByUniqueKey(
      getS3FileByBranchId,
      getS3FileByFileId,
    );
  }

  @Get(':id')
  async getFileById() {}
}
