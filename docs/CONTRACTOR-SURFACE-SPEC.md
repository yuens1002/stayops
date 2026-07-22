# Contractor Surface — Design Spec

**Doc status:** Draft v1 · July 22, 2026
**Companion to:** [`PLAN.md`](PLAN.md) (architecture & build plan) and [`OWNER-SURFACE-SPEC.md`](OWNER-SURFACE-SPEC.md) (owner surface — shares the job model in its §6 and the visual language in its §8). Where this spec extends or diverges from PLAN.md, it says so explicitly (§10).
**Prototype references (local-only, not committed):** `StayOps Chat (standalone).html` (refined contractor mock — canonical), `StayOps Chat.dc.html` (earlier working prototype), `StayOps Cleaning & Maintenance.dc.html` + `StayOps Workflow Options.dc.html` (checklist anatomy exploration). Where mocks conflict, the standalone mock wins.

---

## 1. Vision

The contractor (cleaner/maintenance person) opens a **tokenized link on their phone — no account, no password** — and lands in a chat surface with a job assistant. The prescribed checklist is the product: every required step, photo, note, and stock level must be completed before the job can be submitted for review, and the surface makes that gate visible and navigable rather than punitive. Two interaction paths are first-class: **tap the checklist directly, or tell the agent** ("mark step 3 done, here's the photo") — both write the same step-completion state.

Design tenets:

1. **Zero-friction entry.** The link *is* the auth. Opening it resumes exactly where the contractor left off (state is server-side, not device-side).
2. **The checklist is the contract.** Requirements (photo/note/stock) gate each step's checkbox, and the submit button gates on all steps — client affordance, server-enforced (owner spec §6).
3. **Chat and checklist are the same state.** A step checked in the checklist pane and a step marked via chat are indistinguishable; the agent enforces the same requirement gate ("Step 4 still needs its required photo/note first").
4. **Everything visible to the owner is visible here.** The agent chat is owner-readable (mock copy: *"Questions? Just ask here — the owner sees this thread"*); there are no contractor-private channels.

## 2. Interaction model (from the standalone mock)

- **Chat-first, single column, phone-width.** The default view is the agent chat: greeting header (*"Hey Marisol"*, one-line day summary: *"1 job today · Unit 2B at 11:00 AM · $85 on approval"*), a **recent-activity feed** grouped by date (dots: accent = in progress, red = flagged needs-work, green = done), then the message stream.
- **A2UI cards render inside the chat stream**: `WorkOrderCard` (job summary + "Open checklist →"), `WorkOrderChecklist` (the full interactive checklist, embedded as a chat message), `JobDetailsCard` (door code, parking, supplies location).
- **Three utility views** reachable via quick chips under the composer and a breadcrumb (`home / section ▾` dropdown — no tab bar): **Messages** (direct thread with the owner, own composer), **Calendar** (month grid with cleaning/maintenance/routine dots, day tap → entries), **Jobs** (all work: Work Orders / Routines / Completed sections). A second crumb level opens individual job details.
- **Composer:** text input (placeholder *"Try: mark step 3 done…"*), attach-photo button, and a voice affordance ("Listening…" mode) — see §10 on voice scope.
- The checklist appears in two placements with identical anatomy: embedded in chat (`WorkOrderChecklist` card) and in the Jobs → work-order-detail view. Same underlying state; the detail view is the "big" version.

## 3. Session & token model

- URL shape (mock): `stayops.app/wo/482-t7` — a `work_order_tokens` link minted when the owner assigns the job (PLAN.md). Mock auth note: *"Tokenized job link — no account needed. Expires when the job is closed."*
- **Re-entry:** the link is valid for the life of the job, not single-use. Every open rehydrates conversation + checklist progress from the server; autosave (visible *"Saving… / ✓ All changes saved"* label) means nothing is lost between opens.
- **Expiry is job-state-driven**, not purely clock-driven: the link stays live through `needs work` and dies when the job reaches `paid`/closed. A hard `expires_at` backstop remains for abandoned jobs. *(Inference — the mock states the behavior, not the mechanism.)*
- **On `needs work`:** the same link re-opens with the checklist **editable again** and the owner's note pinned on the job (mock: *"Owner flagged: bathroom mirror still spotted — please redo before resubmitting"*), the job row action reading **"Fix & resubmit"**. Editable statuses in the mock: `not started`, `in progress`, `needs work`.
- **Acceptance:** a newly assigned job appears as a preview row (status pill "New — preview") with an **Accept** button; accepting flips it to Accepted and assigns the WO number to the contractor's active list. *(Standalone mock only; see §10 — PLAN.md has no acceptance step.)*
- Expired/tampered token → rejected with a dead-link screen, never a silent partial view (PLAN.md verification #9). *(Not mocked; inference.)*

## 4. Tool surface (contractor agent)

All tools are scoped server-side to the token's job(s) — the agent can never see other contractors' work or owner data.

| Tool | Risk class | Notes |
|---|---|---|
| `get_job` / `get_checklist` (steps, requirements, progress, example photos) | read | renders `WorkOrderCard` / `WorkOrderChecklist` |
| `get_job_details` (door code, parking, supplies) | read | renders `JobDetailsCard` |
| `complete_step` / `uncomplete_step` (with note, stock levels, photo ref) | write | **agent enforces the same requirement gate as the UI** — refuses with the missing requirement named |
| `submit_for_review` | write | server re-validates every required step; confirmation message both sides |
| `log_routine_visit` (retainer series) | write | see §10 — routines not yet in data model |
| `send_message` (to owner thread) | write | mirrors into the owner's Messages inbox |

**Photo/file limitation (mirrors owner spec §4):** binary uploads never travel over the agent's tool transport. Photos upload through the **web app** and the agent receives a *reference* (upload id/URL) that it passes into `complete_step`. **Capture MUST use `getUserMedia` (in-page camera stream with shutter/retake UI), NOT `<input capture>`** — the input-capture camera trigger is unreliable on Android 14/15 Chrome, and contractors are phone users; this is the photo-evidence gate, so it cannot be flaky. Gallery-pick fallback (plain file input, no `capture` attribute) stays available.

## 5. Screens & states (as evidenced in the mocks)

1. **Job overview / home** — greeting, day summary, recent activity, quick chips. `WorkOrderCard` in chat: WO #, "Turnover · cleaning", unit + address, config (3BR/2BA), due-by date **and time**, guests + pets count, `Rate $85 · paid outside the app`, "Open checklist →".
2. **Checklist in progress** — progress bar + "n of m steps complete" + autosave label. Steps grouped into collapsible **areas** (Kitchen · Bath · Exterior, each "n of m"). Step anatomy:
   - checkbox (disabled until requirements met), label;
   - **maintenance steps folded into the same areas** with a mono meta-line: `Maintenance · quarterly · due by Jul 10 · last done Apr 10` (the Workflow Options mock explored separate-job vs folded-in vs add-on; the standalone mock implements folded-in — treat as decided);
   - **photo requirement**: a horizontal thumb strip — a dashed-green **example photo** (owner-provided, "EX" badge, tap → lightbox), uploaded thumbs with an × delete, and a dashed **"+" add** tile (→ getUserMedia capture, §4);
   - **note requirement**: inline input, placeholder *"Note required…"*;
   - **stock levels**: per-item select `Stocked / Low / Out of stock` (e.g. Soap, Paper towels, Trash bags) — every item must be set before the step can be checked.
3. **Photo capture** — in-page camera stream → shutter → confirm/retake → upload → thumb appears in the step strip; photos also viewable in a full-screen lightbox with prev/next. *(Lightbox is mocked; the capture flow itself is not — getUserMedia per §4 is a hard constraint, marked inference in layout only.)*
4. **Submit** — "Submit for review" button, disabled until all steps complete; on success a green banner (*"Submitted — owner has been notified."*) and an agent message; the owner side is pinged live.
5. **Post-submit locked** — the detail view flips to a **read-only checklist mirror** (check marks, no inputs); status pill `Submitted`, later `Approved` / `Paid` with `$85 · paid outside the app`.
6. **Needs-work reopened** — status pill `Needs work` (red tint), owner's note displayed on the job, checklist editable again, action label "Fix & resubmit"; resubmit runs the same gate.
7. **Jobs list** — Work Orders (incl. pending-acceptance row), Routines (title, address, `n of m visits this month` progress bar, `$X/mo`, per-visit task list with its own log-visit submit), Completed (approved/paid history with dates).
8. **Calendar** — month grid, legend Cleaning / Maintenance / Routine, dots per day, day tap → that day's entries.
9. **Messages** — plain thread with the owner (avatar + "· host" attribution), photo attach, own composer. Distinct from the agent chat: Messages is human-to-human; the chat is contractor-to-agent (owner-readable).

## 6. Shared job model

This surface uses the job model defined in **OWNER-SURFACE-SPEC.md §6** verbatim — statuses `not started → in progress → submitted → approved → paid` with `needs work` as the review-rejection branch; checklist templates prescribing photo/note/stock-level requirements; server-enforced submit gate. Contractor-visible subset:

- The contractor sees **their own** work orders and routine series only; owner-side concepts (pricing deltas, expenses, approval confirm cards) never render here.
- Status labels as shown to contractors: `Not started · In progress · Submitted · Needs work · Approved · Paid`; per-status action labels: `Start job / Open checklist / Fix & resubmit`.
- Rate is shown per job (`$85 on approval · paid outside the app`) — payment itself is external, per PLAN.md.

## 7. Notifications & attention

- **In-surface only for v1** (no push/SMS per PLAN.md): the recent-activity feed and agent messages are the attention surface — e.g. a needs-work flag appears as a red-dot activity row *and* an agent message with the owner's note.
- The owner's `request_changes` and `process_payment` actions each land a message in the contractor's chat (mock: *"Approved — $85 recorded. Thank you!"*).
- **Google Voice channel (post-golden-path, decided 2026-07-22):** the contractor can text or leave a voicemail at the owner's Google Voice number — ingested via Gmail sync into their `kind=direct` owner thread (channel badge: sms/voicemail); app replies to SMS-originated messages go back out as best-effort texts via the GV email-reply gateway (PLAN.md "Google Voice channel"). This softens — but doesn't fully solve — the alert gap for contractors who never open the link; provider-based A2P SMS remains the long-term answer.

## 8. Visual language

Same system as **OWNER-SURFACE-SPEC.md §8** (cream/paper palette, Montserrat headings, Crimson Text body, monospace tokens, card + pill conventions) — not duplicated here. Contractor-mock-specific additions:

- **Status pill tints:** `needs work` = red tint `rgba(180,60,60,0.12)` / `#a33` fg; maintenance meta-lines use the ochre `--maint`; routine rows/dots use the blue `--retainer`.
- **Checklist components:** 44×44 photo thumbs (8px radius), dashed-green example thumb with "EX" badge, dashed "+" add tile, 5px progress bars, collapsible area cards, inline note inputs, stock-level selects.
- **A2UI dev badges** (`A2UI · WorkOrderChecklist`) appear in mocks only — not shipped UI.

## 9. Open questions

1. **Token scope:** the mock URL is per-work-order (`/wo/482-t7`) yet the surface shows the contractor's *whole* book of work (other WOs, routines, completed history). Does a job token resolve to its contact and unlock a contact-scoped view, or should v1 stay strictly job-scoped (PLAN.md's shape) with the Jobs list cut down?
2. **Acceptance flow:** is Accept a real status transition (with timestamp, owner visibility) or mock flourish? What happens on decline/no response?
3. **Voice input** in the contractor composer — mocked, but PLAN.md scopes voice to the guest concierge. Keep as post-MVP for contractors too?
4. **Notification channel** for "you've been assigned / job flagged needs work" when the surface isn't open — ties to the SMS/Telegram-bridge reconsideration in project memory.
5. **Photo storage/lifecycle** (Vercel Blob assumed), max photos per step, compression on capture.
6. **Messages vs owner-readable agent chat** — two channels or one? The mock has both a direct owner thread and an owner-readable agent thread; the conversations model needs an explicit answer.

## 10. Deltas vs. PLAN.md

> **Reconciled 2026-07-22** — applied to PLAN.md: `needs_revision` + `review_note`; checklist schema (`area`, `stock_items`/`stock_levels`, `example_photo_url`, multi-photo `photo_urls`); `maintenance_schedules` (folding kept for v1); `routine_series`/`routine_visits`; **Accept flow kept** (`accepted_at`; no decline branch — contractor messages the owner, resolving §9.2); **token scope decided contact-scoped** (`contact_tokens` replaces `work_order_tokens`, resolving §9.1); state-driven token expiry; Vercel Blob upload path + getUserMedia constraint; `party_size`/`pets`; conversation `kind(agent_chat|direct)` (resolving §9.6 as two channels). Voice stays post-MVP. The table below is kept as the rationale record.

| This spec | PLAN.md today | Action |
|---|---|---|
| `needs work` status + editable-again checklist | Enum ends at `submitted_for_review→approved→paid` | Add `needs_revision` (same delta as owner spec §10) + `review_note` on work_orders |
| Checklist **areas**, **stock levels**, **example photos**, **multi-photo** steps | `workflow_template_steps`: order, label, requires_photo, requires_note; completions have a single `photo_url` | Add `area` to steps; `stock_items jsonb` on steps + `stock_levels jsonb` on completions; `example_photo_url` on steps; photos as array/child table on completions |
| Maintenance items folded into turnover checklist (frequency, due-by, last-done) | No recurring-maintenance schedule concept | Add per-unit maintenance schedule table; work-order generation merges due items into the turnover checklist |
| **Routines** (retainer series, visit logging, `$X/mo`) | Not in data model | Same as owner spec §10: `routine_series` + `routine_visits` |
| Contractor **Accept** step | `requested→assigned` are owner-driven; no acceptance | Decide (§9.2); if real, add `accepted_at` |
| Token valid "until the job is closed", re-entry across the job's life incl. `needs work` | `work_order_tokens.expires_at` only | Expiry check = job-state + timestamp backstop in `lib/tokens.ts` |
| getUserMedia photo capture; binaries over web app, agent gets upload ref | Completions store `photo_url`; no capture/upload path specified | Add upload endpoint + Blob storage; document getUserMedia constraint in the checklist component |
| Direct contractor↔owner Messages thread alongside agent chat | `conversations` keyed by subject only | Model two thread kinds (agent vs direct) or one owner-readable thread (§9.6) |
| Guests + pets on work-order cards | `bookings` lacks `party_size`, `pets` | Same columns as owner spec §10 |
| Due **time** shown everywhere (`Jul 14 · 11:00 AM`) | `scheduled_at` timestamp exists — OK | Surface time in UI |
| Voice affordance in contractor composer | Voice scoped to guest concierge | Treat as post-MVP; keep composer layout voice-ready |
