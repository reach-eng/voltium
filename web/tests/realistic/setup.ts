const SCHEMA_NAME = 'realistic';
const { DATABASE_URL: existingUrl } = process.env;
const BASE_DB_URL =
  existingUrl || 'postgresql://postgres:postgres@localhost:5432/voltium';
const sep = BASE_DB_URL.includes('?') ? '&' : '?';
const SCHEMA_URL = BASE_DB_URL.replace(/[?&]schema=[^&]+/, '') + `${sep}schema=${SCHEMA_NAME}`;

process.env.DATABASE_URL = SCHEMA_URL;

import { beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { execSync } from 'child_process';
import path from 'path';

function baseUrl(): string {
  return BASE_DB_URL.replace(/[?&]schema=[^&]+/, '');
}

async function createSchema(): Promise<void> {
  const temp = new PrismaClient({ datasources: { db: { url: baseUrl() } } });
  try {
    await temp.$executeRawUnsafe(`CREATE SCHEMA IF NOT EXISTS "${SCHEMA_NAME}"`);
  } finally {
    await temp.$disconnect();
  }
}

function pushMigrations(): void {
  const prismaCli = path.join(__dirname, '..', '..', 'node_modules', 'prisma', 'build', 'index.js');
  execSync(`node "${prismaCli}" db push --skip-generate --accept-data-loss`, {
    cwd: path.join(__dirname, '..'),
    stdio: 'pipe',
    timeout: 30_000,
    env: { ...process.env, DATABASE_URL: SCHEMA_URL },
  });
}

beforeAll(async () => {
  await createSchema();
  pushMigrations();
}, 60000);

afterAll(async () => {
  const temp = new PrismaClient({ datasources: { db: { url: baseUrl() } } });
  try {
    await temp.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${SCHEMA_NAME}" CASCADE`);
  } finally {
    await temp.$disconnect();
  }
}, 30000);
