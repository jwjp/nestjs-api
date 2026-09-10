import { ThrottlerGuard } from '@nestjs/throttler';
import { Injectable } from '@nestjs/common';

@Injectable()
export class ProxyThrottlerGuard extends ThrottlerGuard {
  protected getTracker(req: Record<string, any>): Promise<string> {
    return new Promise<string>((resolve) => {
      const tracker =
        Array.isArray(req.ips) && req.ips.filter(Boolean).length > 0
          ? req.ips.at(-1)
          : req.ip;

      resolve(tracker);
    });
  }
}
