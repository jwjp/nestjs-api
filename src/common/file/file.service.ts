import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { extname } from 'path';
import { Repository } from 'typeorm';
import { AuthenticatedMember } from '../auth/auth.decorator';
import { AuthorityService } from '../../member/authority.service';
import { BranchService } from '../../member/branch.service';
import { decodeOriginalName } from './allowed-mime.array';
import {
  FileDetailResponseDto,
  FileIdDto,
  FileListResponseDto,
  S3FileListPageDto,
  UploadS3FilesDto,
  UploadS3FilesResponse,
  UploadS3ResultDto,
} from './dto/file.dto';
import { File } from './entities/file.entity';
import { FileStorageEnum } from './file.enum';
import { S3Service } from './s3.service';

@Injectable()
export class FileService {
  private readonly logger = new Logger(FileService.name);

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(File) private fileRepository: Repository<File>,
    private readonly branchService: BranchService,
    private readonly authorityService: AuthorityService,
    private readonly s3Service: S3Service,
  ) {}

  /**
   * Upload files to S3 and record the ones that succeeded
   */
  async s3UploadFiles(
    uploadS3FilesDto: UploadS3FilesDto,
    member: AuthenticatedMember,
  ): Promise<UploadS3FilesResponse> {
    const { branchId, files } = uploadS3FilesDto;

    await this.authorityService.assertBranchAccess(member, branchId);

    if (!(await this.branchService.isBranchExists({ id: branchId }))) {
      throw new BadRequestException({
        message: '지점이 삭제되었거나 존재하지 않습니다.',
      });
    }

    if (!files?.length) {
      throw new BadRequestException({
        message: '업로드할 파일이 없습니다.',
      });
    }

    const bucket = this.configService.get<string>('AWS_S3_BUCKET');
    const region = this.configService.get<string>('AWS_S3_REGION');
    const uploadPath = this.configService.get<string>('UPLOAD_S3_PATH');

    const uploads = files.map((file) => {
      const originalname = decodeOriginalName(file.originalname);
      const filename = randomUUID() + extname(originalname).toLowerCase();
      const key = `${uploadPath}/${branchId}/${filename}`;

      return {
        key,
        row: {
          branchId,
          originalname,
          filename,
          mimetype: file.mimetype,
          size: file.size,
          storage: FileStorageEnum.s3,
          path: key,
          url: `https://${bucket}.s3.${region}.amazonaws.com/${key}`,
        },
        body: file.buffer,
      };
    });

    const settled = await Promise.allSettled(
      uploads.map(({ key, row, body }) =>
        this.s3Service.putObjectFiles({
          Bucket: bucket,
          Key: key,
          Body: body,
          ContentType: row.mimetype,
        }),
      ),
    );

    const results: UploadS3ResultDto[] = settled.map((outcome, index) => {
      if (outcome.status === 'rejected') {
        this.logger.error(
          `S3 upload failed: ${uploads[index].key}`,
          outcome.reason?.stack,
        );
      }
      return outcome.status === 'fulfilled'
        ? { url: uploads[index].row.url, result: true }
        : { url: '', result: false };
    });

    await this.fileRepository.save(
      uploads
        .filter((_, index) => settled[index].status === 'fulfilled')
        .map(({ row }) => row),
    );

    const uploadS3FilesResponse = new UploadS3FilesResponse();
    uploadS3FilesResponse.message = results;

    return uploadS3FilesResponse;
  }

  /**
   * Paginated files of a branch
   */
  async getS3FileListPerPage(
    s3FileListPageDto: S3FileListPageDto,
    member: AuthenticatedMember,
  ): Promise<FileListResponseDto> {
    const { branch, page, perPage } = s3FileListPageDto;

    await this.authorityService.assertBranchAccess(member, branch);

    const fileListResponseDto = new FileListResponseDto();
    fileListResponseDto.message = await this.fileRepository.find({
      where: { branchId: branch },
      order: { id: 'DESC' },
      skip: perPage * (page - 1),
      take: perPage,
    });

    return fileListResponseDto;
  }

  /**
   * File details with a short-lived download link
   */
  async getFile(
    fileIdDto: FileIdDto,
    member: AuthenticatedMember,
  ): Promise<FileDetailResponseDto> {
    const file = await this.findAccessibleFile(fileIdDto, member);
    const downloadUrl = await this.s3Service.createDownloadUrl(
      file.path,
      file.originalname,
    );

    await this.fileRepository.update(
      { id: file.id },
      { lastAccessedAt: new Date() },
    );

    const fileDetailResponseDto = new FileDetailResponseDto();
    fileDetailResponseDto.message = { ...file, downloadUrl };

    return fileDetailResponseDto;
  }

  /**
   * Hide the file record, then delete the object<br/>
   * If S3 fails the file is already unreachable, so the failure is only logged
   */
  async removeFile(
    fileIdDto: FileIdDto,
    member: AuthenticatedMember,
  ): Promise<{ affectedRows: number }> {
    const file = await this.findAccessibleFile(fileIdDto, member);
    const { affected } = await this.fileRepository.softDelete(file.id);

    await this.s3Service
      .removeObject(file.path)
      .catch((err) =>
        this.logger.error(`S3 delete failed: ${file.path}`, err?.stack),
      );

    return { affectedRows: affected };
  }

  /**
   * A file in another branch looks the same as a missing one
   */
  private async findAccessibleFile(
    { id }: FileIdDto,
    member: AuthenticatedMember,
  ): Promise<File> {
    const file = await this.fileRepository.findOneBy({ id });

    if (!file) {
      throw new NotFoundException({
        message: '파일이 존재하지 않습니다.',
      });
    }

    await this.authorityService
      .assertBranchAccess(member, file.branchId)
      .catch(() => {
        throw new NotFoundException({
          message: '파일이 존재하지 않습니다.',
        });
      });

    return file;
  }
}
