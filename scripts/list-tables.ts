#!/usr/bin/env tsx
/**
 * AC evidence tooling (T1 / AC-FN-1, AC-FN-7): lists all public tables in the
 * connected database.
 *
 * Usage:
 *   npx tsx scripts/list-tables.ts            # table names, one per line
 *   npx tsx scripts/list-tables.ts --counts   # adds per-table row counts
 */
import { loadEnvConfig } from "@next/env";
import { neon } from "@neondatabase/serverless";

// Runs outside Next, so load .env.local the way Next does (same pattern as
// drizzle.config.ts).
loadEnvConfig(process.cwd());

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL is not set (expected in .env.local)");
  process.exit(1);
}

const withCounts = process.argv.includes("--counts");
const sql = neon(databaseUrl);

async function main() {
  const tables = (await sql`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ORDER BY table_name
  `) as { table_name: string }[];

  if (tables.length === 0) {
    console.log("(no public tables)");
    return;
  }

  for (const { table_name } of tables) {
    if (withCounts) {
      // Identifier comes from information_schema (not user input); quote it
      // since identifiers can't be bound as parameters.
      const [{ n }] = (await sql.query(
        `SELECT count(*)::int AS n FROM "${table_name}"`,
      )) as { n: number }[];
      console.log(`${table_name}\t${n}`);
    } else {
      console.log(table_name);
    }
  }
  console.log(`-- ${tables.length} table(s)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
