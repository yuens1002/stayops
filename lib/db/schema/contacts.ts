import {
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

// docs/PLAN.md "Data model" — contacts / contact_tokens.
// The user's own known cleaners/contractors; no marketplace, just a contact
// list.

export const contactTypeEnum = pgEnum("contact_type", [
  "cleaner",
  "maintenance",
  "other",
]);

export const contacts = pgTable("contacts", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  phone: text("phone"),
  email: text("email"),
  type: contactTypeEnum("type").notNull(),
  defaultRateCents: integer("default_rate_cents"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// CONTACT-scoped (decided 2026-07-22, replacing the earlier job-scoped
// work_order_tokens): one link per contractor unlocks their whole book of
// work, with job URLs deep-linking within it. Owner-revocable; expires_at is
// a clock backstop. Server-side authz still checks per-entity ownership.
export const contactTokens = pgTable(
  "contact_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    contactId: uuid("contact_id")
      .notNull()
      .references(() => contacts.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex("contact_tokens_token_hash_idx").on(t.tokenHash)],
);
