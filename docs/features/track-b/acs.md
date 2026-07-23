# Track B — Acceptance Criteria

Branch: `feat/track-b` · Plan: [plan.md](plan.md)

## Functional Acceptance Criteria

| AC | Plan ref | Role | What | How | Pass | Agent | QC | Reviewer |
|----|----------|------|------|-----|------|-------|----|----------|
| AC-FN-1 | D1 | `/backend-architect` | Property/unit service + token rotation | Test run: `npm test` (services suite) | CRUD round-trips; `rotateIcalExportToken()` changes the token and old value no longer matches | | | |
| AC-FN-2 | D2 | `/backend-architect` | Booking service authority rules | Test run: `npm test` (services suite) | Manual create works for all three kinds (lease requires `monthly_rent_cents`, block forbids guest fields); mutating a `source!=manual` booking's dates/status throws; annotation fields (guest contact, payout) ARE writable on synced rows | | | |
| AC-FN-3 | D3 | `/backend-architect` | Work-order status machine + submit gate | Test run: `npm test` (services suite) | `submitted_for_review` REJECTED while any required step lacks its completion (photo/note/stock per template); accept stamps `accepted_at`; `needs_revision` requires a non-empty note and reopens completions; approve writes the mirrored `expenses` row | | | |
| AC-FN-4 | D4 | `/backend-architect` | Supporting services | Test run: `npm test` (services suite) | Routine visit logging never creates a work order; maintenance due-computation returns items due within the turnover window; direct-message send creates/appends a `kind=direct` conversation | | | |
| AC-FN-5 | D5 | `/backend-architect` | Token issue/verify/revoke | Test run: `npm test` (services suite) | Guest token verifies to its booking and fails after expiry; contact token resolves to the contact's own entities only; revoked token fails closed | | | |
| AC-FN-6 | D6 | `/backend-architect` | Calendar sync engine | Test run: `npm test` (ingest suite, fixture .ics) | New event → booking + system turnover (checkout day); removed/cancelled event → booking cancelled + unstarted turnover cancelled, in-progress flagged not cancelled; date change reschedules the unstarted turnover; unchanged feed hash short-circuits; re-run is idempotent | | | |
| AC-FN-7 | D7 | `/backend-architect` | Export feed | Test run: `npm test` (ingest suite) + `curl` the route in dev | Feed is valid iCal containing the unit's confirmed bookings, lease, and block (cancelled excluded); unknown or rotated token → 404 | | | |
| AC-FN-8 | D7 | `/backend-architect` | Enrichment parser | Test run: `npm test` (ingest suite, email fixtures) | Confirmation email matched via confirmation code/dates/unit attaches guest name/contact + payout; cancellation email flags the booking; same Gmail message id twice → one effect; unmatched email lands in the review bucket, not silently dropped | | | |
| AC-FN-9 | D8 | `/backend-architect` | Per-surface toolsets + audit | Test run: `npm test` (pipe suite, mock provider) | Each surface exposes ONLY its plan-listed tools; guest access-info tool refuses >24h before check-in; contractor `complete_step` enforces the same requirement gate as the UI; every executed tool produces a `tool_invocations` row with actor + entity refs | | | |
| AC-FN-10 | D9 | `/backend-architect` | Transport endpoints | Test run: `npm test` (pipe suite) + dev-server round trip | SSE stream emits protocol-valid envelopes (parse against `serverEnvelopeSchema`); ClientAction validates and routes; upload endpoint enforces `lib/uploads/contract.ts` mime/size and returns `{uploadId,url}` | | | |

## Test Coverage Acceptance Criteria

| AC | Plan ref | Role | What | How | Pass | Agent | QC | Reviewer |
|----|----------|------|------|-----|------|-------|----|----------|
| AC-TST-1 | D10 | `/test-engineer` | Service invariants under test | Test run: `npm test` | The submit-gate rejection, needs_revision note requirement, expense mirror, and synced-immutability cases each have a dedicated failing-path assertion | | | |
| AC-TST-2 | D11 | `/test-engineer` | Ingestion invariants under test | Test run: `npm test` | Fixture-driven create/cancel/change/idempotency cases pass; export feed output re-parses as iCal in the test itself | | | |
| AC-TST-3 | D12 | `/test-engineer` | Deterministic pipe tests + eval harness | Test run: `npm test`; `npm run evals -- --dry-run` | Mock-provider pipe tests green in CI; `npm run evals` exists, loads the ~12-scenario owner suite, and enforces the confirm-gating invariant scenario class; dry-run validates scenario schemas without model calls | | | |

## Regression Acceptance Criteria

| AC | Plan ref | Role | What | How | Pass | Agent | QC | Reviewer |
|----|----------|------|------|-----|------|-------|----|----------|
| AC-REG-1 | — | `/devops` | Types stay clean | Test run: `npx tsc --noEmit` | 0 errors | | | |
| AC-REG-2 | — | `/devops` | Lint stays clean | Test run: `npm run lint` | 0 errors, 0 warnings in repo code | | | |
| AC-REG-3 | — | `/devops` | Build + existing suite stay green | Test run: `npm run build && npm test` | Build completes; all pre-existing tests still pass | | | |
