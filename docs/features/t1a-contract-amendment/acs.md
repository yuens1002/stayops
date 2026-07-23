# T1a — Contract amendment — Acceptance Criteria

Branch: `feat/t1a-contract-amendment` · Plan: [plan.md](plan.md)

## Functional Acceptance Criteria

| AC | Plan ref | Role | What | How | Pass | Agent | QC | Reviewer |
|----|----------|------|------|-----|------|-------|----|----------|
| AC-FN-1 | D1 | `/backend-architect` | Amended schema pushes | Test run: `npm run db:push`, then `npx tsx scripts/list-tables.ts` | Push applies; exactly 20 tables (T1's 21 − 2 addon tables + `calendar_feeds`); no `addon_products`/`addon_purchases` | PASS | ✓ | |
| AC-FN-2 | D1 | `/backend-architect` | Bookings/units/cursor shape | Code review: `lib/db/schema/{bookings,properties,calendar,audit,workflows}.ts` | `bookings` has kind(`booking\|lease\|block`)/source/unique `external_ref`/`confirmation_code`/`monthly_rent_cents`, nullable guest fields, NO stripe columns, status enum without `pending_payment`; `units.ical_export_token` unique + rotatable (no hardcoding); `comm_sync_state` keyed by source string; `requested_by` includes `system`; `.env.example` has no Stripe vars | PASS | ✓ | |
| AC-FN-3 | D2 | `/frontend-dev` | Catalog reduced to 12 | Test run: `npm test` (contract suite) | Exactly 12 catalog components; the 4 removed names absent from `CATALOG_COMPONENT_NAMES` and un-parseable; no fixture file references a removed component | PASS | ✓ | |
| AC-FN-4 | D3 | `/backend-architect` | Seed matches amended world | Test run: `npx tsx scripts/seed.ts` twice, `npx tsx scripts/list-tables.ts --counts` | Idempotent (identical counts on run 2); seeds ≥1 `calendar_feeds` row, ≥1 `kind=lease` and ≥1 `kind=block` booking, an `airbnb_email` cursor row; zero addon rows anywhere | PASS | ✓ | |

## Test Coverage Acceptance Criteria

| AC | Plan ref | Role | What | How | Pass | Agent | QC | Reviewer |
|----|----------|------|------|-----|------|-------|----|----------|
| AC-TST-1 | D4 | `/test-engineer` | Suite tracks the amendment | Test run: `npm test` | Full suite green; seed tests assert the per-source cursor + lease/block presence (not the old singleton); fixture tests still cover every remaining catalog component | PASS | ✓ | |

## Regression Acceptance Criteria

| AC | Plan ref | Role | What | How | Pass | Agent | QC | Reviewer |
|----|----------|------|------|-----|------|-------|----|----------|
| AC-REG-1 | — | `/devops` | Types stay clean | Test run: `npx tsc --noEmit` | 0 errors | PASS | ✓ | |
| AC-REG-2 | — | `/devops` | Lint stays clean | Test run: `npm run lint` | 0 errors, 0 warnings in repo code | PASS | ✓ | |
| AC-REG-3 | — | `/devops` | Build stays green | Test run: `npm run build` | Build completes; no route errors | PASS | ✓ | |
