import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import '../src/config/env.js';
import { PrismaClient } from '@prisma/client';
import { maskDatabaseHost, toReachableSupabaseUrl } from './db-guard.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..', '..');
const API_ROOT = path.resolve(REPO_ROOT, 'api');

export interface DriftSummary {
  maskedHost: string;
  targetSchema: string;
  hasDrift: boolean;
  missingTables: string[];
  missingEnums: string[];
  missingColumns: string[];
  missingIndexes: string[];
  sqlDiffSnippet: string;
  rawSqlDiff: string;
}

export interface ReadOnlyDbInspection {
  maskedHost: string;
  extensions: { name: string; version: string }[];
  tables: string[];
  mainTableCounts: Record<string, number>;
  migrations: { name: string; finishedAt: string | null; isSuccess: boolean }[];
}

export function parseDiffSql(sql: string): {
  missingTables: string[];
  missingEnums: string[];
  missingColumns: string[];
  missingIndexes: string[];
} {
  const missingTables: string[] = [];
  const missingEnums: string[] = [];
  const missingColumns: string[] = [];
  const missingIndexes: string[] = [];

  const tableMatches = sql.matchAll(/CREATE TABLE\s+(?:(?:"[^"]+"|[a-zA-Z0-9_]+)\.)?(?:"([^"]+)"|([a-zA-Z0-9_]+))/gi);
  for (const m of tableMatches) {
    missingTables.push(m[1] || m[2]!);
  }

  const enumMatches = sql.matchAll(/CREATE TYPE\s+(?:(?:"[^"]+"|[a-zA-Z0-9_]+)\.)?(?:"([^"]+)"|([a-zA-Z0-9_]+))\s+AS ENUM/gi);
  for (const m of enumMatches) {
    missingEnums.push(m[1] || m[2]!);
  }

  const colMatches = sql.matchAll(/ALTER TABLE\s+(?:[^\s]+)\s+ADD COLUMN\s+(?:"([^"]+)"|([a-zA-Z0-9_]+))/gi);
  for (const m of colMatches) {
    missingColumns.push(m[1] || m[2]!);
  }

  const indexMatches = sql.matchAll(/CREATE(?:\s+UNIQUE)?\s+INDEX\s+(?:"([^"]+)"|([a-zA-Z0-9_]+))/gi);
  for (const m of indexMatches) {
    missingIndexes.push(m[1] || m[2]!);
  }

  return { missingTables, missingEnums, missingColumns, missingIndexes };
}

export async function getDriftReport(targetSchema = 'public'): Promise<DriftSummary> {
  const rawDbUrl = toReachableSupabaseUrl(process.env.DIRECT_URL || process.env.DATABASE_URL || '');
  if (!rawDbUrl) {
    throw new Error('DATABASE_URL or DIRECT_URL is required to generate a drift report.');
  }

  // Construct target URL with specified schema
  let schemaUrl = rawDbUrl;
  try {
    const parsed = new URL(rawDbUrl);
    parsed.searchParams.set('schema', targetSchema);
    schemaUrl = parsed.toString();
  } catch {
    const sep = rawDbUrl.includes('?') ? '&' : '?';
    schemaUrl = `${rawDbUrl}${sep}schema=${targetSchema}`;
  }

  const maskedHost = maskDatabaseHost(rawDbUrl);

  let rawSqlDiff = '';
  try {
    // Run prisma migrate diff in read-only mode
    rawSqlDiff = execSync(
      `npx prisma migrate diff --from-url "${schemaUrl}" --to-schema-datamodel prisma/schema.prisma --script`,
      {
        cwd: API_ROOT,
        encoding: 'utf-8',
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    );
  } catch (err: any) {
    const stderr = err?.stderr?.toString() || err?.message || '';
    throw new Error(`Failed to compute migrate diff: ${stderr}`);
  }

  const parsedDiff = parseDiffSql(rawSqlDiff);
  const trimmed = rawSqlDiff.trim();
  const hasDrift = trimmed.length > 0 && !trimmed.includes('This is an empty migration.');

  const lines = rawSqlDiff.split('\n').filter((l) => l.trim() && !l.startsWith('--'));
  const sqlDiffSnippet = lines.slice(0, 15).join('\n');

  return {
    maskedHost,
    targetSchema,
    hasDrift,
    missingTables: parsedDiff.missingTables,
    missingEnums: parsedDiff.missingEnums,
    missingColumns: parsedDiff.missingColumns,
    missingIndexes: parsedDiff.missingIndexes,
    sqlDiffSnippet,
    rawSqlDiff,
  };
}

export async function inspectDatabase(targetSchema = 'public'): Promise<ReadOnlyDbInspection> {
  const rawDbUrl = toReachableSupabaseUrl(process.env.DIRECT_URL || process.env.DATABASE_URL || '');
  const maskedHost = maskDatabaseHost(rawDbUrl);

  let schemaUrl = rawDbUrl;
  try {
    const parsed = new URL(rawDbUrl);
    parsed.searchParams.set('schema', targetSchema);
    schemaUrl = parsed.toString();
  } catch {
    const sep = rawDbUrl.includes('?') ? '&' : '?';
    schemaUrl = `${rawDbUrl}${sep}schema=${targetSchema}`;
  }

  const client = new PrismaClient({
    datasources: { db: { url: schemaUrl } },
  });

  try {
    // 1. Installed extensions
    let extensionsRaw: { extname: string; extversion: string }[] = [];
    try {
      extensionsRaw = await client.$queryRaw<
        { extname: string; extversion: string }[]
      >`SELECT extname, extversion FROM pg_extension ORDER BY extname ASC;`;
    } catch {
      extensionsRaw = [];
    }

    // 2. Existing tables in targetSchema
    let tablesRaw: { table_name: string }[] = [];
    try {
      tablesRaw = await client.$queryRaw<
        { table_name: string }[]
      >`SELECT table_name FROM information_schema.tables WHERE table_schema = ${targetSchema} AND table_type = 'BASE TABLE' ORDER BY table_name ASC;`;
    } catch {
      tablesRaw = [];
    }

    const tables = tablesRaw.map((t) => t.table_name);

    // 3. Row counts for main tables
    const mainTablesToCheck = ['users', 'campaigns', 'assignments', 'ledger_entries', 'driver_profiles', 'company_profiles'];
    const mainTableCounts: Record<string, number> = {};

    for (const tableName of mainTablesToCheck) {
      if (tables.includes(tableName)) {
        try {
          const countRes = await client.$queryRawUnsafe<{ count: bigint }[]>(
            `SELECT COUNT(*) as count FROM "${targetSchema}"."${tableName}";`,
          );
          mainTableCounts[tableName] = Number(countRes[0]?.count || 0n);
        } catch {
          mainTableCounts[tableName] = 0;
        }
      } else {
        mainTableCounts[tableName] = 0;
      }
    }

    // 4. Migration history from _prisma_migrations
    let migrations: { name: string; finishedAt: string | null; isSuccess: boolean }[] = [];
    try {
      const migs = await client.$queryRaw<
        { migration_name: string; finished_at: Date | null; rolled_back_at: Date | null }[]
      >`SELECT migration_name, finished_at, rolled_back_at FROM _prisma_migrations ORDER BY finished_at ASC;`;
      migrations = migs.map((m) => ({
        name: m.migration_name,
        finishedAt: m.finished_at ? m.finished_at.toISOString() : null,
        isSuccess: Boolean(m.finished_at && !m.rolled_back_at),
      }));
    } catch {
      migrations = [];
    }

    return {
      maskedHost,
      extensions: extensionsRaw.map((e) => ({ name: e.extname, version: e.extversion })),
      tables,
      mainTableCounts,
      migrations,
    };
  } finally {
    await client.$disconnect();
  }
}

// CLI runner
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const schemaArgIndex = process.argv.indexOf('--schema');
  const targetSchema = schemaArgIndex !== -1 ? process.argv[schemaArgIndex + 1] || 'public' : 'public';

  async function run() {
    console.log(`\n=== DATABASE READ-ONLY INSPECTION & DRIFT REPORT ===`);
    const inspection = await inspectDatabase(targetSchema);
    console.log(`Database Host (Masked): ${inspection.maskedHost}`);
    console.log(`Target Schema:          ${targetSchema}`);
    console.log(`\n1. PostgreSQL Extensions:`);
    if (inspection.extensions.length === 0) {
      console.log(`   (None found or query unavailable)`);
    } else {
      for (const ext of inspection.extensions) {
        console.log(`   - ${ext.name} (${ext.version})`);
      }
    }

    console.log(`\n2. Existing Tables in "${targetSchema}" (${inspection.tables.length} tables total):`);
    console.log(`   Main Table Row Counts:`);
    for (const [t, c] of Object.entries(inspection.mainTableCounts)) {
      console.log(`     - ${t.padEnd(20)}: ${c} row(s)`);
    }

    console.log(`\n3. Migration History (_prisma_migrations - ${inspection.migrations.length} total):`);
    for (const m of inspection.migrations) {
      const status = m.isSuccess ? 'APPLIED' : 'FAILED/ROLLED_BACK';
      console.log(`   - [${status}] ${m.name} (${m.finishedAt || 'pending'})`);
    }

    console.log(`\n4. Schema Drift against schema.prisma:`);
    const drift = await getDriftReport(targetSchema);
    if (!drift.hasDrift) {
      console.log(`   \x1b[32m[ZERO DRIFT] Database matches schema.prisma perfectly.\x1b[0m`);
    } else {
      console.log(`   \x1b[33m[DRIFT DETECTED]\x1b[0m`);
      console.log(`   - Missing Tables:  ${drift.missingTables.length} (${drift.missingTables.join(', ') || 'none'})`);
      console.log(`   - Missing Enums:   ${drift.missingEnums.length} (${drift.missingEnums.join(', ') || 'none'})`);
      console.log(`   - Missing Columns: ${drift.missingColumns.length}`);
      console.log(`   - Missing Indexes: ${drift.missingIndexes.length}`);
      if (drift.sqlDiffSnippet) {
        console.log(`\n   SQL Diff Preview (first lines):`);
        console.log(`   ------------------------------------------`);
        console.log(drift.sqlDiffSnippet.replace(/^/gm, '   '));
        console.log(`   ------------------------------------------`);
      }
    }

    console.log(`====================================================\n`);
    process.exit(0);
  }

  run().catch((err) => {
    console.error('[db:drift] Error:', err.message);
    process.exit(1);
  });
}
