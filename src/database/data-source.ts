import { existsSync } from 'fs';
import { join } from 'path';
import { DataSource } from 'typeorm';

// The TypeORM CLI runs outside Nest, so it loads the same env file itself
const envFile = `envs/.${process.env.NODE_ENV ?? 'local'}.env`;
if (existsSync(envFile)) {
  process.loadEnvFile(envFile);
}

export default new DataSource({
  type: 'mysql',
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_SCHEMA,
  charset: process.env.DB_CHARSET,
  timezone: '+09:00',
  entities: [join(__dirname, '..', '**', '*.entity.{js,ts}')],
  migrations: [join(__dirname, 'migrations', '*.{js,ts}')],
});
