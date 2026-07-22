# T1 — Contracts (freeze)

Source: `docs/PLAN.md` → "Build order" → Trunk → T1. Surface specs: `docs/OWNER-SURFACE-SPEC.md`, `docs/CONTRACTOR-SURFACE-SPEC.md`, `docs/GUEST-SURFACE-SPEC.md`.
Branch: `feat/t1-contracts`

T1 produces the frozen seam both tracks build against: the full domain schema, the A2UI protocol + component catalog (Zod), the upload contract, fixture envelopes, and the seed script. **After this merges, catalog/protocol changes are deliberate contract PRs.**

## Deliverables (with spec-role assignment)

| ID | Deliverable | Kind | Owning role |
|----|-------------|------|-------------|
| D1 | `lib/db/schema/*.ts` — full domain schema, every table in PLAN.md's data model (properties, units, bookings, guest_sessions, contacts, contact_tokens, workflow_templates, workflow_template_steps, work_orders, work_order_step_completions, routine_series, routine_visits, maintenance_schedules, expenses, addon_products, addon_purchases, conversations, messages, a2ui_surfaces, tool_invocations, comm_sync_state), replacing the T0 placeholder; enums per PLAN.md (incl. `needs_revision`); `db:push` applies | migration | `/backend-architect` |
| D2 | `lib/a2ui/protocol.ts` — envelope types: server→client discriminated union (`message`, `surface`, `data`, `receipt`, `error`) + `ClientAction` (surfaceId, componentId, action, payload) + SSE event naming | contract | `/backend-architect` |
| D3 | `lib/a2ui/catalog.ts` — Zod prop schema per catalog component + `CatalogComponentName` union + `parseComponent()` helper. Components (16): guest — BookingSummaryCard, ReservationDetailCard, HouseRulesCard, GuestSessionCard, WorkOrderRequestConfirmation, AddonCatalogList, AddonCard, CheckoutCard, CancelReservationCard, BookingCalendar, BookingsIndexList; contractor — WorkOrderCard, WorkOrderChecklist, JobDetailsCard; owner — ToolReceipt, ConfirmCard. Props derive from the surface specs' screen descriptions (§5 of each) | contract | `/frontend-dev` |
| D4 | `lib/uploads/contract.ts` — upload endpoint contract types: request (multipart, jpeg/png/webp, max size) and response `{ uploadId, url }`; error shape. Types only — the endpoint itself is Track B5 | contract | `/backend-architect` |
| D5 | `lib/a2ui/fixtures/*.json` — one fixture envelope per spec screen (~16: guest reservation/rules/session/WO-confirmation/addon-catalog/checkout-pending/checkout-paid/cancel/calendar/index; contractor WO-card/checklist-in-progress/checklist-needs-work/checklist-submitted/job-details; owner receipt/confirm), each a valid `surface` envelope whose components parse against D3 | fixture | `/frontend-dev` |
| D6 | `scripts/seed.ts` — idempotent realistic demo state: 2 properties, 3 units (access-info fields set), contacts (cleaner + maintenance), "Standard Turnover Clean" template (5 steps across areas, 2 photo-required, 1 stock-check), mid-stay + upcoming bookings (party_size/pets), work orders in every status incl. `needs_revision` with `review_note`, routine series + visits, quarterly maintenance schedule, addon products (firewood→work_order, late checkout→none), expenses, comm_sync_state singleton | job | `/backend-architect` |
| D7 | `vitest` setup (config + `npm test`) + `tests/contracts.test.ts` — catalog round-trip/rejection invariants, fixture validation, seed invariants | test | `/test-engineer` |

## Dependency waves (orca structure)

- Wave 1 (parallel): D1, D2, D3, D4 — disjoint files
- Wave 2 (parallel, after wave 1): D5 (needs D3), D6 (needs D1)
- Wave 3: D7 (needs D3, D5, D6)

## Commit schedule

1. `docs: add plan + ACs for t1-contracts` (this commit)
2. `feat(contracts): domain schema, a2ui protocol + catalog, upload contract` (waves 1–2)
3. `feat(contracts): fixtures, seed, contract tests` (wave 3)
4. `chore: update verification status`
