/**
 * T1 / D7 — seed invariants against the seeded dev DB (AC-TST-2).
 *
 * Asserts the invariants named in docs/features/t1-contracts/acs.md: the
 * `needs_revision` work order carries a non-empty `review_note`; the turnover
 * (cleaning) template prescribes >=1 `requires_photo` step and >=1 step with
 * `stock_items`; `comm_sync_state` carries per-source cursor rows; a lease + block are seeded.
 *
 * Runs against the same `.env.local` the app uses (loaded via `@next/env`,
 * same pattern as drizzle.config.ts / scripts/seed.ts). Skips with a clear
 * message when DATABASE_URL is missing so `npm test` stays green offline.
 */
import { loadEnvConfig } from "@next/env";
import { describe, expect, it } from "vitest";

// vitest sets NODE_ENV=test, and @next/env deliberately skips `.env.local` in
// test mode — but this suite must hit the same dev Neon branch the app and
// seed script use, so load env the way they do (development mode), then
// restore NODE_ENV for the rest of the run.
{
  const env = process.env as Record<string, string | undefined>;
  const previousNodeEnv = env.NODE_ENV;
  env.NODE_ENV = "development";
  loadEnvConfig(process.cwd());
  if (previousNodeEnv === undefined) {
    // Assigning undefined would coerce to the string "undefined" — delete instead.
    delete env.NODE_ENV;
  } else {
    env.NODE_ENV = previousNodeEnv;
  }
}

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.warn(
    "[tests/seed.test.ts] DATABASE_URL is not set (expected in .env.local) — " +
      "skipping seed-invariant tests (AC-TST-2). Point DATABASE_URL at the " +
      "seeded dev Neon branch and re-run `npm test` to execute them.",
  );
}

const describeDb = databaseUrl ? describe : describe.skip;

// Neon HTTP round-trips per query; give DB tests headroom over the default 5s.
const DB_TEST_TIMEOUT_MS = 20_000;

describeDb("seed invariants (seeded dev DB)", () => {
  // Deferred + lazy so the driver is only constructed when DATABASE_URL exists.
  async function getDb() {
    const [{ neon }, { drizzle }, schema] = await Promise.all([
      import("@neondatabase/serverless"),
      import("drizzle-orm/neon-http"),
      import("../lib/db/schema"),
    ]);
    return { db: drizzle(neon(databaseUrl!), { schema }), schema };
  }

  it(
    "every needs_revision work order carries a non-empty review_note",
    { timeout: DB_TEST_TIMEOUT_MS },
    async () => {
      const { db, schema } = await getDb();
      const { eq } = await import("drizzle-orm");
      const rows = await db
        .select({
          id: schema.workOrders.id,
          reviewNote: schema.workOrders.reviewNote,
        })
        .from(schema.workOrders)
        .where(eq(schema.workOrders.status, "needs_revision"));

      expect(
        rows.length,
        "seed must produce at least one needs_revision work order (plan D6)",
      ).toBeGreaterThanOrEqual(1);
      for (const row of rows) {
        expect(
          (row.reviewNote ?? "").trim().length,
          `needs_revision work order ${row.id} must carry a non-empty review_note ` +
            "(the owner's request-changes note pinned on the reopened checklist)",
        ).toBeGreaterThan(0);
      }
    },
  );

  it(
    "a turnover (cleaning) template prescribes a requires_photo step and a stock_items step",
    { timeout: DB_TEST_TIMEOUT_MS },
    async () => {
      const { db, schema } = await getDb();
      const { eq, inArray } = await import("drizzle-orm");
      const templates = await db
        .select({ id: schema.workflowTemplates.id })
        .from(schema.workflowTemplates)
        .where(eq(schema.workflowTemplates.type, "cleaning"));

      expect(
        templates.length,
        "seed must produce at least one cleaning workflow template (plan D6)",
      ).toBeGreaterThanOrEqual(1);

      const steps = await db
        .select({
          templateId: schema.workflowTemplateSteps.templateId,
          requiresPhoto: schema.workflowTemplateSteps.requiresPhoto,
          stockItems: schema.workflowTemplateSteps.stockItems,
        })
        .from(schema.workflowTemplateSteps)
        .where(
          inArray(
            schema.workflowTemplateSteps.templateId,
            templates.map((t) => t.id),
          ),
        );

      const satisfying = templates.filter((t) => {
        const own = steps.filter((s) => s.templateId === t.id);
        return (
          own.some((s) => s.requiresPhoto) &&
          own.some((s) => (s.stockItems?.length ?? 0) > 0)
        );
      });
      expect(
        satisfying.length,
        "at least one cleaning template must have >=1 requires_photo step and " +
          ">=1 step with stock_items (the photo-evidence + stock-check gates the " +
          "contractor checklist is built on)",
      ).toBeGreaterThanOrEqual(1);
    },
  );

  it(
    "comm_sync_state carries the airbnb_email cursor row (per-source keys only)",
    { timeout: DB_TEST_TIMEOUT_MS },
    async () => {
      const { db, schema } = await getDb();
      const rows = await db
        .select({ id: schema.commSyncState.id })
        .from(schema.commSyncState);

      const ids = rows.map((r) => r.id);
      expect(
        ids,
        "the v1 ingestion source 'airbnb_email' must have a cursor row",
      ).toContain("airbnb_email");
      for (const id of ids) {
        expect(
          schema.COMM_SYNC_SOURCES,
          `comm_sync_state row '${id}' must use a known source key`,
        ).toContain(id);
      }
    },
  );

  it(
    "seed covers a lease and an owner date-block",
    { timeout: DB_TEST_TIMEOUT_MS },
    async () => {
      const { db, schema } = await getDb();
      const rows = await db
        .select({ kind: schema.bookings.kind })
        .from(schema.bookings);

      const kinds = rows.map((r) => r.kind);
      expect(kinds, "a kind=lease booking must be seeded").toContain("lease");
      expect(kinds, "a kind=block date-block must be seeded").toContain("block");
    },
  );
});
