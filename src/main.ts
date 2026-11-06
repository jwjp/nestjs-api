import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';
import { utilities as WinstonUtilities, WinstonModule } from 'nest-winston';
import * as winston from 'winston';
import * as basicAuth from 'express-basic-auth';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
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

  configureApp(app);

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

  await app.listen(Number(process.env.PORT) || 3000);
}

bootstrap().then();
