import {
  boolean,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { bookings } from "./bookings";
import { contacts } from "./contacts";
import { units } from "./properties";

// docs/PLAN.md "Data model" — workflow_templates / workflow_template_steps /
// work_orders / work_order_step_completions. The prescribed workflow is the
// market-validation core of the app.

// Shared by workflow_templates.type and work_orders.type.
export const workflowTypeEnum = pgEnum("workflow_type", [
  "cleaning",
  "maintenance",
  "other",
]);

// requested→assigned→in_progress→submitted_for_review→approved→paid, plus
// needs_revision as the review-rejection branch. UI maps requested/assigned →
// "not started" (owner spec §6).
export const workOrderStatusEnum = pgEnum("work_order_status", [
  "requested",
  "assigned",
  "in_progress",
  "submitted_for_review",
  "approved",
  "paid",
  "needs_revision",
]);

export const workOrderRequestedByEnum = pgEnum("work_order_requested_by", [
  "owner",
  "guest_concierge",
]);

// Per-item stock answer recorded by the contractor (contractor spec §5.2).
export type StockLevel = "stocked" | "low" | "out";

export const workflowTemplates = pgTable("workflow_templates", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  type: workflowTypeEnum("type").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// The PRESCRIBED steps a contractor must follow. area groups steps into
// collapsible sections (Kitchen/Bath/Exterior); stock_items lists supplies
// the contractor must level-check; example_photo_url is an owner-provided
// reference photo shown beside the step (contractor spec §5.2).
export const workflowTemplateSteps = pgTable("workflow_template_steps", {
  id: uuid("id").primaryKey().defaultRandom(),
  templateId: uuid("template_id")
    .notNull()
    .references(() => workflowTemplates.id, { onDelete: "cascade" }),
  order: integer("order").notNull(),
  area: text("area"),
  label: text("label").notNull(),
  requiresPhoto: boolean("requires_photo").notNull().default(false),
  requiresNote: boolean("requires_note").notNull().default(false),
  stockItems: jsonb("stock_items").$type<string[]>(),
  examplePhotoUrl: text("example_photo_url"),
});

export const workOrders = pgTable("work_orders", {
  id: uuid("id").primaryKey().defaultRandom(),
  unitId: uuid("unit_id")
    .notNull()
    .references(() => units.id),
  bookingId: uuid("booking_id").references(() => bookings.id),
  contactId: uuid("contact_id").references(() => contacts.id),
  workflowTemplateId: uuid("workflow_template_id").references(
    () => workflowTemplates.id,
  ),
  type: workflowTypeEnum("type").notNull(),
  status: workOrderStatusEnum("status").notNull().default("requested"),
  scope: text("scope").notNull(),
  // Lifecycle timestamps: null until the work order reaches that stage.
  scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
  // Accept flow (kept 2026-07-22): accepting stamps accepted_at and moves the
  // job into the contractor's active list. No explicit decline in v1.
  acceptedAt: timestamp("accepted_at", { withTimezone: true }),
  submittedAt: timestamp("submitted_at", { withTimezone: true }),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  costCents: integer("cost_cents"),
  notes: text("notes"),
  // needs_revision re-opens the contractor checklist editable with
  // review_note (the owner's request-changes note) pinned on the job.
  reviewNote: text("review_note"),
  requestedBy: workOrderRequestedByEnum("requested_by")
    .notNull()
    .default("owner"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// One row per prescribed step; a work order can't reach submitted_for_review
// until every required step (per its template) has a completion row.
// photo_urls is an array (steps can require/accept multiple photos);
// stock_levels records the per-item stocked|low|out answer for stock_items.
export const workOrderStepCompletions = pgTable(
  "work_order_step_completions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workOrderId: uuid("work_order_id")
      .notNull()
      .references(() => workOrders.id, { onDelete: "cascade" }),
    stepId: uuid("step_id")
      .notNull()
      .references(() => workflowTemplateSteps.id),
    completedAt: timestamp("completed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    note: text("note"),
    photoUrls: jsonb("photo_urls").$type<string[]>(),
    stockLevels: jsonb("stock_levels").$type<Record<string, StockLevel>>(),
  },
  (t) => [
    // "one row per prescribed step" (docs/PLAN.md)
    uniqueIndex("wo_step_completions_wo_step_idx").on(t.workOrderId, t.stepId),
  ],
);
