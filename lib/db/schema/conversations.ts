import {
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

// docs/PLAN.md "Data model" — conversations / messages / a2ui_surfaces.
// Postgres-backed since Vercel Functions are stateless between requests.

// public_inquiry = pre-booking inquiry threads in the owner's Messages inbox.
export const conversationSubjectTypeEnum = pgEnum("conversation_subject_type", [
  "owner",
  "guest",
  "contractor",
  "public_inquiry",
]);

// kind distinguishes agent conversations from direct human threads (the
// owner's Messages inbox, owner spec §5.4; guest/contractor "message the
// host" threads).
export const conversationKindEnum = pgEnum("conversation_kind", [
  "agent_chat",
  "direct",
]);

// channel/external_ref/audio_url serve the Google Voice channel: sms/voicemail
// messages ingested from Gmail carry the Gmail message id in external_ref
// (idempotency) and the voicemail audio link in audio_url.
export const messageChannelEnum = pgEnum("message_channel", [
  "app",
  "sms",
  "voicemail",
]);

export const conversations = pgTable("conversations", {
  id: uuid("id").primaryKey().defaultRandom(),
  subjectType: conversationSubjectTypeEnum("subject_type").notNull(),
  // Who/what the thread is about: Clerk user id (owner), guest_sessions /
  // bookings ref (guest), contacts ref (contractor), or an E.164 number for
  // unmatched public inquiries.
  subjectRef: text("subject_ref").notNull(),
  kind: conversationKindEnum("kind").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const messages = pgTable(
  "messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    // Chat role (user/assistant/system/tool) — transport-level, kept as text
    // so the agent pipe (track B4) owns the vocabulary.
    role: text("role").notNull(),
    channel: messageChannelEnum("channel").notNull().default("app"),
    externalRef: text("external_ref"),
    audioUrl: text("audio_url"),
    content: jsonb("content").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    // Gmail message id idempotency key for the Google Voice ingestion cron.
    uniqueIndex("messages_external_ref_idx").on(t.externalRef),
  ],
);

// Persisted A2UI surface state so token surfaces rehydrate from Postgres.
export const a2uiSurfaces = pgTable("a2ui_surfaces", {
  id: uuid("id").primaryKey().defaultRandom(),
  conversationId: uuid("conversation_id")
    .notNull()
    .references(() => conversations.id, { onDelete: "cascade" }),
  components: jsonb("components").notNull(),
  // Non-null to stay consistent with the frozen protocol's surfaceEnvelopeSchema
  // (dataModel required) — persist {} when there are no keys.
  dataModel: jsonb("data_model").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
