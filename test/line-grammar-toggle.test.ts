/**
 * Turning the line grammar on or off converges the graph: the setting and the
 * extraction generation commit together (core/line-grammar-config.ts), every
 * page extracted before the change reads as stale through the one watermark
 * (core/link-extraction-watermark.ts), managed extraction re-derives it, and
 * a page prepared under the old settings is never published as fresh.
 * Managed PGLite brain.
 */
import { expect, test } from 'bun:test';
import { randomUUID } from 'node:crypto';
import type { BrainEngine } from '../src/core/engine.ts';
import type { OperationContext } from '../src/core/ops/contract.ts';
import { submitPageMutation } from '../src/core/persistence/page-mutations.ts';
import { extractManagedStaleLinks } from '../src/core/persistence/links-maintenance.ts';
import { prepareAutomaticLinks } from '../src/core/persistence/links-preparation.ts';
import { applyLineGrammarConfigChange, describeLineGrammarChange, invalidLineGrammarValue, isInternalConfigKey } from '../src/core/line-grammar-config.ts';
import { effectiveLinkExtractorWatermark, laterInstant } from '../src/core/link-extraction-watermark.ts';
import { LINK_EXTRACTOR_VERSION_TS } from '../src/core/link-extraction.ts';
import { LINK_EXTRACTION_GENERATION_KEY } from '../src/core/line-grammar.ts';
import { managedBrain } from './helpers/managed-brain.ts';

const put = (ctx: OperationContext, slug: string, body: string, type = 'person') =>
  submitPageMutation(ctx, { operation: 'put_page', params: { slug, request_id: randomUUID(),
    content: `---\ntype: ${type}\ntitle: ${slug}\n---\n\n${body}\n` } }) as Promise<Record<string, any>>;

const aliceTypes = async (engine: BrainEngine) => (await engine.executeRaw<{ link_type: string }>(`SELECT DISTINCT l.link_type FROM links l
  JOIN pages f ON f.id=l.from_page_id JOIN pages t ON t.id=l.to_page_id
  WHERE f.slug='people/alice-example' AND t.slug='companies/acme-example' ORDER BY 1`)).map(r => r.link_type);

const stale = async (engine: BrainEngine) => engine.countStalePagesForExtraction({ versionTs: await effectiveLinkExtractorWatermark(engine) });

async function seed(engine: BrainEngine, ctx: OperationContext) {
  await put(ctx, 'companies/acme-example', 'Acme.', 'company');
  await put(ctx, 'people/alice-example', 'Alice builds things.\n\n- works_at [[companies/acme-example]]');
  await extractManagedStaleLinks(engine, { mentions: false });
}

test('enable then disable: each effective change re-extracts and the stated type follows the setting', async () => {
  await managedBrain(async ({ engine, ctx }) => {
    await seed(engine, ctx);
    expect(await aliceTypes(engine)).not.toContain('works_at');
    expect(await stale(engine)).toBe(0);

    const on = await applyLineGrammarConfigChange(engine, tx => tx.setConfig('line_grammar.enabled', 'true'));
    expect(on.changed).toBe(true);
    expect(await engine.getConfig(LINK_EXTRACTION_GENERATION_KEY)).toBe(on.generation);
    expect(await stale(engine)).toBeGreaterThanOrEqual(2);
    const described = await describeLineGrammarChange(engine, on);
    expect(described.lines.join('\n')).toContain('gbrain extract --stale');
    expect(described.json).toMatchObject({ changed: true, effective: { enabled: true } });
    await extractManagedStaleLinks(engine, { mentions: false });
    expect(await stale(engine)).toBe(0);
    expect(await aliceTypes(engine)).toContain('works_at');

    const off = await applyLineGrammarConfigChange(engine, tx => tx.setConfig('line_grammar.enabled', 'false'));
    expect(off.changed).toBe(true);
    expect(Date.parse(off.generation!)).toBeGreaterThanOrEqual(Date.parse(on.generation!));
    expect(await stale(engine)).toBeGreaterThanOrEqual(2);
    await extractManagedStaleLinks(engine, { mentions: false });
    expect(await stale(engine)).toBe(0);
    expect(await aliceTypes(engine)).not.toContain('works_at');
  });
}, 180_000);

test('no-op changes keep the generation: repeated settings, spellings, unset to the same default, subordinate keys while off', async () => {
  await managedBrain(async ({ engine, ctx }) => {
    await seed(engine, ctx);
    for (const mutate of [
      (tx: BrainEngine) => tx.setConfig('line_grammar.enabled', 'false'),
      (tx: BrainEngine) => tx.setConfig('line_grammar.enabled', 'off'),
      async (tx: BrainEngine) => { await tx.unsetConfig('line_grammar.enabled'); },
      (tx: BrainEngine) => tx.setConfig('line_grammar.effective_ranges', 'false'),
      (tx: BrainEngine) => tx.setConfig('line_grammar.allow_undeclared_types', 'true'),
    ]) {
      const change = await applyLineGrammarConfigChange(engine, mutate);
      expect(change.changed).toBe(false);
    }
    expect(await engine.getConfig(LINK_EXTRACTION_GENERATION_KEY)).toBeNull();
    expect(await stale(engine)).toBe(0);
  });
}, 120_000);

test('a page prepared before a change is not published or stamped fresh after it', async () => {
  await managedBrain(async ({ engine, ctx }) => {
    await seed(engine, ctx);
    const snapshot = await engine.readPageSnapshot('people/alice-example', { sourceId: 'default' });
    const prepared = await prepareAutomaticLinks(engine, 'people/alice-example', snapshot!.page, 'default');
    expect(prepared.settings?.enabled).toBe(false);
    await applyLineGrammarConfigChange(engine, tx => tx.setConfig('line_grammar.enabled', 'true'));
    const written = await engine.transaction(tx => prepared.apply(tx));
    expect(written.errors).toBe(1);
    expect(await stale(engine)).toBeGreaterThanOrEqual(2);
    await extractManagedStaleLinks(engine, { mentions: false });
    expect(await aliceTypes(engine)).toContain('works_at');
  });
}, 120_000);

test('validation and internal keys', () => {
  expect(invalidLineGrammarValue('line_grammar.enabled', 'tru')).toContain('true or false');
  for (const v of ['true', 'false', 'on', 'off', '1', '0', 'yes', 'no', ' TRUE ']) expect(invalidLineGrammarValue('line_grammar.enabled', v)).toBeNull();
  expect(isInternalConfigKey(LINK_EXTRACTION_GENERATION_KEY)).toBe(true);
  expect(isInternalConfigKey('line_grammar.enabled')).toBe(false);
});

test('watermark arithmetic keeps microseconds and never moves before the code watermark', () => {
  expect(laterInstant(LINK_EXTRACTOR_VERSION_TS, null)).toBe(LINK_EXTRACTOR_VERSION_TS);
  expect(laterInstant(LINK_EXTRACTOR_VERSION_TS, '2001-01-01T00:00:00Z')).toBe(LINK_EXTRACTOR_VERSION_TS);
  expect(laterInstant('2030-01-01T00:00:00.000100Z', '2030-01-01T00:00:00.000200Z')).toBe('2030-01-01T00:00:00.000200Z');
  expect(laterInstant('2030-01-01T00:00:00.000300Z', '2030-01-01T00:00:00.000200Z')).toBe('2030-01-01T00:00:00.000300Z');
  expect(laterInstant('2030-01-01T00:00:00Z', 'not a date')).toBe('2030-01-01T00:00:00Z');
});
