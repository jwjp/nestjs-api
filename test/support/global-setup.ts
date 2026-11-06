import { createConnection } from 'mysql2/promise';

/**
 * Starts every run from an empty schema, so the migrations are tested too
 */
export default async function globalSetup(): Promise<void> {
  const connection = await createConnection({
    host: process.env.E2E_DB_HOST ?? '127.0.0.1',
    port: Number(process.env.E2E_DB_PORT ?? 3307),
    user: process.env.E2E_DB_USERNAME ?? 'root',
    password: process.env.E2E_DB_PASSWORD ?? 'root',
  });

  await connection.query('DROP DATABASE IF EXISTS api_e2e');
  await connection.query(
    'CREATE DATABASE api_e2e CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci',
  );
  await connection.end();
}
