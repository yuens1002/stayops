import { integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { properties, units } from "./properties";
import { workOrders } from "./workflows";

// docs/PLAN.md "Data model" — expenses. (addon_products / addon_purchases were
// removed by the 2026-07-23 iteration-1 pivot — deferred with payments.)

// Reporting: work-order costs (populated on approval) + non-work-order costs
// (insurance, taxes).
export const expenses = pgTable("expenses", {
  id: uuid("id").primaryKey().defaultRandom(),
  propertyId: uuid("property_id").references(() => properties.id),
  unitId: uuid("unit_id").references(() => units.id),
  workOrderId: uuid("work_order_id").references(() => workOrders.id),
  category: text("category").notNull(),
  amountCents: integer("amount_cents").notNull(),
  incurredAt: timestamp("incurred_at", { withTimezone: true }).notNull(),
  notes: text("notes"),
});
