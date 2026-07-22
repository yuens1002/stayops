import {
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { contacts } from "./contacts";
import { properties, units } from "./properties";

// docs/PLAN.md "Data model" — routine_series / routine_visits /
// maintenance_schedules.

export const routineSeriesStatusEnum = pgEnum("routine_series_status", [
  "active",
  "paused",
  "ended",
]);

export const maintenanceCadenceEnum = pgEnum("maintenance_cadence", [
  "monthly",
  "quarterly",
  "biannual",
  "annual",
]);

// Monthly-retainer work (pool, landscaping): billed monthly, logged per
// visit; visits do NOT generate work_orders (owner spec §5.3/§6).
// cadence is display copy (e.g. "Monthly retainer"), not an enum.
export const routineSeries = pgTable("routine_series", {
  id: uuid("id").primaryKey().defaultRandom(),
  propertyId: uuid("property_id")
    .notNull()
    .references(() => properties.id),
  contactId: uuid("contact_id")
    .notNull()
    .references(() => contacts.id),
  title: text("title").notNull(),
  cadence: text("cadence").notNull(),
  visitsPerMonth: integer("visits_per_month").notNull(),
  monthlyCostCents: integer("monthly_cost_cents").notNull(),
  status: routineSeriesStatusEnum("status").notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const routineVisits = pgTable("routine_visits", {
  id: uuid("id").primaryKey().defaultRandom(),
  seriesId: uuid("series_id")
    .notNull()
    .references(() => routineSeries.id, { onDelete: "cascade" }),
  visitedAt: timestamp("visited_at", { withTimezone: true }).notNull(),
  note: text("note"),
  photoUrl: text("photo_url"),
});

// Per-unit recurring maintenance (filter change, smoke-detector test). Items
// due fold into the generated turnover checklist as maintenance-tagged steps
// (contractor spec §5.2); completing the step stamps last_done_at.
export const maintenanceSchedules = pgTable("maintenance_schedules", {
  id: uuid("id").primaryKey().defaultRandom(),
  unitId: uuid("unit_id")
    .notNull()
    .references(() => units.id),
  label: text("label").notNull(),
  cadence: maintenanceCadenceEnum("cadence").notNull(),
  lastDoneAt: timestamp("last_done_at", { withTimezone: true }),
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
