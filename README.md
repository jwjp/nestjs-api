### Installed Packages

| Category         | Package                                                                              |
|-------------------|---------------------------------------------------------------------------------------|
| Environment variables | `@nestjs/config`                                                                 |
| Database          | `@nestjs/typeorm`, `typeorm`, `mysql2`                                               |
| Validation        | `class-transformer`, `class-validator`, `joi`                                        |
| Logging           | `nest-winston`, `winston`                                                            |
| Authentication    | `@nestjs/jwt` `cookie-parser`, `@types/cookie-parser`                                |
| Scheduling        | `@nestjs/schedule`                                                                   |
| Health check      | `@nestjs/terminus`, `@nestjs/axios`, `axios`                                         |
| Messaging         | `nodemailer`, `@types/nodemailer`                                                    |
| Files             | `@types/multer`, `multer`, `@aws-sdk/client-s3`, `multer-s3`, `@nestjs/serve-static` |
| Documentation     | `@nestjs/swagger`                                                                    |
| Security          | `express-basic-auth`, `helmet`, `@nestjs/throttler`                                  |
| Caching           | `@nestjs/cache-manager`, `cache-manager`                                             |

### Backlog

1. Testing
2. Redis (Queues, Rate Limiting, Caching)
3. WebSocket (ws/socket.io)
4. CI/CD (GitHub Actions/Jenkins)

### Structure

```
├── envs  # environment variables
├── logs  # log files
├── files # resource files & temporary upload path
└── src
    ├── common
    │   ├── auth  # authentication, authorization, security, exception filters
    │   ├── chat  # mail, MMS, chat, Slack
    │   ├── cron  # scheduling, queues, health checks
    │   └── file  # file CRUD, Excel import/export
    └── member    # member, menu, branch, authority CRUD
```

### Commands

| Command                                       | Description                                                              |
|------------------------------------------------|---------------------------------------------------------------------------|
| nest -h                                       | List available CLI commands [(see options)](https://docs.nestjs.com/cli/usages) |
| nest g res common/sample --no-spec            | Creates the src/common/sample folder and generates CRUD plus entities/dto folders, without test files |
| nest g f common/sample --no-spec              | Generates sample.filter.ts (without a test file) inside the existing src/common/sample folder |
| nest g f common/sample/test --no-spec --flat  | Generates test.filter.ts (without a test file) inside the existing src/common/sample folder |
| pm2 start ecosystem.config.js                 | pm2 start command [(see options)](https://pm2.keymetrics.io/docs/usage/quick-start/) |

### Environment Variables
```conf
ROOT_DIRECTORY=sample-test

DB_HOST=localhost
DB_PORT=3306
DB_SCHEMA=api
DB_USERNAME=root
DB_PASSWORD=root
DB_ENTITIES=dist/**/*.entity.{js,ts}
DB_CHARSET=utf8mb4_unicode_ci

JWT_ACCESS_SECRET_KEY='sample-test-jwt-access'
JWT_ACCESS_EXPIRES_TIME=3h
JWT_REFRESH_SECRET_KEY='sample-test-jwt-refresh'
JWT_REFRESH_EXPIRES_TIME=9h
JWT_EMAIL_VALIDATION_SECRET_KEY='sample-test-jwt-email'
JWT_EMAIL_VALIDATION_EXPIRES_TIME=30m

SLACK_CHANNEL=
SLACK_TOKEN=
SLACK_WEBHOOK=

EMAIL_USERNAME=
EMAIL_PASSWORD=

UPLOAD_DISK_PATH=files
UPLOAD_S3_PATH=files

AWS_ACCESS_KEY=
AWS_SECRET_ACCESS_KEY=
AWS_S3_BUCKET=
AWS_S3_REGION=

SWAGGER_USERNAME=sample-test-swagger
SWAGGER_PASSWORD=sample-test-password
```

### Notes

- Versions used: `nvm-0.39.7`, `nodejs-20.11.0`, `npm-10.2.4`, `nestjs-10.3.0`, `mysql-8.0.35`, `nginx-1.18.0`, `pm2-5.3.1`
- Uses the packages recommended by the [official documentation](https://docs.nestjs.com/)
- [@nestjs/terminus](https://docs.nestjs.com/recipes/terminus)
- [@nestjs/axios](https://docs.nestjs.com/techniques/http-module)
- [@nestjs/schedule node-cron](https://github.com/kelektiv/node-cron)
- [@nestjs/typeorm decorator](https://typeorm.io/decorator-reference)
- [@nestjs/cache-manager](https://docs.nestjs.com/techniques/caching)
- [class-validator](https://github.com/typestack/class-validator)
- [winston](https://github.com/winstonjs/winston)
- [helmet](https://github.com/helmetjs/helmet)
- [cors](https://github.com/expressjs/cors)
- [pm2](https://pm2.keymetrics.io/docs/usage/quick-start/)
- [nvm](https://github.com/nvm-sh/nvm?tab=readme-ov-file#usage)
- [aws s3 sdk examples](https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/javascript_s3_code_examples.html)
- [git commit convention](https://www.conventionalcommits.org/en/v1.0.0/)
- [Installing nvm via Homebrew](https://formulae.brew.sh/formula/nvm)
- [Installing mysql via Homebrew](https://formulae.brew.sh/formula/mysql)

### Production Environment
- Server: AWS EC2 (Ubuntu 22.04.4 LTS)
- DB: AWS RDS (MySQL 8.0.35)
- Web server: nginx/1.18.0, pm2/5.3.1
  - nginx configuration (HTTPS termination is configured on the 443 listener of the AWS load balancer)
    - ```
      server {
        listen 80 default_server;
        listen [::]:80 default_server;

        location = /health-check {
                access_log off;
                return 200 'OK';
                add_header Content-Type text/plain;
        }

        location ^~ / {
                return 444;
        }
      }

      server {
        listen 80;
        listen [::]:80;
        server_name SAMPLE_DOMAIN;

        location ~ /\. {
                return 444;
        }

        location / {
                if ($http_x_forwarded_proto = 'http') {
                        return 301 https://$server_name$request_uri;
                }

                limit_except GET POST PUT PATCH DELETE { deny all; }

                proxy_pass http://127.0.0.1:3000;
                proxy_http_version 1.1;
                proxy_set_header X-Real-IP $remote_addr;
                proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
                proxy_set_header Upgrade $http_upgrade;
                proxy_set_header Connection 'upgrade';
                proxy_set_header Host $host;
                proxy_cache_bypass $http_upgrade;
        }
      }
      ```
