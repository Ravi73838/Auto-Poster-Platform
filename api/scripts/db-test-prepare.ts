import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import '../src/config/env.js';
import { env } from '../src/config/env.js';
import { PrismaClient } from '@prisma/client';
import { assertDbGuard, maskDatabaseHost, toReachableSupabaseUrl } from './db-guard.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..', '..');
const API_ROOT = path.resolve(REPO_ROOT, 'api');

function splitSqlStatements(sql: string): string[] {
  const statements: string[] = [];
  let current = '';
  let inDollarQuote = false;

  const lines = sql.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('--')) continue;

    const count = (line.match(/\$\$/g) || []).length;
    if (count % 2 !== 0) {
      inDollarQuote = !inDollarQuote;
    }

    if (!inDollarQuote && line.includes(';')) {
      const parts = line.split(';');
      for (let i = 0; i < parts.length - 1; i++) {
        current += (current ? '\n' : '') + parts[i];
        if (current.trim().length > 0) {
          statements.push(current.trim());
        }
        current = '';
      }
      current = parts[parts.length - 1] ?? '';
    } else {
      current += (current ? '\n' : '') + line;
    }
  }
  if (current.trim().length > 0) {
    statements.push(current.trim());
  }
  return statements;
}

async function main() {
  const rawTestUrl = env.DATABASE_URL_TEST;
  if (!rawTestUrl) {
    throw new Error('DATABASE_URL_TEST is required to prepare test database schema.');
  }

  // 1. Enforce DB Guard safety policy
  assertDbGuard('test', {
    targetSchema: 'test',
    connectionUrl: rawTestUrl,
  });

  const reachableUrl = toReachableSupabaseUrl(rawTestUrl);
  const maskedHost = maskDatabaseHost(reachableUrl);

  console.log(`[db:test:prepare] Target DB Host: ${maskedHost}`);
  console.log(`[db:test:prepare] Resetting isolated "test" schema...`);

  const client = new PrismaClient({
    datasources: { db: { url: reachableUrl } },
  });

  try {
    // 2. Safely recreate test schema (isolated test workspace)
    await client.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "test" CASCADE;`);
    await client.$executeRawUnsafe(`CREATE SCHEMA "test";`);
    console.log(`[db:test:prepare] Fresh "test" schema created.`);

    // 3. Generate DDL from schema.prisma
    console.log(`[db:test:prepare] Generating DDL script from schema.prisma...`);
    const ddl = execSync(
      `npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script`,
      {
        cwd: API_ROOT,
        encoding: 'utf-8',
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    );

    // 4. Split and execute individual statements in "test" schema
    const rawStatements = ddl
      .replace(/CREATE SCHEMA IF NOT EXISTS "public";/g, '')
      .split(';')
      .map((stmt) => {
        // Strip comment-only lines
        return stmt
          .split('\n')
          .filter((line) => !line.trim().startsWith('--'))
          .join('\n')
          .trim();
      })
      .filter((s) => s.length > 0);

    console.log(`[db:test:prepare] Executing ${rawStatements.length} DDL statements in schema "test"...`);

    // Ensure session search path defaults to "test"
    await client.$executeRawUnsafe(`SET search_path TO "test", public;`);

    for (let i = 0; i < rawStatements.length; i++) {
      const stmt = rawStatements[i]!;
      try {
        await client.$executeRawUnsafe(stmt);
      } catch (err: any) {
        console.error(`Statement ${i + 1} failed: ${stmt.slice(0, 100)}...`);
        throw err;
      }
    }

    // 5. Apply custom raw SQL constraints, partial indexes and triggers
    const customConstraintsPath = path.resolve(
      API_ROOT,
      'prisma/migrations/20261029115211_raw_sql_constraints/migration.sql',
    );
    if (fs.existsSync(customConstraintsPath)) {
      console.log(`[db:test:prepare] Applying custom constraints, partial indexes & triggers...`);
      const customSql = fs.readFileSync(customConstraintsPath, 'utf-8');
      const customStatements = splitSqlStatements(customSql);
      for (const cStmt of customStatements) {
        await client.$executeRawUnsafe(cStmt);
      }
      console.log(`[db:test:prepare] Applied ${customStatements.length} custom constraints & triggers.`);
    }

    console.log(`[db:test:prepare] SUCCESS: Test database schema "test" successfully initialized (${rawStatements.length} statements).`);
  } finally {
    await client.$disconnect();
  }
}

main().catch((err) => {
  console.error('[db:test:prepare] FAILED:', err.message);
  process.exit(1);
});
