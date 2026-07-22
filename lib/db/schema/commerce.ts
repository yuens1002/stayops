import {
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { bookings } from "./bookings";
import { properties, units } from "./properties";
import { workflowTemplates, workOrders } from "./workflows";

// docs/PLAN.md "Data model" — expenses / addon_products / addon_purchases.

export const fulfillmentTypeEnum = pgEnum("fulfillment_type", [
  "none",
  "work_order",
]);

export const addonPurchaseStatusEnum = pgEnum("addon_purchase_status", [
  "pending_payment",
  "paid",
]);

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

// e.g. "firewood bundle" (fulfillment_type=work_order, spawns a work order
// for a contact), "late checkout" (fulfillment_type=none, just flags the
// booking for owner review). unit_id null = available at any unit.
export const addonProducts = pgTable("addon_products", {
  id: uuid("id").primaryKey().defaultRandom(),
  unitId: uuid("unit_id").references(() => units.id),
  name: text("name").notNull(),
  description: text("description"),
  priceCents: integer("price_cents").notNull(),
  fulfillmentType: fulfillmentTypeEnum("fulfillment_type").notNull(),
  defaultWorkflowTemplateId: uuid("default_workflow_template_id").references(
    () => workflowTemplates.id,
  ),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// Guest can buy these ANY time during their stay, not just at booking time.
export const addonPurchases = pgTable("addon_purchases", {
  id: uuid("id").primaryKey().defaultRandom(),
  bookingId: uuid("booking_id")
    .notNull()
    .references(() => bookings.id),
  addonProductId: uuid("addon_product_id")
    .notNull()
    .references(() => addonProducts.id),
  workOrderId: uuid("work_order_id").references(() => workOrders.id),
  amountCents: integer("amount_cents").notNull(),
  // Stripe ids are lifecycle-dependent: null until the Checkout Session is
  // created / the payment lands.
  stripeCheckoutSessionId: text("stripe_checkout_session_id"),
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  status: addonPurchaseStatusEnum("status").notNull().default("pending_payment"),
  purchasedAt: timestamp("purchased_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
