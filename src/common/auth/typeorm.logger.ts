import { AbstractLogger, LogLevel, LogMessage } from 'typeorm';
import { LoggerOptions } from 'typeorm/logger/LoggerOptions';
import { Logger } from '@nestjs/common';

export class TypeOrmLogger extends AbstractLogger {
  /**
   * 로그 옵션 설정
   * 입력 받지 않을 경우, 로그 출력되지 않음
   *
   * @param {LoggerOptions} options
   */
  constructor(options?: LoggerOptions | undefined) {
    super(options);
  }

  /**
   * 로그 출력에 사용할 로거
   * WinstonModule 사용해서 생성한 로거
   *
   * @private {Logger}
   */
  private readonly logger = new Logger();

  protected writeLog(level: LogLevel, logMessage: LogMessage | LogMessage[]) {
    const messages = this.prepareLogMessages(logMessage, {
      highlightSql: false,
    });

    for (const message of messages) {
      switch (message.type ?? level) {
        case 'log':
        case 'schema-build':
        case 'migration':
          this.logger.log(message.message);
          break;

        case 'info':
        case 'query':
          if (message.prefix) {
            this.logger.log({
              level: 'silly',
              message: `${message.prefix} ${message.message}`,
              context: 'QUERY',
            });
          } else {
            this.logger.log({
              level: 'silly',
              message: message.message,
              context: 'QUERY',
            });
          }
          break;

        case 'warn':
        case 'query-slow':
          if (message.prefix) {
            this.logger.warn(message.prefix, message.message);
          } else {
            this.logger.warn(message.message);
          }
          break;

        case 'error':
        case 'query-error':
          if (message.prefix) {
            this.logger.error(message.prefix, message.message);
          } else {
            this.logger.error(message.message);
          }
          break;
      }
    }
  }
}
