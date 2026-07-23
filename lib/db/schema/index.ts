// Full StayOps domain schema (docs/PLAN.md "Data model") — trunk step T1.
// Replaces the T0 `app_meta` placeholder (deliberately dropped: it only
// proved the Drizzle → Neon push path).

export * from "./properties";
export * from "./bookings";
export * from "./calendar";
export * from "./contacts";
export * from "./workflows";
export * from "./routines";
export * from "./commerce";
export * from "./conversations";
export * from "./audit";
