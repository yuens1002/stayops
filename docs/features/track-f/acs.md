# Track F — Acceptance Criteria

Branch: `feat/track-f` · Plan: [plan.md](plan.md)

## UI Acceptance Criteria

| AC | Plan ref | Role | What | How | Pass | Agent | QC | Reviewer |
|----|----------|------|------|-----|------|-------|----|----------|
| AC-UI-1 | D1 | `/ux-architect` | Theme proposal page | Browser: navigate to `/dev/theme`, capture screenshot `ac-ui-1.png` | Both accent candidates render side-by-side on real components (button, card, status pills, checklist row); §8 cream/paper background, Montserrat headings, Crimson body visible | | | |
| AC-UI-2 | D2 | `/frontend-dev` | Fixtures harness renders everything | Browser: navigate to `/dev/fixtures`, capture screenshot `ac-ui-2.png` (+ scroll captures) | Every one of the 13 fixtures renders a styled component — none fall back to the unknown-type card, none crash | | | |
| AC-UI-3 | D3 | `/frontend-dev` | ReservationDetailCard access gate | Browser: harness with a >24h-out fixture and a <24h fixture, capture `ac-ui-3.png` | Locked state shows the padlock chip and hides wifi/door code; unlocked state shows them | | | |
| AC-UI-4 | D4 | `/frontend-dev` | Checklist requirement gate | Browser: capture GIF `ac-ui-4.gif` interacting with the checklist fixture | Checkbox stays disabled until required photo/note/stock inputs are satisfied; progress bar advances; submit button disabled until all steps complete; needs-work banner renders review note | | | |
| AC-UI-5 | D5 | `/frontend-dev` | ConfirmCard lifecycle | Browser: harness states, capture `ac-ui-5.png` | Pending shows confirm/cancel actions; expired renders inert with the "re-ask to renew" hint (owner spec §3.2) | | | |
| AC-UI-6 | D6 | `/frontend-dev` | Owner FAB + sheet + pages | Browser: capture GIF `ac-ui-6.gif` — open each page, summon sheet, dismiss | FAB floats above the bottom nav on all four pages with badge; sheet opens near-full-height over the page and dismissing returns to the same page; pages show lock chips and fixture data (calendar renders the month grid with booking bars) | | | |
| AC-UI-7 | D7 | `/frontend-dev` | Token/guest shells | Browser: capture `ac-ui-7.png` of `(public)` guest + contractor shells at 390px | Both shells mount `<AgentSurface />` with stubbed providers; mobile-width layout has no horizontal scroll | | | |

## Functional Acceptance Criteria

| AC | Plan ref | Role | What | How | Pass | Agent | QC | Reviewer |
|----|----------|------|------|-----|------|-------|----|----------|
| AC-FN-1 | D1 | `/ux-architect` | Tokens are variables, not literals | Code review: `app/globals.css` + two restyled primitives | §8 values exist once as CSS custom properties; components reference variables (accent swap = one-line change); no hex literals in component files | | | |
| AC-FN-2 | D2 | `/frontend-dev` | Renderer safety | Test run: `npm test` (component suite) | Unknown component type renders the fallback card (no throw); every valid fixture dispatches to its component | | | |
| AC-FN-3 | D7 | `/frontend-dev` | Stub swap point | Code review: the stub transport provider | Fixture stream + real-SSE swap is a single provider substitution, documented at the swap site; no component imports the stub directly | | | |

## Test Coverage Acceptance Criteria

| AC | Plan ref | Role | What | How | Pass | Agent | QC | Reviewer |
|----|----------|------|------|-----|------|-------|----|----------|
| AC-TST-1 | D8 | `/test-engineer` | Component invariants under test | Test run: `npm test` | Every catalog component has a fixture-render test; the checklist gate and ConfirmCard-expired-inert cases are asserted in jsdom, not only screenshots | | | |

## Regression Acceptance Criteria

| AC | Plan ref | Role | What | How | Pass | Agent | QC | Reviewer |
|----|----------|------|------|-----|------|-------|----|----------|
| AC-REG-1 | — | `/devops` | Types stay clean | Test run: `npx tsc --noEmit` | 0 errors | | | |
| AC-REG-2 | — | `/devops` | Lint stays clean | Test run: `npm run lint` | 0 errors, 0 warnings in repo code | | | |
| AC-REG-3 | — | `/devops` | Build + existing suite stay green | Test run: `npm run build && npm test` | Production build excludes `/dev/*` routes; all pre-existing tests pass | | | |
