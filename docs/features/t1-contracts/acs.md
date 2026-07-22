# T1 — Contracts — Acceptance Criteria

Branch: `feat/t1-contracts` · Plan: [plan.md](plan.md)

## Functional Acceptance Criteria

| AC | Plan ref | Role | What | How | Pass | Agent | QC | Reviewer |
|----|----------|------|------|-----|------|-------|----|----------|
| AC-FN-1 | D1 | `/backend-architect` | Full schema pushes to Neon | Test run: `npm run db:push`, then `npx tsx scripts/list-tables.ts` | All 21 tables from the plan's D1 list exist in the dev DB; T0 placeholder table replaced or retained deliberately | | | |
| AC-FN-2 | D1 | `/backend-architect` | Spec-reconciled columns present | Code review: `lib/db/schema/*.ts` | `work_orders` has `needs_revision` status + `review_note` + `accepted_at`; `messages` has `channel`/`external_ref` (unique)/`audio_url`; `units` has wifi/door-code/manual/cancellation-policy fields; `bookings` has `party_size`/`pets`; `conversations` has `kind` + `public_inquiry` subject type | | | |
| AC-FN-3 | D2 | `/backend-architect` | Envelope contract | Code review: `lib/a2ui/protocol.ts` | Discriminated union covers `message`/`surface`/`data`/`receipt`/`error`; `ClientAction` carries surfaceId/componentId/action/payload; types compile with no `any` in exported signatures | | | |
| AC-FN-4 | D3 | `/frontend-dev` | Catalog completeness | Test run: `npm test` (round-trip suite) | All 16 named components have Zod schemas; `parseComponent()` accepts every valid fixture component and rejects an unknown type and a missing-required-prop case | | | |
| AC-FN-5 | D4 | `/backend-architect` | Upload contract types | Code review: `lib/uploads/contract.ts` | Request constraints (accepted mime types, max bytes) and response `{ uploadId, url }` + typed error shape are exported; no runtime code | | | |
| AC-FN-6 | D5 | `/frontend-dev` | Fixtures validate | Test run: `npm test` (fixture suite) | Every `lib/a2ui/fixtures/*.json` parses as a `surface` envelope and every component in it passes its catalog schema; at least the ~16 planned screens are covered | | | |
| AC-FN-7 | D6 | `/backend-architect` | Seed is idempotent + realistic | Test run: `npx tsx scripts/seed.ts` twice, then `npx tsx scripts/list-tables.ts --counts` | Second run leaves row counts unchanged; counts satisfy: ≥2 properties, ≥3 units, ≥2 bookings, work orders covering every status, ≥1 routine series with visits, ≥1 maintenance schedule, ≥2 addon products | | | |

## Test Coverage Acceptance Criteria

| AC | Plan ref | Role | What | How | Pass | Agent | QC | Reviewer |
|----|----------|------|------|-----|------|-------|----|----------|
| AC-TST-1 | D7 | `/test-engineer` | Contract invariants under test | Test run: `npm test` | Suite asserts: unknown component type rejected; required-prop omission rejected; every fixture file validates; a mutated fixture (broken prop type) fails | | | |
| AC-TST-2 | D7 | `/test-engineer` | Seed invariants under test | Test run: `npm test` | Suite asserts (against seeded dev DB): the `needs_revision` work order has a non-empty `review_note`; the turnover template has ≥1 `requires_photo` step and ≥1 step with `stock_items`; `comm_sync_state` is a singleton | | | |

## Regression Acceptance Criteria

| AC | Plan ref | Role | What | How | Pass | Agent | QC | Reviewer |
|----|----------|------|------|-----|------|-------|----|----------|
| AC-REG-1 | — | `/devops` | Types stay clean | Test run: `npx tsc --noEmit` | 0 errors | | | |
| AC-REG-2 | — | `/devops` | Lint stays clean | Test run: `npm run lint` | 0 errors, 0 warnings in repo code | | | |
| AC-REG-3 | — | `/devops` | Build stays green | Test run: `npm run build` | Build completes; no new route errors | | | |
