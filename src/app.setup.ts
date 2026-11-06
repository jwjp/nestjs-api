import { ValidationPipe } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import * as cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AuthFilter } from './common/auth/auth.filter';
import { globalMiddleware } from './common/auth/auth.middleware';
import { parseTrustProxy } from './common/auth/trust-proxy';

/**
 * Origins allowed to call the API from a browser<br/>
 * Without a list, only local environments accept every origin
 */
export function corsOrigin(
  origins: string | undefined,
  nodeEnv: string | undefined,
): boolean | string[] {
  const list = (origins ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (list.length > 0) {
    return list;
  }

  return ['local', 'dev'].includes(nodeEnv);
}

/**
 * HTTP pipeline shared by the server and the e2e tests
 *
 * Request & response lifecycle
 * 1. Middleware (global > module)
 * 2. Guards (global > controller > route)
 * 3. Interceptors (global > controller > route)
 * 4. Pipes (global > controller > route)
 * 5. Controller <> service
 * 6. Interceptors (route > controller > global)
 * 7. Exception filters (route > controller > global)
 */
export function configureApp(app: NestExpressApplication): void {
  // HTTP security settings
  // https://github.com/helmetjs/helmet
  app.use(helmet());

  // https://github.com/expressjs/cors
  app.enableCors({
    origin: corsOrigin(process.env.CORS_ORIGINS, process.env.NODE_ENV),
  });

  // Trust only the configured proxy
  app.set('trust proxy', parseTrustProxy(process.env.TRUST_PROXY));

  // Use cookies
  app.use(cookieParser());

  // Pre-processing & logging
  app.use(globalMiddleware);

  // Value validation
  app.useGlobalPipes(new ValidationPipe({ whitelist: true }));

  // Error handling & error logging
  app.useGlobalFilters(new AuthFilter(app.get(HttpAdapterHost)));

  // Close the database connection on SIGTERM
  app.enableShutdownHooks();
}
