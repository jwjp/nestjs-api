import { ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UnsupportedMediaTypeException,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import {
  AuthenticatedMember,
  CurrentMember,
  Roles,
} from '../auth/auth.decorator';
import { FileService } from './file.service';
import { decodeOriginalName, isAllowedUpload } from './allowed-mime.array';
import {
  FileDetailResponseDto,
  FileIdDto,
  FileListResponseDto,
  S3FileListPageDto,
  UploadS3FilesDto,
  UploadS3FilesResponse,
} from './dto/file.dto';

const MAX_ORIGINAL_NAME_LENGTH = 255;

/**
 * Regular members only reach the branches they were granted
 */
@ApiTags('Files')
@Roles('admin', 'user')
@Controller('files')
export class FileController {
  constructor(private readonly fileService: FileService) {}

  /**
   * S3 file upload
   *
   * @param {UploadS3FilesDto} uploadS3FilesDto
   * @param {Array<Express.Multer.File>} files
   * @param {AuthenticatedMember} member
   */
  @ApiOperation({ summary: 'S3 file upload' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FilesInterceptor('files', 10, {
      limits: { fileSize: 10 * 1024 * 1024 },
      fileFilter: (req, file, callback) => {
        const originalname = decodeOriginalName(file.originalname);
        if (
          originalname.length > MAX_ORIGINAL_NAME_LENGTH ||
          !isAllowedUpload(file.mimetype, originalname)
        ) {
          return callback(
            new UnsupportedMediaTypeException('File type not allowed'),
            false,
          );
        }
        callback(null, true);
      },
    }),
  )
  @Post('/s3')
  async s3UploadFiles(
    @Body() uploadS3FilesDto: UploadS3FilesDto,
    @UploadedFiles() files: Array<Express.Multer.File>,
    @CurrentMember() member: AuthenticatedMember,
  ): Promise<UploadS3FilesResponse> {
    uploadS3FilesDto.files = files;
    return await this.fileService.s3UploadFiles(uploadS3FilesDto, member);
  }

  /**
   * Paginated files of a branch
   */
  @ApiOperation({ summary: 'File list' })
  @Get()
  getS3FileListPerPage(
    @Query() s3FileListPageDto: S3FileListPageDto,
    @CurrentMember() member: AuthenticatedMember,
  ): Promise<FileListResponseDto> {
    return this.fileService.getS3FileListPerPage(s3FileListPageDto, member);
  }

  /**
   * File details with a download link valid for 5 minutes
   */
  @ApiOperation({ summary: 'File details' })
  @Get(':id')
  getFile(
    @Param() fileIdDto: FileIdDto,
    @CurrentMember() member: AuthenticatedMember,
  ): Promise<FileDetailResponseDto> {
    return this.fileService.getFile(fileIdDto, member);
  }

  /**
   * Delete a file
   */
  @ApiOperation({ summary: 'Delete a file' })
  @Delete(':id')
  removeFile(
    @Param() fileIdDto: FileIdDto,
    @CurrentMember() member: AuthenticatedMember,
  ): Promise<{ affectedRows: number }> {
    return this.fileService.removeFile(fileIdDto, member);
  }
}
