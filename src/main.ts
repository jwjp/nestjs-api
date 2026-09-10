import { HttpAdapterHost, NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { utilities as WinstonUtilities, WinstonModule } from 'nest-winston';
import * as winston from 'winston';
import * as basicAuth from 'express-basic-auth';
import { globalMiddleware } from './common/auth/auth.middleware';
import { AuthFilter } from './common/auth/auth.filter';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { NestExpressApplication } from '@nestjs/platform-express';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: WinstonModule.createLogger({
      format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        WinstonUtilities.format.nestLike('API', {
          colors: true,
          prettyPrint: true,
        }),
      ),
      transports: [
        // Console output
        new winston.transports.Console({
          // level: silly < debug < verbose < http < info < warn < error
          level: process.env.NODE_ENV === 'prod' ? 'warn' : 'debug',
        }),
        // Error log
        new winston.transports.File({
          filename: 'logs/error.log',
          level: 'error',
          format: winston.format.uncolorize(),
        }),
        // Combined log
        new winston.transports.File({
          filename: 'logs/combined.log',
          level: 'debug',
          format: winston.format.uncolorize(),
        }),
      ],
    }),
  });

  // HTTP security settings
  // https://github.com/helmetjs/helmet
  app.use(helmet());

  // Enable CORS
  // https://github.com/expressjs/cors
  app.enableCors();

  // Trust the proxy
  app.set('trust proxy', true);

  // Only enable Swagger in non-production environments
  if (['local', 'dev'].includes(process.env.NODE_ENV)) {
    // Protect the Swagger docs page
    app.use(
      ['/docs', '/docs-json'],
      basicAuth({
        challenge: true,
        users: {
          [process.env.SWAGGER_USERNAME]: process.env.SWAGGER_PASSWORD,
        },
      }),
    );

    // Swagger setup
    SwaggerModule.setup(
      'docs',
      app,
      SwaggerModule.createDocument(
        app,
        new DocumentBuilder()
          .setTitle('NestJS APIs')
          .setDescription('API using NestJS')
          .setContact(
            'NestJS OpenAPI (Swagger)',
            'https://docs.nestjs.com/openapi/introduction',
            'example@example.com',
          )
          .addBearerAuth()
          .addSecurityRequirements('bearer')
          .build(),
      ),
      {
        customSiteTitle: 'NestJS APIs',
        customfavIcon: 'favicon.ico',
        swaggerOptions: {
          // Keep the token after a page refresh
          persistAuthorization: true,
        },
      },
    );
  }

  // Use cookies
  app.use(cookieParser());

  /**
   * Request & response lifecycle
   * 1. Middleware (global > module)
   * 2. Guards (global > controller > route)
   * 3. Interceptors (global > controller > route)
   * 4. Pipes (global > controller > route)
   * 5. Controller <> service
   * 6. Interceptors (route > controller > global)
   * 7. Exception filters (route > controller > global)
   */

  // 1. Middleware (pre-processing & logging)
  app.use(globalMiddleware);

  // 2. Guards (authorization)
  // 3. Interceptors (modify data before/after the request)
  // 4. Pipes (value validation)
  app.useGlobalPipes(new ValidationPipe({ whitelist: true }));

  // 5. Exception filters (error handling & error logging)
  app.useGlobalFilters(new AuthFilter(app.get(HttpAdapterHost)));

  await app.listen(3000);
}

bootstrap().then();
