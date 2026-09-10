import { Controller, Get, Inject, Logger, LoggerService } from '@nestjs/common';
import { Public } from '../auth/auth.decorator';
import { CronService } from './cron.service';
import { Cron } from '@nestjs/schedule';
import { HealthCheck } from '@nestjs/terminus';
import { HealthCheckService } from './health-check.service';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PutObjectCommandOutput } from '@aws-sdk/client-s3';

@ApiTags('Cron')
@Controller('cron')
export class CronController {
  constructor(
    private readonly cronService: CronService,
    private readonly healthCheckService: HealthCheckService,
    @Inject(Logger) private readonly logger: LoggerService,
  ) {}

  /**
   * List registered cron jobs
   *
   * @return {object}
   */
  @ApiOperation({ security: [] })
  @Public()
  @Get()
  getCrons(): object {
    return Object.assign(
      {},
      {
        getCrons: this.cronService.getCrons(),
        getIntervals: this.cronService.getIntervals(),
        getTimeouts: this.cronService.getTimeouts(),
      },
    );
  }

  // @Cron('0 */1 * * * *', { name: 'cronTask' })
  handleCron() {
    this.cronService.handleCron();
  }

  // @Interval('intervalTask', 30000)
  handleInterval() {
    this.cronService.handleInterval();
  }

  // @Timeout('timeoutTask', 5000)
  handleTimeout() {
    this.cronService.handleTimeout();
  }

  /**
   * Health check feature provided by the nestjs/terminus package<br/>
   * Checks http/db ping plus memory/disk usage
   */
  @ApiOperation({ security: [] })
  @Public()
  @Get('health-check')
  @HealthCheck()
  async healthCheck() {
    return await this.healthCheckService.healthCheck();
  }

  /**
   * Uploads log files to S3 every day at 1am
   * Sends a Slack message and skips the file if it is over 10MB
   * Uploaded log files are auto-deleted via the S3 bucket's lifecycle rules
   *
   * @return {Promise<PutObjectCommandOutput[]>} - S3 upload result
   */
  @Cron('0 1 * * * *', { name: 'logHandling' })
  async logHandling(): Promise<PutObjectCommandOutput[]> {
    return await this.cronService.logHandling();
  }
}
