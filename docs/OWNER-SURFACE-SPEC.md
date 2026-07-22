# Owner Surface — Design Spec

**Doc status:** Draft v1 · July 17, 2026
**Companion to:** [`PLAN.md`](PLAN.md) (architecture & build plan) — this spec anchors the *owner surface* UX and agent architecture agreed during the design prototyping sessions. Where this spec extends or diverges from PLAN.md, it says so explicitly (§10).
**Prototype references:** `StayOps Chat.dc.html` (working prototype: guest/contractor/owner), `StayOps Owner Agent Mocks.dc.html` (owner agent-first mocks — options 1a–1d, 2a, timeline calendar).

---

## 1. Vision

The owner does not manage the portfolio through forms. The owner **talks to a management agent** that executes every mutation as an authenticated tool call, while the app's pages remain **read-only views** of state. The agent is summonable from anywhere, carries full cross-page history, and leaves a durable audit trail of everything it does.

Design tenets, in priority order:

1. **Agent-first, not CRUD-first.** Every create/update/delete — jobs, bookings, properties, payments, messages — happens through the agent. Pages have no edit buttons, no forms.
2. **Separated but integrated.** The page and the agent log are distinct surfaces (page = state, log = actions), connected by receipts, live page updates, and page-context injection.
3. **Trust through receipts.** Every tool call surfaces as a visible, persistent receipt — never silent success.
4. **Confirm before commit** for money and destructive actions. Reads and low-risk writes just execute.
5. **Messages is the one exception**: a real inbox UI with full compose/read/reply — though the agent can also send messages as a tool call from anywhere.

## 2. Chosen interaction model (from mocks)

Explored: peek-bar + pull-up sheet (mock 1a), persistent split view (1b), toast receipts + agent tab (1c). **Chosen: floating anchored agent button ("FAB summon"), mock 2a**, blended with 1a/1c details:

- **Pages are pure content.** No docked composer on pages.
- A **floating agent button** (sparkle icon, accent color) anchors bottom-right above the nav on every page. It carries:
  - an **unread-receipt badge** — count of tool receipts since the sheet was last opened;
  - a transient **receipt peek** — the latest receipt slides out beside the FAB for a few seconds after a tool call lands (`✓ update_booking · done`), then retracts.
- Tapping the FAB opens a **near-full-height sheet** over the current page: full agent history + composer. The page (and its URL) stays underneath; dismissing returns exactly where you were.
- Tool calls that change what the current page shows update the page **live**, with a subtle attribution line on the changed row (e.g. *"updated just now by agent"*).
- **Bottom anchor nav** (replaces the old footer): `Properties · Calendar · Jobs · Messages`. The agent is NOT a tab — it floats above all tabs. (Footer links About/Contact/Terms move into a small overflow item; TBD.)
- Read-only pages carry a **lock chip** (`🔒 Read-only · changes via agent`) in the header.

## 3. Agent context & session model

Three layers, from most ephemeral to most durable:

### 3.1 Page context (ephemeral, implicit)
When the sheet opens, the current page/entity is injected as context. Standing on WO #481 and saying "pay this one" resolves without naming it. The sheet header shows a removable chip: `📍 viewing WO #481`. Context = route + entity id(s) + visible filter state; never more.

### 3.2 Sessions (task-scoped threads)
- The log auto-groups into **sessions**. A session closes after ~30 min inactivity or when its task resolves; the agent auto-titles it (*"Extend Sam's booking · 3 tool calls"*).
- The sheet opens on the **current session**; a history affordance reveals prior sessions grouped by day, resumable with full context.
- **Pending confirm cards expire when their session closes.** A stale "Approve & pay $85" from Tuesday must not be tappable on Friday — expired cards render inert with a "re-ask to renew" hint.
- The FAB badge counts receipts since last open — not unread chat messages.

### 3.3 Audit log (permanent, server-side)
- Every executed tool call is durably logged **independent of chat**: timestamp, actor, tool name, args (redacted where sensitive), result, affected entity ids.
- Chat receipts are *views into* this log. The owner-landing "recent activity" feed derives from it for free.
- Attribution is explicit: `you · via agent` vs `Marisol` vs `system` (e.g. auto-generated turnover on checkout day).
- History survives devices/re-logins — it lives behind the authenticated server, not the browser.

## 4. Tool surface (owner agent)

Names as used in the mocks; final names should follow the service layer in PLAN.md. All are authenticated as the owner; per-call authorization is enforced server-side, never by the UI.

| Tool | Risk class | Confirm card? |
|---|---|---|
| `list_/get_*` (bookings, jobs, properties, messages, reporting) | read | no |
| `create_job` (references job type + checklist template + contact + rate) | write | no (receipt only) |
| `update_job` (reschedule, reassign, edit scope, attach photo ref) | write | no |
| `update_booking` (extend/move dates — computes price delta & conflicts first) | money | **yes** |
| `cancel_booking` / `delete_*` | destructive | **yes** |
| `process_payment` (approve & pay a submitted job) | money | **yes** |
| `request_changes` (send job back as "needs work", with note) | write | no |
| `send_message` (to contractor / guest / public-inquiry thread) | write | no (labeled receipt in inbox) |
| `create/update_property`, `create/update_addon`, `create/update_checklist_template` | write | no |

**Receipt anatomy** (chat + toast + audit log): bolt icon · monospace tool name · one-line outcome (`WO #483 created`) · `View` deep-link to the affected entity/page.

**Photo/file limitation:** binary uploads do not travel over the agent's tool transport. Uploads go through the **web app** (composer attach button); the agent receives a *reference* (upload id/URL) and passes it into tool calls (`update_job` with `photo_ref`). The composer communicates this quietly (fine print: *"actions run as tool calls · photo uploads travel over the web app"*).

## 5. Pages (read-only)

### 5.1 Properties
Portfolio list: name, status pill (Active/Inactive), address, type · config (e.g. Condo · 3BR/2BA), nightly rate, next event (checkout/check-in). Tap → property detail (units, upcoming bookings, linked checklist templates, add-on catalog). All CRUD via agent.

### 5.2 Calendar
Month timeline grid (per the timeline mock): rows = properties/units, columns = days; booking spans as horizontal bars (guest name, party size, pet icon — **no pricing**), checkout/turnover markers, routine-visit dots. Legend: booking / turnover / maintenance / routine. Day tap → that day's events. Job markers deep-link to job detail.

### 5.3 Jobs
Three card sections, most recent first:
1. **Work Orders** — actionable: not started / in progress / submitted / needs work. Submitted rows expose review affordance ("review #481").
2. **Routines** — monthly-retainer work (pool, landscaping): title, property, cadence, `n of m visits` progress bar, monthly cost. Visits do **not** generate work orders; contractors log visits against the series (see §6).
3. **Completed** — approved/paid history.

**Job review flow** (owner side of the contractor's submit): open submitted job → read-only checklist mirror (steps, per-step photos, notes, stock levels) → two actions:
- **Approve & pay** → confirm card (`Marisol · $85 · paid outside the app, marked here`) → `process_payment` → status `paid`, expense recorded, receipt sent to contractor via `send_message`.
- **Request changes** → note required → `request_changes` → status `needs work`, contractor notified, their checklist re-opens editable.

### 5.4 Messages (the exception — full inbox)
- Tabbed inboxes: **All · Contractors · Guests · Public** (public = pre-booking inquiries). Unread dots per thread; one-tap tab switching.
- **New message** button → compose: pick contact (contractor/guest/public reply), write, send. Creates or appends to the thread.
- Threads show agent-sent messages with an attribution line: *"sent by your agent · just now."*
- Reply inline like any messenger. This page keeps its own composer (the one page that does).

## 6. Job model (shared vocabulary with contractor surface)

- **Job types:** Turnover (cleaning, tied to checkout day), Maintenance (one-off), Delivery/other (add-on fulfillment), **Routine** (retainer series — monthly billing, per-visit logging).
- **Work orders generate on the due day**, not at scheduling time. Scheduled cleaning tasks belong to the turnover checklist (optional until due).
- **Status vocabulary:** `not started → in progress → submitted (for review) → approved → paid`, with `needs work` as the review-rejection branch. (Extends PLAN.md's enum with `needs work`; "requested/assigned" collapse into `not started` in the UI.)
- Checklist templates prescribe steps; steps may require photo(s), a note, or stock levels (stocked/low/out). A job can't reach `submitted` until requirements are met — server-enforced.

## 7. Notifications & attention

- The FAB badge is the primary "something happened" signal.
- The agent proactively surfaces attention items when the sheet opens on a stale session (e.g. "WO #481 was submitted while you were away").
- No push/SMS in v1 (per PLAN.md).

## 8. Visual language (from the prototype)

- Cream/paper palette `#EFEAE0 / #FAF7F0`, ink `#26241f`; accent terracotta `#B5533C`; success `#4A7A57`; routine blue `#3B5BA5`; maintenance ochre `#8A6D3B`.
- Headings/UI: Montserrat; body/info text: Crimson Text (serif); tool names & tokens: ui-monospace.
- Cards: white, 1px `rgba(0,0,0,0.07)` border, 14px radius; row dividers `rgba(0,0,0,0.06)`, never after the last row.
- Status pills: tinted bg + strong fg, Montserrat 700.
- Icons: 24×24 stroke (Feather-style), inline SVG, used for location/due/rate/guests/pets metadata rows.

## 9. Open questions

1. Sheet vs. full-screen agent on small phones (sheet assumed).
2. Where About/Contact/Terms live once the footer is gone (overflow on Properties? sign-out menu?).
3. Voice input in the owner composer — guest concierge gets it first per PLAN.md; owner later?
4. Session inactivity threshold (30 min assumed) and whether sessions can be manually pinned/renamed.
5. Public-inquiry inbox: does replying to a public inquiry mint anything (lead record)? Not in the current data model.
6. Reporting page — agent-answered only for v1 ("this month's numbers" in chat), or also a read-only page? Mocks assume agent-answered.

## 10. Deltas vs. PLAN.md

> **Reconciled 2026-07-22** — the schema/status/audit rows below have been applied to PLAN.md (`routine_series`/`routine_visits`, `needs_revision`, `public_inquiry` subject type, `party_size`/`pets`, `tool_invocations`). The table is kept as the rationale record. The session-model row remains open design work for `lib/agent/session.ts` (contract shape in trunk T1, implementation in track B4 — see PLAN.md "Build order").

| This spec | PLAN.md today | Action |
|---|---|---|
| "Authenticated MCP server" framing for owner tools | In-process tool-calling (AI SDK), WebMCP explicitly out of scope | Keep tools in-process per plan; "MCP" in the mocks is conceptual — the owner surface treats the tool layer *as if* a remote authenticated server. Rename in UI copy if misleading. |
| **Routines** (retainer series, monthly billing, visit logging) | Not in data model | Add: `routine_series` + `routine_visits` (or `work_orders.kind=routine` + visits table). |
| `needs work` status | `requested→assigned→in_progress→submitted_for_review→approved→paid` | Add `needs_revision` to enum; UI maps requested/assigned → "not started". |
| Public-inquiry inbox tab | Conversations are owner/guest/contractor only | Add `subject_type=public_inquiry` or a leads concept. |
| Booking guest count & pets on calendar/work orders | `bookings` lacks `party_size`, `pets` | Add columns (contractor surface already displays both). |
| Audit log independent of chat | Only `conversations/messages` persistence | Add `tool_invocations` table (actor, tool, args, result, entity refs, ts). |
| Session model (auto-titled, expiring confirms) | Not specified | Belongs in `lib/agent/session.ts` design. |
| Job due **time** (not just date) | `scheduled_at` timestamp exists — OK | Surface time in all UI (`7/14 · 4pm`). |
