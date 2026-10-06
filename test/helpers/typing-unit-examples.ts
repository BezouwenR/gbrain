/**
 * Frozen per-example expectations for the relationship-phrasing typing units (src/core/link-typing-units.ts).
 *
 * Each example states the type set, tense, dated transitions and live/as-of result explainLinkType must give with
 * its unit off (`off`, master behavior) and on (`on`). `on` may depend on the other units in the set (joint effects).
 * Controls (negation, third party, concurrent roles, rejoins, repeated targets, window truncation, event look-alikes)
 * are examples whose `on` equals `off` or whose unit is null. Development text only; names are placeholders.
 */
import { explainLinkType } from '../../src/core/link-extraction.ts';
import { stintCovers } from '../../src/core/link-validity.ts';
import type { TypingUnit } from '../../src/core/link-typing-units.ts';

export interface Expectation {
  /** Distinct types the page emits for the target (sorted; `mentions` rows included). */
  types: string[];
  /** Tense per temporal type, when asserted. */
  tense?: Record<string, 'past' | 'present'>;
  /** Dated transitions for the target: `${type} ${kind} ${date}`, in order. */
  transitions?: string[];
  /** Whether `type` is valid on each date (as-of), with 'today' = 2026-10-06. */
  live?: { type: string; at: Record<string, boolean> };
}

export interface TypingExample {
  id: string;
  /** The unit this example measures, or null for a control that no unit may change. */
  unit: TypingUnit | null;
  target: string;
  content: string;
  pageType?: 'person' | 'company' | 'concept';
  off: Expectation;
  on?: Expectation | ((units: ReadonlySet<TypingUnit>) => Expectation);
}

export const ACME = 'companies/acme-example';
export const BETA = 'companies/beta-example';
export const GLOBEX = 'companies/globex-example';
export const SLUG = 'people/alice-example';
export const L = (slug: string) => `[${slug.split('/')[1]!.replace(/-example$/, '').replace(/^\w/, c => c.toUpperCase())}](../${slug}.md)`;
export const page = (prose: string, timeline: string[] = []) =>
  timeline.length ? `${prose}\n\n## Timeline\n\n${timeline.map(l => `- ${l}`).join('\n')}\n` : `${prose}\n`;

export function expected(ex: TypingExample, units: ReadonlySet<TypingUnit>): Expectation {
  if (!ex.unit || !ex.on || !units.has(ex.unit)) return ex.off;
  return typeof ex.on === 'function' ? ex.on(units) : ex.on;
}

/** What explainLinkType actually gives, in the Expectation shape (only the fields `want` asks for). */
export async function observe(ex: TypingExample, want: Expectation): Promise<Expectation> {
  const e = await explainLinkType({ slug: SLUG, content: ex.content, pageType: ex.pageType ?? 'person', target: ex.target });
  const got: Expectation = { types: e.types };
  if (want.tense) got.tense = e.tense;
  if (want.transitions) got.transitions = e.transitions.map(t => `${t.link_type} ${t.kind} ${t.occurred_on}`);
  if (want.live) {
    const stints = e.stints[want.live.type] ?? [];
    got.live = { type: want.live.type, at: Object.fromEntries(Object.keys(want.live.at).map(d =>
      [d, stints.some(s => stintCovers(s, d === 'today' ? '2026-10-06' : d))])) };
  }
  return got;
}

// ─── U1: adviser wording, with local negation ───────────────────────────
const U1: TypingExample[] = [
  { id: 'u1-is-an-adviser-to', unit: 'U1', target: ACME, content: page(`Alice is an adviser to ${L(ACME)}.`),
    off: { types: ['mentions'] }, on: { types: ['advises'], tense: { advises: 'present' }, live: { type: 'advises', at: { today: true } } } },
  { id: 'u1-serves-as-adviser', unit: 'U1', target: ACME, content: page(`Alice serves as an adviser to ${L(ACME)} on hiring.`),
    off: { types: ['mentions'] }, on: { types: ['advises'] } },
  { id: 'u1-now-advising', unit: 'U1', target: ACME, content: page(`Alice is now advising ${L(ACME)} on pricing.`),
    off: { types: ['mentions'] }, on: { types: ['advises'] } },
  { id: 'u1-advising-link', unit: 'U1', target: ACME, content: page(`Alice works at ${L(BETA)}.`, [`**2025-02-03** | note — Advising ${L(ACME)} on its launch`]),
    off: { types: ['mentions'] }, on: { types: ['advises'] } },
  { id: 'u1-technical-adviser-at', unit: 'U1', target: ACME, content: page(`Alice is a technical adviser at ${L(ACME)}.`),
    off: { types: ['mentions'] }, on: { types: ['advises'] } },
  { id: 'u1-job-title-financial-adviser-at', unit: 'U1', target: ACME, content: page(`Alice is a financial adviser at ${L(ACME)}.`),
    off: { types: ['mentions'] }, on: { types: ['mentions'] } },
  { id: 'u1-negated-not-an-advisor', unit: 'U1', target: ACME, content: page(`Alice is not an advisor to ${L(ACME)}.`),
    off: { types: ['advises'], tense: { advises: 'present' } }, on: { types: ['mentions'] } },
  { id: 'u1-negated-no-longer-advises', unit: 'U1', target: ACME, content: page(`Alice no longer advises ${L(ACME)}.`),
    off: { types: ['advises'], tense: { advises: 'past' }, live: { type: 'advises', at: { today: false } } }, on: { types: ['mentions'] } },
  { id: 'u1-negated-not-an-adviser', unit: 'U1', target: ACME, content: page(`Alice is not an adviser to ${L(ACME)}.`),
    off: { types: ['mentions'] }, on: { types: ['mentions'] } },
  { id: 'u1-stopped-advising', unit: 'U1', target: ACME, content: page(`Alice stopped advising ${L(ACME)} last year.`),
    off: { types: ['mentions'] }, on: { types: ['mentions'] } },
  { id: 'u1-third-party-adviser', unit: 'U1', target: ACME, content: page(`Alice's husband is an adviser to ${L(ACME)}.`),
    off: { types: ['mentions'] }, on: { types: ['mentions'] } },
  { id: 'u1-third-party-friend-advising', unit: 'U1', target: ACME, content: page(`Alice introduced a friend who is now advising ${L(ACME)}.`),
    off: { types: ['mentions'] }, on: { types: ['mentions'] } },
  { id: 'u1-concurrent-role', unit: 'U1', target: ACME, content: page(`Alice works at ${L(BETA)} and is an adviser to ${L(ACME)}.`),
    off: { types: ['mentions'] }, on: { types: ['advises'] } },
  { id: 'u1-concurrent-role-employer-kept', unit: null, target: BETA, content: page(`Alice works at ${L(BETA)} and is an adviser to ${L(ACME)}.`),
    off: { types: ['works_at'], tense: { works_at: 'present' } } },
  { id: 'u1-dated-start', unit: 'U1', target: ACME,
    content: page(`Alice works at ${L(BETA)}. She is an adviser to ${L(ACME)}.`, [`**2024-05-06** | note — Began advising ${L(ACME)}`]),
    off: { types: ['mentions'], transitions: [] },
    on: { types: ['advises'], transitions: ['advises start 2024-05-06'], live: { type: 'advises', at: { '2024-01-01': false, today: true } } } },
  { id: 'u1-employer-not-closed-by-advising-line', unit: null, target: BETA,
    content: page(`Alice works at ${L(BETA)} as CTO.`, [`**2019-01-02** | linkedin — Joined ${L(BETA)} as CTO`, `**2024-05-06** | note — Now advising ${L(ACME)}`]),
    off: { types: ['mentions', 'works_at'], transitions: ['works_at start 2019-01-02'], live: { type: 'works_at', at: { today: true } } } },
];

export const EXAMPLES: TypingExample[] = [...U1];
