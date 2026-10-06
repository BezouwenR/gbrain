/** scripts/q2-typing-package.ts: the one-line rewrite of ENABLED_TYPING_UNITS and the branch names. */
import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { packageBranchName, withEnabledUnits } from '../scripts/q2-typing-package.ts';
import { TYPING_UNITS, parseTypingUnits, withTypingUnits } from '../src/core/link-typing-units.ts';
import { EXAMPLES, expected, observe } from './helpers/typing-unit-examples.ts';

const source = readFileSync(join(import.meta.dir, '../src/core/link-typing-units.ts'), 'utf8');

test('the package commit changes exactly the ENABLED_TYPING_UNITS line, in the given order', () => {
  const next = withEnabledUnits(source, ['U2', 'U1', 'U5']);
  const changed = next.split('\n').filter((line, i) => line !== source.split('\n')[i]);
  expect(changed).toEqual([`export const ENABLED_TYPING_UNITS: ReadonlySet<TypingUnit> = new Set<TypingUnit>(['U2', 'U1', 'U5']);`]);
  expect(withEnabledUnits(next, [])).toBe(source);
});

test('a joint unit expands in place and branch names say what the ref holds', () => {
  expect(parseTypingUnits(['U2', 'U34'])).toEqual(['U2', 'U3', 'U4']);
  expect(packageBranchName('abc123def', ['U2', 'U3', 'U4'], false)).toBe('q2-typing/abc123def/U2-U3-U4');
  expect(packageBranchName('abc123def', ['U3', 'U4'], true)).toBe('q2-typing/abc123def/arm-U3U4');
  expect(packageBranchName('abc123def', [], false)).toBe('q2-typing/abc123def/none');
});

test('a units file without the declaration is refused with what to restore', () => {
  expect(() => withEnabledUnits('export const X = 1;', ['U1'])).toThrow(/has no "export const ENABLED_TYPING_UNITS/);
});

test('the amended family {U1, U25, U34, U6} expands to all six units and its package passes the frozen examples', async () => {
  const units = parseTypingUnits(['U1', 'U25', 'U34', 'U6']);
  expect(units).toEqual(['U1', 'U2', 'U5', 'U3', 'U4', 'U6']);
  expect([...units].sort()).toEqual([...TYPING_UNITS]);
  expect(withEnabledUnits(source, units)).toContain(`new Set<TypingUnit>(['U1', 'U2', 'U5', 'U3', 'U4', 'U6'])`);
  expect(packageBranchName('abc123def', parseTypingUnits(['U25']), true)).toBe('q2-typing/abc123def/arm-U2U5');
  await withTypingUnits(units, async () => {
    for (const ex of EXAMPLES) {
      const want = expected(ex, new Set(units));
      expect({ id: ex.id, ...(await observe(ex, want)) }).toEqual({ id: ex.id, ...want });
    }
  });
});
