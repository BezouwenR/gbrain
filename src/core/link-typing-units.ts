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

// ─── Typing hooks (link-extraction.ts) ──────────────────────────────────

/** A verb rule a unit adds. `id` is stable (`unit.u<N>.*`); it sits right after the core rule for the same verb. */
export interface UnitVerbRule { id: string; re: RegExp; verb: string; unit: TypingUnit; after: string }

/**
 * U1: the British `adviser` spelling and "advising [X]". A bare "adviser at [X]" is a job title ("financial adviser
 * at [Bank]") and stays employment; a qualified advisory title ("technical adviser at [X]") advises.
 */
const U1_ADVISER_RE = /\b(?:adviser (?:to|for|of)|(?:strategic|technical|security|product|industry|senior|board|startup|outside|special|go-to-market) adviser (?:to|at|for|of)|(?:is|was|as|became|becomes|serves as|served as|serving as|now|currently|signed on as|brought on as|joined as) an? (?:\w+ )?adviser\b(?! at)|board of advisers|(?:now|currently|is|was|been|started|began|begun|also|still) advising|advising (?=\[))/i;

export const UNIT_VERB_RULES: readonly UnitVerbRule[] = [
  { id: 'unit.u1.adviser', re: U1_ADVISER_RE, verb: 'advises', unit: 'U1', after: 'verb.advises' },
];

/** Negation right before an advisory phrase ("not an advisor to", "no longer advises", "stopped advising"). */
const U1_NEGATED_BEFORE = /\b(?:not|never|no\s+longer|nor|isn't|wasn't|aren't|hasn't|haven't|didn't|doesn't|stopped|ceased(?:\s+to\s+be)?|declined\s+to\s+(?:be|become)|turned\s+down\s+(?:being|becoming)?)\s+(?:(?:an?|the|her|his|their|any|longer|formally|officially|really|yet|be|been)\s+)*$/i;

/** The clause before `index`: back to a sentence, clause or timeline-entry break (at most 100 chars). */
export function clauseBefore(text: string, index: number): string {
  const w = text.slice(Math.max(0, index - 100), index);
  const cut = Math.max(...['. ', '; ', '! ', '? ', '\n', ' | ', ' — ', ' - **'].map(b => { const i = w.lastIndexOf(b); return i < 0 ? -1 : i + b.length; }));
  return cut >= 0 ? w.slice(cut) : w;
}

/** Someone other than the page's subject holds the role ("her husband is …", "a friend who …"). */
const THIRD_PARTY = /\b(?:husband|wife|spouse|boyfriend|girlfriend|fianc[eé]e?|brother|sister|mother|father|mom|dad|son|daughter|parent|friend|colleague|co-?worker|manager|boss|mentor|mentee|roommate|neighbou?r|cousin|uncle|aunt|classmate|former\s+colleague|whose|who|someone|somebody)\b/i;
export const thirdPartyBefore = (text: string, index: number) => THIRD_PARTY.test(clauseBefore(text, index));

export interface VetoInput {
  rule: { id: string; verb: string };
  context: string;
  /** Match offsets in `context`. */
  start: number;
  end: number;
}

/**
 * A unit's veto of one verb match, or null. A vetoed match does not decide the type; inference moves on to the next
 * match or rule. Returns the stable id of the veto (`unit.u<N>.*`).
 */
export function unitVerbVeto(v: VetoInput): string | null {
  if (v.rule.verb === 'advises' && typingUnitEnabled('U1')) {
    if (U1_NEGATED_BEFORE.test(v.context.slice(Math.max(0, v.start - 40), v.start))) return 'unit.u1.negated';
    if (v.rule.id === 'unit.u1.adviser' && thirdPartyBefore(v.context, v.start)) return 'unit.u1.third_party';
  }
  return null;
}

/** The unit a rule or veto id belongs to (`unit.u3.board_wording` → U3). */
export function unitOfRule(id: string | null | undefined): TypingUnit | null {
  const m = /^unit\.u(\d)\./.exec(id ?? '');
  return m ? (`U${m[1]}` as TypingUnit) : null;
}
