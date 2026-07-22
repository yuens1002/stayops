/**
 * T1 / D7 — contract invariants (AC-TST-1, supports AC-FN-4 / AC-FN-6).
 *
 * Asserts the frozen-seam invariants named in docs/features/t1-contracts/acs.md:
 * unknown component type rejected; required-prop omission rejected; every
 * fixture file validates (envelope + every component); a mutated fixture
 * (broken prop type) fails.
 */
import { describe, expect, it } from "vitest";
import { z } from "zod";

import {
  CATALOG_COMPONENT_NAMES,
  catalogPropSchemas,
  isCatalogComponentName,
  parseComponent,
  safeParseComponent,
  UnknownCatalogComponentError,
  type CatalogComponentName,
} from "../lib/a2ui/catalog";
import { surfaceEnvelopeSchema } from "../lib/a2ui/protocol";
import { loadFixtureFiles } from "./helpers/fixtures";

const fixtures = loadFixtureFiles();

/** The 16 components the plan's D3 row freezes into the catalog. */
const PLANNED_CATALOG_SIZE = 16;

/** The ~16 spec screens the plan's D5 row requires fixtures for. */
const PLANNED_FIXTURE_COUNT = 16;

type RawComponent = { id: string; type: string; props: Record<string, unknown> };

/** Components of one fixture, via the envelope contract (validated separately). */
function componentsOf(envelope: unknown): RawComponent[] {
  return surfaceEnvelopeSchema.parse(envelope).components as RawComponent[];
}

/**
 * Keys of a catalog component's props schema that must be present (no
 * optional/default escape hatch) — derived from the schema itself so the test
 * never pins a hand-maintained list.
 */
function requiredPropKeys(name: CatalogComponentName): string[] {
  const shape = (
    catalogPropSchemas[name] as unknown as { shape: Record<string, z.ZodType> }
  ).shape;
  return Object.entries(shape)
    .filter(([, field]) => !field.safeParse(undefined).success)
    .map(([key]) => key);
}

describe("catalog completeness", () => {
  it(`defines a prop schema for all ${PLANNED_CATALOG_SIZE} planned components`, () => {
    expect(
      CATALOG_COMPONENT_NAMES.length,
      `catalog must freeze exactly the ${PLANNED_CATALOG_SIZE} components named in plan D3`,
    ).toBe(PLANNED_CATALOG_SIZE);
  });

  it(`ships at least ${PLANNED_FIXTURE_COUNT} fixture screens (plan D5)`, () => {
    expect(
      fixtures.length,
      `expected >= ${PLANNED_FIXTURE_COUNT} fixture files in lib/a2ui/fixtures, found ${fixtures.length}`,
    ).toBeGreaterThanOrEqual(PLANNED_FIXTURE_COUNT);
  });

  it("exercises every catalog component in at least one fixture", () => {
    const seen = new Set<string>();
    for (const { envelope } of fixtures) {
      for (const component of componentsOf(envelope)) {
        seen.add(component.type);
      }
    }
    const unexercised = CATALOG_COMPONENT_NAMES.filter(
      (name) => !seen.has(name),
    );
    expect(
      unexercised,
      `every catalog component must appear in a fixture; missing: ${unexercised.join(", ")}`,
    ).toEqual([]);
  });
});

describe("fixture validation (every fixture validates)", () => {
  it.each(fixtures)("$name is a valid surface envelope", ({ name, envelope }) => {
    const result = surfaceEnvelopeSchema.safeParse(envelope);
    expect(
      result.success,
      `${name} must parse as a 'surface' envelope: ${result.success ? "" : z.prettifyError(result.error)}`,
    ).toBe(true);
  });

  it.each(fixtures)(
    "$name: every component round-trips through parseComponent()",
    ({ name, envelope }) => {
      for (const raw of componentsOf(envelope)) {
        const result = safeParseComponent(raw);
        expect(
          result.success,
          `${name} component '${raw.id}' (${raw.type}) must pass its catalog schema: ${
            result.success ? "" : result.error.message
          }`,
        ).toBe(true);
        if (!result.success) continue;
        // Round-trip: the validated output (defaults applied) is itself a
        // valid component instance and re-parses to the same value.
        const reparsed = parseComponent(result.component);
        expect(
          reparsed,
          `${name} component '${raw.id}' must be stable under re-parse (parse ∘ parse = parse)`,
        ).toEqual(result.component);
      }
    },
  );
});

describe("catalog rejection", () => {
  it("rejects an unknown component type", () => {
    expect(
      fixtures.length,
      "fixture files must be present for this suite to be meaningful",
    ).toBeGreaterThan(0);
    const validComponent = componentsOf(fixtures[0].envelope)[0];
    const unknown = { ...structuredClone(validComponent), type: "NotInCatalog" };
    expect(
      () => parseComponent(unknown),
      "a component type outside the catalog must throw UnknownCatalogComponentError",
    ).toThrow(UnknownCatalogComponentError);
    const safe = safeParseComponent(unknown);
    expect(safe.success, "safeParseComponent must also reject it").toBe(false);
  });

  it("rejects omission of any required prop, for every fixture component", () => {
    for (const { name, envelope } of fixtures) {
      for (const raw of componentsOf(envelope)) {
        if (!isCatalogComponentName(raw.type)) continue; // covered above
        for (const key of requiredPropKeys(raw.type)) {
          const mutated = structuredClone(raw);
          delete mutated.props[key];
          const result = safeParseComponent(mutated);
          expect(
            result.success,
            `${name} component '${raw.id}' (${raw.type}) must be rejected when required prop '${key}' is omitted`,
          ).toBe(false);
          if (!result.success) {
            expect(
              result.error,
              `omitting required prop '${key}' must surface a ZodError, not an unknown-type error`,
            ).toBeInstanceOf(z.ZodError);
          }
        }
      }
    }
  });

  it("rejects a mutated fixture (broken prop type), for every fixture", () => {
    for (const { name, envelope } of fixtures) {
      const raw = componentsOf(envelope)[0];
      if (!isCatalogComponentName(raw.type)) continue; // covered above
      const [key] = requiredPropKeys(raw.type);
      expect(
        key,
        `${raw.type} must declare at least one required prop for the mutation probe`,
      ).toBeDefined();
      const mutated = structuredClone(raw);
      // Flip the prop to a value of the wrong primitive type.
      mutated.props[key] =
        typeof mutated.props[key] === "number" ? "not-a-number" : 42;
      const result = safeParseComponent(mutated);
      expect(
        result.success,
        `${name} component '${raw.id}' (${raw.type}) must fail validation when prop '${key}' has a broken type`,
      ).toBe(false);
    }
  });
});
