# Track B — Backend (services, sync engine, agent pipe)

Source: `docs/PLAN.md` → "Build order" → Track B (+ "Booking ingestion", "Google Voice channel" for shared Gmail infra shape).
Branch: `feat/track-b`
Contracts (frozen, post-T1a): `lib/db/schema/*`, `lib/a2ui/protocol.ts`, `lib/a2ui/catalog.ts` (12 components), `lib/uploads/contract.ts`. Zero UI in this track — all evidence is headless.

## Execution notes (for the orchestrating session)

- Run via `/agentic-orca` (Workflow tool). `.claude/agents/{backend-architect,test-engineer}.md` exist — `agentType` works when the session started after their creation.
- Waves: **W1** D1–D4 (services + tokens, disjoint files) → **W2** D5–D7 (ingestion; D5 needs D2's booking service) + D8 (agent pipe; needs D1–D4 services as tools) → **W3** D9 (endpoints; needs D8) → **W4** D10–D12 (tests/evals; D12 needs D8+D9).
- Effort: D2/D3/D5/D8 high (core rules); D1/D4/D6/D7/D9 medium; verify agents Opus/high.
- The user's six real Airbnb feed URLs sit in `.env.local` under unit nicknames (BILLY, BITKI, SOFI, LOUIS, TALIA, CHARLIE) — usable for a real-feed smoke test of D5, but AC evidence uses the committed fixture feed so it's reproducible.
- Gmail OAuth env vars are placeholders until the owner provisions the Google Cloud OAuth client — D7's ACs run against committed email fixtures; the live-Gmail path is verified at M1.

## Deliverables (with spec-role assignment)

| ID | Deliverable | Kind | Owning role |
|----|-------------|------|-------------|
| D1 | `lib/services/propertyService.ts` — properties/units CRUD + `rotateIcalExportToken()` | resolver | `/backend-architect` |
| D2 | `lib/services/bookingService.ts` — manual create (kind booking/lease/block, source=manual, owner-only), annotate (attach guest contact, record payout), cancel-manual, calendar range queries; synced rows immutable except annotation fields (server-enforced) | resolver | `/backend-architect` |
| D3 | `lib/services/workOrderService.ts` — status machine (requested→assigned→accept→in_progress→submitted_for_review→approved→paid, needs_revision branch w/ review_note), THE submit gate (every required step complete: photos/notes/stock per template), step completions, approve→`expenses` mirror | resolver | `/backend-architect` |
| D4 | `lib/services/{contactService,routineService,maintenanceService,expenseService,messageService}.ts` — contacts CRUD; routine series + visit logging; maintenance schedules (due-item computation for turnover folding); expenses queries; direct-message threads (`kind=direct`, conversations/messages) | resolver | `/backend-architect` |
| D5 | `lib/tokens.ts` — signed-token helpers: guest_sessions issue/verify (owner-issued), contact_tokens issue/verify/revoke; server-side resolution helpers for the `(public)` shell | resolver | `/backend-architect` |
| D6 | `lib/ingest/calendarSync.ts` + `app/api/cron/calendar-sync/route.ts` — .ics fetch/parse per `calendar_feeds`, UID upsert, cancellation + date-change detection, turnover auto-create (checkout day, default cleaning template, `requested_by=system`) / auto-cancel (unstarted) / flag (in-progress) / reschedule; `last_hash` skip | job | `/backend-architect` |
| D7 | `lib/ingest/icalExport.ts` + `app/api/ical/[token]/route.ts` — export feed: valid iCal of confirmed bookings/leases/blocks for the token's unit; 404 on unknown/rotated token | endpoint | `/backend-architect` |
| D8 | `lib/agent/pipe.ts` + `lib/agent/tools/{owner,guest,contractor}.ts` — AI SDK `streamText` via AI Gateway; per-surface toolsets scoped server-side (owner: full mgmt incl. issue-guest-link + manual booking + approve/request-changes w/ confirm gating; guest: own-booking lookup, space info w/ 24h gate, report-a-problem, late-checkout flag; contractor: job/checklist tools w/ requirement gate, log-visit, message-owner); transcripts persist (`kind=agent_chat`), NO session features (B4a deferred); every executed tool writes `tool_invocations` | resolver | `/backend-architect` |
| D9 | `app/api/agent/[surface]/route.ts` (SSE stream, protocol envelopes) + `app/api/agent/action/route.ts` (ClientAction) + `app/api/uploads/route.ts` (Vercel Blob, per `lib/uploads/contract.ts`) | endpoint | `/backend-architect` |
| D10 | `tests/services.test.ts` — service invariants: submit gate (incomplete required step → submitted_for_review REJECTED server-side), needs_revision requires note + reopens, approve mirrors expense, synced-booking immutability, token verify/revoke | test | `/test-engineer` |
| D11 | `tests/ingest.test.ts` + fixture feeds/emails (`tests/fixtures/*.ics`, sanitized Airbnb emails) — sync create/cancel/date-change incl. turnover side-effects; export feed round-trip (our export parses back, contains lease+block); enrichment match + idempotency on Gmail message id | test | `/test-engineer` |
| D12 | `tests/agent-pipe.test.ts` (AI SDK mock provider: tool result → receipt envelope → `tool_invocations` row → surface update, deterministic) + `evals/` harness with `npm run evals` (owner-surface golden suite ~12 scenarios, pass@k, confirm-gating invariant: approve/request-changes/manual-cancel NEVER execute without a preceding confirm action) | test | `/test-engineer` |

## Commit schedule

1. `docs: add plan + ACs for track-b`
2. `feat(services): domain services + tokens` (W1)
3. `feat(ingest): two-way calendar sync + email enrichment` (W2 part)
4. `feat(agent): pipe, toolsets, endpoints` (W2/W3)
5. `test(track-b): service/ingest/pipe suites + eval harness` (W4)
6. `chore: update verification status`
