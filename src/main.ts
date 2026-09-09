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
        // 콘솔 표시 정보
        new winston.transports.Console({
          // level: silly < debug < verbose < http < info < warn < error
          level: process.env.NODE_ENV === 'prod' ? 'warn' : 'debug',
        }),
        // 에러 로그
        new winston.transports.File({
          filename: 'logs/error.log',
          level: 'error',
          format: winston.format.uncolorize(),
        }),
        // 통합 로그
        new winston.transports.File({
          filename: 'logs/combined.log',
          level: 'debug',
          format: winston.format.uncolorize(),
        }),
      ],
    }),
  });

  // HTTP 보안 설정
  // https://github.com/helmetjs/helmet
  app.use(helmet());

  // CORS 활성화
  // https://github.com/expressjs/cors
  app.enableCors();

  // 프록시 신뢰 설정
  app.set('trust proxy', true);

  // 개발 환경에서만 Swagger 사용
  if (['local', 'dev'].includes(process.env.NODE_ENV)) {
    // Swagger 페이지 보호
    app.use(
      ['/docs', '/docs-json'],
      basicAuth({
        challenge: true,
        users: {
          [process.env.SWAGGER_USERNAME]: process.env.SWAGGER_PASSWORD,
        },
      }),
    );

    // Swagger 설정
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
          // 새로고침 해도 Token 값 유지
          persistAuthorization: true,
        },
      },
    );
  }

  // 쿠키 사용
  app.use(cookieParser());

  /**
   * 요청 & 응답 생명주기
   * 1. 미들웨어 (전역 > 모듈)
   * 2. 가드 (전역 > 컨트롤러 > 라우터)
   * 3. 인터셉터 (전역 > 컨트롤러 > 라우터)
   * 4. 파이프 (전역 > 컨트롤러 > 라우터)
   * 5. 컨트롤러 < > 서비스
   * 6. 인터셉터 (라우터 > 컨트롤러 > 전역)
   * 7. 예외 필터 (라우터 > 컨트롤러 > 전역)
   */

  // 1. 미들웨어 (전처리 작업 & 로그 기록)
  app.use(globalMiddleware);

  // 2. 가드 (권한 인증)
  // 3. 인터셉터 (요청 전/후 데이터 수정)
  // 4. 파이프 (값 검증)
  app.useGlobalPipes(new ValidationPipe({ whitelist: true }));

  // 5. 예외 필터 (에러 처리 & 에러 로그 기록)
  app.useGlobalFilters(new AuthFilter(app.get(HttpAdapterHost)));

  await app.listen(3000);
}

bootstrap().then();
