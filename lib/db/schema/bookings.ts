import {
  boolean,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { units } from "./properties";

// docs/PLAN.md "Data model" — bookings / guest_sessions.

export const bookingStatusEnum = pgEnum("booking_status", [
  "pending_payment",
  "confirmed",
  "cancelled",
  "completed",
]);

export const bookings = pgTable("bookings", {
  id: uuid("id").primaryKey().defaultRandom(),
  unitId: uuid("unit_id")
    .notNull()
    .references(() => units.id),
  checkIn: timestamp("check_in", { withTimezone: true }).notNull(),
  checkOut: timestamp("check_out", { withTimezone: true }).notNull(),
  guestName: text("guest_name").notNull(),
  guestEmail: text("guest_email").notNull(),
  guestPhone: text("guest_phone"),
  // party_size/pets surface on the owner calendar bars and contractor job
  // context.
  partySize: integer("party_size").notNull(),
  pets: boolean("pets").notNull().default(false),
  status: bookingStatusEnum("status").notNull().default("pending_payment"),
  // Stripe ids are lifecycle-dependent: null until the Checkout Session is
  // created / the payment lands.
  stripeCheckoutSessionId: text("stripe_checkout_session_id"),
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  amountCents: integer("amount_cents").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// Tokenized concierge-chat link, issued once a booking confirms; valid for
// the whole stay (docs/PLAN.md "Guest concierge chat").
export const guestSessions = pgTable(
  "guest_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    bookingId: uuid("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex("guest_sessions_token_hash_idx").on(t.tokenHash)],
);
