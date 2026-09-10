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
   * Cron 리스트 출력
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
   * nestjs/terminus 패키지에서 제공하는 헬스체크 기능<br/>
   * http, db ping 체크 및 memory, disk 용량 체크
   */
  @ApiOperation({ security: [] })
  @Public()
  @Get('health-check')
  @HealthCheck()
  async healthCheck() {
    return await this.healthCheckService.healthCheck();
  }

  /**
   * 매일 오전 1시에 로그 파일을 S3 저장
   * 10Mb 이상이면 슬랙 메시지 발송 후 스킵
   * 업로드 된 로그 파일의 자동 삭제는 S3 버킷의 수명 주기 규칙 활용
   *
   * @return {Promise<PutObjectCommandOutput[]>} - S3 저장 결과
   */
  @Cron('0 1 * * * *', { name: 'logHandling' })
  async logHandling(): Promise<PutObjectCommandOutput[]> {
    return await this.cronService.logHandling();
  }
}
