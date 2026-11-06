import { Injectable, Logger } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { promises as fs } from 'fs';
import * as path from 'path';
import { S3Service } from '../file/s3.service';
import { SlackService } from '../chat/slack.service';
import { ConfigService } from '@nestjs/config';
import { PutObjectCommandOutput } from '@aws-sdk/client-s3';

const MAX_LOG_UPLOAD_BYTES = 1024 * 1024 * 10;

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
   * Uploads log files to S3 and empties each one only after its upload succeeds<br/>
   * A file over 10MB is skipped with a Slack message<br/>
   * Uploaded log files are auto-deleted via the S3 bucket's lifecycle rules
   *
   * @param {string} logsPath - Log file folder
   * @return {Promise<PutObjectCommandOutput[]>} - S3 upload results
   */
  async logHandling(
    logsPath: string = path.resolve('logs'),
  ): Promise<PutObjectCommandOutput[]> {
    const names: string[] = await fs.readdir(logsPath).catch(() => []);
    const date = new Date().toISOString().slice(0, 10);
    const results: PutObjectCommandOutput[] = [];

    for (const name of names) {
      if (path.extname(name).toLowerCase() !== '.log') {
        continue;
      }

      const file = path.join(logsPath, name);

      try {
        const { size } = await fs.stat(file);

        if (size === 0) {
          continue;
        }

        if (size > MAX_LOG_UPLOAD_BYTES) {
          await this.slackService.sendSlack(
            this.configService.get('SLACK_WEBHOOK'),
            this.configService.get('SLACK_CHANNEL'),
            `${name} file is over 10Mb`,
            this.configService.get('SLACK_TOKEN'),
          );
          continue;
        }

        results.push(
          await this.s3Service.putObjectFiles({
            Bucket: this.configService.get<string>('AWS_S3_BUCKET'),
            Key: `logs/${date}/${name}`,
            Body: await fs.readFile(file),
          }),
        );

        // Truncate instead of deleting, because winston keeps the file open
        await fs.truncate(file);
      } catch (err) {
        this.logger.error(`Log upload failed: ${name}`, err?.stack);
      }
    }

    return results;
  }
}
