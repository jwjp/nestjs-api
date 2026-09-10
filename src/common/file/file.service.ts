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
   * S3 파일 업로드
   */
  async s3UploadFiles(uploadS3FilesDto: UploadS3FilesDto) {
    // 지점 검색
    const isBranchExists: boolean = await this.branchService.isBranchExists({
      id: uploadS3FilesDto.branchId,
    });

    // 지점이 없으면 예외처리
    if (!isBranchExists) {
      throw new BadRequestException({
        message: '지점이 삭제되었거나 존재하지 않습니다.',
      });
    }

    // S3 업로드 파라미터
    const uploadParams: PutObjectCommandInput[] = [];

    // DB 인서트 파라미터
    const insertParams: FileInsertDto[] = [];

    // S3 Url 리턴 값
    const uploadS3ResultDtos: UploadS3ResultDto[] = [];

    // 파라미터 입력
    for (const [i, file] of Object.entries(uploadS3FilesDto.files)) {
      // S3 업로드 파라미터
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

      // S3 Url
      uploadS3ResultDtos.push({
        url: `https://${this.configService.get(
          'AWS_S3_BUCKET',
        )}.s3.${this.configService.get('AWS_S3_REGION')}.amazonaws.com/${
          uploadParams[i].Key
        }`,
        result: true,
      });

      // DB 인서트 파라미터
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

    // 배열 데이터 검증을 위한 인스턴스화
    const fileInstance: FileInsertDto[] = plainToInstance(
      FileInsertDto,
      insertParams,
    );

    // 권한 배열 데이터 검증
    for (const file of fileInstance) {
      const { constraints } = (await validate(file)).pop() || {};
      if (constraints) {
        throw new BadRequestException({
          message: Object.values(constraints),
        });
      }
    }

    // S3 업로드
    const putResult: PutObjectCommandOutput[] = await Promise.all(
      uploadParams.map(async (uploadParam: PutObjectCommandInput) => {
        const command: PutObjectCommand = new PutObjectCommand(uploadParam);
        return await this.s3Client.send(command);
      }),
    );

    // S3 업로드 실패 시, DB 인서트 파라미터 삭제
    for (const [idx, { $metadata }] of Object.entries(putResult)) {
      if ($metadata.httpStatusCode !== 200) {
        delete insertParams[idx];
        uploadS3ResultDtos[idx].url = '';
        uploadS3ResultDtos[idx].result = false;
      }
    }

    // S3 업로드 결과에 따른 DB 인서트 파라미터
    const insertParamsByPutResult: FileInsertDto[] =
      insertParams.filter(Boolean);

    // DB 인서트
    await this.fileRepository.save(insertParamsByPutResult);

    // Swagger 문서 적용을 위한 DTO 생성
    const uploadS3FilesResponse: UploadS3FilesResponse =
      new UploadS3FilesResponse();
    uploadS3FilesResponse.message = uploadS3ResultDtos;

    return uploadS3FilesResponse;
  }

  async getS3FileListPerPage(s3FileListPageDto: S3FileListPageDto) {
    // {offset}번째 부터
    const offset = s3FileListPageDto.perPage * (s3FileListPageDto.page - 1);

    // {limit}개 표시
    const limit = s3FileListPageDto.perPage;

    // 파일 리스트
    const fileList: File[] = await this.fileRepository.find({
      where: {
        branchId: s3FileListPageDto.branch,
      },
      withDeleted: false,
      skip: offset,
      take: limit,
    });

    // Swagger 문서 적용을 위한 DTO 생성
    const fileListResponseDto: FileListResponseDto = new FileListResponseDto();
    fileListResponseDto.message = fileList;

    return fileListResponseDto;
  }

  // TODO: 2. getFiles (s3.service.ts getObjects 참고)
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
    // // 파일명 배열
    // let files: string[] = [];
    //
    // if (Contents.length > 0) {
    //   // 특정 파일 필터링
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

    // 파일명 배열
    let files: string[] = [];

    if (Contents.length > 0) {
      // 특정 파일 필터링
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
      deleteMarker: DeleteMarker, // true 이면 모든 버전을 포함한 해당 파일 삭제
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

  // TODO: S3 API 완료 후 diskStorage 진행
}
