#!/usr/bin/env tsx
/**
 * T1 / D6 — idempotent realistic demo state (docs/features/t1-contracts/plan.md).
 *
 * Every row carries a stable seed UUID and is written with an upsert
 * (onConflictDoUpdate on the primary key), so running the script twice leaves
 * row counts unchanged (AC-FN-7) while re-running resets drifted demo data
 * back to the canonical state (docs/PLAN.md "Seed data").
 *
 * Usage: npx tsx scripts/seed.ts
 */
import { loadEnvConfig } from "@next/env";

// Runs outside Next, so load .env.local the way Next does (same pattern as
// drizzle.config.ts / scripts/list-tables.ts). Static imports hoist above this
// call, but none of the imported modules read env at module scope — the db
// client below is created after env is loaded.
loadEnvConfig(process.cwd());

import { neon } from "@neondatabase/serverless";
import { getTableColumns, sql, type SQL } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-http";
import type { PgTable } from "drizzle-orm/pg-core";

import * as schema from "../lib/db/schema";
import {
  bookings,
  calendarFeeds,
  commSyncState,
  contacts,
  expenses,
  maintenanceSchedules,
  properties,
  routineSeries,
  routineVisits,
  units,
  workflowTemplates,
  workflowTemplateSteps,
  workOrders,
} from "../lib/db/schema";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL is not set (expected in .env.local)");
  process.exit(1);
}

const db = drizzle(neon(databaseUrl), { schema });

// ---------------------------------------------------------------------------
// Stable seed identity
// ---------------------------------------------------------------------------

/** Deterministic, valid-format UUID from a small integer: `5eed…` prefix makes
 * seed rows recognizable in the DB and safe to upsert on the primary key. */
function seedUuid(n: number): string {
  return `5eed0000-0000-4000-8000-${String(n).padStart(12, "0")}`;
}

// One flat registry so ids stay unique and greppable.
const ID = {
  propertyCedarRidge: seedUuid(1),
  propertyHarborview: seedUuid(2),
  unitMainCabin: seedUuid(11),
  unitCreeksideAdu: seedUuid(12),
  unitBungalow: seedUuid(13),
  contactCleaner: seedUuid(21),
  contactMaintenance: seedUuid(22),
  templateTurnover: seedUuid(31),
  stepKitchenClean: seedUuid(41),
  stepKitchenStock: seedUuid(42),
  stepBathroom: seedUuid(43),
  stepBedroom: seedUuid(44),
  stepExterior: seedUuid(45),
  bookingMidStay: seedUuid(51),
  bookingUpcoming: seedUuid(52),
  bookingLease: seedUuid(53),
  bookingBlock: seedUuid(54),
  feedMainCabinAirbnb: seedUuid(55),
  woRequested: seedUuid(61),
  woAssigned: seedUuid(62),
  woInProgress: seedUuid(63),
  woSubmitted: seedUuid(64),
  woNeedsRevision: seedUuid(65),
  woApproved: seedUuid(66),
  woPaid: seedUuid(67),
  routineSeriesGrounds: seedUuid(71),
  routineVisit1: seedUuid(72),
  routineVisit2: seedUuid(73),
  maintenanceHvacFilter: seedUuid(81),
  expenseHvacRepair: seedUuid(101),
  expenseTurnoverClean: seedUuid(102),
  expenseInsurance: seedUuid(103),
} as const;

// ---------------------------------------------------------------------------
// Date helpers — bookings/work orders are anchored to "now" so the demo state
// is always mid-stay-realistic no matter when the seed runs.
// ---------------------------------------------------------------------------

const CHECK_IN_HOUR = 16; // 4pm check-in
const CHECK_OUT_HOUR = 11; // 11am checkout

function daysFromNow(days: number, hour = 12): Date {
  const d = new Date();
  d.setHours(hour, 0, 0, 0);
  d.setDate(d.getDate() + days);
  return d;
}

function nights(checkIn: Date, checkOut: Date): number {
  const MS_PER_DAY = 24 * 60 * 60 * 1000;
  return Math.round((checkOut.getTime() - checkIn.getTime()) / MS_PER_DAY);
}

// ---------------------------------------------------------------------------
// Upsert helper — update every column except the identity/immutable ones with
// the attempted-insert (`excluded`) values, keyed on the stable seed id.
// ---------------------------------------------------------------------------

function conflictUpdateAllExcept<
  T extends PgTable,
  E extends (keyof T["_"]["columns"])[],
>(table: T, except: E) {
  const columns = getTableColumns(table);
  return Object.fromEntries(
    Object.entries(columns)
      .filter(([name]) => !except.includes(name as E[number]))
      .map(([name, column]) => [name, sql.raw(`excluded."${column.name}"`)]),
  ) as Omit<Record<keyof T["_"]["columns"], SQL>, E[number]>;
}

// ---------------------------------------------------------------------------
// Seed
// ---------------------------------------------------------------------------

async function main() {
  // --- properties (2) ------------------------------------------------------
  await db
    .insert(properties)
    .values([
      {
        id: ID.propertyCedarRidge,
        name: "Cedar Ridge Cabin",
        address: "4180 Timberline Rd, Leavenworth, WA 98826",
      },
      {
        id: ID.propertyHarborview,
        name: "Harborview Bungalow",
        address: "212 Bayview Ave, Port Townsend, WA 98368",
      },
    ])
    .onConflictDoUpdate({
      target: properties.id,
      set: conflictUpdateAllExcept(properties, ["id", "createdAt"]),
    });

  // --- units (3, access-info fields set) -----------------------------------
  await db
    .insert(units)
    .values([
      {
        id: ID.unitMainCabin,
        propertyId: ID.propertyCedarRidge,
        label: "Main Cabin",
        unitType: "whole_property",
        baseNightlyRateCents: 28900,
        maxGuests: 6,
        houseRules:
          "No smoking. Quiet hours 10pm-8am. Pets allowed with prior approval. No parties or events.",
        status: "active",
        wifiNetwork: "CedarRidge-Guest",
        wifiPassword: "tall-pines-2026",
        doorCode: "4821#",
        houseManual:
          "Thermostat is in the hallway (please keep between 62-74F). " +
          "Hot tub cover clips must be re-latched after use. " +
          "Firewood is for the outdoor pit only. Trash pickup is Tuesday - bins to the road Monday night.",
        cancellationPolicy:
          "Full refund up to 7 days before check-in; 50% refund up to 48 hours before check-in; no refund after that.",
      },
      {
        id: ID.unitCreeksideAdu,
        propertyId: ID.propertyCedarRidge,
        label: "Creekside ADU",
        unitType: "adu",
        baseNightlyRateCents: 16500,
        maxGuests: 3,
        houseRules: "No smoking. Quiet hours 10pm-8am. No pets in the ADU.",
        status: "active",
        wifiNetwork: "CedarRidge-Guest",
        wifiPassword: "tall-pines-2026",
        doorCode: "7355#",
        houseManual:
          "Mini-split remote is on the kitchen wall. Creek path is slippery when wet - use the gravel trail after rain.",
        cancellationPolicy:
          "Full refund up to 5 days before check-in; no refund after that.",
      },
      {
        id: ID.unitBungalow,
        propertyId: ID.propertyHarborview,
        label: "Bungalow",
        unitType: "whole_property",
        baseNightlyRateCents: 21900,
        maxGuests: 4,
        houseRules: "No smoking. Quiet hours 10pm-8am. Small dogs welcome.",
        status: "active",
        wifiNetwork: "Harborview",
        wifiPassword: "salt-air-4life",
        doorCode: "1962#",
        houseManual:
          "Street parking only - permit hangs by the door. Ferry horn is loud at 7am; earplugs in the nightstand. " +
          "Kayaks in the shed are guest-usable, life vests required.",
        cancellationPolicy:
          "Full refund up to 7 days before check-in; 50% refund up to 48 hours before check-in; no refund after that.",
      },
    ])
    .onConflictDoUpdate({
      target: units.id,
      set: conflictUpdateAllExcept(units, ["id", "createdAt"]),
    });

  // --- contacts (cleaner + maintenance) ------------------------------------
  await db
    .insert(contacts)
    .values([
      {
        id: ID.contactCleaner,
        name: "Marisol Vega",
        phone: "+13605550142",
        email: "marisol.vega.cleaning@example.com",
        type: "cleaner",
        defaultRateCents: 12000,
      },
      {
        id: ID.contactMaintenance,
        name: "Dale Hutchins",
        phone: "+13605550177",
        email: "dale@hutchinshandyman.example.com",
        type: "maintenance",
        defaultRateCents: 9500,
      },
    ])
    .onConflictDoUpdate({
      target: contacts.id,
      set: conflictUpdateAllExcept(contacts, ["id", "createdAt"]),
    });

  // --- "Standard Turnover Clean" template + 5 steps ------------------------
  await db
    .insert(workflowTemplates)
    .values([
      {
        id: ID.templateTurnover,
        name: "Standard Turnover Clean",
        type: "cleaning",
        description:
          "Full between-guest turnover: kitchen, bath, bedrooms, exterior reset, and consumables stock check.",
      },
    ])
    .onConflictDoUpdate({
      target: workflowTemplates.id,
      set: conflictUpdateAllExcept(workflowTemplates, ["id", "createdAt"]),
    });

  // 5 steps across areas: 2 photo-required, 1 stock-check (plan D6).
  await db
    .insert(workflowTemplateSteps)
    .values([
      {
        id: ID.stepKitchenClean,
        templateId: ID.templateTurnover,
        order: 1,
        area: "Kitchen",
        label: "Wipe counters, stovetop, and appliance exteriors",
        requiresPhoto: true,
      },
      {
        id: ID.stepKitchenStock,
        templateId: ID.templateTurnover,
        order: 2,
        area: "Kitchen",
        label: "Check and restock guest consumables",
        stockItems: ["Coffee pods", "Paper towels", "Dish soap", "Trash bags"],
      },
      {
        id: ID.stepBathroom,
        templateId: ID.templateTurnover,
        order: 3,
        area: "Bathroom",
        label: "Scrub shower, sink, and toilet; replace towels",
        requiresPhoto: true,
      },
      {
        id: ID.stepBedroom,
        templateId: ID.templateTurnover,
        order: 4,
        area: "Bedroom",
        label: "Strip and remake beds with fresh linens",
      },
      {
        id: ID.stepExterior,
        templateId: ID.templateTurnover,
        order: 5,
        area: "Exterior",
        label: "Sweep porch and re-latch hot tub cover",
        requiresNote: true,
      },
    ])
    .onConflictDoUpdate({
      target: workflowTemplateSteps.id,
      set: conflictUpdateAllExcept(workflowTemplateSteps, ["id"]),
    });

  // --- bookings: mid-stay + upcoming (party_size/pets) ---------------------
  const midStayCheckIn = daysFromNow(-2, CHECK_IN_HOUR);
  const midStayCheckOut = daysFromNow(3, CHECK_OUT_HOUR);
  const upcomingCheckIn = daysFromNow(5, CHECK_IN_HOUR);
  const upcomingCheckOut = daysFromNow(9, CHECK_OUT_HOUR);

  const MAIN_CABIN_RATE_CENTS = 28900;
  const BUNGALOW_RATE_CENTS = 21900;

  await db
    .insert(bookings)
    .values([
      {
        id: ID.bookingMidStay,
        unitId: ID.unitMainCabin,
        kind: "booking" as const,
        source: "airbnb" as const,
        externalRef: "airbnb-HMABC1234X@airbnb.com",
        confirmationCode: "HMABC1234X",
        checkIn: midStayCheckIn,
        checkOut: midStayCheckOut,
        guestName: "Priya Raman",
        guestEmail: "priya.raman@example.com",
        guestPhone: "+14255550163",
        partySize: 4,
        pets: true,
        status: "confirmed",
        amountCents:
          nights(midStayCheckIn, midStayCheckOut) * MAIN_CABIN_RATE_CENTS,
      },
      {
        id: ID.bookingUpcoming,
        unitId: ID.unitBungalow,
        kind: "booking" as const,
        source: "airbnb" as const,
        externalRef: "airbnb-HMDEF5678Y@airbnb.com",
        confirmationCode: "HMDEF5678Y",
        checkIn: upcomingCheckIn,
        checkOut: upcomingCheckOut,
        guestName: "Tom Ellery",
        guestEmail: "tom.ellery@example.com",
        guestPhone: null,
        partySize: 2,
        pets: false,
        status: "confirmed",
        amountCents:
          nights(upcomingCheckIn, upcomingCheckOut) * BUNGALOW_RATE_CENTS,
      },
      {
        // Mid-term lease (Furnished Finder / direct) — monthly rent, manual.
        id: ID.bookingLease,
        unitId: ID.unitCreeksideAdu,
        kind: "lease" as const,
        source: "manual" as const,
        checkIn: daysFromNow(-20, CHECK_IN_HOUR),
        checkOut: daysFromNow(70, CHECK_OUT_HOUR),
        guestName: "Dana Whitfield",
        guestEmail: "dana.whitfield@example.com",
        partySize: 1,
        pets: false,
        status: "confirmed" as const,
        monthlyRentCents: 245000,
      },
      {
        // Owner date-block (personal use) — no guest, no auto-turnover.
        id: ID.bookingBlock,
        unitId: ID.unitMainCabin,
        kind: "block" as const,
        source: "manual" as const,
        checkIn: daysFromNow(14, CHECK_IN_HOUR),
        checkOut: daysFromNow(17, CHECK_OUT_HOUR),
        status: "confirmed" as const,
      },
    ])
    .onConflictDoUpdate({
      target: bookings.id,
      set: conflictUpdateAllExcept(bookings, ["id", "createdAt"]),
    });

  // --- work orders: every status incl. needs_revision + review_note --------
  await db
    .insert(workOrders)
    .values([
      {
        id: ID.woRequested,
        unitId: ID.unitMainCabin,
        bookingId: ID.bookingMidStay,
        type: "maintenance",
        status: "requested",
        scope:
          "Kitchen faucet dripping steadily - reported by current guest via concierge chat.",
        requestedBy: "guest_concierge",
      },
      {
        id: ID.woAssigned,
        unitId: ID.unitBungalow,
        contactId: ID.contactCleaner,
        workflowTemplateId: ID.templateTurnover,
        type: "cleaning",
        status: "assigned",
        scope: "Turnover clean after the Ellery stay checks out.",
        scheduledAt: daysFromNow(9, CHECK_OUT_HOUR),
        costCents: 12000,
        requestedBy: "owner",
      },
      {
        id: ID.woInProgress,
        unitId: ID.unitCreeksideAdu,
        contactId: ID.contactCleaner,
        workflowTemplateId: ID.templateTurnover,
        type: "cleaning",
        status: "in_progress",
        scope: "Same-day turnover clean of the Creekside ADU.",
        scheduledAt: daysFromNow(0, CHECK_OUT_HOUR),
        acceptedAt: daysFromNow(-1),
        costCents: 12000,
        requestedBy: "owner",
      },
      {
        id: ID.woSubmitted,
        unitId: ID.unitMainCabin,
        contactId: ID.contactCleaner,
        workflowTemplateId: ID.templateTurnover,
        type: "cleaning",
        status: "submitted_for_review",
        scope: "Pre-arrival deep clean before the Raman party checked in.",
        scheduledAt: daysFromNow(-3, CHECK_OUT_HOUR),
        acceptedAt: daysFromNow(-4),
        submittedAt: daysFromNow(-3, 15),
        costCents: 12000,
        requestedBy: "owner",
      },
      {
        id: ID.woNeedsRevision,
        unitId: ID.unitBungalow,
        contactId: ID.contactCleaner,
        workflowTemplateId: ID.templateTurnover,
        type: "cleaning",
        status: "needs_revision",
        scope: "Turnover clean between spring stays.",
        scheduledAt: daysFromNow(-6, CHECK_OUT_HOUR),
        acceptedAt: daysFromNow(-7),
        submittedAt: daysFromNow(-6, 16),
        costCents: 12000,
        reviewNote:
          "Bathroom mirror is still streaky in the photo and the exterior step photo is missing - please redo both and resubmit.",
        requestedBy: "owner",
      },
      {
        id: ID.woApproved,
        unitId: ID.unitMainCabin,
        contactId: ID.contactMaintenance,
        type: "maintenance",
        status: "approved",
        scope: "Replace HVAC filter and test both smoke detectors.",
        scheduledAt: daysFromNow(-6),
        acceptedAt: daysFromNow(-8),
        submittedAt: daysFromNow(-6, 14),
        approvedAt: daysFromNow(-5),
        costCents: 9500,
        requestedBy: "owner",
      },
      {
        id: ID.woPaid,
        unitId: ID.unitCreeksideAdu,
        contactId: ID.contactCleaner,
        workflowTemplateId: ID.templateTurnover,
        type: "cleaning",
        status: "paid",
        scope: "Turnover clean after the early-July ADU stay.",
        scheduledAt: daysFromNow(-13, CHECK_OUT_HOUR),
        acceptedAt: daysFromNow(-14),
        submittedAt: daysFromNow(-13, 15),
        approvedAt: daysFromNow(-12),
        costCents: 12000,
        requestedBy: "owner",
      },
    ])
    .onConflictDoUpdate({
      target: workOrders.id,
      set: conflictUpdateAllExcept(workOrders, ["id", "createdAt"]),
    });

  // --- routine series + visits ---------------------------------------------
  await db
    .insert(routineSeries)
    .values([
      {
        id: ID.routineSeriesGrounds,
        propertyId: ID.propertyCedarRidge,
        contactId: ID.contactMaintenance,
        title: "Hot tub & grounds care",
        cadence: "Monthly retainer",
        visitsPerMonth: 2,
        monthlyCostCents: 22000,
        status: "active",
      },
    ])
    .onConflictDoUpdate({
      target: routineSeries.id,
      set: conflictUpdateAllExcept(routineSeries, ["id", "createdAt"]),
    });

  await db
    .insert(routineVisits)
    .values([
      {
        id: ID.routineVisit1,
        seriesId: ID.routineSeriesGrounds,
        visitedAt: daysFromNow(-20),
        note: "Balanced hot tub chemicals, skimmed and topped off water.",
      },
      {
        id: ID.routineVisit2,
        seriesId: ID.routineSeriesGrounds,
        visitedAt: daysFromNow(-6),
        note: "Mowed, cleared trail debris after windstorm.",
      },
    ])
    .onConflictDoUpdate({
      target: routineVisits.id,
      set: conflictUpdateAllExcept(routineVisits, ["id"]),
    });

  // --- quarterly maintenance schedule --------------------------------------
  await db
    .insert(maintenanceSchedules)
    .values([
      {
        id: ID.maintenanceHvacFilter,
        unitId: ID.unitMainCabin,
        label: "Replace HVAC filter",
        cadence: "quarterly",
        lastDoneAt: daysFromNow(-60),
        note: "20x25x1 MERV 11 - spares in the hall closet.",
      },
    ])
    .onConflictDoUpdate({
      target: maintenanceSchedules.id,
      set: conflictUpdateAllExcept(maintenanceSchedules, ["id", "createdAt"]),
    });

  // --- expenses (work-order costs + a non-work-order cost) -----------------
  await db
    .insert(expenses)
    .values([
      {
        id: ID.expenseHvacRepair,
        propertyId: ID.propertyCedarRidge,
        unitId: ID.unitMainCabin,
        workOrderId: ID.woApproved,
        category: "maintenance",
        amountCents: 9500,
        incurredAt: daysFromNow(-5),
        notes: "HVAC filter + smoke detector check (Dale Hutchins).",
      },
      {
        id: ID.expenseTurnoverClean,
        propertyId: ID.propertyCedarRidge,
        unitId: ID.unitCreeksideAdu,
        workOrderId: ID.woPaid,
        category: "cleaning",
        amountCents: 12000,
        incurredAt: daysFromNow(-12),
        notes: "ADU turnover clean (Marisol Vega).",
      },
      {
        id: ID.expenseInsurance,
        propertyId: ID.propertyHarborview,
        unitId: null,
        workOrderId: null,
        category: "insurance",
        amountCents: 78000,
        incurredAt: daysFromNow(-15),
        notes: "Annual STR liability policy installment.",
      },
    ])
    .onConflictDoUpdate({
      target: expenses.id,
      set: conflictUpdateAllExcept(expenses, ["id"]),
    });

  // --- calendar feeds: per-unit import URLs (test feed until real ones land)
  await db
    .insert(calendarFeeds)
    .values([
      {
        id: ID.feedMainCabinAirbnb,
        unitId: ID.unitMainCabin,
        platform: "airbnb" as const,
        url: "https://www.airbnb.com/calendar/ical/00000001.ics?s=seedfixture",
      },
    ])
    .onConflictDoUpdate({
      target: calendarFeeds.id,
      set: conflictUpdateAllExcept(calendarFeeds, ["id", "createdAt"]),
    });

  // --- comm_sync_state: per-source cursors (2026-07-23 pivot) --------------
  // DoNothing, not DoUpdate: never clobber a live Gmail poll cursor.
  await db
    .insert(commSyncState)
    .values([{ id: "airbnb_email" as const }])
    .onConflictDoNothing({ target: commSyncState.id });

  console.log("Seed complete:");
  console.log("  properties: 2, units: 3, contacts: 2");
  console.log("  workflow template: 1 (Standard Turnover Clean, 5 steps)");
  console.log("  bookings: 4 (mid-stay + upcoming + lease + block)");
  console.log("  work orders: 7 (every status incl. needs_revision)");
  console.log("  routine series: 1 (+2 visits), maintenance schedules: 1");
  console.log("  calendar feeds: 1, expenses: 3, comm_sync_state: airbnb_email cursor");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
