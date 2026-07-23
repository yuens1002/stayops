import { pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { units } from "./properties";

// docs/PLAN.md "Booking ingestion" — per-unit IMPORT feed URLs, polled by the
// ingestion cron. The EXPORT direction is per-unit via units.ical_export_token
// (see properties.ts).

export const calendarPlatformEnum = pgEnum("calendar_platform", [
  "airbnb",
  "furnished_finder",
  "other",
]);

export const calendarFeeds = pgTable("calendar_feeds", {
  id: uuid("id").primaryKey().defaultRandom(),
  unitId: uuid("unit_id")
    .notNull()
    .references(() => units.id, { onDelete: "cascade" }),
  platform: calendarPlatformEnum("platform").notNull(),
  url: text("url").notNull(),
  lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
  // Content hash of the last fetch — skip processing when the feed is unchanged.
  lastHash: text("last_hash"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
