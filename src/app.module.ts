import { Module } from '@nestjs/common';
import { join } from 'path';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MemberModule } from './member/member.module';
import { CronModule } from './common/cron/cron.module';
import { ServeStaticModule } from '@nestjs/serve-static';
import { TypeOrmLogger } from './common/auth/typeorm.logger';
import * as Joi from 'joi';
import { ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ProxyThrottlerGuard } from './common/auth/proxy-throttler.guard';
import { HttpCacheInterceptor } from './common/auth/http-cache.interceptor';
import { CacheModule } from '@nestjs/cache-manager';
import { FileModule } from './common/file/file.module';
import { JwtModule } from '@nestjs/jwt';
import { AuthGuard } from './common/auth/auth.guard';
import { AuthInterceptor } from './common/auth/auth.interceptor';
import { Member } from './member/entities/member.entity';

// A short secret can be guessed offline from any issued token
const jwtSecret = Joi.string()
  .required()
  .when('NODE_ENV', { is: 'prod', then: Joi.string().min(32) });

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: `envs/.${process.env.NODE_ENV}.env`,
      validate: (config: Record<string, unknown>) => {
        const schema = Joi.object({
          // Runtime environment (Node environment variable)
          NODE_ENV: Joi.string()
            .valid('local', 'dev', 'prod', 'test')
            .default('dev')
            .required(),
          // Timezone (Node environment variable)
          TZ: Joi.string()
            .valid('Asia/Seoul', 'Asia/Hong_Kong', 'Asia/Tokyo', 'UTC')
            .default('Asia/Seoul')
            .required(),

          // Database
          DB_HOST: Joi.string().required(),
          DB_PORT: Joi.number().required(),
          DB_SCHEMA: Joi.string().required(),
          DB_USERNAME: Joi.string().required(),
          DB_PASSWORD: Joi.string().required(),
          DB_ENTITIES: Joi.string().required(),
          DB_CHARSET: Joi.string().required(),

          // JSON Web Token
          JWT_ACCESS_SECRET_KEY: jwtSecret,
          JWT_ACCESS_EXPIRES_TIME: Joi.string().required(),
          JWT_REFRESH_SECRET_KEY: jwtSecret,
          JWT_REFRESH_EXPIRES_TIME: Joi.string().required(),
          JWT_EMAIL_VALIDATION_SECRET_KEY: jwtSecret,
          JWT_EMAIL_VALIDATION_EXPIRES_TIME: Joi.string().required(),
          JWT_PASSWORD_RESET_SECRET_KEY: jwtSecret,
          JWT_PASSWORD_RESET_EXPIRES_TIME: Joi.string().default('30m'),

          // Origin used in email links, such as https://api.example.com
          // Verification emails are refused while this is unset
          PUBLIC_BASE_URL: Joi.string()
            .uri({ scheme: ['http', 'https'] })
            .optional(),

          // Frontend page that receives ?token= from password reset emails
          // Reset emails are not sent while this is unset
          PASSWORD_RESET_URL: Joi.string()
            .uri({ scheme: ['http', 'https'] })
            .optional(),

          // Name shown in emails and notifications
          APP_NAME: Joi.string().default('NestJS API'),

          // Receives member removal notifications (optional)
          ADMIN_EMAIL: Joi.string().email().optional(),

          // Slack
          SLACK_CHANNEL: Joi.string().required(),
          SLACK_TOKEN: Joi.string().required(),
          SLACK_WEBHOOK: Joi.string().required(),

          // Email sending account
          EMAIL_USERNAME: Joi.string().email().required(),
          EMAIL_PASSWORD: Joi.string().required(),

          // File upload paths
          UPLOAD_S3_PATH: Joi.string().required(),

          // Amazon Web Services
          AWS_ACCESS_KEY: Joi.string().required(),
          AWS_SECRET_ACCESS_KEY: Joi.string().required(),
          AWS_S3_BUCKET: Joi.string().required(),
          AWS_S3_REGION: Joi.string().required(),

          // OpenAPI (Swagger) docs credentials
          SWAGGER_USERNAME: Joi.string().required(),
          SWAGGER_PASSWORD: Joi.string().required(),
        });

        const { error, value } = schema.validate(config, {
          allowUnknown: true,
          abortEarly: true,
        });

        if (error) {
          throw error;
        }

        return value;
      },
    }),
    TypeOrmModule.forRoot({
      type: 'mysql',
      host: process.env.DB_HOST,
      port: +process.env.DB_PORT,
      username: process.env.DB_USERNAME,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_SCHEMA,
      entities: [process.env.DB_ENTITIES],
      migrations: [join(__dirname, 'database', 'migrations', '*.{js,ts}')],
      migrationsRun: process.env.DB_MIGRATIONS_RUN === 'true',
      charset: process.env.DB_CHARSET,
      // Never alter a production schema automatically
      synchronize:
        ['local', 'dev'].includes(process.env.NODE_ENV) &&
        process.env.DB_MIGRATIONS_RUN !== 'true',
      timezone: '+09:00',
      logger: new TypeOrmLogger('all'),
      maxQueryExecutionTime: 1000,
    }),
    ThrottlerModule.forRoot([
      {
        ttl: Number(process.env.THROTTLE_TTL_MS) || 10000,
        limit: Number(process.env.THROTTLE_LIMIT) || 10,
      },
    ]),
    CacheModule.register({ ttl: 2000, max: 10 }),
    JwtModule.register({}),
    // AuthGuard loads the member on every request
    TypeOrmModule.forFeature([Member]),
    ServeStaticModule.forRoot({
      rootPath: 'files',
      serveRoot: '',
      renderPath: 'files',
    }),
    FileModule,
    CronModule,
    MemberModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ProxyThrottlerGuard,
    },
    {
      provide: APP_GUARD,
      useClass: AuthGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: AuthInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: HttpCacheInterceptor,
    },
  ],
})
export class AppModule {}
