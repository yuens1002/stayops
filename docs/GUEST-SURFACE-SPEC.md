# Guest Surface — Design Spec

**Doc status:** Draft v1 · July 22, 2026
**Companion to:** [`PLAN.md`](PLAN.md) (architecture & build plan) and [`OWNER-SURFACE-SPEC.md`](OWNER-SURFACE-SPEC.md) (owner surface — shared visual language §8, shared job vocabulary, owner-side Messages inbox §5.4). Where this spec extends or diverges from PLAN.md, it says so explicitly (§10).
**Prototype references:** `StayOps Chat.dc.html` (working prototype — guest tab is canonical; public tab covers pre-booking), `StayOps Public Pages.dc.html` (public marketing/booking page exploration), `StayOps Chat v1 (mobile).dc.html` (earlier guest iteration — cited only where noted).

---

## 1. Vision

The guest never installs an app or creates an account. Their booking confirmation mints **one tokenized concierge link, valid for the whole stay** — a mobile-first chat where an agent answers stay questions, files maintenance requests, and sells add-ons via inline Stripe Checkout, rendering every rich answer as an A2UI card in the stream. When the agent can't answer, a **real human (the host) is one tap away** in a separate Messages thread — the agent and the host are visibly distinct voices.

Design tenets, in priority order:

1. **Chat is the whole surface.** No nav, no pages, no FAB (unlike the owner surface): rich content — reservation, rules, photos, add-ons — arrives as cards inside the conversation.
2. **Trust through identity clarity.** Agent bubbles carry an `Assistant` attribution with a spark icon; host bubbles carry `Alex · host` with an avatar. The guest always knows whether a machine or a person answered.
3. **Nothing charges without a tap.** Every money action renders an inline `CheckoutCard` with line items and an explicit `Pay $N` button — that tap *is* the confirmation. Reads and requests just execute.
4. **Escalate gracefully.** Unrecognized questions are forwarded to the host thread with an honest ack ("That's a good one for Alex — I've sent your question over").

## 2. Interaction model (from the prototype)

- Single full-height mobile chat (390px design frame), tokenized URL shown in a status pill at top (`stayops.app/g/8f3k2`).
- **Empty state / arrival:** hero photo, eyebrow chip ("staying, made conversational"), animated greeting (*"Happy Friday, Jordan"*), subline (*"Harbor House · your concierge is live for the whole stay"*), fine-print auth note (*"Tokenized guest link — no account, no password. Expires after checkout."*), and a single accent quick-action chip (first menu item).
- **Quick-action menu** (guest): My reservation · Change reservation · Cancel reservation · Report a problem. (Defined in the prototype's logic; the visible affordance in the final template is the single hero chip — placement TBD, §9.)
- **Composer:** text input, attach-photo button, send button ⇄ **mic button** when empty (voice is a designed-in affordance, §5.9). Placeholder: *"Ask your concierge anything…"*.
- A **Messages chip** (with unread dot) sits above the composer — the one secondary view, opening the human host thread (§5.7). Legal/info pages (About/Contact/Terms) exist behind a breadcrumb view.
- Free text routes by intent: wifi/door-code/"my reservation" → reservation card; broken/leak/AC → maintenance flow; add-on/firewood → catalog; late checkout → priced offer; anything else → host escalation.

## 3. Session & token model

- **Issuance:** Stripe webhook confirms payment → `bookings.status = confirmed` → `guest_sessions` token minted. The mock surfaces it as a `GuestSessionCard` in the booking conversation (*"Your private concierge link — valid for your whole stay — chat, buy add-ons, or get help any time. Also sent to your email."*) and on the public confirmation page.
- **Validity:** whole stay, re-enterable any time from any device holding the link; no password. Expiry: *"Expires after checkout"* (auth note).
- **Reservation lifecycle gates content**, not access: prototype prop `reservationStatus ∈ upcoming | checked_in | past` drives a status pill and unlocks — **Wi-Fi, door code & house manual are locked until 24 hours before check-in** (lock chip with padlock icon), guestbook posting opens only once `checked_in`.
- **Tension (inference):** the mock renders a `past` stay state (guestbook posting allowed) while the auth note says the link dies at checkout — post-checkout grace period is unresolved (§9).
- **Tamper/expired:** rejected, never silently allowed (PLAN.md verification #9). The mocks show no expired/invalid-token screen — needs design (§9).

## 4. Tool/action surface (guest agent)

All calls are authorized server-side by the booking the token resolves to — the guest can only ever read/act on their own stay.

| Action | Risk class | UX contract |
|---|---|---|
| Look up own booking / reservation detail / house rules / house manual / FAQ | read | just executes; renders a card |
| Create maintenance work order ("report a problem") | write | executes immediately; `WorkOrderRequestConfirmation` receipt card; owner notified |
| Request late checkout | flag for owner review | **per PLAN.md: flagged, never auto-approved** (see §10 — the canonical mock explored it as an automated paid add-on instead) |
| Buy add-on (`addon_products`) | money | inline `CheckoutCard`; explicit `Pay $N` tap is the confirmation; Stripe Checkout per purchase |
| Cancel reservation / change dates | destructive / money | mock shows self-service confirm cards — **not in PLAN.md's guest tool list** (§10) |
| Anything unanswerable | escalation | forwarded to host Messages thread; host replies land with unread dot |

**Photo limitation** mirrors the owner spec §4: uploads travel via the composer attach button (web app), not the tool transport.

## 5. Screens & states (as evidenced in mocks)

### 5.1 Reservation & FAQ answers
`ReservationDetailCard`: cover photo with floating status pill (Upcoming/Checked in/Past), location eyebrow, dates · nights · guests · total, check-in/checkout times, address, locked-or-unlocked Wi-Fi + door code block (§3), then a badge-tab row — **Photos · Location · House rules · House manual · Guestbook** — each expanding inline (photo grid with swipeable lightbox, approximate-area map with zoom, rules list, manual notes, guestbook feed). Plain house-rules questions get a compact `HouseRulesCard`.

### 5.2 Work-order request → confirmation
Menu "Report a problem" (or matching free text) → agent asks what's wrong/urgency → guest describes ("The AC is blowing warm air") → agent: *"Got it — filing a maintenance request now."* → `WorkOrderRequestConfirmation` card: **Work Order #483 — Maintenance**, `Requested` pill, quoted issue text, unit, *"The owner's been notified and someone will be assigned shortly. I'll update you here."* Owner's surface simultaneously receives the event.

### 5.3 Add-on browse / buy / receipt
`AddonCatalogList` (*"Add-ons for your stay"*): rows of thumbnail · name · `$18 · delivered by a contractor` · **Buy**. Buy → user bubble ("Buy Firewood bundle") + `CheckoutCard`: line items, total, `Pay $18`, fine print *"Stripe Checkout (mock) — no real payment."* (production: real Checkout handoff, inline). Paid state → green `✓ Paid · $18` banner on the card, catalog row flips to `✓ Purchased`, agent confirms: *"Payment confirmed — firewood is on its way. A delivery work order was created."* Owner is notified of the purchase + auto-created WO.

### 5.4 Late checkout / early check-in
Canonical mock: guest asks → agent quotes from house rules (*"late checkout is available until 2:00 PM… for $25. Add it to your bill?"*) → `CheckoutCard` → paid → *"booked, no approval needed. I've let your host know."* The earlier v1 mobile mock instead lists it as `$25 · flagged for owner review` — which matches PLAN.md. **Spec position: v1 ships the PLAN.md behavior (paid-or-free request → owner review flag); fully automated fulfillment is a per-product option to revisit** (§10).

### 5.5 Cancel / change reservation
`CancelReservationCard`: policy summary (*"Free cancellation until 5 days before check-in…"*), **Keep reservation** / **Cancel reservation** buttons; cancelled state banner + refund message. Date changes reuse the `BookingCalendar` card. `BookingsIndexList` ("Your stays") lists multiple stays with status pills → `BookingSummaryCard` per stay.

### 5.6 Host Messages (human thread)
Separate view (breadcrumb header, host identity header) — messenger UI: guest bubbles right, host bubbles left with `Alex · host` attribution, photo attach, its own composer. Escalations from chat land here with a delayed human reply; unread dot appears on the Messages chip. This is the guest end of the owner's Messages inbox **Guests** tab (owner spec §5.4).

### 5.7 Guestbook
`GuestbookList` (entries: first name, date, text, optional photo/gallery/video) + `GuestbookComposer` (*"Posting as Jordan — first name only, visible to future guests"*), gated to checked-in/past stays.

### 5.8 Voice (designed-for, post-golden-path per PLAN.md)
Mic button in the empty composer → "Listening…" state with pulsing mic + stop control; voice turns render as waveform bubbles with duration; agent voice replies show a play control + `0:11 · voice reply` above the transcript text. v1 ships typed chat only; the composer reserves the affordance.

## 6. Public / pre-booking surface

Two explorations exist and should converge:

- **`StayOps Public Pages.dc.html`** — a single-property marketing site (hero photo + tagline, or compact header), pages: Home · About · Photos · Location · House rules · Terms · Booking · Checkout · Confirmed. A **sticky chat composer** (with a "Talk" voice pill) is the primary nav: free text routes to the matching page. Booking = calendar (range select, nights × rate + taxes) → Reserve → checkout form → Pay → **Confirmed page mints and displays the concierge link**. Footer: About/Photos/Location/House rules/Terms & privacy.
- **Main prototype, Public tab** — the same journey entirely in chat: `PropertyCard` (photos/location/rules/reviews badge-tabs, share/save), multi-unit browse (`Sunset Cabin`/`Riverbend Studio`/`Pine Row Room` under a "Ridgeline Homestead" group), `BookingCalendar`, `CheckoutCard` with **party composition steppers (adults/children/infants/pets), extra-guest and pet fees, and invite-guests-by-email**, then `GuestSessionCard` + a welcome message pre-seeded into the guest tab.
- **Inquiry → owner inbox:** the owner Messages inbox has a **Public** tab with `Public inquiry` threads (*"Do you allow pets at Sunset Cabin in August?"*). The mocks do not show the public visitor's side of thread creation — the public chat answers generically and never escalates. The handoff mechanism (email capture? anonymous thread?) is undesigned (§9).

## 7. Notifications & attention

- No provider-based push/SMS in v1 (per PLAN.md). **Email is the out-of-band channel**: concierge link *"also sent to your email"*, *"check-in instructions arrive by email"*.
- **Google Voice channel (post-golden-path, decided 2026-07-22):** guests can also text or leave a voicemail at the owner's Google Voice number — ingested via Gmail sync into their `kind=direct` host thread (channel badge); app replies to SMS-originated messages are delivered back as best-effort texts via the GV email-reply gateway (PLAN.md "Google Voice channel").
- In-surface attention = the unread dot on the Messages chip (host replied) — nothing else badges.
- Guest events (WO created, add-on purchased, booking confirmed) notify the **owner's** surface; the guest is only ever updated inside their own chat thread.

## 8. Visual language

Identical system to OWNER-SURFACE-SPEC.md §8 (cream/paper palette, terracotta accent, Montserrat/Crimson Text/monospace, white 14px-radius cards, tinted status pills, Feather-style stroke icons). Guest-specific notes:

- Chat bubbles: user = accent bg, right-aligned, `14px 14px 3px 14px` radius; agent = white, left, attribution line above; host = same shape with host avatar + name.
- A2UI card names as rendered (badge labels in the prototype, dev-only): `BookingSummaryCard`, `ReservationDetailCard`, `GuestSessionCard`, `HouseRulesCard`, `WorkOrderRequestConfirmation`, `AddonCatalogList`, `CheckoutCard`, `CancelReservationCard`, `BookingCalendar`, `BookingsIndexList`, `GuestbookList`/`GuestbookComposer`, `PropertyCard` (public).
- Public pages use the same tokens at marketing scale (clamp-sized Montserrat headlines, serif body, paper background, "stayops" wallpaper texture).

## 9. Open questions

1. Expired/invalid/tampered token screen — no mock exists; needs a designed dead-end (re-request link via email?).
2. Post-checkout grace: `past` state renders (guestbook) but the link "expires after checkout" — pick an expiry (checkout + N days?) and what's accessible then.
3. Quick-action menu placement — logic exists, template shows only the single hero chip. Chips row? Dock menu?
4. ~~Cancel/date-change self-service~~ — *resolved 2026-07-22: kept for v1.* Confirm cards; policy + refund rules from `units.cancellation_policy`; Stripe refund API.
5. ~~Public inquiry → owner-inbox thread minting~~ — *mooted 2026-07-22: the entire public surface is deferred* (PLAN.md "Deferred research"); revisit with that research.
6. Door code + Wi-Fi in a forwardable tokenized page — acceptable, or require a second factor (booking email) for the unlock block?
7. ~~Guestbook~~ — *resolved 2026-07-22: cut from v1.*
8. ~~Multi-stay "Your stays" index~~ — *resolved 2026-07-22: per-booking scope stands* (`guest_sessions` per booking); index only if sessions ever key to guest email.

## 10. Deltas vs. PLAN.md

> **Iteration-1 pivot 2026-07-23** — payments cut entirely; bookings now sync from third-party platforms (iCal + Gmail enrichment) or are owner-created (`kind=lease` supported). Consequences for this spec: add-on browsing/purchase (§5.3), self-service cancel/date-change (§5.5 — the 2026-07-22 "kept" decision is REVERSED), paid late checkout (§5.4), and `CheckoutCard`/`AddonCatalogList`/`AddonCard`/`CancelReservationCard`/`BookingCalendar`/`BookingsIndexList` are **deferred-scope reference only**. The concierge link is **owner-issued** (no payment webhook exists to auto-mint it). v1 guest surface = booking/lease + space info (24h access gate) + report-a-problem + host Messages. See PLAN.md "Iteration-1 pivot" + "Booking ingestion".
>
> **Reconciled 2026-07-22** — applied to PLAN.md: **guest self-service cancel/date-change kept for v1** (confirm cards; policy/refund rules from `units.cancellation_policy`, Stripe refunds, resolving §9.4); **unit access-info fields added** (`wifi_network`/`wifi_password`/`door_code`/`house_manual` with the 24h-before-check-in unlock); host direct-message threads via conversation `kind(agent_chat|direct)`; late checkout keeps the owner-review gate. **Cut/deferred**: guestbook (resolving §9.7), reviews, extra-guest/pet fees + invites (party_size/pets recorded, flat pricing), and the **entire public/pre-booking surface — deferred pending research** (insurance, background checks, e-signature, OTA calendar sync, dynamic pricing, terms, payment compliance; see PLAN.md "Deferred research"), which moots §6 and §9.5 for v1 — bookings are owner-initiated with a Checkout link sent to the guest. The table below is kept as the rationale record.

| This spec / mocks | PLAN.md today | Action |
|---|---|---|
| Late checkout (+ early check-in) sold as automated paid service, "no approval needed" (canonical mock) | Late checkout = flag for owner review, **never auto-approved**; `fulfillment_type=none` | Keep PLAN's review gate for v1 (v1 mock agrees: "$25 · flagged for owner review"). Consider per-product `auto_fulfill` flag later. Early check-in = new `addon_product`. |
| Guest self-service cancel + date change with refund copy | No guest cancel/update tools; no policy fields | Decide v1 scope; if kept, add cancellation-policy data + tools; else route to host thread. |
| Host Messages thread (guest ↔ owner, human) | `conversations` are agent chat persistence only | Add direct-message thread kind — same need as owner spec §5.4 inbox delta. |
| Guestbook (entries + media + composer) | Absent | Add `guestbook_entries` table or cut (§9.7). |
| Wi-Fi / door code / house manual with 24h-before-check-in unlock | `units` has only `house_rules` | Add `wifi_network/wifi_password/door_code/house_manual` fields + time-gate rule. |
| Party composition (adults/children/infants/pets), extra-guest & pet fees, invite emails at checkout | `bookings` lacks party/pets/fee fields (owner spec flags same gap) | Extend `bookings` + pricing rules. |
| "Your stays" multi-booking index in one guest chat | `guest_sessions` is per-booking | Keep per-booking scope for v1; index only if sessions get keyed to guest email. |
| Public marketing page set (hero/about/photos/location/rules) + in-chat booking | "Simple internal/direct booking flow", no public storefront | Public Pages mock is single-property, not a storefront — confirm it fits "direct booking flow" scope. |
| Reviews/ratings on `PropertyCard` (4.9 · reviews) | No reviews concept | Cut for v1 or add table; guestbook ≠ reviews. |
| Voice bubbles + listening composer | Post-golden-path enhancement — agrees | Ship composer with mic affordance hidden/disabled until voice phase. |
| Token expiry at checkout | `guest_sessions.expires_at` exists — OK | Set expiry = checkout (+ grace pending §9.2). |
