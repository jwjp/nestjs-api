import {
  Module,
  ServiceUnavailableException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { diskStorage } from 'multer';
import * as fs from 'fs';
import { randomUUID } from 'crypto';
import { extname } from 'path';
import { MimeType } from './allowed-mime.array';

@Module({
  imports: [
    MulterModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => ({
        storage: diskStorage({
          destination: (req, file, callback) => {
            const nowDate = new Date();
            const nowDestination =
              nowDate.getFullYear() +
              '-' +
              String(nowDate.getMonth() + 1).padStart(2, '0') +
              '-' +
              String(nowDate.getDate()).padStart(2, '0');
            const dest =
              configService.get<string>('UPLOAD_DISK_PATH') +
              '/' +
              nowDestination;

            // Check the folder name length (max 100)
            if (dest.length > 100) {
              return callback(
                new ServiceUnavailableException('Too long folder name'),
                '',
              );
            }

            // Create the folder if it does not exist
            !fs.existsSync(dest) && fs.mkdirSync(dest, { recursive: true });
            callback(null, dest);
          },
          filename: (req, file, callback) => {
            const filename =
              Date.now() + '-' + randomUUID() + extname(file.originalname);

            // Check the uploaded filename length (max 255)
            if (filename.length > 255) {
              return callback(
                new ServiceUnavailableException('Too long upload filename'),
                '',
              );
            }

            // Append the extension to the filename and upload
            callback(null, filename);
          },
        }),
        limits: {
          fieldNameSize: 8,
          fieldSize: 5,
          fields: 3,
          fileSize: 4000,
          files: 1,
        },
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
export class DiskModule {}
