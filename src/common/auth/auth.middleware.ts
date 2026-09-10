import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';

// Middleware for use in specific modules
@Injectable()
export class AuthMiddleware implements NestMiddleware {
  private readonly logger: Logger = new Logger();

  // Logging, or any other pre-processing as needed
  use(req: Request, res: Response, next: () => void): void {
    const { ip, ips, method, path: url } = req;
    const userAgent: string = req.get('user-agent') || '';
    const requestData: string = JSON.stringify(
      method === 'GET' ? req.query : req.body,
    );

    // When app.set('trust proxy', true) is configured, use ip as-is
    const proxyIp =
      Array.isArray(ips) && ips.filter(Boolean).length > 0 ? ips.at(-1) : ip;

    this.logger.log({
      level: 'http',
      message: `${method} ${url} - ${userAgent} -- IP: ${proxyIp} -- RequestData: ${requestData}`,
      context: 'AuthMiddleware',
    });

    next();
  }
}

// Middleware for global logging (classes can't be used here)
export function globalMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const now = Date.now();
  const logger: Logger = new Logger();
  const { ip, ips, method, path: url } = req;
  const userAgent = req.get('user-agent') || '';

  // When app.set('trust proxy', true) is configured, use ip as-is
  const proxyIp =
    Array.isArray(ips) && ips.filter(Boolean).length > 0 ? ips.at(-1) : ip;

  // Middleware log after the response completes
  res.on('close', () => {
    const { statusCode } = res;
    const contentLength = res.get('content-length') ?? 0;
    const requestData = JSON.stringify(method === 'GET' ? req.query : req.body);
    const delay = Date.now() - now;

    logger.log({
      level: 'http',
      message: `${method} ${url} ${statusCode} ${contentLength} - ${userAgent} -- IP: ${proxyIp} -- RequestData: ${requestData} ${delay}ms`,
      context: 'CloseResponse',
    });
  });

  next();
}

// Real client IP behind a proxy server
// If app.set('trust proxy', true) is not configured, the headers must be parsed manually
export function getRealIp(req: Request): string {
  const requestIp: string | string[] =
    req.headers['x-forwarded-for'] ||
    req.headers['x-real-ip'] ||
    req.socket.remoteAddress;

  // Use the rightmost IP among the XFF proxy IP addresses
  // https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/X-Forwarded-For
  // https://en.wikipedia.org/wiki/X-Forwarded-For
  return String(Array.isArray(requestIp) ? requestIp.at(-1) : requestIp)
    .split(',')
    .map((item: string) => item.trim())
    .at(0);
}

// Save a cookie
export function setCookie(
  response: Response,
  name: string,
  value: string,
  option?: {
    httpOnly: boolean;
    secure: boolean;
    sameSite: 'strict';
    maxAge: number; // 1 day: 24 * 60 * 60 * 1000
  },
) {
  return response.cookie(name, value, option);
}
