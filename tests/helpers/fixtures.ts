/**
 * Shared fixture loading for the T1 contract suites (D7).
 *
 * Reads every `lib/a2ui/fixtures/*.json` from disk (rather than importing a
 * hardcoded list) so a newly added fixture file is automatically covered by
 * the every-fixture-validates invariant (AC-TST-1 / AC-FN-6).
 */
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const FIXTURES_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../lib/a2ui/fixtures",
);

export type FixtureFile = {
  /** File basename, e.g. "guest-reservation.json". */
  name: string;
  /** Raw parsed JSON — validated by the suites, never trusted here. */
  envelope: unknown;
};

export function loadFixtureFiles(): FixtureFile[] {
  return readdirSync(FIXTURES_DIR)
    .filter((file) => file.endsWith(".json"))
    .sort()
    .map((name) => ({
      name,
      envelope: JSON.parse(
        readFileSync(path.join(FIXTURES_DIR, name), "utf8"),
      ) as unknown,
    }));
}
