#!/usr/bin/env tsx
/**
 * Gate 1 — AC coverage validator.
 *
 * Usage: tsx scripts/check-acs-coverage.ts <plan.md> <acs.md>
 *
 * Hard-fails when:
 *  - a deliverable (D1, D2, …) in the plan's deliverables table has no AC row
 *    referencing it in the ACs doc's "Plan ref" column
 *  - an AC row references a Plan ref that doesn't exist in the plan
 *  - a deliverable row has no owning role (TBD/empty Role cell)
 */
import { readFileSync } from "node:fs";

const [planPath, acsPath] = process.argv.slice(2);
if (!planPath || !acsPath) {
  console.error("usage: tsx scripts/check-acs-coverage.ts <plan.md> <acs.md>");
  process.exit(1);
}

const plan = readFileSync(planPath, "utf8");
const acs = readFileSync(acsPath, "utf8");

// Deliverables table rows: | D1 | ... | kind | /role |
const deliverableRows = [...plan.matchAll(/^\|\s*(D\d+)\s*\|(.+)$/gm)];
const deliverables = new Map<string, string[]>(
  deliverableRows.map((m) => [m[1], m[2].split("|").map((c) => c.trim())]),
);

// AC rows: | AC-XX-1 | <plan ref> | <role> | ...
const acRows = [...acs.matchAll(/^\|\s*(AC-[A-Z]+-\d+)\s*\|\s*([^|]+)\|/gm)];

const errors: string[] = [];

if (deliverables.size === 0) errors.push(`no deliverables table found in ${planPath}`);
if (acRows.length === 0) errors.push(`no AC rows found in ${acsPath}`);

const referenced = new Set<string>();
for (const [, acId, refCell] of acRows) {
  const refs = refCell.trim();
  if (refs === "—" || refs === "-") continue; // regression ACs are unscoped
  for (const ref of refs.split(/[,\s]+/).filter(Boolean)) {
    if (!deliverables.has(ref)) {
      errors.push(`${acId}: Plan ref '${ref}' matches no deliverable ID`);
    } else {
      referenced.add(ref);
    }
  }
}

for (const [id, cells] of deliverables) {
  if (!referenced.has(id)) errors.push(`deliverable ${id} has no AC referencing it`);
  const role = cells.at(-1) ?? "";
  if (!role || /tbd/i.test(role)) errors.push(`deliverable ${id} has no owning role`);
}

if (errors.length) {
  console.error(`Gate 1 FAILED (${errors.length}):`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}

console.log(
  `Gate 1 passed: ${deliverables.size} deliverables, ${acRows.length} ACs, full coverage.`,
);
