import { Injectable, InternalServerErrorException } from '@nestjs/common';
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
import * as fs from 'fs';
import * as path from 'path';
import { PutObjectCommandInput } from '@aws-sdk/client-s3/dist-types/commands/PutObjectCommand';

@Injectable()
export class S3Service {
  private readonly s3Client: S3Client;
  constructor(private readonly configService: ConfigService) {
    this.s3Client = new S3Client({
      region: configService.get('AWS_S3_REGION'),
      credentials: {
        accessKeyId: configService.get('AWS_ACCESS_KEY'),
        secretAccessKey: configService.get('AWS_SECRET_ACCESS_KEY'),
      },
    });
  }

  /**
   * File upload
   *
   * @param {string} key - S3 filename
   * @param {fs.ReadStream} fileStream - Target file
   * @param {string} prefix - S3 folder name
   * @return {Promise<PutObjectCommandOutput>}
   */
  async putObjectFile(
    key: string,
    fileStream: fs.ReadStream,
    prefix: string = '',
  ): Promise<PutObjectCommandOutput> {
    return await this.s3Client.send(
      new PutObjectCommand({
        Bucket: this.configService.get<string>('AWS_S3_BUCKET'),
        Key: (prefix ? prefix + '/' : prefix) + key,
        Body: fileStream,
      }),
    );
  }

  /**
   * Upload multiple files at once
   * Must be used with Promise.all
   *
   * @param {PutObjectCommandInput} input
   * @return {Promise<PutObjectCommandOutput>}
   */
  async putObjectFiles(
    input: PutObjectCommandInput,
  ): Promise<PutObjectCommandOutput> {
    return await this.s3Client.send(new PutObjectCommand(input));
  }

  /**
   * File upload
   *
   * @param {string} key - S3 filename
   * @param {string} body - File content
   * @param {string} prefix - S3 folder name
   * @return {Promise<PutObjectCommandOutput>}
   */
  async putObjectPlain(
    key: string,
    body: string,
    prefix: string = '',
  ): Promise<PutObjectCommandOutput> {
    return await this.s3Client.send(
      new PutObjectCommand({
        Bucket: this.configService.get<string>('AWS_S3_BUCKET'),
        Key: (prefix ? prefix + '/' : prefix) + key,
        Body: body,
      }),
    );
  }

  /**
   * List of files in a given folder
   * Supports filtering by extension and a maximum item count
   *
   * @param {string} prefix
   * @param {number} maxKeys
   * @return {Promise<string[]>}
   */
  async getObjects(
    prefix: string = '',
    maxKeys: number = 30,
  ): Promise<string[]> {
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

  /**
   * Check whether a file exists in the bucket
   *
   * @param {string} filename - Filename, i.e. the Key without the S3 path
   * @param {string} prefix - S3 path
   * @param {string | undefined} versionId - File version ID
   */
  async getObject(
    filename: string,
    prefix: string,
    versionId: string | undefined = undefined,
  ): Promise<object> {
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

  /**
   * Download an S3 file to local disk
   *
   * @param {string} filename - Filename, i.e. the Key without the S3 path
   * @param {string} destination - Local folder to save the file in
   * @param {string} prefix - S3 path
   * @param {string | undefined} versionId - File version ID
   */
  async downloadObject(
    filename: string,
    destination: string,
    prefix: string,
    versionId: string | undefined = undefined,
  ): Promise<boolean> {
    const { Body } = await this.s3Client.send(
      new GetObjectCommand({
        Bucket: this.configService.get<string>('AWS_S3_BUCKET'),
        Key: `${prefix}/${filename}`,
        VersionId: versionId,
      }),
    );

    // Project root folder
    const rootPath: string = path.join(__dirname + '/../../../');

    // If the project root folder does not exist
    if (
      !fs.existsSync(rootPath) &&
      rootPath.split('/').filter(Boolean).pop() !==
        this.configService.get('ROOT_DIRECTORY')
    ) {
      throw new InternalServerErrorException({
        message: '폴더 경로에 대한 환경변수를 확인해주세요.',
      });
    }

    // Folder to save the file in
    const downloadFolder: string = path.join(
      rootPath,
      this.configService.get<string>('UPLOAD_DISK_PATH'),
      destination,
    );

    // Create the folder if it does not exist
    !fs.existsSync(downloadFolder) &&
      fs.mkdirSync(downloadFolder, { recursive: true });

    // S3 file data
    const uint8Array: Uint8Array = await Body.transformToByteArray();

    // Overwrite the local disk file
    const writeStream: fs.WriteStream = fs.createWriteStream(
      downloadFolder + '/' + filename,
    );

    // Whether the file was written
    return writeStream.write(uint8Array);
  }

  /**
   * Delete multiple S3 files at once
   *
   * @param {object} deleteObject - [{Key: '', VersionId: ''}, ...]
   * @return {Promise<object>}
   */
  async deleteObjects(deleteObject: object): Promise<object> {
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

  /**
   * Delete a specific S3 file
   *
   * @param {string} filename - Filename, i.e. the key without the S3 path
   * @param {string} prefix - S3 folder name
   * @param {string} versionId - S3 version ID; if undefined, every version of the file is deleted
   */
  async deleteObject(
    filename: string,
    prefix: string,
    versionId: string | undefined = undefined,
  ): Promise<object> {
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
}
