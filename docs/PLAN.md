# Personal Property Manager — MVP Plan

## Context

Separate from (and much smaller than) the earlier rent-runner OSS/3-service concept, which stays parked for later once there's a validated go-to-market strategy — nothing from that plan is being executed; its scaffolding on disk at `C:\Users\yuens\dev\rent-runner` is untouched and dormant.

A personal tool for managing a handful of the user's own short-term/mid-term rental properties. **Bookings originate on third-party platforms (Airbnb, Furnished Finder) and sync in** — per-unit iCal feeds are the dates/existence authority, Airbnb confirmation emails (via Gmail) enrich them with guest details and payout amounts, and the owner can manually create bookings/leases for direct arrangements. Around that: a conversational concierge for guests, a **prescribed, checklist-based workflow** for cleaning/maintenance that contractors must complete and report on before approval, and reporting. **No payments in v1** (pivoted 2026-07-23 — the platforms collect guest money; Stripe cut entirely). Single operator, not a distributed/multi-tenant product — **one app, one database, no payment processing, no separate services**.

The user explicitly wants this to double as market validation for the bigger OSS idea — real usage evidence of "prescribed workflow" surfaces before investing in the 3-service build. That means the **chat-first, lightweight SPA UI paradigm and the A2UI-rendered surfaces are kept**, not swapped for a conventional dashboard — this app is a working prototype of the real product experience, just scoped to one operator.

**Repo**: `stayops` (this repo — `C:\Users\yuens\dev\stayops`, its own standalone git repository).

## Stack

- Next.js 16 App Router + **React** + TypeScript, deployed to Vercel.
- **Tailwind 4 + shadcn/ui** (locked 2026-07-22). The mocks were prototyped in Pico.css, but the owner spec's §8 visual language is fully custom (cream/terracotta palette, Montserrat/Crimson type) — which erodes Pico's classless advantage — and the owner surface needs bespoke primitives (FAB sheet, confirm cards, inbox tabs, timeline grid) that map directly onto shadcn's Sheet/Dialog/Tabs. Spec §8 tokens port to Tailwind theme variables.
- **A2UI 1.0RC** for rendering the chat-driven UI — reuses the protocol/catalog/transport design already worked out for the OSS plan (envelope types, component catalog, SSE transport, Postgres-backed conversation/surface persistence), just running **in-process** in this one app instead of behind a separate `workflow-engine` service, since there's no one else's usage to meter or gate.
- **Vercel AI SDK** (`streamText`/`generateText` + `tools`) as the reasoning-engine integration (locked 2026-07-22) — the need is scoped tool-calling + multi-turn chat + generative UI, not autonomous agent orchestration; Claude Agent SDK rejected as over-fitted to coding-agent-shaped work.
- **Vercel AI Gateway** for model routing (locked 2026-07-22) — model-agnostic `"provider/model"` strings (e.g. `"anthropic/<model-id>"`), natively wired into the existing Vercel project; direct Anthropic SDK and OpenRouter rejected to avoid an extra external dependency for the same benefit.
- Neon Postgres + Drizzle — same reasoning as before (no query-engine binary in a Fluid Compute function, first-class `@neondatabase/serverless` support). Provisioned as a single project under the owner's **personal Neon account (`yuens1002`, Hobby plan), connected via the native Vercel↔Neon integration on the same Vercel account** — no new or team Neon account; branch usage budgeted within Hobby limits (see "Dev & verification environment").
- **Vercel Blob** for checklist photo evidence (and add-on/property images). Binary uploads never travel over the agent tool transport — the web app uploads and the agent receives a reference it passes into tool calls (all three surface specs carry this limitation).
- Clerk — single owner login (or a couple of named users with a `role` field if access gets shared later); no Organizations complexity needed.
- **Gmail API (OAuth, owner's yuens1002 account)** — v1-core ingestion channel: Airbnb booking-confirmation/cancellation email parsing enriches iCal-synced bookings with guest details + payout (see "Booking ingestion"); the same infra later serves the Google Voice channel.
- **No Stripe / no payments** (pivoted 2026-07-23; was single-account Checkout) — platforms collect guest money; revenue is recorded from email-enriched payouts or manual entry; contractor payment stays external, tracked via `expenses`.
- Voice I/O: Grok (xAI) for STT/TTS only, browser-only, no telephony — see the Guest concierge chat section below.

## Design decisions — locked 2026-07-22

The three decisions previously flagged as open are now closed (rationale recorded in the Stack section above): **Tailwind 4 + shadcn/ui**, **Vercel AI SDK**, **Vercel AI Gateway**.

## Iteration-1 pivot — 2026-07-23

Re-scoped after T1 shipped: **(1) payments cut entirely** (no Stripe, no add-on commerce, no guest self-service cancel/date-change — the booking platforms own money and booking mutations); **(2) third-party booking ingestion becomes the core** (**two-way iCal** — import feeds + a per-unit export feed; Gmail enrichment; manual booking/lease/block creation, owner-only mutations; turnover work orders auto-create/cancel from sync events); **(3) all agent chat-history features deferred** to a separate planning pass (sessions, auto-titling, cross-session resume, context-assembly design — v1 persists agent transcripts but ships no session features; human Messages threads unaffected). The frozen T1 contracts get a deliberate **contract-amendment PR** (schema + catalog) reflecting this — see Build order.

## Design references (surface specs are the contract)

Per-surface design specs, extracted from the local design-session mocks, are the committed contracts implementation builds against:

- `docs/OWNER-SURFACE-SPEC.md` — owner surface (agent-first, FAB-summoned sheet, read-only pages)
- `docs/CONTRACTOR-SURFACE-SPEC.md` — contractor checklist/chat surface (tokenized, no account)
- `docs/GUEST-SURFACE-SPEC.md` — guest concierge surface (its public/pre-booking sections are **deferred-scope reference only** — the public surface is out of scope for v1, see "Explicitly out of scope")

The mock HTML files under `docs/SPA chat interface design/` are **local-only working references, deliberately not committed** — anything an implementer needs from them must live in the specs.

## Roles

- **Owner** (the user) — full access via a Clerk-authenticated chat surface: properties/units, the synced calendar, jobs (work-order review/approval), Messages, reporting. Bookings are **read-only mirrors of the platforms** (changes happen on Airbnb/Furnished Finder and sync in) plus manual booking/lease/block creation for direct arrangements and calendar holds.
- **Guest** — no account. A tokenized concierge-chat link (`guest_sessions`), **issued by the owner** once guest contact info is attached to a synced booking (iCal feeds carry no contact info — it arrives via Airbnb email enrichment or the owner types it in) or at manual booking/lease creation (blocks have no guest). Guest needs served: everything about their booking/lease, everything about the space (access info time-gated), Messages with the owner, and report-a-problem.
- **Contractor** (cleaner/maintenance) — no account. A tokenized link (`contact_tokens`, contact-scoped) to a chat/checklist surface covering their whole book of work — assigned jobs, routines, history — with per-job deep links.

Two shells, same pattern as the original plan: `(public)` (guest + contractor, token-gated) and `(app)` (owner, Clerk-gated) — both mount the same `<AgentSurface />`; role resolved server-side from session/token, not from separate hand-built pages.

## Data model (Drizzle / Neon Postgres, single DB, no tenant_id needed)

```
properties            id, name, address
units                 id, property_id, label, unit_type(whole_property|adu|private_room|shared_room),
                      base_nightly_rate_cents, max_guests, house_rules, status,
                      wifi_network?, wifi_password?, door_code?, house_manual?, cancellation_policy?,
                      ical_export_token unique
                      -- access info (wifi/door code/house manual) renders on the guest concierge but is
                      -- LOCKED until 24h before check-in (guest spec §3); cancellation_policy is
                      -- informational copy only (cancellations happen on the booking platform);
                      -- ical_export_token is the rotatable capability token for the unit's export feed

calendar_feeds        id, unit_id, platform(airbnb|furnished_finder|other), url, last_synced_at?,
                      last_hash?
                      -- per-unit IMPORT feed URLs, polled by the ingestion cron. The EXPORT direction
                      -- is per-unit: units.ical_export_token serves our own feed (see Booking ingestion)

bookings              id, unit_id, kind(booking|lease|block), source(airbnb|furnished_finder|manual),
                      external_ref? unique, confirmation_code?,
                      check_in, check_out, guest_name?, guest_email?, guest_phone?,
                      party_size?, pets bool default false,
                      status(confirmed|cancelled|completed),
                      amount_cents?, monthly_rent_cents?
                      -- iCal is the dates/existence authority (external_ref = iCal event UID,
                      -- idempotency key); guest fields are NULLABLE because feeds carry no contact
                      -- info — Airbnb email enrichment (matched via confirmation_code/dates/unit)
                      -- or the owner fills them in. amount_cents = payout (email-enriched or manual);
                      -- monthly_rent_cents for kind=lease (Furnished Finder / direct mid-term);
                      -- kind=block = owner date-block (personal use/maintenance window): no guest,
                      -- no turnover, exported to platforms via the unit's export feed. Blocks never
                      -- auto-create work orders.
                      -- No payment columns — platforms collect money (2026-07-23 pivot).
                      -- party_size/pets surface on the owner calendar bars and contractor job context

guest_sessions        id, booking_id, token_hash, expires_at
                      -- issued by the OWNER (agent action) once the booking has guest contact info —
                      -- not auto-minted (there is no payment webhook anymore)

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
                      review_note?, requested_by(owner|guest_concierge|system)
                      -- requested_by=system: turnover work orders AUTO-CREATE when a booking syncs in
                      -- (scheduled for checkout day, default cleaning template) and AUTO-CANCEL when
                      -- the platform booking cancels (2026-07-23 pivot — see Booking ingestion).
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

-- addon_products / addon_purchases: REMOVED 2026-07-23 (deferred with payments —
-- see out-of-scope; the T1 tables get dropped in the contract-amendment PR)

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

comm_sync_state       id (source key: 'airbnb_email' | later 'gv'), gmail_history_cursor, last_polled_at
                      -- per-source poll cursors for the Gmail ingestion cron (was a singleton in T1;
                      -- generalized in the contract-amendment PR — airbnb_email is v1, gv post-golden-path)
```

## The prescribed workflow, concretely

This is the feature that makes the cleaning/maintenance flow more than a bare "mark complete" button, and the part worth getting right since it's the market-validation core:

0. **Turnover work orders create themselves** (2026-07-23): when a booking syncs in from a platform feed, a `cleaning` work order auto-creates (`requested_by=system`) scheduled for checkout day with the default turnover template; when the platform booking cancels, an unstarted auto-created work order cancels with it (an in-progress one gets flagged for owner review instead). Maintenance/other work orders are owner- or guest-initiated as before.
1. Owner defines `workflow_templates` per job type (e.g. one "Standard Turnover Clean" template with 5-8 ordered steps, some requiring a photo).
2. A `work_order` of type `cleaning` gets a `workflow_template_id` (default template for that type, owner can override).
3. Contractor opens their tokenized chat/checklist surface (A2UI-rendered: a `WorkOrderChecklist` component showing each step, a photo-upload affordance where required, a note field where required).
4. Contractor works through the steps; each completed step writes a `work_order_step_completions` row via chat or by checking items directly (both should work — this is a chat surface, not a form-only page, so "mark step 3 done, here's the photo" via chat should also work).
5. Once all required steps are complete, `work_orders.status → submitted_for_review` — this **is** the "report for payment": the owner reviews the submitted checklist (steps + photos + notes) before approving.
6. Owner approves in their own chat surface → `status → approved`, `cost_cents` recorded, mirrored into `expenses`. Actual payment to the contractor still happens outside the app (Venmo/cash/check) — v1 doesn't automate contractor payment, only gates the *approval* on a completed prescribed report.

Photo-evidence capture on the contractor surface **must use `getUserMedia`** (in-page camera stream with shutter/retake), not `<input capture>` — the input-capture camera trigger is unreliable on Android 14/15 Chrome and contractors are phone users; a plain gallery-pick file input (no `capture` attribute) is the fallback. Photos upload to Vercel Blob via the web app; `complete_step` receives the upload reference (contractor spec §4).

## Guest concierge chat

- Guest receives their `guest_sessions` link **from the owner** (see Roles — issuance is an owner agent action once contact info exists on the booking). The link is valid for the whole stay, not single-use — guest can return any time (mobile-friendly).
- Scope (2026-07-23 pivot): the guest surface is **know-everything-about-my-stay + messages + report-a-problem**. Tools: look up their own booking/lease (unit, dates, rules, time-gated access info), answer FAQ/house-rules questions, **create a `work_order`** (e.g. "please send someone to fix the AC" → maintenance work order, `requested_by = guest_concierge`, template auto-assigned by type), flag a late-checkout **request** for owner review (a flag, not a purchase), and message the host (`kind=direct` thread).
- **Removed with the payments pivot**: add-on browsing/purchase, self-service cancel/date-change (bookings change on the platform they were made on), paid late checkout.
- A2UI catalog components: `BookingSummaryCard`, `ReservationDetailCard`, `HouseRulesCard`, `WorkOrderRequestConfirmation`, chat bubbles.

### Voice I/O (optional enhancement, not core MVP scope)

Decision: **browser-only voice, kept simple** — reasoning stays in Claude; Grok is voice I/O only, not a second reasoning engine, and there is no telephony (no real phone number to call). Concretely:

- Guest speaks (browser mic, while on the concierge chat page) → audio streamed to **Grok STT** (streaming, ~$0.20/hr) → transcribed text fed into the *same* Claude tool-calling pipeline used for typed chat — same tools, same A2UI generation, no separate logic path.
- Claude's text response → **Grok TTS** (~$15/1M characters) → streamed back as audio for playback.
- Explicitly rejected: deploying Grok's own Voice Agent API (which has its own built-in reasoning + tool-calling, and integrates with LiveKit for real telephony) as a standalone voice agent that could also take real inbound phone calls. That's a materially bigger feature (SIP/PSTN bridge, a second independent reasoning/tool-calling implementation to keep behaviorally consistent with Claude's text-chat agent) and isn't needed right now — browser mic only.
- **WebMCP is unrelated to this feature** — it only exists inside a browser tab and is designed for third-party/visitor-brought agents reaching into a page, not for our own first-party agent's tool-calling (voice or text). Our own agent, whichever channel it's serving, just calls the backend's tools directly.
- Cost at this app's scale is low — a back-of-envelope 30 voice conversations/month at ~4 min each is a few dollars/month in STT+TTS, negligible relative to booking revenue.
- New env var: an xAI API key. New UI surface: a mic-input affordance + audio playback on the guest concierge chat.
- **Treat as a post-golden-path enhancement** — build the typed-chat golden path first (through milestone M3), add voice I/O once that's solid, not as a trunk/track/milestone blocker.

## Booking ingestion (iCal + Gmail enrichment + manual) — v1 core

The 2026-07-23 pivot's centerpiece: bookings are made and changed on third-party platforms; StayOps mirrors them and reacts.

1. **iCal sync — two-way (decided 2026-07-23, superseding the same-day import-only call):**
   - **Import (dates/existence authority):** a Vercel Cron polls each `calendar_feeds` URL, upserting `bookings` keyed on the iCal event UID (`external_ref`). New event → booking created (`source` = platform) **and a turnover work order auto-created** for checkout day. Event gone or cancelled → booking `cancelled` and its unstarted auto-turnover cancelled (in-progress → flagged for owner review). Date changes update the booking and reschedule the unstarted turnover.
   - **Export (our feed, platforms subscribe):** each unit publishes a tokenized iCal URL (`GET /api/ical/{unitExportToken}.ics`, capability URL — rotatable via `units.ical_export_token`) serving VEVENTs for every date-consuming row on that unit: manual bookings/leases, **owner date-blocks** (`kind=block` — personal use, maintenance windows; no guest, just dates), and platform-synced bookings (cross-blocking when a unit lists on more than one platform). The owner pastes this URL into each platform's external-calendar setting once.
   - **Mutation authority:** only the **owner surface** writes calendar state in-app (manual bookings/leases/blocks + annotations); platform-synced bookings are read-only mirrors; guests and contractors never mutate the calendar. Outbound latency caveat: platforms poll subscribed feeds on their own schedule (hours, not minutes) — inbound latency is our cron's, outbound is theirs.
2. **Airbnb email enrichment (guest details + revenue):** the same Gmail infrastructure planned for the Google Voice channel, promoted to v1: the cron also parses Airbnb booking-confirmation/cancellation emails (Gmail API, owner's account) and matches them to synced bookings via confirmation code/dates/unit — attaching `guest_name`/contact, `confirmation_code`, and payout → `amount_cents`. Best-effort parser (Airbnb can change formats); unmatched emails land in an owner-inbox review bucket. Idempotent on Gmail message id.
3. **Manual booking/lease creation:** the owner agent creates `source=manual` rows directly — direct bookings and **mid-term leases** (`kind=lease`, `monthly_rent_cents`; the Furnished Finder arrangement, whose own feed still provides dates when available). Manual rows are the one kind the owner can edit in-app.

`update_booking` as a general mutation is **gone** — synced bookings are read-only mirrors plus owner annotations (attach guest contact, record payout, notes). The platforms own the booking lifecycle.

## Google Voice channel (post-golden-path enhancement)

Decided 2026-07-22: the owner's personal Google Voice number becomes an inbound text/voicemail channel for guests and contractors — the **interim** answer to guest/contractor adoption friction until a real A2P registration through an SMS provider lands (a Twilio attempt stalled; revisit when worth the fight).

- **No official GV API**, so sync rides Gmail: Google Voice's voicemail notifications (transcript + audio link) and SMS-forward emails are polled by a **Vercel Cron** hitting the Gmail API (OAuth refresh token, single account). Pub/Sub push is the upgrade path if ~1–5 min latency ever matters.
- **Matching:** sender number E.164-normalized, matched against the active booking's `guest_phone` first, then `contacts.phone`; matched messages append to that party's existing `kind=direct` thread with a channel badge. Unmatched numbers land in an "Unmatched" owner-inbox bucket with a link-to-contact/booking agent action.
- **Idempotency** keys on the Gmail message id (`messages.external_ref` unique). The parser scrapes Google's notification-email format, which can change without notice — this is a best-effort channel; the in-app thread stays the source of truth.
- **Outbound, best-effort:** replies to SMS-originated messages also send a Gmail reply to the `…@txt.voice.google.com` address, which Google Voice delivers as a text from the owner's number. Unofficial and may break silently — the UI labels these *"sent via text (best effort)"* and failures degrade to in-app-only without erroring the thread.
- **Prerequisites:** GV voicemail-to-email + SMS-forward-to-email enabled; a Gmail filter/label fencing GV notifications; Gmail OAuth env vars.
- **Build order:** the messages schema shipped in T1; the **shared Gmail plumbing (OAuth, cron, per-source cursors) now ships in v1 with the Airbnb email enrichment** (see Booking ingestion) — the GV parser/gateway is the post-golden-path add on top of it, alongside voice I/O.

## Money (none in v1 — 2026-07-23 pivot)

- **Guest money:** collected by the booking platforms (Airbnb/Furnished Finder) or arranged directly off-app. StayOps records revenue only: `amount_cents` from email enrichment or manual entry, `monthly_rent_cents` on leases.
- **Contractor money:** unchanged — paid outside the app (Venmo/cash/check), gated on the approved prescribed report, recorded in `expenses`.
- **Stripe:** entirely out (packages, env vars, webhook route, checkout call sites). Revisit only if direct booking ever returns (see Deferred research).

## Build order — trunk → parallel tracks → integration milestones

Restructured 2026-07-22 (from a strictly sequential phase list) to maximize concurrency between the app's discrete concerns. The seam that makes this safe is the **A2UI contract**: backend and frontend never call each other directly — they meet at typed envelopes — so once the contract freezes, the two tracks share almost no files and can run concurrently (orca worktree isolation applies cleanly).

### Trunk (serial, small)

- **T0 Scaffold** — Next.js + TS, Tailwind 4 + shadcn/ui, Clerk, Drizzle+Neon (provisioned per the stack note: `yuens1002` Hobby account via the Vercel integration), Vercel link, `.env.example` documenting every required var; agentic-workflow repo infra (`.claude/` gates, validators, templates). *Verify: app boots, sign-in works, `drizzle-kit push` connects, Gate 1 validator runs.*
- **T1a Contract amendment (2026-07-23 pivot)** — the deliberate contract PR the freeze process exists for: schema — add `calendar_feeds`, rework `bookings` (kind incl. `block`/source/external_ref/confirmation_code, nullable guest fields, no payment columns, simplified status), `units.ical_export_token`, drop `addon_products`/`addon_purchases`, generalize `comm_sync_state` to per-source cursors, `requested_by` gains `system`; catalog — remove `CheckoutCard`, `AddonCatalogList`, `AddonCard`, `CancelReservationCard` (+ their fixtures); re-freeze after merge. *Verify: db:push clean, full test suite green after amendment.*
- **T1 Contracts (freeze)** — DONE 2026-07-22 (PR #6). Was: the FULL Drizzle schema (every table in the data model above), `lib/a2ui/protocol.ts` (envelope/SSE/action shapes, reused from the OSS plan's design), `lib/a2ui/catalog.ts` (every component named in the three surface specs, with Zod prop schemas), the upload-endpoint contract (route + response shape), and **fixture envelopes** (one JSON fixture per spec screen, validated against the Zod schemas). Also **`scripts/seed.ts`** — realistic demo state (2 properties, units, a mid-stay booking, work orders across every status, a routine series) so screenshots and reporting checks always run over believable data, and any Neon branch can be reset to baseline. After T1 the catalog is **frozen** — any change is a deliberate contract PR visible to both tracks, not a drive-by edit. *Verify: types compile, schema pushes, every fixture validates, seed runs clean twice (idempotent).*

### Parallel tracks (after T1; minimal cross-dependence by construction)

**Track B — backend, owned by `/backend-architect`:**
- B1 service layer per table (CRUD + invariants — the submit-gate rule in `workOrderService` is the core)
- B2 `lib/tokens.ts` (`guest_sessions` + `contact_tokens`) and server-side token resolution
- B3 **booking ingestion + 2-way sync** (replaces Stripe, 2026-07-23): iCal poll cron over `calendar_feeds` (UID upsert, cancellation/date-change detection), turnover work-order auto-create/cancel/reschedule, **per-unit export feed endpoint** (`/api/ical/{unitExportToken}.ics` — manual bookings/leases/blocks + cross-platform events), Airbnb email enrichment parser on the shared Gmail infra (OAuth + per-source cursors), manual booking/lease/block creation (owner-only mutations), owner-initiated guest-session issuance
- B4 agent pipe: AI SDK + AI Gateway, per-surface toolsets (owner/guest/contractor), `tool_invocations` audit writes. Agent transcripts persist; **no session features** (B4a deferred)
- ~~B4a context/session model~~ — **DEFERRED 2026-07-23** to a separate planning pass with all chat-history features (sessions, titling, resume, context-assembly design). v1: transcripts persist, context = current page + recent turns, nothing fancier
- B5 SSE + action endpoints wired to the pipe; upload endpoint (Vercel Blob)

*Verify: CRUD/invariant scripts, tool-call integration tests, ingestion run against a local test iCal feed + captured Airbnb email fixtures — all headless, zero UI.*

**Track F — frontend, owned by `/frontend-dev` (design system led by `/ux-architect`):**
- F1 design system — **a first-class deliverable, not a token dump** (emphasized 2026-07-22): port the mocks' design language into a full custom shadcn theme — owner spec §8 tokens as Tailwind theme variables/CSS custom properties, shadcn primitives (Sheet/Dialog/Tabs/Card/Badge/Button) restyled to match the mocks' card/pill/divider conventions, and the Montserrat/Crimson/mono type scale. **Accent direction: leaning the green tone** (the §8 success-green family) over the mocks' terracotta — final call during the F1 theme pass, applied via theme variable so it's a one-line swap either way
- F2 chat shell + A2UI renderer, rendering fixture envelopes; plus a **dev-only fixtures harness route** (`/dev/fixtures`, excluded from production builds) rendering every catalog component from its T1 fixtures — the screenshot-AC and visual-regression surface for the whole track
- F3 catalog components against fixtures — guest cards, `WorkOrderChecklist` with the getUserMedia capture flow (against a stub upload endpoint), owner receipts/confirm cards
- F4 owner FAB + sheet + receipt peek + read-only pages (Properties/Calendar/Jobs/Messages) with fixture data
- F5 `(public)`/`(app)` shells with a stubbed session/token provider

*Verify: component render tests + screenshot ACs against fixtures — zero backend.*

**Track T — tests, owned by `/test-engineer`, cross-cutting:** schema/service invariant tests alongside B1 (especially the submit gate), component render tests alongside F3, the integration harness the milestones below run on, and the **agent eval harness** (with B4): (1) deterministic pipe tests via the AI SDK mock provider — tool result → receipt → `tool_invocations` row → envelope, in CI; (2) live evals (`npm run evals`, on-demand, NOT in the CI critical path) — a golden scenario suite per surface (~12–15) against the real model asserting tool name + args-subset + **gating invariants (money/destructive tools never fire without a preceding confirm action)** at a pass@k threshold. Non-deterministic behavior ships only behind a passing eval suite.

### Integration milestones (serial; each swaps fixtures/stubs for the real thing and is a golden-path gate)

- **M1 Owner surface live** (needs Clerk only) — renderer switched from fixtures to real SSE; owner golden path: property/unit management, **live synced calendar (test iCal feed → bookings + auto-turnovers visible; export feed serving the unit's events)**, manual booking/lease/block creation, jobs review, Messages, receipts, audit log, cold start proving state rehydrates from Postgres; **owner-surface live eval suite passing at threshold** (confirm-gating invariant included) is a merge gate.
- **M2 Contractor surface live** — contact token resolution, book-of-work views, Accept flow, full checklist round trip: photos (getUserMedia → Blob), submit gate, `needs_revision` fix + resubmit, owner approval.
- **M3 Guest surface live** — owner attaches guest contact (or email enrichment provides it) and issues the concierge link; guest golden path: booking/lease lookup, space info with the 24h access-info gate, FAQ/rules, report-a-problem → work order, host Messages thread.
- **M4 Reporting** — revenue/expense/occupancy per property/unit, date-range filtering, charts via the `dataviz` skill. *Verify: numbers match manually-computed totals.*
- **M5 Polish** — mobile-friendly pass (contractors and the owner live on phones), loading/empty/error states, keyboard-only pass.

**Post-golden-path enhancements** (any order, after M3): voice I/O (Grok STT/TTS), the Google Voice channel.

## Dev & verification environment

How work gets validated with substantive evidence (the AC docs reference these methods):

- **Local**: `next dev` on localhost. Visual ACs are verified by driving the app with browser automation and capturing named screenshots/GIFs that are **viewed in-conversation** — an agent's text description never passes a visual AC; the image itself is the evidence.
- **Preview deploys**: every PR gets a Vercel preview URL (HTTPS). Mandatory for device-specific checks — desktop browsers can exercise getUserMedia basics, but the constraints that actually matter (Android Chrome camera behavior, secure-context rules, capture UX on a phone) are validated on a **real Android device against a preview URL** before merge. Same route for judging the owner FAB/sheet feel on a real phone.
- **Neon**: single project under the owner's **personal account (`yuens1002`, Hobby plan)**, connected through the **native Vercel↔Neon integration on the owner's Vercel account** so env vars sync automatically — never a separate or team Neon account. Branching: `main` (prod) + one long-lived `dev` branch; ephemeral per-PR branches only when a change needs isolated data, deleted after merge — Hobby-plan project/branch limits are the budget, so branches are spent deliberately.
- **Ingestion simulation**: a local test iCal feed (fixture `.ics` files served from a dev route or file) exercises the full sync chain — booking upsert, turnover auto-create, cancellation — without touching real platforms; captured real Airbnb notification emails (sanitized) are the parser fixtures. Clerk dev-instance keys for auth.
- **Seed data**: `scripts/seed.ts` (trunk T1) resets any branch to the realistic demo state — screenshots show real UI over real state, and reporting numbers can be checked against hand-computed totals.
- **Fixtures harness**: `/dev/fixtures` (track F2) renders every A2UI catalog component from its frozen T1 fixtures — Track F produces screenshot evidence with zero backend, and the route doubles as the visual-regression surface later.
- **Evidence rules** (enforced by the AC format + Gate 3): visual AC → named screenshot/GIF artifact; logic AC → code-review file ref; behavior AC → test-run output; E2E → numbered steps against seeded state. Track B evidence is headless by design — e.g. the submit-gate invariant (submitting with an incomplete required step must fail server-side) is a test run, not a screenshot.
- `.env.example` (T0) documents every required var: Clerk, Neon, Blob, AI Gateway, **Gmail OAuth (v1 — Airbnb email enrichment)** — later xAI (voice) and the GV number. Stripe vars removed (2026-07-23).

## Explicitly out of scope for v1

Multiple owners/multi-tenancy; a vendor marketplace or cross-instance shared-resource concept; automated payment to contractors (tracked as an expense only, gated on a completed prescribed report, not itself automated); provider-based A2P SMS (a real provider registration is a later goal — the Twilio attempt stalled; the Google Voice channel above is the interim, and email remains the fallback); **all payment processing** (2026-07-23 pivot — Stripe removed entirely; platforms collect guest money); **add-on commerce** (`addon_products`/`addon_purchases` cut with payments); **guest self-service cancel/date-change** (kept 2026-07-22, **reversed 2026-07-23** — the booking platform owns booking mutations); **paid late checkout** (survives only as a request flag); **agent chat-history/session features** (deferred 2026-07-23 to a separate planning pass — transcripts persist, no sessions/titling/resume/context-assembly design); WebMCP (revisit only if this prototype validates enough to justify the bigger build); **any public/pre-booking surface** (deferred 2026-07-22 — bookings now arrive via platform sync or manual creation; see "Deferred research" below); **guestbook** (mocked, cut 2026-07-22); **reviews/ratings**; **extra-guest/pet fee pricing** (party_size + pets are recorded only); **TIDY's turnover-management MCP/API** (considered 2026-07-22 — full API access requires their paid Standard tier, $10-20/unit/mo, and it would outsource the prescribed-checklist/step-completion workflow that this app exists to validate as its own feature, not a vendor's).

### Deferred research — before any public booking surface

A public, stranger-facing booking page is a different risk category from the current known-guest direct flow and needs a research pass before design (flagged 2026-07-22): short-term-rental insurance requirements, guest credit/background-check APIs, e-signature for rental agreements (DocuSign or similar), calendar sync with OTAs (iCal/Airbnb/VRBO), dynamic pricing, terms-of-service/liability copy, and payment-compliance implications of taking public payments. Until that research lands, "public" stays out of scope and nothing in the v1 architecture should presuppose it.

## Verification plan

1. Owner defines a "Standard Turnover Clean" workflow template with 5 steps (2 requiring photos), creates a property with 2 units, and attaches a test iCal feed URL to each unit.
2. A booking event appears in the test feed → sync creates the booking (`source=airbnb`, guest fields empty) **and auto-creates a turnover work order** scheduled for checkout day.
3. A captured Airbnb confirmation-email fixture is ingested → the booking gains guest name/contact, confirmation code, and payout `amount_cents`. Owner issues the guest concierge link via their agent.
4. Guest chats via the concierge link, asks a house-rules question (access info still locked if >24h before check-in), then reports a broken AC → maintenance work order created with the default template attached.
5. Owner assigns the turnover + maintenance work orders to a test contact → contact-scoped contractor link issued.
6. Contractor opens the link (no login), sees the job as "New — preview", **accepts it**, works through the checklist via chat, uploads photos for the 2 required steps (in-page getUserMedia capture) → all steps complete → `status = submitted_for_review`.
7. Owner reviews the submitted checklist (steps + photos + notes) in their own chat surface, approves → cost recorded, mirrored into `expenses`.
8. A second feed booking is **cancelled** in the test feed → its booking flips to `cancelled` and its unstarted auto-turnover cancels with it.
9. Owner manually creates a `kind=lease` booking (`source=manual`, `monthly_rent_cents`) for the second unit and a `kind=block` (personal use) on the first unit via their agent.
10. **Export check:** fetching the unit's export feed URL returns valid iCal containing the manual lease, the block, and the synced platform booking — and rotating `ical_export_token` kills the old URL.
11. Reporting for the property shows enriched + lease revenue against work-order expenses, and occupancy reflects synced nights.
12. Tamper check: an expired or revoked contractor/guest token → rejected, not silently allowed.

## Critical files to start with

- `lib/db/schema/*` — properties/units/bookings/calendar_feeds/workflow_templates/work_orders/work_order_step_completions foundation
- `lib/a2ui/protocol.ts` — the frozen transport contract (T1)
- `lib/services/workOrderService.ts` — the step-completion gate (`submitted_for_review` only when every required step is done) is the core business rule of this app
- `lib/ingest/calendarSync.ts` — iCal poll → booking upsert → turnover auto-create/cancel (the other core rule as of the 2026-07-23 pivot)
- `lib/ingest/airbnbEmail.ts` — Gmail-based enrichment parser (shares infra with the future GV channel)
- `lib/tokens.ts` — shared signed-token helper for `guest_sessions` and `contact_tokens`
