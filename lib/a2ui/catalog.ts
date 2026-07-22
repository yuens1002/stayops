/**
 * A2UI component catalog — the frozen T1 contract (deliverable D3).
 *
 * One Zod prop schema per catalog component, keyed by the exact component
 * names the surface specs use (guest spec §5/§8, contractor spec §5/§8,
 * owner spec §4/§5; PLAN.md "Guest concierge chat"). Component instances on
 * the wire are `{ id, type, props }` (see `surfaceComponentSchema` in
 * `lib/a2ui/protocol.ts`); `parseComponent()` narrows that shape to a fully
 * typed catalog component.
 *
 * After T1 merges, changes here are deliberate contract PRs.
 */
import { z } from "zod";
import { RECEIPT_STATUSES } from "./protocol";

// ---------------------------------------------------------------------------
// Shared vocabularies (single-source constants)
// ---------------------------------------------------------------------------

/** Guest-facing reservation lifecycle (guest spec §3: status pill + content gates). */
export const RESERVATION_STATUSES = ["upcoming", "checked_in", "past"] as const;
export type ReservationStatus = (typeof RESERVATION_STATUSES)[number];

/**
 * Contractor-facing job status labels (contractor spec §6). UI vocabulary, not
 * the DB enum: `requested`/`assigned` render as `not_started`,
 * `submitted_for_review` as `submitted`, `needs_revision` as `needs_work`.
 */
export const CONTRACTOR_JOB_STATUSES = [
  "not_started",
  "in_progress",
  "submitted",
  "needs_work",
  "approved",
  "paid",
] as const;
export type ContractorJobStatus = (typeof CONTRACTOR_JOB_STATUSES)[number];

/** Work-order types (PLAN.md data model: `work_orders.type`). */
export const WORK_ORDER_TYPES = ["cleaning", "maintenance", "other"] as const;
export type WorkOrderType = (typeof WORK_ORDER_TYPES)[number];

/** Per-item stock answers (PLAN.md `work_order_step_completions.stock_levels`). */
export const STOCK_LEVELS = ["stocked", "low", "out"] as const;
export type StockLevel = (typeof STOCK_LEVELS)[number];

/** Recurring-maintenance cadence (PLAN.md `maintenance_schedules.cadence`). */
export const MAINTENANCE_CADENCES = [
  "monthly",
  "quarterly",
  "biannual",
  "annual",
] as const;
export type MaintenanceCadence = (typeof MAINTENANCE_CADENCES)[number];

/** CheckoutCard payment states (guest spec §5.3: pending → green "✓ Paid" banner). */
export const CHECKOUT_STATUSES = ["pending", "paid"] as const;
export type CheckoutStatus = (typeof CHECKOUT_STATUSES)[number];

/** Guest-facing cancel-card states (guest spec §5.5: confirm → cancelled banner). */
export const CANCEL_RESERVATION_STATUSES = ["active", "cancelled"] as const;
export type CancelReservationStatus =
  (typeof CANCEL_RESERVATION_STATUSES)[number];

/**
 * ConfirmCard lifecycle (owner spec §3.2: pending cards expire with their
 * session and render inert with a "re-ask to renew" hint).
 */
export const CONFIRM_CARD_STATES = [
  "pending",
  "confirmed",
  "cancelled",
  "expired",
] as const;
export type ConfirmCardState = (typeof CONFIRM_CARD_STATES)[number];

// ---------------------------------------------------------------------------
// Shared field shapes
// ---------------------------------------------------------------------------

const entityId = z.string().min(1);
const cents = z.number().int().nonnegative();
const isoDate = z.iso.date();
const isoDateTime = z.iso.datetime();

/**
 * One add-on row (guest spec §5.3: thumbnail · name · "$18 · delivered by a
 * contractor" · Buy; purchased rows flip to "✓ Purchased").
 */
const addonItem = z.strictObject({
  addonProductId: entityId,
  name: z.string().min(1),
  priceCents: cents,
  thumbnailUrl: z.url().optional(),
  /** e.g. "delivered by a contractor" (fulfillment_type=work_order add-ons). */
  fulfillmentNote: z.string().optional(),
  purchased: z.boolean().default(false),
});

// ---------------------------------------------------------------------------
// Guest components (guest spec §5, §8; PLAN.md "Guest concierge chat")
// ---------------------------------------------------------------------------

/** Per-stay summary card (guest spec §5.5: one per stay from "Your stays"). */
export const bookingSummaryCardProps = z.strictObject({
  bookingId: entityId,
  propertyName: z.string().min(1),
  unitLabel: z.string().optional(),
  coverPhotoUrl: z.url().optional(),
  status: z.enum(RESERVATION_STATUSES),
  checkIn: isoDate,
  checkOut: isoDate,
  /** Party size (`bookings.party_size`); nights derive from the dates. */
  guests: z.number().int().positive(),
  totalCents: cents,
});
export type BookingSummaryCardProps = z.infer<typeof bookingSummaryCardProps>;

/**
 * Full reservation card (guest spec §5.1): cover photo + status pill, location
 * eyebrow, dates/guests/total, times, address, the 24h-locked access block
 * (guest spec §3), and the Photos · Location · House rules · House manual
 * badge-tab content (guestbook cut from v1, §9.7).
 */
export const reservationDetailCardProps = z.strictObject({
  bookingId: entityId,
  propertyName: z.string().min(1),
  unitLabel: z.string().optional(),
  coverPhotoUrl: z.url(),
  status: z.enum(RESERVATION_STATUSES),
  /** Location eyebrow line, e.g. "Harborview, Maine". */
  locationEyebrow: z.string().min(1),
  checkIn: isoDate,
  checkOut: isoDate,
  /** Display times, e.g. "4:00 PM" / "11:00 AM". */
  checkInTime: z.string().min(1),
  checkOutTime: z.string().min(1),
  guests: z.number().int().positive(),
  totalCents: cents,
  address: z.string().min(1),
  /**
   * Wi-Fi / door-code block — locked until 24h before check-in (guest spec
   * §3): while `locked`, credentials are omitted server-side, never sent.
   */
  accessInfo: z.strictObject({
    locked: z.boolean(),
    /** When the block unlocks (24h before check-in); shown on the lock chip. */
    unlocksAt: isoDateTime.optional(),
    wifiNetwork: z.string().optional(),
    wifiPassword: z.string().optional(),
    doorCode: z.string().optional(),
  }),
  /** Photos tab: grid with swipeable lightbox. */
  photos: z.array(z.url()).default([]),
  /** Location tab: approximate-area map image. */
  mapImageUrl: z.url().optional(),
  /** House-rules tab: rules list (`units.house_rules`). */
  houseRules: z.array(z.string().min(1)).default([]),
  /** House-manual tab: manual notes (`units.house_manual`). */
  houseManual: z.string().optional(),
});
export type ReservationDetailCardProps = z.infer<
  typeof reservationDetailCardProps
>;

/** Compact rules answer card (guest spec §5.1: plain house-rules questions). */
export const houseRulesCardProps = z.strictObject({
  propertyName: z.string().optional(),
  rules: z.array(z.string().min(1)).min(1),
});
export type HouseRulesCardProps = z.infer<typeof houseRulesCardProps>;

/**
 * Concierge-link card (guest spec §3): "Your private concierge link — valid
 * for your whole stay… Also sent to your email."
 */
export const guestSessionCardProps = z.strictObject({
  conciergeUrl: z.url(),
  propertyName: z.string().min(1),
  guestName: z.string().optional(),
  /** Link validity end ("Expires after checkout"). */
  expiresAt: isoDate.optional(),
  /** Email the link was also sent to. */
  emailedTo: z.email().optional(),
});
export type GuestSessionCardProps = z.infer<typeof guestSessionCardProps>;

/**
 * Maintenance-request receipt card (guest spec §5.2): "Work Order #483 —
 * Maintenance", Requested pill, quoted issue, unit, owner-notified message.
 */
export const workOrderRequestConfirmationProps = z.strictObject({
  workOrderId: entityId,
  workOrderType: z.enum(WORK_ORDER_TYPES),
  /** Guest-side confirmation always renders the "Requested" pill. */
  status: z.literal("requested"),
  /** The guest's quoted issue text, e.g. "The AC is blowing warm air". */
  issue: z.string().min(1),
  unitLabel: z.string().min(1),
  /** e.g. "The owner's been notified and someone will be assigned shortly." */
  message: z.string().optional(),
});
export type WorkOrderRequestConfirmationProps = z.infer<
  typeof workOrderRequestConfirmationProps
>;

/** Add-on catalog rows (guest spec §5.3: "Add-ons for your stay"). */
export const addonCatalogListProps = z.strictObject({
  /** Renderer defaults to "Add-ons for your stay". */
  title: z.string().optional(),
  items: z.array(addonItem).min(1),
});
export type AddonCatalogListProps = z.infer<typeof addonCatalogListProps>;

/** Single browsable add-on with a Buy action (PLAN.md guest catalog list). */
export const addonCardProps = addonItem.extend({
  description: z.string().optional(),
});
export type AddonCardProps = z.infer<typeof addonCardProps>;

/**
 * Inline payment card (guest spec §1.3, §5.3): line items, total, explicit
 * "Pay $N" tap as the confirmation, fine print; paid state renders the green
 * "✓ Paid · $N" banner.
 */
export const checkoutCardProps = z.strictObject({
  lineItems: z
    .array(
      z.strictObject({
        label: z.string().min(1),
        amountCents: cents,
        quantity: z.number().int().positive().optional(),
      }),
    )
    .min(1),
  totalCents: cents,
  status: z.enum(CHECKOUT_STATUSES),
  /** Stripe Checkout handoff target (production; mocks fake it). */
  checkoutUrl: z.url().optional(),
  /** e.g. "Stripe Checkout — payments are processed securely." */
  finePrint: z.string().optional(),
});
export type CheckoutCardProps = z.infer<typeof checkoutCardProps>;

/**
 * Self-service cancel card (guest spec §5.5): policy summary, Keep/Cancel
 * buttons, cancelled-state banner + refund message. Policy copy comes from
 * `units.cancellation_policy` (PLAN.md).
 */
export const cancelReservationCardProps = z.strictObject({
  bookingId: entityId,
  /** e.g. "Free cancellation until 5 days before check-in…" */
  policySummary: z.string().min(1),
  status: z.enum(CANCEL_RESERVATION_STATUSES),
  refundAmountCents: cents.optional(),
  /** Refund copy shown in the cancelled-state banner. */
  refundMessage: z.string().optional(),
});
export type CancelReservationCardProps = z.infer<
  typeof cancelReservationCardProps
>;

/**
 * Date-change calendar card (guest spec §5.5: date changes reuse the
 * BookingCalendar card; range select over nights × rate).
 */
export const bookingCalendarProps = z.strictObject({
  unitId: entityId,
  /** Month in view, e.g. "2026-08". */
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
  nightlyRateCents: cents,
  unavailableDates: z.array(isoDate).default([]),
  selectedRange: z
    .strictObject({ checkIn: isoDate, checkOut: isoDate })
    .optional(),
});
export type BookingCalendarProps = z.infer<typeof bookingCalendarProps>;

/** "Your stays" index (guest spec §5.5): stays with status pills. */
export const bookingsIndexListProps = z.strictObject({
  /** Renderer defaults to "Your stays". */
  title: z.string().optional(),
  stays: z
    .array(
      z.strictObject({
        bookingId: entityId,
        propertyName: z.string().min(1),
        checkIn: isoDate,
        checkOut: isoDate,
        status: z.enum(RESERVATION_STATUSES),
      }),
    )
    .min(1),
});
export type BookingsIndexListProps = z.infer<typeof bookingsIndexListProps>;

// ---------------------------------------------------------------------------
// Contractor components (contractor spec §2, §5)
// ---------------------------------------------------------------------------

/**
 * Job summary card (contractor spec §5.1): WO #, "Turnover · cleaning", unit +
 * address, config, due-by date AND time, guests + pets, rate, "Open checklist →".
 * A newly assigned job renders as "New — preview" with an Accept button
 * (contractor spec §3).
 */
export const workOrderCardProps = z.strictObject({
  workOrderId: entityId,
  /** Job title, e.g. "Turnover". */
  title: z.string().min(1),
  workOrderType: z.enum(WORK_ORDER_TYPES),
  status: z.enum(CONTRACTOR_JOB_STATUSES),
  /** True until the contractor taps Accept (`work_orders.accepted_at` unset). */
  pendingAcceptance: z.boolean().default(false),
  unitLabel: z.string().min(1),
  address: z.string().min(1),
  /** Unit config line, e.g. "3BR/2BA". */
  config: z.string().optional(),
  /** Due date and time (contractor spec §10: due time shown everywhere). */
  dueBy: isoDateTime,
  /** Booking context when tied to a stay (`bookings.party_size` / `pets`). */
  guests: z.number().int().positive().optional(),
  pets: z.boolean().optional(),
  rateCents: cents,
  /** e.g. "paid outside the app" / "$85 on approval". */
  rateNote: z.string().optional(),
});
export type WorkOrderCardProps = z.infer<typeof workOrderCardProps>;

/**
 * One checklist step (contractor spec §5.2 step anatomy): requirement-gated
 * checkbox, example photo + uploaded thumbs, note input, per-item stock
 * levels, and folded-in maintenance meta.
 */
const checklistStep = z.strictObject({
  stepId: entityId,
  label: z.string().min(1),
  completed: z.boolean().default(false),
  requiresPhoto: z.boolean().default(false),
  requiresNote: z.boolean().default(false),
  /** Owner-provided reference photo (dashed-green "EX" thumb). */
  examplePhotoUrl: z.url().optional(),
  /** Uploaded photo evidence (`work_order_step_completions.photo_urls`). */
  photoUrls: z.array(z.url()).default([]),
  note: z.string().optional(),
  /** Supplies to level-check; every item must be answered before checking off. */
  stockItems: z.array(z.string().min(1)).optional(),
  /** Per-item answers keyed by stock item (`stock_levels` jsonb). */
  stockLevels: z.record(z.string(), z.enum(STOCK_LEVELS)).optional(),
  /**
   * Folded-in maintenance meta-line (contractor spec §5.2):
   * "Maintenance · quarterly · due by Jul 10 · last done Apr 10".
   */
  maintenance: z
    .strictObject({
      cadence: z.enum(MAINTENANCE_CADENCES),
      dueBy: isoDate.optional(),
      lastDoneAt: isoDate.optional(),
    })
    .optional(),
});

/**
 * The interactive checklist (contractor spec §5.2–§5.6): steps grouped into
 * collapsible areas; progress bars derive from `completed` flags. Post-submit
 * it renders as a read-only mirror; `needs_work` re-opens it editable with the
 * owner's `reviewNote` pinned.
 */
export const workOrderChecklistProps = z.strictObject({
  workOrderId: entityId,
  status: z.enum(CONTRACTOR_JOB_STATUSES),
  /** Owner's request-changes note (`work_orders.review_note`), pinned on needs_work. */
  reviewNote: z.string().optional(),
  areas: z
    .array(
      z.strictObject({
        /** Area name, e.g. "Kitchen" / "Bath" / "Exterior". */
        name: z.string().min(1),
        steps: z.array(checklistStep).min(1),
      }),
    )
    .min(1),
});
export type WorkOrderChecklistProps = z.infer<typeof workOrderChecklistProps>;

/** Logistics card (contractor spec §2/§4: door code, parking, supplies location). */
export const jobDetailsCardProps = z.strictObject({
  workOrderId: entityId,
  unitLabel: z.string().min(1),
  doorCode: z.string().optional(),
  parking: z.string().optional(),
  suppliesLocation: z.string().optional(),
  notes: z.string().optional(),
});
export type JobDetailsCardProps = z.infer<typeof jobDetailsCardProps>;

// ---------------------------------------------------------------------------
// Owner components (owner spec §1.3–§1.4, §3.2, §4, §5.3)
// ---------------------------------------------------------------------------

/**
 * Tool-call receipt card (owner spec §4 anatomy: monospace tool name ·
 * one-line outcome · "View" deep-link). A chat-stream view into the
 * `tool_invocations` audit log; field names mirror the `receipt` envelope.
 */
export const toolReceiptProps = z.strictObject({
  /** `tool_invocations.id` of the audit row this receipt surfaces. */
  toolInvocationId: entityId,
  toolName: z.string().min(1),
  status: z.enum(RECEIPT_STATUSES),
  /** One-line outcome, e.g. "WO #483 created". */
  outcome: z.string().min(1),
  /** Deep-link to the affected entity/page ("View"). */
  href: z.string().min(1).optional(),
  timestamp: isoDateTime.optional(),
});
export type ToolReceiptProps = z.infer<typeof toolReceiptProps>;

/**
 * Confirm-before-commit card for money/destructive actions (owner spec §1.4,
 * §5.3): summary line + explicit confirm tap; expired cards render inert with
 * a "re-ask to renew" hint (owner spec §3.2).
 */
export const confirmCardProps = z.strictObject({
  /** The tool this card gates, e.g. "process_payment" / "cancel_booking". */
  toolName: z.string().min(1),
  /** One-line summary, e.g. "Marisol · $85 · paid outside the app, marked here". */
  summary: z.string().min(1),
  /** Confirm button label, e.g. "Approve & pay". */
  confirmLabel: z.string().min(1),
  /** Renderer defaults to "Cancel". */
  cancelLabel: z.string().optional(),
  /** Set for money actions so the amount renders prominently. */
  amountCents: cents.optional(),
  state: z.enum(CONFIRM_CARD_STATES).default("pending"),
});
export type ConfirmCardProps = z.infer<typeof confirmCardProps>;

// ---------------------------------------------------------------------------
// Catalog registry + parseComponent()
// ---------------------------------------------------------------------------

/** Prop schema per catalog component, keyed by spec-exact component name. */
export const catalogPropSchemas = {
  // guest
  BookingSummaryCard: bookingSummaryCardProps,
  ReservationDetailCard: reservationDetailCardProps,
  HouseRulesCard: houseRulesCardProps,
  GuestSessionCard: guestSessionCardProps,
  WorkOrderRequestConfirmation: workOrderRequestConfirmationProps,
  AddonCatalogList: addonCatalogListProps,
  AddonCard: addonCardProps,
  CheckoutCard: checkoutCardProps,
  CancelReservationCard: cancelReservationCardProps,
  BookingCalendar: bookingCalendarProps,
  BookingsIndexList: bookingsIndexListProps,
  // contractor
  WorkOrderCard: workOrderCardProps,
  WorkOrderChecklist: workOrderChecklistProps,
  JobDetailsCard: jobDetailsCardProps,
  // owner
  ToolReceipt: toolReceiptProps,
  ConfirmCard: confirmCardProps,
} as const;

export const CATALOG_COMPONENT_NAMES = Object.keys(
  catalogPropSchemas,
) as ReadonlyArray<keyof typeof catalogPropSchemas>;

export type CatalogComponentName = keyof typeof catalogPropSchemas;

export function isCatalogComponentName(
  value: string,
): value is CatalogComponentName {
  return Object.hasOwn(catalogPropSchemas, value);
}

/** A validated component instance: `{ id, type, props }` with typed props. */
export type CatalogComponent = {
  [N in CatalogComponentName]: {
    id: string;
    type: N;
    props: z.infer<(typeof catalogPropSchemas)[N]>;
  };
}[CatalogComponentName];

/** Wire shape before per-component validation (mirrors `surfaceComponentSchema`). */
const componentInstanceSchema = z.strictObject({
  id: z.string().min(1),
  type: z.string().min(1),
  props: z.unknown(),
});

export class UnknownCatalogComponentError extends Error {
  constructor(readonly componentType: string) {
    super(`Unknown catalog component type: ${JSON.stringify(componentType)}`);
    this.name = "UnknownCatalogComponentError";
  }
}

/**
 * Parse an untrusted component instance against the catalog. Throws
 * `ZodError` on a malformed instance or invalid props (e.g. a missing
 * required prop) and `UnknownCatalogComponentError` on a type outside the
 * catalog.
 */
export function parseComponent(input: unknown): CatalogComponent {
  const instance = componentInstanceSchema.parse(input);
  if (!isCatalogComponentName(instance.type)) {
    throw new UnknownCatalogComponentError(instance.type);
  }
  const props = catalogPropSchemas[instance.type].parse(instance.props);
  return { id: instance.id, type: instance.type, props } as CatalogComponent;
}

export type ParseComponentResult =
  | { success: true; component: CatalogComponent }
  | { success: false; error: z.ZodError | UnknownCatalogComponentError };

/** Non-throwing variant of `parseComponent()` (fixture/test validation). */
export function safeParseComponent(input: unknown): ParseComponentResult {
  try {
    return { success: true, component: parseComponent(input) };
  } catch (error) {
    if (
      error instanceof z.ZodError ||
      error instanceof UnknownCatalogComponentError
    ) {
      return { success: false, error };
    }
    throw error;
  }
}
