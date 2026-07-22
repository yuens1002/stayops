import {
  check,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

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

export const COMM_SYNC_STATE_SINGLETON_ID = 1;

// Singleton row: poll cursor for the Google Voice / Gmail ingestion cron.
export const commSyncState = pgTable(
  "comm_sync_state",
  {
    id: integer("id")
      .primaryKey()
      .default(COMM_SYNC_STATE_SINGLETON_ID),
    gmailHistoryCursor: text("gmail_history_cursor"),
    lastPolledAt: timestamp("last_polled_at", { withTimezone: true }),
  },
  (t) => [
    // Enforce the singleton at the DB layer. sql.raw: DDL can't take bound
    // parameters, so the constant must be inlined into the check expression.
    check(
      "comm_sync_state_singleton",
      sql`${t.id} = ${sql.raw(String(COMM_SYNC_STATE_SINGLETON_ID))}`,
    ),
  ],
);
