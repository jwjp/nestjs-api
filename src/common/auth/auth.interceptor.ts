import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { map, Observable } from 'rxjs';
import { ResponseDto } from './response.dto';

@Injectable()
export class AuthInterceptor implements NestInterceptor {
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<ResponseDto> {
    const { method, url } = context.getArgByIndex(0); // IncomingMessage
    const { statusCode } = context.getArgByIndex(1); // ServerResponse

    // Interceptor applied after the request is handled
    return next.handle().pipe(
      // Used to transform the response data
      map((data) => {
        // Values returned from controllers/services are captured in data,
        // everything else is wrapped in the format below (error messages are handled by AuthFilter)
        const responseBody: ResponseDto = {
          result: true,
          statusCode: statusCode,
          request: `${method} ${url}`,
          timestamp: new Date().toString(),
          message: data?.message ?? data,
        };

        return responseBody;
      }),
    );
  }
}
