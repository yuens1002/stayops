# Personal Property Manager — MVP Plan

## Context

Separate from (and much smaller than) the earlier rent-runner OSS/3-service concept, which stays parked for later once there's a validated go-to-market strategy — nothing from that plan is being executed; its scaffolding on disk at `C:\Users\yuens\dev\rent-runner` is untouched and dormant.

A personal tool for managing a handful of the user's own short-term rental properties: booking + direct guest payment, a conversational concierge for guests, a **prescribed, checklist-based workflow** for cleaning/maintenance that contractors must complete and report on before payment, and reporting. Single operator, not a distributed/multi-tenant product — so the prior plan's monetization-boundary and cross-instance marketplace concerns don't apply, which collapses the architecture to **one app, one database, one Stripe account, no Connect, no separate services**.

The user explicitly wants this to double as market validation for the bigger OSS idea — real usage evidence of "prescribed workflow" surfaces before investing in the 3-service build. That means the **chat-first, lightweight SPA UI paradigm and the A2UI-rendered surfaces are kept**, not swapped for a conventional dashboard — this app is a working prototype of the real product experience, just scoped to one operator.

**Repo**: `stayops` (this repo — `C:\Users\yuens\dev\stayops`, its own standalone git repository).

## Stack

- Next.js 16 App Router + **React** + TypeScript, deployed to Vercel.
- **Tailwind 4 + shadcn/ui** (locked 2026-07-22). The mocks were prototyped in Pico.css, but the owner spec's §8 visual language is fully custom (cream/terracotta palette, Montserrat/Crimson type) — which erodes Pico's classless advantage — and the owner surface needs bespoke primitives (FAB sheet, confirm cards, inbox tabs, timeline grid) that map directly onto shadcn's Sheet/Dialog/Tabs. Spec §8 tokens port to Tailwind theme variables.
- **A2UI 1.0RC** for rendering the chat-driven UI — reuses the protocol/catalog/transport design already worked out for the OSS plan (envelope types, component catalog, SSE transport, Postgres-backed conversation/surface persistence), just running **in-process** in this one app instead of behind a separate `workflow-engine` service, since there's no one else's usage to meter or gate.
- **Vercel AI SDK** (`streamText`/`generateText` + `tools`) as the reasoning-engine integration (locked 2026-07-22) — the need is scoped tool-calling + multi-turn chat + generative UI, not autonomous agent orchestration; Claude Agent SDK rejected as over-fitted to coding-agent-shaped work.
- **Vercel AI Gateway** for model routing (locked 2026-07-22) — model-agnostic `"provider/model"` strings (e.g. `"anthropic/claude-sonnet-5"`), natively wired into the existing Vercel project; direct Anthropic SDK and OpenRouter rejected to avoid an extra external dependency for the same benefit.
- Neon Postgres + Drizzle — same reasoning as before (no query-engine binary in a Fluid Compute function, first-class `@neondatabase/serverless` support).
- **Vercel Blob** for checklist photo evidence (and add-on/property images). Binary uploads never travel over the agent tool transport — the web app uploads and the agent receives a reference it passes into tool calls (all three surface specs carry this limitation).
- Clerk — single owner login (or a couple of named users with a `role` field if access gets shared later); no Organizations complexity needed.
- Stripe — **plain single-account Checkout**, no Connect. The user is the one merchant collecting guest payments directly.
- Voice I/O: Grok (xAI) for STT/TTS only, browser-only, no telephony — see the Guest concierge chat section below.

## Design decisions — locked 2026-07-22

The three decisions previously flagged as open are now closed (rationale recorded in the Stack section above): **Tailwind 4 + shadcn/ui**, **Vercel AI SDK**, **Vercel AI Gateway**.

## Design references (surface specs are the contract)

Per-surface design specs, extracted from the local design-session mocks, are the committed contracts implementation builds against:

- `docs/OWNER-SURFACE-SPEC.md` — owner surface (agent-first, FAB-summoned sheet, read-only pages)
- `docs/CONTRACTOR-SURFACE-SPEC.md` — contractor checklist/chat surface (tokenized, no account)
- `docs/GUEST-SURFACE-SPEC.md` — guest concierge + public/pre-booking pages

The mock HTML files under `docs/SPA chat interface design/` are **local-only working references, deliberately not committed** — anything an implementer needs from them must live in the specs.

## Roles

- **Owner** (the user) — full access via a Clerk-authenticated chat surface: properties/units, bookings, work-order review/approval, reporting.
- **Guest** — no account. A tokenized concierge-chat link (`guest_sessions`), issued once a booking confirms.
- **Contractor** (cleaner/maintenance) — no account. A tokenized link (`contact_tokens`, contact-scoped) to a chat/checklist surface covering their whole book of work — assigned jobs, routines, history — with per-job deep links.

Two shells, same pattern as the original plan: `(public)` (guest + contractor, token-gated) and `(app)` (owner, Clerk-gated) — both mount the same `<AgentSurface />`; role resolved server-side from session/token, not from separate hand-built pages.

## Data model (Drizzle / Neon Postgres, single DB, no tenant_id needed)

```
properties            id, name, address
units                 id, property_id, label, unit_type(whole_property|adu|private_room|shared_room),
                      base_nightly_rate_cents, max_guests, house_rules, status,
                      wifi_network?, wifi_password?, door_code?, house_manual?, cancellation_policy?
                      -- access info (wifi/door code/house manual) renders on the guest concierge but is
                      -- LOCKED until 24h before check-in (guest spec §3); cancellation_policy is the
                      -- copy + rule source for guest self-service cancel/date-change

bookings              id, unit_id, check_in, check_out, guest_name, guest_email, guest_phone,
                      party_size, pets bool,
                      status(pending_payment|confirmed|cancelled|completed),
                      stripe_checkout_session_id, stripe_payment_intent_id, amount_cents
                      -- party_size/pets surface on the owner calendar bars and contractor job context

guest_sessions        id, booking_id, token_hash, expires_at

contacts              id, name, phone, email, type(cleaner|maintenance|other), default_rate_cents
                      -- the user's own known cleaners/contractors; no marketplace, just a contact list

workflow_templates    id, name, type(cleaning|maintenance|other), description
workflow_template_steps   id, template_id, order, area?, label, requires_photo bool, requires_note bool,
                      stock_items jsonb?, example_photo_url?
                      -- e.g. "Standard Turnover Clean": strip linens, run laundry, restock supplies,
                      -- photo of kitchen, photo of bathroom — the PRESCRIBED steps a contractor must follow
                      -- area groups steps into collapsible sections (Kitchen/Bath/Exterior);
                      -- stock_items lists supplies the contractor must level-check (stocked|low|out);
                      -- example_photo_url is an owner-provided reference photo shown beside the step
                      -- (contractor spec §5.2)

work_orders           id, unit_id, booking_id?, contact_id?, workflow_template_id?,
                      type(cleaning|maintenance|other),
                      status(requested→assigned→in_progress→submitted_for_review→approved→paid,
                             + needs_revision as the review-rejection branch),
                      scope, scheduled_at, accepted_at?, submitted_at, approved_at, cost_cents, notes,
                      review_note?, requested_by(owner|guest_concierge)
                      -- UI maps requested/assigned → "not started" (owner spec §6); needs_revision
                      -- re-opens the contractor checklist editable with review_note (the owner's
                      -- request-changes note) pinned on the job.
                      -- Accept flow (kept 2026-07-22): an assigned job renders as "New — preview" with
                      -- an Accept button on the contractor surface; accepting stamps accepted_at and
                      -- moves it into their active list. No explicit decline in v1 — a contractor who
                      -- can't take the job says so in the owner Messages thread and the owner reassigns.

work_order_step_completions   id, work_order_id, step_id, completed_at, note?, photo_urls jsonb?,
                      stock_levels jsonb?
                      -- one row per prescribed step; a work order can't reach submitted_for_review
                      -- until every required step (per its template) has a completion row;
                      -- photo_urls is an array (steps can require/accept multiple photos);
                      -- stock_levels records the per-item stocked|low|out answer for stock_items

contact_tokens        id, contact_id, token_hash, expires_at?, revoked_at?
                      -- CONTACT-scoped (decided 2026-07-22, replacing the earlier job-scoped
                      -- work_order_tokens): one link per contractor unlocks their whole book of work —
                      -- assigned/accepted work orders, routines, completed history, calendar — with
                      -- job URLs deep-linking within it (mock: /wo/482-t7). Owner-revocable;
                      -- expires_at is a clock backstop. Server-side authz still checks per-entity
                      -- ownership: a contact only ever sees their own assignments.

routine_series        id, property_id, contact_id, title, cadence, visits_per_month,
                      monthly_cost_cents, status(active|paused|ended)
routine_visits        id, series_id, visited_at, note?, photo_url?
                      -- monthly-retainer work (pool, landscaping): billed monthly, logged per visit;
                      -- visits do NOT generate work_orders (owner spec §5.3/§6)

maintenance_schedules id, unit_id, label, cadence(monthly|quarterly|biannual|annual), last_done_at?, note?
                      -- per-unit recurring maintenance (filter change, smoke-detector test). Items due
                      -- fold into the generated turnover checklist as maintenance-tagged steps with
                      -- due-by/last-done meta (contractor spec §5.2); completing the step stamps
                      -- last_done_at

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

conversations, messages, a2ui_surfaces   id, subject_type(owner|guest|contractor|public_inquiry),
                      subject_ref, kind(agent_chat|direct), role,
                      channel(app|sms|voicemail) default app, external_ref? unique, audio_url?,
                      content jsonb / components jsonb / data_model jsonb
                      -- channel/external_ref/audio_url serve the Google Voice channel (see that
                      -- section): sms/voicemail messages ingested from Gmail carry the Gmail message
                      -- id in external_ref (idempotency) and the voicemail audio link in audio_url
                      -- Postgres-backed since Vercel Functions are stateless between requests;
                      -- kind distinguishes agent conversations from direct human threads (the owner's
                      -- Messages inbox, owner spec §5.4; guest/contractor "message the host" threads);
                      -- agent chat on token surfaces is owner-readable (contractor spec §1.4);
                      -- public_inquiry = pre-booking inquiry threads in the owner's Messages inbox

tool_invocations      id, actor(owner_via_agent|contractor|guest|system), tool_name,
                      args jsonb (sensitive values redacted), result jsonb, entity_refs jsonb,
                      created_at
                      -- permanent audit log, independent of chat (owner spec §3.3); chat receipts
                      -- and the owner "recent activity" feed are views into this table

comm_sync_state       singleton row: gmail_history_cursor, last_polled_at
                      -- poll cursor for the Google Voice / Gmail ingestion cron
```

## The prescribed workflow, concretely

This is the feature that makes the cleaning/maintenance flow more than a bare "mark complete" button, and the part worth getting right since it's the market-validation core:

1. Owner defines `workflow_templates` per job type (e.g. one "Standard Turnover Clean" template with 5-8 ordered steps, some requiring a photo).
2. A `work_order` of type `cleaning` gets a `workflow_template_id` (default template for that type, owner can override).
3. Contractor opens their tokenized chat/checklist surface (A2UI-rendered: a `WorkOrderChecklist` component showing each step, a photo-upload affordance where required, a note field where required).
4. Contractor works through the steps; each completed step writes a `work_order_step_completions` row via chat or by checking items directly (both should work — this is a chat surface, not a form-only page, so "mark step 3 done, here's the photo" via chat should also work).
5. Once all required steps are complete, `work_orders.status → submitted_for_review` — this **is** the "report for payment": the owner reviews the submitted checklist (steps + photos + notes) before approving.
6. Owner approves in their own chat surface → `status → approved`, `cost_cents` recorded, mirrored into `expenses`. Actual payment to the contractor still happens outside the app (Venmo/cash/check) — v1 doesn't automate contractor payment, only gates the *approval* on a completed prescribed report.

Photo-evidence capture on the contractor surface **must use `getUserMedia`** (in-page camera stream with shutter/retake), not `<input capture>` — the input-capture camera trigger is unreliable on Android 14/15 Chrome and contractors are phone users; a plain gallery-pick file input (no `capture` attribute) is the fallback. Photos upload to Vercel Blob via the web app; `complete_step` receives the upload reference (contractor spec §4).

## Guest concierge chat

- Guest receives their `guest_sessions` link once `bookings.status = confirmed`. The link is valid for the whole stay, not single-use — guest can return to it any time (mobile-friendly) to chat or buy an add-on.
- Tools: look up their own booking (unit, dates, house rules), answer FAQ/house-rules questions, **create a `work_order`** (e.g. "please send someone to fix the AC" → maintenance work order, `requested_by = guest_concierge`, template auto-assigned by type), flag a late-checkout request for owner review (not auto-approved), **browse and buy `addon_products`** at any point during the stay, and **self-service cancel / date-change** (added 2026-07-22): both render confirm cards before committing; policy copy and refund rules come from `units.cancellation_policy`, refunds execute via the Stripe refund API, and date changes compute conflicts + price delta first (mirroring the owner agent's `update_booking` pattern).
- A2UI catalog components: `BookingSummaryCard`, `WorkOrderRequestConfirmation`, `AddonCatalogList`/`AddonCard` (browsable, "buy" button triggers Checkout inline in chat), chat bubbles.

### Voice I/O (optional enhancement, not core MVP scope)

Decision: **browser-only voice, kept simple** — reasoning stays in Claude; Grok is voice I/O only, not a second reasoning engine, and there is no telephony (no real phone number to call). Concretely:

- Guest speaks (browser mic, while on the concierge chat page) → audio streamed to **Grok STT** (streaming, ~$0.20/hr) → transcribed text fed into the *same* Claude tool-calling pipeline used for typed chat — same tools, same A2UI generation, no separate logic path.
- Claude's text response → **Grok TTS** (~$15/1M characters) → streamed back as audio for playback.
- Explicitly rejected: deploying Grok's own Voice Agent API (which has its own built-in reasoning + tool-calling, and integrates with LiveKit for real telephony) as a standalone voice agent that could also take real inbound phone calls. That's a materially bigger feature (SIP/PSTN bridge, a second independent reasoning/tool-calling implementation to keep behaviorally consistent with Claude's text-chat agent) and isn't needed right now — browser mic only.
- **WebMCP is unrelated to this feature** — it only exists inside a browser tab and is designed for third-party/visitor-brought agents reaching into a page, not for our own first-party agent's tool-calling (voice or text). Our own agent, whichever channel it's serving, just calls the backend's tools directly.
- Cost at this app's scale is low — a back-of-envelope 30 voice conversations/month at ~4 min each is a few dollars/month in STT+TTS, negligible relative to booking revenue.
- New env var: an xAI API key. New UI surface: a mic-input affordance + audio playback on the guest concierge chat.
- **Treat as a post-golden-path enhancement** — build the typed-chat golden path first (through milestone M3), add voice I/O once that's solid, not as a trunk/track/milestone blocker.

## À la carte guest services (add-ons, any time during the stay)

No architecture change — reuses the existing single-account Stripe Checkout mechanism and the same chat/A2UI surface, just a second purchase path independent of the original booking charge:
- Owner curates `addon_products` per unit (or globally) — e.g. firewood, late checkout, a welcome basket, an airport shuttle.
- Guest browses/buys via the concierge chat any time their `guest_sessions` link is valid (i.e. any time during the stay, from their phone) — a new Stripe Checkout Session per purchase, webhook confirms → `addon_purchases.status = paid`.
- If `fulfillment_type = work_order` (e.g. firewood delivery), payment confirmation auto-creates a `work_order` assigned via the same prescribed-workflow path as cleaning/maintenance (reuses `workflow_templates` — an add-on can have its own minimal template, e.g. "deliver + confirm drop-off photo"). If `fulfillment_type = none` (e.g. late checkout), it just updates a flag for owner review — no work order needed.
- Revenue from `addon_purchases` rolls into the same reporting queries as `bookings` revenue.

## Google Voice channel (post-golden-path enhancement)

Decided 2026-07-22: the owner's personal Google Voice number becomes an inbound text/voicemail channel for guests and contractors — the **interim** answer to guest/contractor adoption friction until a real A2P registration through an SMS provider lands (a Twilio attempt stalled; revisit when worth the fight).

- **No official GV API**, so sync rides Gmail: Google Voice's voicemail notifications (transcript + audio link) and SMS-forward emails are polled by a **Vercel Cron** hitting the Gmail API (OAuth refresh token, single account). Pub/Sub push is the upgrade path if ~1–5 min latency ever matters.
- **Matching:** sender number E.164-normalized, matched against the active booking's `guest_phone` first, then `contacts.phone`; matched messages append to that party's existing `kind=direct` thread with a channel badge. Unmatched numbers land in an "Unmatched" owner-inbox bucket with a link-to-contact/booking agent action.
- **Idempotency** keys on the Gmail message id (`messages.external_ref` unique). The parser scrapes Google's notification-email format, which can change without notice — this is a best-effort channel; the in-app thread stays the source of truth.
- **Outbound, best-effort:** replies to SMS-originated messages also send a Gmail reply to the `…@txt.voice.google.com` address, which Google Voice delivers as a text from the owner's number. Unofficial and may break silently — the UI labels these *"sent via text (best effort)"* and failures degrade to in-app-only without erroring the thread.
- **Prerequisites:** GV voicemail-to-email + SMS-forward-to-email enabled; a Gmail filter/label fencing GV notifications; Gmail OAuth env vars.
- **Build order:** the schema ships in trunk step T1 (`channel`/`external_ref`/`audio_url` on messages, `comm_sync_state`) so no later migration; the cron/parser/gateway build is an enhancement **after** the typed-chat golden path (post-M3), alongside voice I/O.

## Money flow (Stripe, single account — no Connect)

- Guest Checkout → the user's own Stripe account directly (`transfer_data` not needed — no platform/connected-account split). The add-on purchases above reuse this exact mechanism, invoked again per purchase.
- Webhook confirms payment → `bookings.status = confirmed` → issues the guest concierge link.
- Contractor payment is manual/external, tracked via `expenses` — see prescribed-workflow section above.

## Build order — trunk → parallel tracks → integration milestones

Restructured 2026-07-22 (from a strictly sequential phase list) to maximize concurrency between the app's discrete concerns. The seam that makes this safe is the **A2UI contract**: backend and frontend never call each other directly — they meet at typed envelopes — so once the contract freezes, the two tracks share almost no files and can run concurrently (orca worktree isolation applies cleanly).

### Trunk (serial, small)

- **T0 Scaffold** — Next.js + TS, Tailwind 4 + shadcn/ui, Clerk, Drizzle+Neon, Vercel link; agentic-workflow repo infra (`.claude/` gates, validators, templates). *Verify: app boots, sign-in works, `drizzle-kit push` connects, Gate 1 validator runs.*
- **T1 Contracts (freeze)** — the FULL Drizzle schema (every table in the data model above), `lib/a2ui/protocol.ts` (envelope/SSE/action shapes, reused from the OSS plan's design), `lib/a2ui/catalog.ts` (every component named in the three surface specs, with Zod prop schemas), the upload-endpoint contract (route + response shape), and **fixture envelopes** (one JSON fixture per spec screen, validated against the Zod schemas). After T1 the catalog is **frozen** — any change is a deliberate contract PR visible to both tracks, not a drive-by edit. *Verify: types compile, schema pushes, every fixture validates.*

### Parallel tracks (after T1; minimal cross-dependence by construction)

**Track B — backend, owned by `/backend-architect`:**
- B1 service layer per table (CRUD + invariants — the submit-gate rule in `workOrderService` is the core)
- B2 `lib/tokens.ts` (`guest_sessions` + `contact_tokens`) and server-side token resolution
- B3 Stripe: shared Checkout call site, webhook, refunds; booking confirm → guest-session issuance
- B4 agent pipe: AI SDK + AI Gateway, per-surface toolsets (owner/guest/contractor), session model (`lib/agent/session.ts`), `tool_invocations` audit writes
- B5 SSE + action endpoints wired to the pipe; upload endpoint (Vercel Blob)

*Verify: CRUD/invariant scripts, tool-call integration tests, test-mode Stripe run (`4242…`) — all headless, zero UI.*

**Track F — frontend, owned by `/frontend-dev` (design system led by `/ux-architect`):**
- F1 design system — **a first-class deliverable, not a token dump** (emphasized 2026-07-22): port the mocks' design language into a full custom shadcn theme — owner spec §8 tokens as Tailwind theme variables/CSS custom properties, shadcn primitives (Sheet/Dialog/Tabs/Card/Badge/Button) restyled to match the mocks' card/pill/divider conventions, and the Montserrat/Crimson/mono type scale. **Accent direction: leaning the green tone** (the §8 success-green family) over the mocks' terracotta — final call during the F1 theme pass, applied via theme variable so it's a one-line swap either way
- F2 chat shell + A2UI renderer, rendering fixture envelopes
- F3 catalog components against fixtures — guest cards, `WorkOrderChecklist` with the getUserMedia capture flow (against a stub upload endpoint), owner receipts/confirm cards
- F4 owner FAB + sheet + receipt peek + read-only pages (Properties/Calendar/Jobs/Messages) with fixture data
- F5 `(public)`/`(app)` shells with a stubbed session/token provider

*Verify: component render tests + screenshot ACs against fixtures — zero backend.*

**Track T — tests, owned by `/test-engineer`, cross-cutting:** schema/service invariant tests alongside B1 (especially the submit gate), component render tests alongside F3, and the integration harness the milestones below run on.

### Integration milestones (serial; each swaps fixtures/stubs for the real thing and is a golden-path gate)

- **M1 Owner surface live** (needs Clerk only) — renderer switched from fixtures to real SSE; owner golden path: property/unit/booking management via agent, receipts, audit log, simulated cold start proving state rehydrates from Postgres.
- **M2 Contractor surface live** — contact token resolution, book-of-work views, Accept flow, full checklist round trip: photos (getUserMedia → Blob), submit gate, `needs_revision` fix + resubmit, owner approval.
- **M3 Guest surface live** (needs Stripe) — concierge link issuance on webhook confirm, FAQ/booking lookup, work-order request, add-on purchase mid-stay, cancel/date-change with policy-driven refund.
- **M4 Reporting** — revenue/expense/occupancy per property/unit, date-range filtering, charts via the `dataviz` skill. *Verify: numbers match manually-computed totals.*
- **M5 Polish** — mobile-friendly pass (contractors and the owner live on phones), loading/empty/error states, keyboard-only pass.

**Post-golden-path enhancements** (any order, after M3): voice I/O (Grok STT/TTS), the Google Voice channel.

## Explicitly out of scope for v1

Multiple owners/multi-tenancy; a vendor marketplace or cross-instance shared-resource concept; automated payment to contractors (tracked as an expense only, gated on a completed prescribed report, not itself automated); provider-based A2P SMS (a real provider registration is a later goal — the Twilio attempt stalled; the Google Voice channel above is the interim, and email remains the fallback); Stripe Connect of any kind; WebMCP (revisit only if this prototype validates enough to justify the bigger build); **any public/pre-booking surface** (deferred entirely 2026-07-22 — bookings are owner-initiated with a Checkout link sent to the guest; see "Deferred research" below); **guestbook** (mocked, cut 2026-07-22); **reviews/ratings**; **extra-guest/pet fee pricing and invite-guests-by-email at checkout** (party_size + pets are recorded, but v1 pricing is flat nightly rate); **TIDY's turnover-management MCP/API** (considered 2026-07-22 — full API access requires their paid Standard tier, $10-20/unit/mo, and it would outsource the prescribed-checklist/step-completion workflow that this app exists to validate as its own feature, not a vendor's).

### Deferred research — before any public booking surface

A public, stranger-facing booking page is a different risk category from the current known-guest direct flow and needs a research pass before design (flagged 2026-07-22): short-term-rental insurance requirements, guest credit/background-check APIs, e-signature for rental agreements (DocuSign or similar), calendar sync with OTAs (iCal/Airbnb/VRBO), dynamic pricing, terms-of-service/liability copy, and payment-compliance implications of taking public payments. Until that research lands, "public" stays out of scope and nothing in the v1 architecture should presuppose it.

## Verification plan

1. Owner defines a "Standard Turnover Clean" workflow template with 5 steps (2 requiring photos).
2. Owner creates a property with 2 units, a test booking, pays via Stripe test mode → booking confirms, guest concierge link issued.
3. Guest chats via the concierge link, asks a house-rules question, then requests a cleaning → work order created with the default cleaning template attached.
4. Owner assigns the work order to a test contact → contact-scoped contractor link issued.
5. Contractor opens the link (no login), sees the job as "New — preview", **accepts it**, works through the checklist via chat, uploads photos for the 2 required steps (in-page getUserMedia capture) → all steps complete → `status = submitted_for_review`.
6. Owner reviews the submitted checklist (steps + photos + notes) in their own chat surface, approves → cost recorded, mirrored into `expenses`.
7. Reporting dashboard for that property shows the booking's revenue and the work order's expense, and occupancy reflects the booked nights.
8. Mid-stay, guest reopens the same concierge link on their phone and buys a "firewood bundle" add-on (`fulfillment_type = work_order`) → Stripe test payment → a work order auto-creates and flows through the same prescribed-workflow path as step 3-6.
9. Tamper check: an expired or already-used contractor/guest token → rejected, not silently allowed.

## Critical files to start with

- `lib/db/schema/*` — properties/units/bookings/workflow_templates/work_orders/work_order_step_completions foundation
- `lib/a2ui/protocol.ts`, `lib/agent/session.ts` — reused transport/persistence design from the OSS plan, now running in-process
- `lib/services/workOrderService.ts` — the step-completion gate (`submitted_for_review` only when every required step is done) is the core business rule of this app
- `lib/stripe/webhookHandlers.ts` — booking confirmation → guest session issuance
- `lib/tokens.ts` — shared signed-token helper for `guest_sessions` and `contact_tokens`
