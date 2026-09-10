import {
  IsDate,
  IsEnum,
  IsMimeType,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  Min,
} from 'class-validator';
import { ApiProperty, PartialType } from '@nestjs/swagger';
import { ResponseDto } from '../../auth/response.dto';
import { Type } from 'class-transformer';
import { FileStorageEnum } from '../file.enum';
import { File } from '../entities/file.entity';

/**
 * File DTO
 */
export class FileInsertDto {
  /**
   * Branch primary key
   */
  @IsNumber()
  @IsNotEmpty()
  branchId: number;

  /**
   * Filename at the time of upload<br/>
   * Used as the download filename (falls back to the existing filename if not provided, editable)
   */
  @IsString({
    message: '파일명은 문자만 사용할 수 있습니다.',
  })
  @IsNotEmpty({
    message: '파일명은 빈 값이 올 수 없습니다.',
  })
  originalname: string;

  /**
   * Unique filename<br/>
   * Used to fetch the file (generated via randomUUID or similar, not editable)
   */
  @IsString({
    message: '고유 파일명은 문자만 사용할 수 있습니다.',
  })
  @IsNotEmpty({
    message: '고유 파일명은 빈 값이 올 수 없습니다.',
  })
  filename: string;

  /**
   * File MimeType
   */
  @IsMimeType({
    message: 'MimeType 형태의 값이어야 합니다.',
  })
  mimetype: string;

  /**
   * File size (bytes)
   */
  @IsNumber(
    {
      allowNaN: false,
      allowInfinity: false,
    },
    {
      message: '파일 사이즈는 숫자 형태만 올 수 있습니다.',
    },
  )
  @IsNotEmpty({
    message: '파일 사이즈는 빈 값이 올 수 없습니다.',
  })
  size: number;

  /**
   * Storage type (s3, disk)
   * @example 's3'
   */
  @IsEnum(FileStorageEnum, {
    message: 's3, disk 중에서 선택해주세요.',
  })
  storage: FileStorageEnum;

  /**
   * Path the file is stored at
   * @example 'files/{branchId}/{date(YYYYMMDD)}'
   */
  @IsString({
    message: '경로 값은 문자만 사용할 수 있습니다.',
  })
  @IsNotEmpty({
    message: '경로 값은 빈 값이 올 수 없습니다.',
  })
  path: string;

  /**
   * File access URL
   * @example 'https://{AWS_S3_BUCKET}.s3.{AWS_S3_REGION}.amazonaws.com/{Key}'
   */
  @IsUrl(
    {
      require_protocol: true,
      protocols: ['http', 'https'],
      require_tld: true,
    },
    {
      message: 'URL은 https 를 포함한 전체 경로를 입력해주세요.',
    },
  )
  url: string;

  /**
   * Last accessed timestamp
   */
  @IsDate()
  @IsOptional()
  lastAccessedAt?: Date;
}

export class UploadS3FilesDto {
  /**
   * Files
   */
  @ApiProperty({ type: Array, format: 'binary', required: true })
  files: Array<Express.Multer.File>;

  /**
   * Branch ID primary key value
   */
  @IsNumber(
    {
      allowNaN: false,
      allowInfinity: false,
    },
    {
      message: '지점 ID 값은 숫자 형태만 올 수 있습니다.',
    },
  )
  @IsNotEmpty({
    message: '지점 ID 값은 빈 값이 올 수 없습니다.',
  })
  @Type(() => Number)
  branchId: number;
}

export class UploadS3ResultDto {
  url: string;
  result: boolean;
}

export class UploadS3FilesResponse extends PartialType(ResponseDto) {
  result: boolean;
  statusCode: number;
  request: string;
  timestamp: string;
  message: UploadS3ResultDto[];
}

export class GetS3FileByFileId {
  @IsNumber(
    {
      allowNaN: false,
      allowInfinity: false,
    },
    {
      message: 'ID 값은 숫자 형태만 올 수 있습니다.',
    },
  )
  @Type(() => Number)
  id: number;
}

export class S3FileListPageDto {
  @IsNumber(
    {
      allowNaN: false,
      allowInfinity: false,
    },
    {
      message: '지점 ID 값은 숫자 형태만 올 수 있습니다.',
    },
  )
  @Type(() => Number)
  branch: number;

  /**
   * Page number (minimum 1)
   * @example 1
   */
  @IsOptional()
  @IsNumber(
    {
      allowNaN: false,
      allowInfinity: false,
    },
    {
      message: '페이지 번호는 숫자 형태만 올 수 있습니다.',
    },
  )
  @Type(() => Number)
  @Min(1, {
    message: '최소 1 이상으로 입력해야 합니다.',
  })
  page?: number = 1;

  /**
   * Items per page (minimum 1, maximum 100)
   * @example 10
   */
  @IsOptional()
  @IsNumber(
    {
      allowNaN: false,
      allowInfinity: false,
    },
    {
      message: '페이지 당 표시 할 개수는 숫자 형태만 올 수 있습니다.',
    },
  )
  @Type(() => Number)
  @Min(1, {
    message: '최소 1 까지 입력 가능합니다.',
  })
  @Max(100, {
    message: '최대 100 까지 입력 가능합니다.',
  })
  perPage?: number = 10;
}

export class GetS3FileByBranchId {
  @IsNumber(
    {
      allowNaN: false,
      allowInfinity: false,
    },
    {
      message: '지점 ID 값은 숫자 형태만 올 수 있습니다.',
    },
  )
  @Type(() => Number)
  branch: number;
}

export class GetS3FileByMaxKeys {
  maxKeys: number;
}

export class getS3FileByUniqueKey {
  branchId: number;
  maxKeys: number;
}

/**
 * (Swagger) File list result, including the interceptor response
 */
export class FileListResponseDto extends PartialType(ResponseDto) {
  result: boolean;
  statusCode: number;
  request: string;
  timestamp: string;
  message: File[];
}

export class S3RemoveFileDto {
  filename: string;
  versionId?: string;
}
export class S3RemoveFilesDto {
  deleteObject: [
    {
      Key: string;
      VersionId: string;
    },
  ];
}
