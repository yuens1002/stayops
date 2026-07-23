# stayops

A personal, chat-first short-term rental management app: bookings + direct guest payment, a conversational concierge for guests (with à la carte add-on services during the stay), a prescribed checklist-based workflow for cleaning/maintenance contractors to follow and report on before payment, and reporting.

> **Status: early build.** Scaffold + frozen data/UI contracts are in; surfaces are under construction — see [`docs/PLAN.md`](docs/PLAN.md) for the full architecture and build plan.

Built for personal use (managing a handful of the author's own properties), and shared publicly in case it's useful to others managing their own short-term rentals. Not a multi-tenant product — single operator, no payment processing (bookings sync in from Airbnb/Furnished Finder), no vendor marketplace.

## Stack

Next.js (App Router) + TypeScript, Tailwind 4 + shadcn/ui, A2UI-rendered chat UI, Vercel AI SDK + AI Gateway, Drizzle ORM + Neon Postgres, Clerk auth, two-way iCal booking sync + Gmail enrichment (no payment processing), deployed on Vercel. See [`docs/PLAN.md`](docs/PLAN.md) for the full rationale.

## Getting started

Not yet runnable — Phase 0 scaffolding hasn't started.

## License

MIT — see [LICENSE](LICENSE).
