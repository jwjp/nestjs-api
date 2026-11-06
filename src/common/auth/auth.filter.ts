import { ArgumentsHost, Catch, ExceptionFilter, Logger } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { ResponseDto } from './response.dto';
import { redactPath } from './log-redaction';
import { describeException } from './exception-response';

@Catch()
export class AuthFilter implements ExceptionFilter {
  constructor(private readonly httpAdapterHost: HttpAdapterHost) {}

  private readonly logger = new Logger();

  catch(exception: unknown, host: ArgumentsHost) {
    const { httpAdapter } = this.httpAdapterHost;
    const ctx = host.switchToHttp();
    const { status, message } = describeException(exception);

    // Response payload to send to the client
    const responseBody: ResponseDto = {
      result: false,
      statusCode: status,
      request: `${httpAdapter.getRequestMethod(ctx.getRequest())} ${redactPath(
        httpAdapter.getRequestUrl(ctx.getRequest()),
      )}`,
      timestamp: new Date().toString(),
      message: { error: message },
    };

    // Log data for developers to inspect
    const debuggingLog = Object.assign({}, responseBody, {
      query: exception?.['sql'] ?? exception?.['query'] ?? undefined,
      stack: exception?.['response']?.stack ?? exception?.['stack'],
      messageData: exception?.['response']?.message,
      message: exception?.['message'] ?? message,
    });

    // A client error is expected traffic, so it needs no stack trace
    const context = exception?.['response']?.name ?? exception?.['name'];
    if (status >= 500) {
      this.logger.error(debuggingLog, debuggingLog.stack, context);
    } else {
      this.logger.warn(
        `${status} ${responseBody.request} ${JSON.stringify(message)}`,
        context,
      );
    }

    // Send the error response
    httpAdapter.reply(ctx.getResponse(), responseBody, status);
  }
}
