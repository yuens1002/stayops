# Personal Property Manager — MVP Plan

## Context

Separate from (and much smaller than) the earlier rent-runner OSS/3-service concept, which stays parked for later once there's a validated go-to-market strategy — nothing from that plan is being executed; its scaffolding on disk at `C:\Users\yuens\dev\rent-runner` is untouched and dormant.

A personal tool for managing a handful of the user's own short-term rental properties: booking + direct guest payment, a conversational concierge for guests, a **prescribed, checklist-based workflow** for cleaning/maintenance that contractors must complete and report on before payment, and reporting. Single operator, not a distributed/multi-tenant product — so the prior plan's monetization-boundary and cross-instance marketplace concerns don't apply, which collapses the architecture to **one app, one database, one Stripe account, no Connect, no separate services**.

The user explicitly wants this to double as market validation for the bigger OSS idea — real usage evidence of "prescribed workflow" surfaces before investing in the 3-service build. That means the **chat-first, lightweight SPA UI paradigm and the A2UI-rendered surfaces are kept**, not swapped for a conventional dashboard — this app is a working prototype of the real product experience, just scoped to one operator.

**Repo**: `stayops` (this repo — `C:\Users\yuens\dev\stayops`, its own standalone git repository).

## Stack

- Next.js 16 App Router + TypeScript, **Pico.css** (lightweight, classless — carried over from the original OSS design, still the right fit for a chat-first SPA), deployed to Vercel.
- **A2UI 1.0RC** for rendering the chat-driven UI — reuses the protocol/catalog/transport design already worked out for the OSS plan (envelope types, component catalog, SSE transport, Postgres-backed conversation/surface persistence), just running **in-process** in this one app instead of behind a separate `workflow-engine` service, since there's no one else's usage to meter or gate.
- Claude Agent SDK called directly, in-app.
- Neon Postgres + Drizzle — same reasoning as before (no query-engine binary in a Fluid Compute function, first-class `@neondatabase/serverless` support).
- Clerk — single owner login (or a couple of named users with a `role` field if access gets shared later); no Organizations complexity needed.
- Stripe — **plain single-account Checkout**, no Connect. The user is the one merchant collecting guest payments directly.

## Roles

- **Owner** (the user) — full access via a Clerk-authenticated chat surface: properties/units, bookings, work-order review/approval, reporting.
- **Guest** — no account. A tokenized concierge-chat link (`guest_sessions`), issued once a booking confirms.
- **Contractor** (cleaner/maintenance) — no account. A tokenized link (`work_order_tokens`) to a chat/checklist surface for their assigned job.

Two shells, same pattern as the original plan: `(public)` (guest + contractor, token-gated) and `(app)` (owner, Clerk-gated) — both mount the same `<AgentSurface />`; role resolved server-side from session/token, not from separate hand-built pages.

## Data model (Drizzle / Neon Postgres, single DB, no tenant_id needed)

```
properties            id, name, address
units                 id, property_id, label, unit_type(whole_property|adu|private_room|shared_room),
                      base_nightly_rate_cents, max_guests, house_rules, status

bookings              id, unit_id, check_in, check_out, guest_name, guest_email, guest_phone,
                      status(pending_payment|confirmed|cancelled|completed),
                      stripe_checkout_session_id, stripe_payment_intent_id, amount_cents

guest_sessions        id, booking_id, token_hash, expires_at

contacts              id, name, phone, email, type(cleaner|maintenance|other), default_rate_cents
                      -- the user's own known cleaners/contractors; no marketplace, just a contact list

workflow_templates    id, name, type(cleaning|maintenance|other), description
workflow_template_steps   id, template_id, order, label, requires_photo bool, requires_note bool
                      -- e.g. "Standard Turnover Clean": strip linens, run laundry, restock supplies,
                      -- photo of kitchen, photo of bathroom — the PRESCRIBED steps a contractor must follow

work_orders           id, unit_id, booking_id?, contact_id?, workflow_template_id?,
                      type(cleaning|maintenance|other),
                      status(requested→assigned→in_progress→submitted_for_review→approved→paid),
                      scope, scheduled_at, submitted_at, approved_at, cost_cents, notes,
                      requested_by(owner|guest_concierge)

work_order_step_completions   id, work_order_id, step_id, completed_at, note?, photo_url?
                      -- one row per prescribed step; a work order can't reach submitted_for_review
                      -- until every required step (per its template) has a completion row

work_order_tokens     id, work_order_id, token_hash, expires_at
                      -- the contractor's no-account link to the checklist chat/surface

expenses              id, property_id?, unit_id?, work_order_id?, category, amount_cents, incurred_at, notes
                      -- reporting: work-order costs (populated on approval) + non-work-order costs (insurance, taxes)

addon_products        id, unit_id? (null = available at any unit), name, description, price_cents,
                      fulfillment_type(none|work_order), default_workflow_template_id?
                      -- e.g. "firewood bundle" (fulfillment_type=work_order, spawns a work order for a contact),
                      -- "late checkout" (fulfillment_type=none, just flags the booking for owner review)

addon_purchases       id, booking_id, addon_product_id, work_order_id?, amount_cents,
                      stripe_checkout_session_id, stripe_payment_intent_id, status(pending_payment|paid),
                      purchased_at
                      -- guest can buy these ANY time during their stay, not just at booking time

conversations, messages, a2ui_surfaces   id, subject_type(owner|guest|contractor), subject_ref,
                      role, content jsonb / components jsonb / data_model jsonb
                      -- Postgres-backed since Vercel Functions are stateless between requests
```

## The prescribed workflow, concretely

This is the feature that makes the cleaning/maintenance flow more than a bare "mark complete" button, and the part worth getting right since it's the market-validation core:

1. Owner defines `workflow_templates` per job type (e.g. one "Standard Turnover Clean" template with 5-8 ordered steps, some requiring a photo).
2. A `work_order` of type `cleaning` gets a `workflow_template_id` (default template for that type, owner can override).
3. Contractor opens their tokenized chat/checklist surface (A2UI-rendered: a `WorkOrderChecklist` component showing each step, a photo-upload affordance where required, a note field where required).
4. Contractor works through the steps; each completed step writes a `work_order_step_completions` row via chat or by checking items directly (both should work — this is a chat surface, not a form-only page, so "mark step 3 done, here's the photo" via chat should also work).
5. Once all required steps are complete, `work_orders.status → submitted_for_review` — this **is** the "report for payment": the owner reviews the submitted checklist (steps + photos + notes) before approving.
6. Owner approves in their own chat surface → `status → approved`, `cost_cents` recorded, mirrored into `expenses`. Actual payment to the contractor still happens outside the app (Venmo/cash/check) — v1 doesn't automate contractor payment, only gates the *approval* on a completed prescribed report.

## Guest concierge chat

- Guest receives their `guest_sessions` link once `bookings.status = confirmed`. The link is valid for the whole stay, not single-use — guest can return to it any time (mobile-friendly) to chat or buy an add-on.
- Tools: look up their own booking (unit, dates, house rules), answer FAQ/house-rules questions, **create a `work_order`** (e.g. "please send someone to fix the AC" → maintenance work order, `requested_by = guest_concierge`, template auto-assigned by type), flag a late-checkout request for owner review (not auto-approved), **browse and buy `addon_products`** at any point during the stay.
- A2UI catalog components: `BookingSummaryCard`, `WorkOrderRequestConfirmation`, `AddonCatalogList`/`AddonCard` (browsable, "buy" button triggers Checkout inline in chat), chat bubbles.

### Voice I/O (optional enhancement, not core MVP scope)

Decision: **browser-only voice, kept simple** — reasoning stays in Claude; Grok is voice I/O only, not a second reasoning engine, and there is no telephony (no real phone number to call). Concretely:

- Guest speaks (browser mic, while on the concierge chat page) → audio streamed to **Grok STT** (streaming, ~$0.20/hr) → transcribed text fed into the *same* Claude tool-calling pipeline used for typed chat — same tools, same A2UI generation, no separate logic path.
- Claude's text response → **Grok TTS** (~$15/1M characters) → streamed back as audio for playback.
- Explicitly rejected: deploying Grok's own Voice Agent API (which has its own built-in reasoning + tool-calling, and integrates with LiveKit for real telephony) as a standalone voice agent that could also take real inbound phone calls. That's a materially bigger feature (SIP/PSTN bridge, a second independent reasoning/tool-calling implementation to keep behaviorally consistent with Claude's text-chat agent) and isn't needed right now — browser mic only.
- **WebMCP is unrelated to this feature** — it only exists inside a browser tab and is designed for third-party/visitor-brought agents reaching into a page, not for our own first-party agent's tool-calling (voice or text). Our own agent, whichever channel it's serving, just calls the backend's tools directly.
- Cost at this app's scale is low — a back-of-envelope 30 voice conversations/month at ~4 min each is a few dollars/month in STT+TTS, negligible relative to booking revenue.
- New env var: an xAI API key. New UI surface: a mic-input affordance + audio playback on the guest concierge chat.
- **Treat as a post-golden-path enhancement** — build the typed-chat golden path first (Phases 1-6), add voice I/O once that's solid, not as a Phase 0-6 blocker.

## À la carte guest services (add-ons, any time during the stay)

No architecture change — reuses the existing single-account Stripe Checkout mechanism and the same chat/A2UI surface, just a second purchase path independent of the original booking charge:
- Owner curates `addon_products` per unit (or globally) — e.g. firewood, late checkout, a welcome basket, an airport shuttle.
- Guest browses/buys via the concierge chat any time their `guest_sessions` link is valid (i.e. any time during the stay, from their phone) — a new Stripe Checkout Session per purchase, webhook confirms → `addon_purchases.status = paid`.
- If `fulfillment_type = work_order` (e.g. firewood delivery), payment confirmation auto-creates a `work_order` assigned via the same prescribed-workflow path as cleaning/maintenance (reuses `workflow_templates` — an add-on can have its own minimal template, e.g. "deliver + confirm drop-off photo"). If `fulfillment_type = none` (e.g. late checkout), it just updates a flag for owner review — no work order needed.
- Revenue from `addon_purchases` rolls into the same reporting queries as `bookings` revenue.

## Money flow (Stripe, single account — no Connect)

- Guest Checkout → the user's own Stripe account directly (`transfer_data` not needed — no platform/connected-account split). The add-on purchases above reuse this exact mechanism, invoked again per purchase.
- Webhook confirms payment → `bookings.status = confirmed` → issues the guest concierge link.
- Contractor payment is manual/external, tracked via `expenses` — see prescribed-workflow section above.

## Phased build order

0. **Scaffold** — Next.js + TS, Pico.css, Clerk, Drizzle+Neon, Vercel link. *Verify: app boots, sign-in works, `drizzle-kit push` connects.*
1. **A2UI + agent pipe, no-op agent** — protocol types (reused from the OSS plan's design), minimal catalog, SSE+action endpoints, `conversations`/`messages`/`a2ui_surfaces` tables, renderer, `(public)`/`(app)` shells. *Verify: full round trip including a simulated cold start proving state rehydrates from Postgres.*
2. **Domain schema + service layer** — properties/units/bookings/contacts/workflow_templates/work_orders/expenses/addon_products/addon_purchases, tenant-scoping not needed (single operator) but still a clean service-layer boundary. *Verify: CRUD script for each table.*
3. **Bookings + Stripe Checkout** — booking creation, Checkout session, webhook → confirmed → guest session issued. Reuse the same Checkout call site for add-on purchases. *Verify: test-mode booking end to end, card `4242 4242 4242 4242`.*
4. **Owner + guest concierge chat wired to services** — owner's chat surface (property/unit/booking management, work-order review/approval, add-on catalog authoring), guest's chat surface (FAQ, work-order creation, browse/buy add-ons any time during the stay). *Verify: both roles complete their golden-path actions via chat, including a guest buying an add-on after check-in (not just at booking time).*
5. **Prescribed workflow / contractor checklist** — `workflow_templates`/steps authoring (owner), `WorkOrderChecklist` A2UI component, `work_order_step_completions`, status gate to `submitted_for_review`, owner approval flow. *Verify: full contractor checklist walkthrough via the tokenized link, no account.*
6. **Reporting** — revenue/expense/occupancy per property/unit, date-range filtering, charts via the `dataviz` skill. *Verify: numbers match manually-computed totals for a test property.*
7. **Polish** — Pico theming, mobile-friendly pass (contractors and the owner will likely use this from phones), loading/empty/error states, keyboard-only pass.

## Explicitly out of scope for v1

Multiple owners/multi-tenancy; a vendor marketplace or cross-instance shared-resource concept; automated payment to contractors (tracked as an expense only, gated on a completed prescribed report, not itself automated); SMS notifications (email only, or none, for v1); Stripe Connect of any kind; WebMCP (revisit only if this prototype validates enough to justify the bigger build); a public multi-property booking storefront (a simple internal/direct booking flow is enough at this scale).

## Verification plan

1. Owner defines a "Standard Turnover Clean" workflow template with 5 steps (2 requiring photos).
2. Owner creates a property with 2 units, a test booking, pays via Stripe test mode → booking confirms, guest concierge link issued.
3. Guest chats via the concierge link, asks a house-rules question, then requests a cleaning → work order created with the default cleaning template attached.
4. Owner assigns the work order to a test contact → contractor link issued.
5. Contractor opens the link (no login), works through the checklist via chat, uploads photos for the 2 required steps → all steps complete → `status = submitted_for_review`.
6. Owner reviews the submitted checklist (steps + photos + notes) in their own chat surface, approves → cost recorded, mirrored into `expenses`.
7. Reporting dashboard for that property shows the booking's revenue and the work order's expense, and occupancy reflects the booked nights.
8. Mid-stay, guest reopens the same concierge link on their phone and buys a "firewood bundle" add-on (`fulfillment_type = work_order`) → Stripe test payment → a work order auto-creates and flows through the same prescribed-workflow path as step 3-6.
9. Tamper check: an expired or already-used contractor/guest token → rejected, not silently allowed.

## Critical files to start with

- `lib/db/schema/*` — properties/units/bookings/workflow_templates/work_orders/work_order_step_completions foundation
- `lib/a2ui/protocol.ts`, `lib/agent/session.ts` — reused transport/persistence design from the OSS plan, now running in-process
- `lib/services/workOrderService.ts` — the step-completion gate (`submitted_for_review` only when every required step is done) is the core business rule of this app
- `lib/stripe/webhookHandlers.ts` — booking confirmation → guest session issuance
- `lib/tokens.ts` — shared signed-token helper for `guest_sessions` and `work_order_tokens`
