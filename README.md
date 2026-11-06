# NestJS API

A backend template with members, roles, branch authority, files on S3, migrations, and end-to-end tests.

### Quick Start

Requires Node.js 24.9 or newer and Docker.

```bash
cp .env.example envs/.local.env   # create the envs folder first
docker compose up -d db
npm ci
npm run build
npm run start:local
```

The API runs on port 3000, and the Swagger docs are at `/docs` in `local` and `dev`.

The first administrator is set directly in the database:

```sql
UPDATE member SET role = 'admin', emailValidateAt = NOW() WHERE loginId = 'your-id';
```

To run the API in a container instead, use `docker compose --profile api up --build`.

### Tests

```bash
npm test             # unit tests
docker compose up -d db
npm run test:e2e     # the real application and MySQL, with email, Slack and S3 replaced
```

The e2e run drops and recreates the `api_e2e` schema through the migrations. Set `E2E_DB_HOST`, `E2E_DB_PORT`, `E2E_DB_USERNAME` and `E2E_DB_PASSWORD` to use another server.

### Authentication and Authority

| Rule | Behavior |
|---|---|
| Sessions | The access token is checked against the database on every request, so a role change, removal, password change or logout applies immediately. This adds one primary key lookup per request. |
| Refresh tokens | Stored as a digest and usable once. Store the `refreshToken` returned by `POST /members/refresh`. Each member has one active refresh token, so a new login replaces the previous one. |
| Email verification | Only records `emailValidateAt`. It does not grant anything by itself. |
| Roles | Set with `PATCH /members/:id/role` by an administrator. Only a verified member can become an administrator, and nobody can change their own role or remove themselves. |
| Branch authority | `AuthorityService.assertBranchAccess` limits regular members to their granted branches. The file API uses it; call it the same way from new branch-scoped services. |
| Menu authority | Stored and returned by `GET /members/me` for building navigation, but not enforced by the API, because menus do not map to routes yet. |

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
| Files             | `@types/multer`, `multer`, `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`, `@nestjs/serve-static` |
| Documentation     | `@nestjs/swagger`                                                                    |
| Security          | `express-basic-auth`, `helmet`, `@nestjs/throttler`                                  |
| Caching           | `@nestjs/cache-manager`, `cache-manager`                                             |

### Backlog

1. Redis (Queues, Rate Limiting, Caching)
2. WebSocket (ws/socket.io)

### Structure

```
├── envs  # environment variables
├── logs  # log files
├── files # public static files, served from the root path
├── test  # e2e tests
└── src
    ├── common
    │   ├── auth  # authentication, authorization, security, exception filters
    │   ├── chat  # mail, Slack
    │   ├── cron  # scheduling, health checks
    │   └── file  # file upload, download, deletion on S3
    ├── database  # TypeORM data source and migrations
    └── member    # member, menu, branch, authority CRUD
```

### Commands

| Command                                       | Description                                                              |
|------------------------------------------------|---------------------------------------------------------------------------|
| nest -h                                       | List available CLI commands [(see options)](https://docs.nestjs.com/cli/usages) |
| nest g res common/sample --no-spec            | Creates the src/common/sample folder and generates CRUD plus entities/dto folders, without test files |
| nest g f common/sample --no-spec              | Generates sample.filter.ts (without a test file) inside the existing src/common/sample folder |
| nest g f common/sample/test --no-spec --flat  | Generates test.filter.ts (without a test file) inside the existing src/common/sample folder |
| pm2 start ecosystem.config.js                 | Runs `dist/main.js` with `NODE_ENV=prod` [(see options)](https://pm2.keymetrics.io/docs/usage/quick-start/) |
| NODE_ENV=local npm run migration:generate -- src/database/migrations/Name | Generates a migration from entity changes |
| NODE_ENV=local npm run migration:run          | Applies pending migrations |
| NODE_ENV=local npm run migration:revert       | Reverts the latest migration |
| npm run migration:run:prod                    | Applies pending migrations from `dist` |

### Environment Variables

`.env.example` lists every variable. `NODE_ENV` selects `envs/.{NODE_ENV}.env`.

`synchronize` runs only when `NODE_ENV` is `local` or `dev` and `DB_MIGRATIONS_RUN` is not `true`. Apply schema changes to `prod` with `npm run migration:run:prod`.

A database created before migrations were added already has the `Initial` tables. Before the first run, record that migration as applied:

```sql
CREATE TABLE IF NOT EXISTS migrations (id int NOT NULL AUTO_INCREMENT PRIMARY KEY, timestamp bigint NOT NULL, name varchar(255) NOT NULL);
INSERT INTO migrations (timestamp, name) VALUES (1793976185388, 'Initial1793976185388');
```

### Notes

- Versions used: `nodejs-24`, `nestjs-12`, `typeorm-1`, `mysql-8.0`, `nginx-1.18.0`, `pm2-5.3.1`
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
