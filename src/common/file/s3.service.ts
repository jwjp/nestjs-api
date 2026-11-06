import { Injectable } from '@nestjs/common';
import {
  DeleteObjectCommand,
  DeleteObjectCommandOutput,
  GetObjectCommand,
  PutObjectCommand,
  PutObjectCommandInput,
  PutObjectCommandOutput,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { ConfigService } from '@nestjs/config';

const DOWNLOAD_URL_SECONDS = 300;

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
   * Upload a file
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
   * Short-lived link that downloads a file under its original name
   *
   * @param {string} key - S3 key
   * @param {string} filename - Name offered to the browser
   * @return {Promise<string>}
   */
  async createDownloadUrl(key: string, filename: string): Promise<string> {
    return getSignedUrl(
      this.s3Client,
      new GetObjectCommand({
        Bucket: this.configService.get<string>('AWS_S3_BUCKET'),
        Key: key,
        ResponseContentDisposition: `attachment; filename*=UTF-8''${encodeURIComponent(
          filename,
        )}`,
      }),
      { expiresIn: DOWNLOAD_URL_SECONDS },
    );
  }

  /**
   * Delete a file
   *
   * @param {string} key - S3 key
   * @return {Promise<DeleteObjectCommandOutput>}
   */
  async removeObject(key: string): Promise<DeleteObjectCommandOutput> {
    return await this.s3Client.send(
      new DeleteObjectCommand({
        Bucket: this.configService.get<string>('AWS_S3_BUCKET'),
        Key: key,
      }),
    );
  }
}
