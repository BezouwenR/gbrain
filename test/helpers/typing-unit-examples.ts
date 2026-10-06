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

export const EXAMPLES: TypingExample[] = [];
