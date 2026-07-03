# stayops

A personal, chat-first short-term rental management app: bookings + direct guest payment, a conversational concierge for guests (with à la carte add-on services during the stay), a prescribed checklist-based workflow for cleaning/maintenance contractors to follow and report on before payment, and reporting.

> **Status: design stage.** No application code yet — see [`docs/PLAN.md`](docs/PLAN.md) for the full architecture and build plan.

Built for personal use (managing a handful of the author's own properties), and shared publicly in case it's useful to others managing their own short-term rentals. Not a multi-tenant product — single operator, single Stripe account, no vendor marketplace.

## Stack

Next.js (App Router) + TypeScript, Pico.css, A2UI-rendered chat UI, Claude Agent SDK, Drizzle ORM + Neon Postgres, Clerk auth, Stripe (single-account Checkout, no Connect), deployed on Vercel. See [`docs/PLAN.md`](docs/PLAN.md) for the full rationale.

## Getting started

Not yet runnable — Phase 0 scaffolding hasn't started.

## License

MIT — see [LICENSE](LICENSE).
