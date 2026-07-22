import {
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

// docs/PLAN.md "Data model" — properties / units.

export const unitTypeEnum = pgEnum("unit_type", [
  "whole_property",
  "adu",
  "private_room",
  "shared_room",
]);

// Owner spec §4 portfolio list: status pill Active/Inactive.
export const unitStatusEnum = pgEnum("unit_status", ["active", "inactive"]);

export const properties = pgTable("properties", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  address: text("address").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const units = pgTable("units", {
  id: uuid("id").primaryKey().defaultRandom(),
  propertyId: uuid("property_id")
    .notNull()
    .references(() => properties.id),
  label: text("label").notNull(),
  unitType: unitTypeEnum("unit_type").notNull(),
  baseNightlyRateCents: integer("base_nightly_rate_cents").notNull(),
  maxGuests: integer("max_guests").notNull(),
  houseRules: text("house_rules"),
  status: unitStatusEnum("status").notNull().default("active"),
  // Access info (wifi/door code/house manual) renders on the guest concierge
  // but is LOCKED until 24h before check-in (guest spec §3);
  // cancellation_policy is the copy + rule source for guest self-service
  // cancel/date-change.
  wifiNetwork: text("wifi_network"),
  wifiPassword: text("wifi_password"),
  doorCode: text("door_code"),
  houseManual: text("house_manual"),
  cancellationPolicy: text("cancellation_policy"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
