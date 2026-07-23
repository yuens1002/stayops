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

// docs/PLAN.md "Data model" — bookings / guest_sessions (amended by the
// 2026-07-23 iteration-1 pivot: bookings sync in from third-party platforms;
// no payment columns).

export const bookingStatusEnum = pgEnum("booking_status", [
  "confirmed",
  "cancelled",
  "completed",
]);

// booking = short-term stay; lease = mid-term arrangement (Furnished Finder /
// direct, monthly rent); block = owner date-block (personal use, maintenance
// window) — no guest, no auto-turnover, exported via the unit's iCal feed.
export const bookingKindEnum = pgEnum("booking_kind", [
  "booking",
  "lease",
  "block",
]);

export const bookingSourceEnum = pgEnum("booking_source", [
  "airbnb",
  "furnished_finder",
  "manual",
]);

export const bookings = pgTable(
  "bookings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    unitId: uuid("unit_id")
      .notNull()
      .references(() => units.id),
    kind: bookingKindEnum("kind").notNull().default("booking"),
    source: bookingSourceEnum("source").notNull(),
    // iCal event UID for platform-synced rows — the sync idempotency key.
    externalRef: text("external_ref"),
    // Platform confirmation code (Airbnb email enrichment match key).
    confirmationCode: text("confirmation_code"),
    checkIn: timestamp("check_in", { withTimezone: true }).notNull(),
    checkOut: timestamp("check_out", { withTimezone: true }).notNull(),
    // Nullable: iCal feeds carry no contact info — enrichment or the owner
    // fills these in; kind=block rows never have them.
    guestName: text("guest_name"),
    guestEmail: text("guest_email"),
    guestPhone: text("guest_phone"),
    // party_size/pets surface on the owner calendar bars and contractor job
    // context.
    partySize: integer("party_size"),
    pets: boolean("pets").notNull().default(false),
    status: bookingStatusEnum("status").notNull().default("confirmed"),
    // Payout for the stay (email-enriched or manual) — platforms collect the
    // money; this is bookkeeping only.
    amountCents: integer("amount_cents"),
    // kind=lease only.
    monthlyRentCents: integer("monthly_rent_cents"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex("bookings_external_ref_idx").on(t.externalRef)],
);

// Tokenized concierge-chat link, ISSUED BY THE OWNER once the booking has
// guest contact info (no payment webhook exists to auto-mint it) — valid for
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
