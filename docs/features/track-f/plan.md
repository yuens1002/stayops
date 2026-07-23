# Track F — Frontend (design system, renderer, components, shells)

Source: `docs/PLAN.md` → "Build order" → Track F. Design contracts: the three surface specs (`docs/OWNER-SURFACE-SPEC.md` §8 is the visual language source; guest spec carries a ⚠️ pivot banner — deferred sections are reference-only).
Branch: `feat/track-f`
Contracts (frozen, post-T1a): `lib/a2ui/catalog.ts` (12 components), `lib/a2ui/protocol.ts`, fixtures in `lib/a2ui/fixtures/` (13). **Zero backend in this track** — everything renders from fixtures/stubs.

## Execution notes (for the orchestrating session)

- Run via `/agentic-orca`. `.claude/agents/frontend-dev.md` exists (`agentType` works in a fresh session); create `.claude/agents/ux-architect.md` for D1 on first use, per the orca skill's build-on-first-run rule.
- **D1 is a HUMAN CHECKPOINT**: the theme proposal renders the green accent vs. the mocks' terracotta side-by-side on real components — STOP after D1's proposal artifact and get the owner's pick before D3+ builds on the theme. (Owner's recorded leaning: green — `project_build_goal_t0_m5` memory.)
- Waves: **W1** D1 (design system, checkpoint) + D2 (renderer + harness, theme-independent) → **W2** D3–D5 (components; need D1 pick + D2) → **W3** D6 (owner FAB/pages) + D7 (shells) → **W4** D8 (tests/screenshot ACs).
- Effort: D1/D3 high; D2/D6 high; D4/D5/D7 medium; verify agents Opus/high. Screenshot ACs: images must be viewed in-conversation by the orchestrator (persona rule) — verify agents capture, the main thread confirms.
- Mobile-first: guest + contractor components at 390px; owner pages responsive. Preview-deploy phone checks (getUserMedia) land at M2, not this track — the capture component ships against a stub here.

## Deliverables (with spec-role assignment)

| ID | Deliverable | Kind | Owning role |
|----|-------------|------|-------------|
| D1 | Design system: `app/globals.css` theme (owner spec §8 tokens as CSS variables — cream/paper, ink, accent, status tints, Montserrat/Crimson/mono scale), restyled shadcn primitives (Button/Card/Badge/Tabs/Sheet/Dialog), plus a `/dev/theme` proposal page rendering both accent candidates (green vs terracotta) on real components — the owner picks before W2 | component | `/ux-architect` |
| D2 | `components/a2ui/Renderer.tsx` — envelope → component dispatch via `parseComponent()` (unknown type → safe fallback card, never a crash) + `/dev/fixtures` harness route (dev-only, excluded from production builds) rendering every fixture | component | `/frontend-dev` |
| D3 | Guest components (5): `BookingSummaryCard`, `ReservationDetailCard` (status pill, 24h-locked access-info block, badge-tabs), `HouseRulesCard`, `GuestSessionCard`, `WorkOrderRequestConfirmation` — per guest spec §5.1–5.2/§8, props exactly per catalog | component | `/frontend-dev` |
| D4 | Contractor components (3): `WorkOrderCard`, `JobDetailsCard`, `WorkOrderChecklist` (collapsible areas, requirement-gated checkboxes, multi-photo strip w/ example thumbs + getUserMedia capture flow against a stub upload, note inputs, stock selects, progress bar, submit gate, needs-work banner) — per contractor spec §5 | component | `/frontend-dev` |
| D5 | Owner + shared components (4): `ToolReceipt`, `ConfirmCard` (pending/confirmed/cancelled/expired states), `BookingCalendar`, `BookingsIndexList` — per owner spec §4 receipt anatomy + catalog | component | `/frontend-dev` |
| D6 | Owner surface chrome: FAB (badge + receipt peek) + near-full-height agent sheet, bottom anchor nav, read-only pages `app/(app)/{properties,calendar,jobs,messages}/page.tsx` rendering fixture data (calendar = month timeline grid per owner spec §5.2; lock chips) | page | `/frontend-dev` |
| D7 | `(public)`/`(app)` shells + `<AgentSurface />` mount with stubbed session/token/transport providers (fixture envelopes over a fake stream; swap point documented for M1) | page | `/frontend-dev` |
| D8 | `tests/components.test.tsx` (render tests: every catalog component renders from its fixture; checklist checkbox disabled until requirements met; ConfirmCard expired state inert) + screenshot ACs via `/dev/fixtures` | test | `/test-engineer` |

## Commit schedule

1. `docs: add plan + ACs for track-f`
2. `feat(design): theme + restyled primitives` (D1, after owner pick)
3. `feat(a2ui): renderer + fixtures harness` (D2)
4. `feat(components): guest, contractor, owner catalog components` (D3–D5)
5. `feat(owner): fab, sheet, read-only pages, shells` (D6–D7)
6. `test(track-f): component render tests + screenshots` (D8)
7. `chore: update verification status`
