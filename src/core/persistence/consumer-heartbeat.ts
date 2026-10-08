/**
 * #6317 (B3): the per-process consumer heartbeat table, `persistence_consumers`.
 *
 * LANE 2 STUB. Lane 1 owns this module, its migration and the heartbeat
 * writer; this file carries only the read side lane 2 (the drain's
 * wedged-owner check and the movement reader) depends on, under the names
 * the plan fixes, so the integrator keeps lane 1's file and drops this one.
 * Every read answers null or an empty list when the table does not exist yet
 * (a brain older than the migration, PGLite without it), so no caller treats
 * a missing row as evidence of anything.
 *
 * One row per consumer-bearing process: `(host_id, pid, nonce)` identifies a
 * process across pid reuse and pid namespaces; `mode` says whether it claims
 * (`full`, `promoted`) or only waits (`probing`, `waiter_only`); `renewed_at`
 * is its liveness (live within 30 s, lapsed at 60 s); `restart_required` and
 * `root_barrier_age_ms` are the owner's own verdict on itself (a zombie at
 * the cap, an abandoned root barrier), from which `wedged` derives.
 */
import { randomUUID } from 'node:crypto';
import { readlinkSync } from 'node:fs';
import type { BrainEngine } from '../engine.ts';

export const CONSUMER_LIVE_MS = 30_000;
export const CONSUMER_LAPSED_MS = 60_000;
export const RESIDENT_CONSUMER_KINDS: readonly string[] = ['serve', 'sync', 'jobs', 'autopilot', 'mcp'];

export type ConsumerMode = 'probing' | 'full' | 'waiter_only' | 'promoted';
export interface ConsumerRow {
  host_id: string;
  pid: number;
  nonce: string;
  pid_ns: string | null;
  kind: string;
  mode: ConsumerMode;
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
export interface ConsumerIdentity { pid: number; nonce: string; pid_ns: string | null }

const NONCE = randomUUID();
let pidNamespace: string | null | undefined;
/** This process's identity for claim stamps and heartbeat rows: pid, a per-process nonce, and the pid namespace inode where readable. */
export function consumerIdentity(): ConsumerIdentity {
  if (pidNamespace === undefined) {
    try { pidNamespace = /pid:\[(\d+)\]/.exec(readlinkSync('/proc/self/ns/pid'))?.[1] ?? null; } catch { pidNamespace = null; }
  }
  return { pid: process.pid, nonce: NONCE, pid_ns: pidNamespace };
}

/** Whether `row` was renewed within the live window (`now` on this clock; renewed_at is the database's). */
export function consumerLive(row: Pick<ConsumerRow, 'renewed_at'>, now = Date.now()): boolean {
  const at = Date.parse(row.renewed_at);
  return Number.isFinite(at) && now - at <= CONSUMER_LIVE_MS;
}
/** A consumer whose own status says it stopped making progress: at the zombie cap, or holding a root barrier past the ceiling. */
export function consumerWedged(row: Pick<ConsumerRow, 'restart_required' | 'root_barrier_age_ms'>, ceilingMs: number): boolean {
  return row.restart_required || (row.root_barrier_age_ms !== null && row.root_barrier_age_ms > ceilingMs);
}

/** Every heartbeat row of `hostId`, newest renewal first; empty when the table is absent or the read fails. */
export async function listHostConsumers(engine: Pick<BrainEngine, 'executeRaw'>, hostId: string): Promise<ConsumerRow[]> {
  try {
    return await engine.executeRaw<ConsumerRow>(
      `SELECT host_id::text AS host_id, pid, nonce, pid_ns, kind, mode, started_at::text AS started_at, renewed_at::text AS renewed_at,
         restart_required, root_barrier_age_ms, pool, host_json_path, persistence_home, minted_under, version
       FROM persistence_consumers WHERE host_id = $1::uuid ORDER BY renewed_at DESC`, [hostId]);
  } catch {
    return [];
  }
}

/** The live, full, resident-kind, not-wedged row on `hostId` that is not `self`, or null (B1a's probe). */
export async function probeLiveFullConsumer(engine: Pick<BrainEngine, 'executeRaw'>, hostId: string, self: ConsumerIdentity, ceilingMs = 600_000): Promise<ConsumerRow | null> {
  const rows = await listHostConsumers(engine, hostId);
  return rows.find(row => (row.mode === 'full' || row.mode === 'promoted') && RESIDENT_CONSUMER_KINDS.includes(row.kind)
    && !(row.pid === self.pid && row.nonce === self.nonce) && consumerLive(row) && !consumerWedged(row, ceilingMs)) ?? null;
}
