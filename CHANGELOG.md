# Changelog

All notable changes to this project are documented here. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versioning follows [Semantic Versioning](https://semver.org/) once releases begin.

## [Unreleased]

### Added
- Iteration 0 planning pass (2026-07-22): contractor + guest surface specs (`docs/CONTRACTOR-SURFACE-SPEC.md`, `docs/GUEST-SURFACE-SPEC.md`) extracted from the design mocks; Google Voice inbound channel section in `docs/PLAN.md`.
- Initial repo scaffolding and architecture plan (`docs/PLAN.md`).
- Standard OSS project files: README, LICENSE (MIT), CONTRIBUTING, this changelog.
- Owner surface design spec (`docs/OWNER-SURFACE-SPEC.md`): agent-first UX, tool surface, and page model for the owner chat surface.
- No application code yet.

### Changed
- `docs/PLAN.md`: added "Dev & verification environment" section (evidence rules, preview-deploy phone checks, Stripe test mode, Neon pinned to the owner's personal `yuens1002` Hobby account via the Vercel integration); named `scripts/seed.ts`, `/dev/fixtures` harness, and `.env.example` as T0/T1/F2 deliverables.
- `docs/PLAN.md`: recorded TIDY's turnover-management MCP/API as considered and rejected for v1.
- `docs/PLAN.md` (iteration 0): locked stack decisions (Tailwind 4 + shadcn/ui, Vercel AI SDK, Vercel AI Gateway); reconciled all three surface specs' deltas into the data model (contact-scoped `contact_tokens`, Accept flow, checklist areas/stock/example-photos, `maintenance_schedules`, unit access-info fields, guest cancel/date-change, `tool_invocations`, conversation `kind`/`channel`); deferred the public surface pending API research; restructured the build order from sequential phases into trunk → parallel backend/frontend tracks → integration milestones.
