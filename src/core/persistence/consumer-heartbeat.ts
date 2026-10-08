/**
 * Consumer heartbeat rows (#6317 B3): one row per process that holds a
 * persistence consumer, in `persistence_consumers`, keyed by
 * `(host_id, pid, nonce)` so a reused pid is a new row.
 *
 * LANE 3 STUB. Lane 1 owns this module (the migration, the heartbeat timer
 * and the full probe rules). Lane 3 (serve-delegated managed sync) needs only
 * the probe and the process identity, with the agreed signatures, so it can
 * build and test against them; the integrator replaces this file with lane
 * 1's module. The probe below reads the agreed columns and answers `null`
 * when the table does not exist yet (a probe the database cannot answer
 * falls back to today's behaviour).
 */

import { randomUUID } from 'node:crypto';
import type { BrainEngine } from '../engine.ts';
import { readPidNs } from '../pglite-lock.ts';

/** The resident kinds that may own a host's writes (B1 scope). */
export const RESIDENT_CONSUMER_KINDS = new Set(['serve', 'sync', 'jobs', 'autopilot', 'mcp']);
/** A row renewed within this many ms is live (leases are 30 s, renewed every 10 s). */
export const CONSUMER_LIVE_MS = 30_000;

export interface ConsumerIdentity { pid: number; nonce: string; pid_ns: string | null }

export interface ConsumerRow {
  host_id: string;
  pid: number;
  nonce: string;
  pid_ns: string | null;
  kind: string;
  mode: 'probing' | 'full' | 'waiter_only' | 'promoted';
  started_at: string;
  renewed_at: string;
  restart_required: boolean;
  root_barrier_age_ms: number | null;
  pool: { checked_out: number; max: number; waiters: number } | null;
  host_json_path: string | null;
  persistence_home: string | null;
  minted_under: Record<string, unknown> | null;
  version: string | null;
}

const nonce = randomUUID();

/** This process's identity in the stamp and the row: pid alone is not identity across pid namespaces or reuse. */
export function consumerIdentity(): ConsumerIdentity {
  return { pid: process.pid, nonce, pid_ns: readPidNs() };
}

const ROW_COLUMNS = 'host_id,pid,nonce,pid_ns,kind,mode,started_at,renewed_at,restart_required,root_barrier_age_ms,pool,host_json_path,persistence_home,minted_under,version';

function missingTable(error: unknown): boolean {
  const code = (error as { code?: unknown })?.code;
  const message = error instanceof Error ? error.message : String(error);
  return code === '42P01' || /persistence_consumers.*does not exist|no such table/i.test(message);
}

/** Every heartbeat row of one host, newest renewal first; empty when the table is absent. */
export async function listHostConsumers(engine: Pick<BrainEngine, 'executeRaw'>, hostId: string): Promise<ConsumerRow[]> {
  try {
    return await engine.executeRaw<ConsumerRow>(`SELECT ${ROW_COLUMNS} FROM persistence_consumers WHERE host_id=$1 ORDER BY renewed_at DESC`, [hostId]);
  } catch (error) {
    if (missingTable(error)) return [];
    throw error;
  }
}

/**
 * The live full resident consumer of this host that is not this process: renewed within
 * `CONSUMER_LIVE_MS`, mode `full`, a resident kind, not `restart_required`, and not wedged
 * (no root barrier older than the preparation ceiling). Null when none, or when the
 * table does not exist yet.
 */
export async function probeLiveFullConsumer(engine: Pick<BrainEngine, 'executeRaw'>, hostId: string, self: ConsumerIdentity,
  opts: { now?: number; ceilingMs?: number } = {}): Promise<ConsumerRow | null> {
  const now = opts.now ?? Date.now();
  const ceilingMs = opts.ceilingMs ?? 600_000;
  const rows = await listHostConsumers(engine, hostId);
  for (const row of rows) {
    if (row.pid === self.pid && row.nonce === self.nonce) continue;
    if (row.mode !== 'full' || !RESIDENT_CONSUMER_KINDS.has(row.kind) || row.restart_required) continue;
    if (now - new Date(row.renewed_at).getTime() > CONSUMER_LIVE_MS) continue;
    if (row.root_barrier_age_ms !== null && row.root_barrier_age_ms > ceilingMs) continue;
    return row;
  }
  return null;
}

/** Lane 1 owns the heartbeat; the stub starts nothing and stops at once. */
export function startConsumerHeartbeat(_engine: Pick<BrainEngine, 'executeRaw'>, _row: Partial<ConsumerRow>, _opts: { intervalMs?: number } = {}): { stop(): Promise<void> } {
  return { stop: async () => {} };
}
