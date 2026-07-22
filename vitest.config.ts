import { defineConfig } from "vitest/config";

/**
 * T1 / D7 — vitest runner config (docs/features/t1-contracts/plan.md).
 *
 * Contract + seed invariant suites live under `tests/`. DB-touching tests load
 * `.env.local` themselves via `@next/env` (same pattern as drizzle.config.ts /
 * scripts/seed.ts) and self-skip with a clear message when DATABASE_URL is
 * missing, so `npm test` is deterministic and non-interactive everywhere.
 */
export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
  },
});
