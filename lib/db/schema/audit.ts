import {
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

// docs/PLAN.md "Data model" — tool_invocations / comm_sync_state.

export const toolActorEnum = pgEnum("tool_actor", [
  "owner_via_agent",
  "contractor",
  "guest",
  "system",
]);

// Permanent audit log, independent of chat (owner spec §3.3); chat receipts
// and the owner "recent activity" feed are views into this table.
export const toolInvocations = pgTable("tool_invocations", {
  id: uuid("id").primaryKey().defaultRandom(),
  actor: toolActorEnum("actor").notNull(),
  toolName: text("tool_name").notNull(),
  // Sensitive values redacted before write.
  args: jsonb("args").notNull(),
  result: jsonb("result"),
  entityRefs: jsonb("entity_refs"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// Gmail ingestion sources, one cursor row each (2026-07-23 pivot — was a
// singleton): airbnb_email is v1 (booking enrichment), gv is post-golden-path
// (Google Voice SMS/voicemail).
export const COMM_SYNC_SOURCES = ["airbnb_email", "gv"] as const;
export type CommSyncSource = (typeof COMM_SYNC_SOURCES)[number];

export const commSyncState = pgTable("comm_sync_state", {
  // Source key, e.g. 'airbnb_email'.
  id: text("id").primaryKey().$type<CommSyncSource>(),
  gmailHistoryCursor: text("gmail_history_cursor"),
  lastPolledAt: timestamp("last_polled_at", { withTimezone: true }),
});
