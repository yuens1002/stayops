/**
 * A2UI protocol — the frozen T1 contract both tracks build against.
 *
 * Server → client traffic is a discriminated union of envelopes delivered over
 * SSE; client → server interactions are `ClientAction` payloads POSTed to the
 * action endpoint (Track B5). Binary uploads never travel over this transport
 * (see `lib/uploads/contract.ts`).
 *
 * Source: docs/PLAN.md ("Build order" → T1), docs/features/t1-contracts/plan.md (D2).
 * After T1 merges, changes here are deliberate contract PRs.
 */
import { z } from "zod";

// ---------------------------------------------------------------------------
// JSON primitives (payloads/data models are persisted as jsonb — see
// `a2ui_surfaces.data_model` / `messages.content` in the domain schema)
// ---------------------------------------------------------------------------

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | { [key: string]: JsonValue }
  | JsonValue[];

export const jsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.record(z.string(), jsonValueSchema),
    z.array(jsonValueSchema),
  ]),
);

export const jsonObjectSchema = z.record(z.string(), jsonValueSchema);
export type JsonObject = z.infer<typeof jsonObjectSchema>;

// ---------------------------------------------------------------------------
// Envelope discriminants + SSE event naming
// ---------------------------------------------------------------------------

export const SERVER_ENVELOPE_TYPES = [
  "message",
  "surface",
  "data",
  "receipt",
  "error",
] as const;

export type ServerEnvelopeType = (typeof SERVER_ENVELOPE_TYPES)[number];

/**
 * SSE event naming: each envelope is emitted as one SSE event whose `event:`
 * field is `a2ui.<envelope type>` and whose `data:` field is the JSON-encoded
 * envelope. Renderers subscribe by these names.
 */
export const SSE_EVENT_PREFIX = "a2ui" as const;

export const SSE_EVENT_NAMES = {
  message: `${SSE_EVENT_PREFIX}.message`,
  surface: `${SSE_EVENT_PREFIX}.surface`,
  data: `${SSE_EVENT_PREFIX}.data`,
  receipt: `${SSE_EVENT_PREFIX}.receipt`,
  error: `${SSE_EVENT_PREFIX}.error`,
} as const satisfies Record<ServerEnvelopeType, string>;

export type SseEventName =
  (typeof SSE_EVENT_NAMES)[keyof typeof SSE_EVENT_NAMES];

export function sseEventName(type: ServerEnvelopeType): SseEventName {
  return SSE_EVENT_NAMES[type];
}

// ---------------------------------------------------------------------------
// Component instance shape
//
// The protocol is structurally agnostic about component props — per-component
// prop schemas live in the catalog (`lib/a2ui/catalog.ts`, deliverable D3),
// which validates `type`/`props` pairs. Keeping the two files disjoint is what
// lets the envelope contract and the catalog evolve as separate contract PRs.
// ---------------------------------------------------------------------------

export const surfaceComponentSchema = z.object({
  /** Stable id within the surface; `ClientAction.componentId` refers to it. */
  id: z.string().min(1),
  /** Catalog component name — validated against D3's `CatalogComponentName`. */
  type: z.string().min(1),
  props: jsonObjectSchema,
});

export type SurfaceComponent = z.infer<typeof surfaceComponentSchema>;

// ---------------------------------------------------------------------------
// Server → client envelopes (discriminated on `type`)
// ---------------------------------------------------------------------------

/** A chat message rendered as a bubble (assistant text; persisted in `messages`). */
export const messageEnvelopeSchema = z.object({
  type: z.literal("message"),
  /** `messages.id` of the persisted row. */
  messageId: z.string().min(1),
  role: z.enum(["assistant", "user", "system"]),
  content: z.string(),
});

export type MessageEnvelope = z.infer<typeof messageEnvelopeSchema>;

/** A full A2UI surface: components + data model (persisted in `a2ui_surfaces`). */
export const surfaceEnvelopeSchema = z.object({
  type: z.literal("surface"),
  /** `a2ui_surfaces.id`; `ClientAction.surfaceId` refers to it. */
  surfaceId: z.string().min(1),
  components: z.array(surfaceComponentSchema).min(1),
  dataModel: jsonObjectSchema,
});

export type SurfaceEnvelope = z.infer<typeof surfaceEnvelopeSchema>;

/** A data-model update for an already-rendered surface (live page updates). */
export const dataEnvelopeSchema = z.object({
  type: z.literal("data"),
  surfaceId: z.string().min(1),
  /** Replacement values, merged by top-level key into the surface's data model. */
  dataModel: jsonObjectSchema,
});

export type DataEnvelope = z.infer<typeof dataEnvelopeSchema>;

export const RECEIPT_STATUSES = ["done", "error"] as const;

/**
 * A tool-call receipt (owner spec §3.3 anatomy: tool name · one-line outcome ·
 * optional deep-link). Receipts are views into `tool_invocations`.
 */
export const receiptEnvelopeSchema = z.object({
  type: z.literal("receipt"),
  /** `tool_invocations.id` of the audit row this receipt surfaces. */
  toolInvocationId: z.string().min(1),
  toolName: z.string().min(1),
  status: z.enum(RECEIPT_STATUSES),
  /** One-line outcome, e.g. "WO #483 created". */
  outcome: z.string().min(1),
  /** Deep-link to the affected entity/page ("View"). */
  href: z.string().min(1).optional(),
});

export type ReceiptEnvelope = z.infer<typeof receiptEnvelopeSchema>;

/** A stream-level failure the renderer must show (never silent). */
export const errorEnvelopeSchema = z.object({
  type: z.literal("error"),
  code: z.string().min(1),
  message: z.string().min(1),
});

export type ErrorEnvelope = z.infer<typeof errorEnvelopeSchema>;

export const serverEnvelopeSchema = z.discriminatedUnion("type", [
  messageEnvelopeSchema,
  surfaceEnvelopeSchema,
  dataEnvelopeSchema,
  receiptEnvelopeSchema,
  errorEnvelopeSchema,
]);

export type ServerEnvelope = z.infer<typeof serverEnvelopeSchema>;

// ---------------------------------------------------------------------------
// Client → server action (POSTed to the action endpoint, Track B5)
// ---------------------------------------------------------------------------

export const clientActionSchema = z.object({
  /** The surface the interaction happened on (`SurfaceEnvelope.surfaceId`). */
  surfaceId: z.string().min(1),
  /** The component within it (`SurfaceComponent.id`). */
  componentId: z.string().min(1),
  /** Component-defined action name, e.g. "buy", "confirm", "complete_step". */
  action: z.string().min(1),
  /** Action arguments; upload references (not binaries) travel here. */
  payload: jsonObjectSchema,
});

export type ClientAction = z.infer<typeof clientActionSchema>;
