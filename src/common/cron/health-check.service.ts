import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import {
  DiskHealthIndicator,
  HealthCheckService as healthCheck,
  HttpHealthIndicator,
  MemoryHealthIndicator,
  TypeOrmHealthIndicator,
} from '@nestjs/terminus';
import { SlackService } from '../chat/slack.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class HealthCheckService {
  constructor(
    private readonly configService: ConfigService,
    private readonly health: healthCheck,
    private readonly http: HttpHealthIndicator,
    private readonly db: TypeOrmHealthIndicator,
    private readonly disk: DiskHealthIndicator,
    private readonly memory: MemoryHealthIndicator,
    private readonly slackService: SlackService,
  ) {}

  async healthCheck() {
    try {
      await this.health.check([
        () =>
          this.http.pingCheck('http', 'http://localhost:3000', {
            timeout: 60,
          }),
        () => this.db.pingCheck('database', { timeout: 60 }),
        () =>
          this.disk.checkStorage('storage', {
            path: '/',
            thresholdPercent: 0.9, // Alert when 90% of storage is allocated
          }),
        () => this.memory.checkRSS('memory', 4 * 1024 * 1024 * 1024), // Alert when memory usage exceeds 4GB
      ]);

      return 'OK';
    } catch (err) {
      const timestamp = new Date().toLocaleString('ko-KR', {
        timeZone: 'Asia/Seoul',
        hour12: false,
      });
      const stack = err.stack;
      const data = JSON.stringify(err.response?.error);

      // Send a Slack message
      await this.slackService.sendSlack(
        this.configService.get<string>('SLACK_WEBHOOK'),
        this.configService.get<string>('SLACK_CHANNEL'),
        `:boom: _*${timestamp}*_ \n*\`stack\`*: ${stack} \n*\`data\`*: ${data}`,
        this.configService.get<string>('SLACK_TOKEN'),
      );

      // Remove undefined entries after building the object
      const errMessage: object = JSON.parse(
        JSON.stringify({
          http: err.response?.error?.http
            ? '현재 도메인의 연결 상태가 불안정합니다.'
            : undefined,
          database: err.response?.error?.database
            ? '데이터베이스의 연결 상태가 불안정합니다.'
            : undefined,
          storage: err.response?.error?.storage
            ? '디스크 용량이 설정 된 임계값에 도달했습니다.'
            : undefined,
          memory: err.response?.error?.memory
            ? '메모리 용량이 설정 된 임계값에 도달했습니다.'
            : undefined,
        }),
      );

      throw new ServiceUnavailableException({
        message:
          Object.keys(errMessage).length > 0
            ? Object.values(errMessage)
            : err.message,
        stack: err.stack,
      });
    }
  }
}
