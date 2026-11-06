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
          this.http.pingCheck(
            'http',
            `http://localhost:${Number(process.env.PORT) || 3000}`,
            { timeout: 60 },
          ),
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

      // This endpoint is public, so the failing component only goes to Slack
      throw new ServiceUnavailableException({
        message: '서비스 상태가 불안정합니다.',
        public: true,
        stack: err.stack,
      });
    }
  }
}
