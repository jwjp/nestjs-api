import { BadRequestException, Injectable } from '@nestjs/common';
import {
  DeleteObjectCommand,
  DeleteObjectsCommand,
  DeleteObjectsCommandInput,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  PutObjectCommandOutput,
  S3Client,
} from '@aws-sdk/client-s3';
import { ConfigService } from '@nestjs/config';
import { PutObjectCommandInput } from '@aws-sdk/client-s3/dist-types/commands/PutObjectCommand';
import path, { extname } from 'path';
import {
  FileInsertDto,
  FileListResponseDto,
  GetS3FileByBranchId,
  GetS3FileByFileId,
  S3FileListPageDto,
  UploadS3FilesDto,
  UploadS3FilesResponse,
  UploadS3ResultDto,
} from './dto/file.dto';
import { BranchService } from '../../member/branch.service';
import { randomUUID } from 'crypto';
import { InjectRepository } from '@nestjs/typeorm';
import { File } from './entities/file.entity';
import { Repository } from 'typeorm';
import { FileStorageEnum } from './file.enum';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

@Injectable()
export class FileService {
  private readonly s3Client: S3Client;
  private readonly multerOption; // TODO: multerOption (multer-option.config.ts)

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(File) private fileRepository: Repository<File>,
    private readonly branchService: BranchService,
  ) {
    this.s3Client = new S3Client({
      region: configService.get('AWS_S3_REGION'),
      credentials: {
        accessKeyId: configService.get('AWS_ACCESS_KEY'),
        secretAccessKey: configService.get('AWS_SECRET_ACCESS_KEY'),
      },
    });
  }

  /**
   * S3 file upload
   */
  async s3UploadFiles(uploadS3FilesDto: UploadS3FilesDto) {
    // Look up the branch
    const isBranchExists: boolean = await this.branchService.isBranchExists({
      id: uploadS3FilesDto.branchId,
    });

    // Throw an error if the branch does not exist
    if (!isBranchExists) {
      throw new BadRequestException({
        message: '지점이 삭제되었거나 존재하지 않습니다.',
      });
    }

    // S3 upload parameters
    const uploadParams: PutObjectCommandInput[] = [];

    // DB insert parameters
    const insertParams: FileInsertDto[] = [];

    // S3 URL return values
    const uploadS3ResultDtos: UploadS3ResultDto[] = [];

    // Build the parameters
    for (const [i, file] of Object.entries(uploadS3FilesDto.files)) {
      // S3 upload parameters
      uploadParams.push(<PutObjectCommandInput>{
        Bucket: this.configService.get<string>('AWS_S3_BUCKET'),
        Key:
          this.configService.get<string>('UPLOAD_S3_PATH') +
          '/' +
          uploadS3FilesDto.branchId +
          '/' +
          randomUUID() +
          extname(file.originalname),
        Body: file.buffer,
      });

      // S3 URL
      uploadS3ResultDtos.push({
        url: `https://${this.configService.get(
          'AWS_S3_BUCKET',
        )}.s3.${this.configService.get('AWS_S3_REGION')}.amazonaws.com/${
          uploadParams[i].Key
        }`,
        result: true,
      });

      // DB insert parameters
      insertParams.push(<FileInsertDto>{
        branchId: uploadS3FilesDto.branchId,
        originalname: file.originalname,
        filename: randomUUID() + extname(file.originalname),
        mimetype: file.mimetype,
        size: file.size,
        storage: FileStorageEnum.s3,
        path: uploadParams[i].Key,
        url: uploadS3ResultDtos[i].url,
      });
    }

    // Instantiate for array data validation
    const fileInstance: FileInsertDto[] = plainToInstance(
      FileInsertDto,
      insertParams,
    );

    // Validate the array data
    for (const file of fileInstance) {
      const { constraints } = (await validate(file)).pop() || {};
      if (constraints) {
        throw new BadRequestException({
          message: Object.values(constraints),
        });
      }
    }

    // Upload to S3
    const putResult: PutObjectCommandOutput[] = await Promise.all(
      uploadParams.map(async (uploadParam: PutObjectCommandInput) => {
        const command: PutObjectCommand = new PutObjectCommand(uploadParam);
        return await this.s3Client.send(command);
      }),
    );

    // Remove the DB insert parameters for any failed S3 uploads
    for (const [idx, { $metadata }] of Object.entries(putResult)) {
      if ($metadata.httpStatusCode !== 200) {
        delete insertParams[idx];
        uploadS3ResultDtos[idx].url = '';
        uploadS3ResultDtos[idx].result = false;
      }
    }

    // DB insert parameters based on the S3 upload results
    const insertParamsByPutResult: FileInsertDto[] =
      insertParams.filter(Boolean);

    // Insert into the DB
    await this.fileRepository.save(insertParamsByPutResult);

    // Build the DTO used for the Swagger docs
    const uploadS3FilesResponse: UploadS3FilesResponse =
      new UploadS3FilesResponse();
    uploadS3FilesResponse.message = uploadS3ResultDtos;

    return uploadS3FilesResponse;
  }

  async getS3FileListPerPage(s3FileListPageDto: S3FileListPageDto) {
    // Starting from the {offset}th item
    const offset = s3FileListPageDto.perPage * (s3FileListPageDto.page - 1);

    // Show {limit} items
    const limit = s3FileListPageDto.perPage;

    // File list
    const fileList: File[] = await this.fileRepository.find({
      where: {
        branchId: s3FileListPageDto.branch,
      },
      withDeleted: false,
      skip: offset,
      take: limit,
    });

    // Build the DTO used for the Swagger docs
    const fileListResponseDto: FileListResponseDto = new FileListResponseDto();
    fileListResponseDto.message = fileList;

    return fileListResponseDto;
  }

  // TODO: 2. getFiles (see s3.service.ts getObjects)
  async getS3FileByUniqueKey(
    getS3FileByBranchId: GetS3FileByBranchId,
    getS3FileByFileId: GetS3FileByFileId,
  ) {
    console.log(getS3FileByFileId, getS3FileByBranchId);
    // const command: ListObjectsV2Command = new ListObjectsV2Command({
    //   Bucket: this.configService.get<string>('AWS_S3_BUCKET'),
    //   Prefix:
    //     this.configService.get<string>('UPLOAD_S3_PATH') +
    //     '/' +
    //     getS3FileByBranchId.branchId +
    //     '/',
    //   MaxKeys: getS3FileByMaxKeys.maxKeys,
    // });
    //
    // console.log(command);
    //
    // const { Contents } = await this.s3Client.send(command);
    //
    // console.log(Contents);
    //
    // // Array of filenames
    // let files: string[] = [];
    //
    // if (Contents.length > 0) {
    //   // Filter to specific files
    //   files = Contents.map((content) => content.Key).filter(
    //     (file) => path.extname(file).toLowerCase() === '.jpg',
    //   );
    // }
    //
    // return files;
  }

  async s3GetFile(
    filename: string,
    prefix: string,
    versionId: string | undefined = undefined,
  ) {
    const { $metadata, LastModified, ContentLength, VersionId, ContentType } =
      await this.s3Client.send(
        new GetObjectCommand({
          Bucket: this.configService.get<string>('AWS_S3_BUCKET'),
          Key: `${prefix}/${filename}`,
          VersionId: versionId,
        }),
      );

    return {
      httpStatusCode: $metadata.httpStatusCode,
      contentLength: ContentLength,
      contentType: ContentType,
      lastModified: LastModified,
      versionId: VersionId,
    };
  }

  async s3GetFiles(prefix: string = '', maxKeys: number = 30) {
    const { Contents } = await this.s3Client.send(
      new ListObjectsV2Command({
        Bucket: this.configService.get<string>('AWS_S3_BUCKET'),
        Prefix: prefix ? prefix + '/' : prefix,
        MaxKeys: maxKeys,
      }),
    );

    // Array of filenames
    let files: string[] = [];

    if (Contents.length > 0) {
      // Filter to specific files
      switch (prefix) {
        case 'logs':
          files = Contents.map((content) => content.Key).filter(
            (file) => path.extname(file).toLowerCase() === '.log',
          );
          break;
        default:
          files = Contents.map((content) => content.Key);
          break;
      }
    }

    return files;
  }

  async s3RemoveFile(
    filename: string,
    prefix: string,
    versionId: string | undefined = undefined,
  ) {
    const { $metadata, DeleteMarker, VersionId } = await this.s3Client.send(
      new DeleteObjectCommand({
        Bucket: this.configService.get<string>('AWS_S3_BUCKET'),
        Key: `${prefix}/${filename}`,
        VersionId: versionId,
      }),
    );

    return {
      httpStatusCode: $metadata.httpStatusCode,
      deleteMarker: DeleteMarker, // true means every version of the file, including this one, was deleted
      versionId: VersionId,
    };
  }

  async s3RemoveFiles(deleteObject: object) {
    const { Deleted, Errors } = await this.s3Client.send(
      new DeleteObjectsCommand(<DeleteObjectsCommandInput>{
        Bucket: this.configService.get<string>('AWS_S3_BUCKET'),
        Delete: {
          Objects: deleteObject, // [{Key: '', VersionId: ''}, ...]
        },
      }),
    );

    return Object.assign({
      Deleted,
      Errors,
    });
  }

  // TODO: Move on to diskStorage once the S3 API is complete
}
