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
 * 파일 DTO
 */
export class FileInsertDto {
  /**
   * 지점 기본키
   */
  @IsNumber()
  @IsNotEmpty()
  branchId: number;

  /**
   * 업로드 했을 때의 파일명<br/>
   * 다운로드 하는 경우 이 파일명 사용 (별도 입력하지 않으면 기존 파일명 이용, 수정 가능)
   */
  @IsString({
    message: '파일명은 문자만 사용할 수 있습니다.',
  })
  @IsNotEmpty({
    message: '파일명은 빈 값이 올 수 없습니다.',
  })
  originalname: string;

  /**
   * 고유한 파일명<br/>
   * 파일 불러올 때 사용 (randomUUID 등 고유값 함수 이용, 수정 불가)
   */
  @IsString({
    message: '고유 파일명은 문자만 사용할 수 있습니다.',
  })
  @IsNotEmpty({
    message: '고유 파일명은 빈 값이 올 수 없습니다.',
  })
  filename: string;

  /**
   * 파일의 MimeType
   */
  @IsMimeType({
    message: 'MimeType 형태의 값이어야 합니다.',
  })
  mimetype: string;

  /**
   * 파일 사이즈(byte)
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
   * 스토리지 타입 (s3, disk)
   * @example 's3'
   */
  @IsEnum(FileStorageEnum, {
    message: 's3, disk 중에서 선택해주세요.',
  })
  storage: FileStorageEnum;

  /**
   * 파일이 저장 된 경로
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
   * 파일 액세스 URL
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
   * 마지막 액세스 일시
   */
  @IsDate()
  @IsOptional()
  lastAccessedAt?: Date;
}

export class UploadS3FilesDto {
  /**
   * 파일
   */
  @ApiProperty({ type: Array, format: 'binary', required: true })
  files: Array<Express.Multer.File>;

  /**
   * 지점ID 기본키 값
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
   * 페이지 번호 (최소 1 이상)
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
   * 페이지 당 표시 할 개수 (최소 1, 최대 100)
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
 * (Swagger) 파일 리스트 결과, 인터셉터 응답 포함
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
