# Agentic Workflow — StayOps

This repo opts into the agentic-workflow cadence (global skills: `/agentic-workflow`, `/agentic-orca`; hooks self-gate on `.claude/verification-status.json`).

## Phases

**Plan → ACs + Gate 1/2 → Implement → Verify (Gate 3) → /review → Human → /release → /retro**

1. **Plan** — `/project-manager` produces a deliverables table (ID / deliverable / kind / owning role) per feature or track, derived from `docs/PLAN.md` and the three surface specs (`docs/OWNER-SURFACE-SPEC.md`, `docs/CONTRACTOR-SURFACE-SPEC.md`, `docs/GUEST-SURFACE-SPEC.md`).
2. **ACs** — each owning role drafts AC rows (Plan ref + Role columns mandatory). Gate 1: `npm run gate1 -- <plan.md> <acs.md>`. Gate 2 spot-check: Pass cells phrase invariants, not config literals.
3. **Implement + Verify** — through `/agentic-orca` (Workflow tool): pipeline of implement → verify per deliverable, worktree isolation for parallel tracks. Evidence rules per `docs/PLAN.md` "Dev & verification environment" — visual ACs need in-conversation screenshots, behavior ACs need test-run output.
4. **Review/Release** — `/review` before human review; `/commit` for the PR flow; `/retro` closes the loop.

## Conventions

- Feature docs live at `docs/features/<branch-suffix>/{plan.md,acs.md}`.
- Branch names: `feat/<track-or-milestone>-<short-description>` (e.g. `feat/t1-contracts`).
- `verification-status.json` entries are keyed by branch; status `pending → partial → verified`.
- Build order, tracks, and milestone gates: `docs/PLAN.md` "Build order — trunk → parallel tracks → integration milestones".
