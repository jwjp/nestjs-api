import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import * as fs from 'fs';
import * as path from 'path';
import { S3Service } from '../file/s3.service';
import { SlackService } from '../chat/slack.service';
import { ConfigService } from '@nestjs/config';
import { PutObjectCommandInput } from '@aws-sdk/client-s3/dist-types/commands/PutObjectCommand';
import { PutObjectCommandOutput } from '@aws-sdk/client-s3';

/**
 * Registering, removing, and stopping schedules can be handled dynamically through the controller
 *
 * If you don't register schedules through the controller,
 * they can be registered from any service using the @Cron, @Interval, @Timeout decorators
 */
@Injectable()
export class CronService {
  private readonly logger: Logger = new Logger();

  constructor(
    private readonly scheduler: SchedulerRegistry,
    private readonly s3Service: S3Service,
    private readonly slackService: SlackService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * List of cron jobs created via the Cron decorator
   *
   * @return {Object[]}
   */
  getCrons(): object[] {
    const jobs = this.scheduler.getCronJobs();
    const list: object[] = [];
    jobs.forEach((val, key, map) => {
      list.push({
        name: key,
        cronTime: map.get(key)['cronTime']['source'],
      });
    });

    return list;
  }

  /**
   * List of jobs created via the Interval decorator
   *
   * @return {string[]}
   */
  getIntervals(): string[] {
    return this.scheduler.getIntervals();
  }

  /**
   * List of jobs created via the Timeout decorator
   *
   * @return {string[]}
   */
  getTimeouts(): string[] {
    return this.scheduler.getTimeouts();
  }

  handleCron() {
    this.logger.debug('Task Called', this.handleCron.name);
  }

  handleInterval() {
    this.logger.debug('Task Called by interval', this.handleInterval.name);
  }

  handleTimeout() {
    this.logger.debug('Task Called by timeout', this.handleTimeout.name);
  }

  /**
   * Uploads log files to S3 every day at 1am
   * Sends a Slack message and skips the file if it is over 10MB
   * Uploaded log files are auto-deleted via the S3 bucket's lifecycle rules
   *
   * @return {Promise<PutObjectCommandOutput[]>} - S3 upload result
   */
  async logHandling(): Promise<PutObjectCommandOutput[]> {
    // Project root folder
    const rootPath: string = path.join(__dirname + '/../../../');

    // If the folder does not exist
    if (
      !fs.existsSync(rootPath) &&
      rootPath.split('/').filter(Boolean).pop() !==
        this.configService.get('ROOT_DIRECTORY')
    ) {
      throw new InternalServerErrorException({
        message: '폴더 경로에 대한 환경변수를 확인해주세요.',
      });
    }

    // Log file root folder
    const logsPath = path.join(rootPath, 'logs');

    // Only look at log files
    const files: string[] = fs
      .readdirSync(logsPath)
      .filter((file) => path.extname(file).toLowerCase() === '.log');

    // Array for uploading to the S3 bucket in one batch
    const putObjectInputs: PutObjectCommandInput[] = [];

    // Check file info
    for (const i in files) {
      // File path and name
      const file = path.join('logs', files[i]);

      // File stats
      const stat: fs.Stats = fs.lstatSync(file);

      // Difference between now and the file creation time (in ms)
      const diffMs: number = Date.now() - parseInt(String(stat.birthtimeMs));

      // 1000: convert ms to seconds / 3600(sec): 1 hour / 24(hours): 1 day
      const diffDay: number = diffMs / 1000 / 3600 / 24;

      // If the log file is over 10MB, send a Slack message and skip it
      if (stat.size > 1024 * 1024 * 10) {
        await this.slackService.sendSlack(
          this.configService.get('SLACK_WEBHOOK'),
          this.configService.get('SLACK_CHANNEL'),
          `${file} file is over 10Mb`,
          this.configService.get('SLACK_TOKEN'),
        );

        continue;
      }

      // Files older than a day and larger than 0 bytes
      if (diffDay > 1 && stat.size > 0) {
        const fileStream: fs.ReadStream = fs.createReadStream(file);

        // Add the S3 input parameters to the array
        putObjectInputs.push({
          Bucket: this.configService.get<string>('AWS_S3_BUCKET'),
          Key: 'logs/' + files[i],
          Body: fileStream,
        });
      }
    }

    // Upload to S3 and reset the existing files
    return await Promise.all(
      putObjectInputs.map((input) => {
        for (const i in files) {
          // File path and name
          const file = path.join('logs', files[i]);

          // Delete and recreate the file after the upload completes
          fs.unlinkSync(file);
          fs.writeFileSync(file, '');
        }

        return this.s3Service.putObjectFiles(input);
      }),
    );
  }
}
