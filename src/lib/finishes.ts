import type { Finish } from "./types";

/**
 * Pure finish helpers, deliberately in their own module with no data import.
 *
 * These are used by client components. Anything imported from
 * `lib/catalogue.ts` drags the catalogue JSON into the browser bundle with
 * it, because that module imports data/ at the top level. Keeping the shared
 * logic here is what lets the picker and the filter use one implementation
 * instead of two copies, without shipping the catalogue to do it.
 */

export interface FinishGroup {
  family: string;
  familyName: string;
  finishes: Finish[];
}

/**
 * Grouped by the material each finish belongs to, which is the structure the
 * live site's own filter throws away: their colour codes already encode it in
 * the prefix. Largest group first, so the material a category is mostly made
 * of leads.
 */
export function groupFinishesByFamily(list: readonly Finish[]): FinishGroup[] {
  const groups = new Map<string, FinishGroup>();
  for (const finish of list) {
    const group = groups.get(finish.family) ?? {
      family: finish.family,
      familyName: finish.familyName,
      finishes: [],
    };
    group.finishes.push(finish);
    groups.set(finish.family, group);
  }
  return [...groups.values()].sort(
    (a, b) =>
      b.finishes.length - a.finishes.length ||
      a.familyName.localeCompare(b.familyName),
  );
}
