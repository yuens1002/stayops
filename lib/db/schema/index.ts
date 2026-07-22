import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

// T0 placeholder proving the Drizzle → Neon push path works. The full domain
// schema (docs/PLAN.md "Data model") lands in trunk step T1.
export const appMeta = pgTable("app_meta", {
  key: text("key").primaryKey(),
  value: text("value"),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
