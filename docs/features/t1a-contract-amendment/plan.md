# T1a — Contract amendment (iteration-1 pivot)

Source: `docs/PLAN.md` → "Build order" → Trunk → T1a (+ "Iteration-1 pivot", "Booking ingestion").
Branch: `feat/t1a-contract-amendment`

The deliberate contract PR the T1 freeze process exists for. After merge the contracts re-freeze.

## Deliverables (with spec-role assignment)

| ID | Deliverable | Kind | Owning role |
|----|-------------|------|-------------|
| D1 | Schema amendment: `bookings` rework (kind `booking\|lease\|block`, source, unique `external_ref`, `confirmation_code`, nullable guest fields/party_size/amount, `monthly_rent_cents`, no Stripe columns, status `confirmed\|cancelled\|completed`); new `calendar_feeds`; `units.ical_export_token` (unique, rotatable); drop `addon_products`/`addon_purchases` (+ their enums); `comm_sync_state` → per-source text-keyed cursors; `work_orders.requested_by` gains `system`; `.env.example` loses Stripe vars | migration | `/backend-architect` |
| D2 | Catalog amendment: remove `CheckoutCard`, `AddonCatalogList`, `AddonCard`, `CancelReservationCard` (16 → 12 components) + delete their fixture files | contract | `/frontend-dev` |
| D3 | Seed rework: bookings carry kind/source/external_ref; adds a `kind=lease` and a `kind=block` row, ≥1 `calendar_feeds` row, `comm_sync_state` `airbnb_email` cursor row; addon seeding removed; still idempotent | job | `/backend-architect` |
| D4 | Test-suite update: seed invariants follow the new schema (per-source cursor, lease/block present); contract tests keep full fixture coverage at the reduced catalog | test | `/test-engineer` |

## Commit schedule

1. `docs: add plan + ACs for t1a-contract-amendment`
2. `feat(contracts): t1a amendment - ingestion schema, catalog reduction, seed + tests`
3. `chore: update verification status`
