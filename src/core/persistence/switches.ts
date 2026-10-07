/**
 * Kill switches for write-path behaviors, read from one per-process snapshot.
 *
 * Every switch is on by default. An environment variable overrides the brain
 * config key; `0` or `false` (either source) turns a switch off. The snapshot
 * reads every switch key in one statement and is reused for SWITCH_TTL_MS, so
 * `gbrain config set <key> false` reaches a running `serve` within that time
 * without a round trip per write. Config writes are trusted-local only (no
 * remote operation writes config), so a remote caller cannot flip a switch.
 */
import type { SqlEngine } from './model.ts';

export const WRITE_SWITCHES = {
  /** Phase 4.1/4.3/4.4: single page writes publish as a group of one, the own admission claims directly, publication reuses a warm connection. */
  single_write_group: { key: 'persistence.single_write_group', env: 'GBRAIN_SINGLE_WRITE_GROUP' },
  /** Phase 4.2: per-process cache of pre-admission reads that admission rechecks under lock. */
  preadmit_cache: { key: 'persistence.preadmit_cache', env: 'GBRAIN_PREADMIT_CACHE' },
  /** Batched waiver runs; `GBRAIN_SYNC_WAIVE_NOOP=0` wins over it. */
  waive_batch: { key: 'sync.waive_batch', env: 'GBRAIN_SYNC_WAIVE_BATCH' },
} as const;
export type WriteSwitch = keyof typeof WRITE_SWITCHES;
export type WriteSwitches = Record<WriteSwitch, boolean>;
export const WRITE_SWITCH_KEYS: readonly string[] = Object.values(WRITE_SWITCHES).map(s => s.key);
export const SWITCH_TTL_MS = 5000;

const off = (value: string | null | undefined) => typeof value === 'string' && /^(0|false)$/i.test(value.trim());
const on = (value: string | null | undefined) => typeof value === 'string' && /^(1|true)$/i.test(value.trim());
const snapshots = new WeakMap<object, { at: number; generation: number; read: Promise<WriteSwitches> }>();
let generation = 0;

function resolve(configured: Map<string, string>): WriteSwitches {
  const out = {} as WriteSwitches;
  for (const [name, { key, env }] of Object.entries(WRITE_SWITCHES) as Array<[WriteSwitch, { key: string; env: string }]>) {
    const fromEnv = process.env[env];
    out[name] = off(fromEnv) ? false : on(fromEnv) ? true : !off(configured.get(key));
  }
  return out;
}

/** A read-through view of an engine (preparation config, pre-admission cache) names its engine here, so it shares that engine's snapshot. */
export const VIEWED_ENGINE = Symbol('gbrain.viewedEngine');

/** The switch snapshot of `engine`'s brain, at most SWITCH_TTL_MS old. A failed read is not kept. */
export function readWriteSwitches(viewed: SqlEngine, now: () => number = Date.now): Promise<WriteSwitches> {
  const engine = (viewed as { [VIEWED_ENGINE]?: SqlEngine })[VIEWED_ENGINE] ?? viewed;
  const held = snapshots.get(engine);
  if (held && held.generation === generation && now() - held.at < SWITCH_TTL_MS) return held.read;
  const read = engine.executeRaw<{ key: string; value: string }>('SELECT key,value FROM config WHERE key = ANY($1::text[])', [WRITE_SWITCH_KEYS])
    .then(rows => resolve(new Map(rows.map(row => [row.key, row.value]))));
  snapshots.set(engine, { at: now(), generation, read });
  read.catch(() => { if (snapshots.get(engine)?.read === read) snapshots.delete(engine); });
  return read;
}

export async function writeSwitchOn(engine: SqlEngine, name: WriteSwitch): Promise<boolean> {
  return (await readWriteSwitches(engine))[name];
}

/** Test seam: the next read of every engine sees the current config. */
export function resetWriteSwitches(): void { generation++; }
