import {
  Module,
  ServiceUnavailableException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { ConfigModule, ConfigService } from '@nestjs/config';
import * as multerS3 from 'multer-s3';
import { S3Client } from '@aws-sdk/client-s3';
import { randomUUID } from 'crypto';
import { extname } from 'path';
import { MimeType } from './allowed-mime.array';

@Module({
  imports: [
    MulterModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => ({
        storage: multerS3({
          s3: new S3Client({
            region: configService.get<string>('AWS_S3_REGION'),
            credentials: {
              accessKeyId: configService.get<string>('AWS_ACCESS_KEY'),
              secretAccessKey: configService.get<string>(
                'AWS_SECRET_ACCESS_KEY',
              ),
            },
          }),
          bucket: configService.get<string>('AWS_S3_BUCKET'),
          contentType: multerS3.AUTO_CONTENT_TYPE,
          key(req, file, callback) {
            // TODO: revisit multer-s3 compatibility and usability
            const nowDate = new Date();
            const nowDestination =
              nowDate.getFullYear() +
              '-' +
              String(nowDate.getMonth() + 1).padStart(2, '0') +
              '-' +
              String(nowDate.getDate()).padStart(2, '0');
            const filename =
              configService.get<string>('UPLOAD_S3_PATH') +
              '/' +
              nowDestination +
              '/' +
              Date.now() +
              '-' +
              randomUUID() +
              extname(file.originalname);

            // Check the uploaded filename length (max 255)
            if (filename.length > 255) {
              return callback(
                new ServiceUnavailableException('Too long upload filename'),
                '',
              );
            }

            callback(null, filename);
          },
        }),
        fileFilter: (req, file, callback) => {
          // Check whether the file type is supported for upload
          if (!MimeType.includes(file.mimetype)) {
            return callback(
              new UnsupportedMediaTypeException('File type not allowed'),
              false,
            );
          }

          // Check the uploaded filename length (max 255)
          if (file.originalname.length > 255) {
            return callback(
              new ServiceUnavailableException('Too long original filename'),
              false,
            );
          }

          callback(null, true);
        },
      }),
    }),
  ],
  exports: [MulterModule],
})
export class S3Module {}
