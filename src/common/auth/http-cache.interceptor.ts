import { CacheInterceptor } from '@nestjs/cache-manager';
import { ExecutionContext, Injectable } from '@nestjs/common';

@Injectable()
export class HttpCacheInterceptor extends CacheInterceptor {
  trackBy(context: ExecutionContext): string | undefined {
    const request = context.switchToHttp().getRequest();
    const { httpAdapter } = this.httpAdapterHost;

    // Only GET endpoints can be cached
    if (httpAdapter.getRequestMethod(request) !== 'GET') {
      return undefined;
    }

    // The cache key is only the URL, so one member's response must never be
    // served to another
    if (request.headers.authorization) {
      return undefined;
    }

    const url: string = httpAdapter.getRequestUrl(request);

    // Paths excluded from caching
    if (
      url === '/' ||
      url === '/cron/health-check' ||
      // Completes a verification, so it has to reach the handler every time
      url.startsWith('/members/validate/')
    ) {
      return undefined;
    }

    return url;
  }
}
