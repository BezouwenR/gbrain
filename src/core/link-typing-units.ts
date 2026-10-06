/**
 * Relationship-phrasing typing units (Q2 Track C).
 *
 * Each unit is one entailment-limited change to link typing (link-extraction.ts) or to the temporal cue lexicon
 * (link-temporal-evidence.ts). A unit takes effect only when its id is in ENABLED_TYPING_UNITS; with the set empty,
 * extraction behaves exactly as before the units existed. Which units ship is decided by the preregistered held-out
 * verdict (docs/eval/decisions/q2-parser-gaps/, gbrain-evals docs/benchmarks/2026-10-06-q2-parser-gaps-preregistration.md);
 * scripts/q2-typing-package.ts builds a branch whose one extra commit sets this constant.
 *
 * Policy, examples and the contributor recipe: docs/guides/temporal-edges.md, "Relationship phrasings".
 */

export const TYPING_UNITS = ['U1', 'U2', 'U3', 'U4', 'U5', 'U6'] as const;
export type TypingUnit = typeof TYPING_UNITS[number];

/** The units this build applies. Changed only by the package script after the verdict. */
export const ENABLED_TYPING_UNITS: ReadonlySet<TypingUnit> = new Set<TypingUnit>([]);

let override: ReadonlySet<TypingUnit> | null = null;

export function typingUnitEnabled(unit: TypingUnit): boolean {
  return (override ?? ENABLED_TYPING_UNITS).has(unit);
}

/** The unit set extraction uses right now (the test override, else ENABLED_TYPING_UNITS). */
export function activeTypingUnits(): TypingUnit[] {
  return TYPING_UNITS.filter(typingUnitEnabled);
}

export function parseTypingUnits(units: Iterable<string>): TypingUnit[] {
  const out: TypingUnit[] = [];
  for (const raw of units) {
    const u = raw.trim().toUpperCase();
    if (!u) continue;
    if (!(TYPING_UNITS as readonly string[]).includes(u)) {
      throw new Error(`Unknown typing unit "${raw}". The units are ${TYPING_UNITS.join(', ')} (src/core/link-typing-units.ts); pass a comma-separated subset.`);
    }
    if (!out.includes(u as TypingUnit)) out.push(u as TypingUnit);
  }
  return out;
}

/** Tests and development reports only: run extraction with `units` instead of ENABLED_TYPING_UNITS (null restores it). */
export function setTypingUnitsForTests(units: Iterable<string> | null): void {
  override = units === null ? null : new Set(parseTypingUnits(units));
}

/** Tests only: run `fn` with `units` enabled, then restore the previous set. */
export async function withTypingUnits<T>(units: Iterable<string>, fn: () => T | Promise<T>): Promise<T> {
  const previous = override;
  setTypingUnitsForTests(units);
  try {
    return await fn();
  } finally {
    override = previous;
  }
}
