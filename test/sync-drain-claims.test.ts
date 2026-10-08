/**
 * #6278 (B4): the drain's no-progress detector is claim-aware. Its fingerprint
 * keys on state, blocked reason, head id/state and the head claim's
 * phase/step/since, never on the lease columns every renewal bumps (before
 * this change a renewed-forever claim could never read as a stall, which is
 * how the reporter got the watchdog instead of `blocked` with `next`). A live
 * preparation is allowed its budget plus grace; a lapsed claim keeps the plain
 * window; a preparation this process's own consumer holds past its allowance
 * ends the drain `resumable` / `preparation_abandoned`; a tripped breaker ends
 * it `blocked` / `preparation_systemic`. The stall object and the timer line
 * name the step and wait cause.
 */
import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { randomUUID } from 'node:crypto';
import type { BrainEngine } from '../src/core/engine.ts';
import { PGLiteEngine } from '../src/core/pglite-engine.ts';
import { drainClaimOf, drainJsonFields, drainNext, engineStallProbe, formatDrainSummary, runDrain, STALL_GRACE_MS, syncOutcome, type DrainClaim, type StallProbe } from '../src/core/persistence/sync-drain.ts';
import { ERROR_CATALOGUE } from '../src/core/error-catalogue.ts';
import type { SyncResult } from '../src/commands/sync.ts';

const base: SyncResult = { status: 'synced', fromCommit: 'a', toCommit: 'b', added: 0, modified: 0, deleted: 0, renamed: 0, chunksCreated: 0, embedded: 0, pagesAffected: [] };
const pending = (index: number, requestId = '00000000-0000-0000-0000-000000000001', total = 10): SyncResult => ({ ...base, status: 'partial', reason: 'writer_pending', managedCursor: { index, total },
  managedWrite: { source_id: 's', slug: 'p', path: 'p.md', write_error: 'write_pending', reason: 'write_pending', message: 'm', suggestion: 's',
    write_request: { request_id: requestId, state: 'queued', retry_after_ms: 0 } as never } });
const done = (total = 10): SyncResult => ({ ...base, managedCursor: { index: total, total } });
const RESUME = 'gbrain sync --source s --no-pull';
const stall = { request_id: 'r', state: 'queued', blocked_reason: null, head_request_id: 'h', head_state: 'running', claimable_here: false, owner_is_this_host: true };
const claim = (over: Partial<DrainClaim> = {}): DrainClaim => ({ phase: 'preparing', step: 'origin_check', waiting_on: 'db', step_age_ms: 45_000, claim_age_ms: 50_000, lapsed: false,
  owner_pid: null, allowance_ms: 150_000, ...over });
const probeWith = (c: DrainClaim | null, key = 'same'): StallProbe => ({ blockedHead: async () => null, fingerprint: async () => ({ key, stall, claim: c }) });

describe('claim-aware no-progress window', () => {
  test('a healthy preparation longer than the 30 s window and shorter than its budget is not cut off', async () => {
    let passes = 0;
    const started = Date.now();
    const result = await runDrain({ pass: async () => (++passes < 12 ? pending(2) : done()), probe: probeWith(claim()), pauseMs: 5, stallMs: 20 });
    // Twelve passes over more than the 20 ms window: the plain rule would have stopped it as drain_stalled at the fourth pass.
    expect(Date.now() - started).toBeGreaterThanOrEqual(40);
    expect(result.drain).toMatchObject({ outcome: 'synced', passes: 12 });
  });

  test('a live preparation past its allowance, owned elsewhere, stops blocked as drain_stalled with cause, step and wait cause', async () => {
    const result = await runDrain({ pass: async () => pending(2), probe: probeWith(claim({ step_age_ms: 160_000, owner_pid: process.pid + 1 })), pauseMs: 1, stallMs: 20 });
    expect(result.drain).toMatchObject({ outcome: 'blocked', stop_reason: 'drain_stalled',
      stall: { cause: 'preparation_overdue', step: 'origin_check', waiting_on: 'db', phase: 'preparing', stalled_seconds: 160 } });
    const next = drainNext(result, RESUME, 's')!;
    expect(next).toMatchObject({ command: 'gbrain sources writer status s', safe_to_loop: false, docs: 'docs/guides/write-refusals.md#drain-stalled' });
    expect(next.why).toContain('stuck at step origin_check, waiting on db');
    expect(next.why).toContain('renewing the claim past the preparation budget');
    expect(formatDrainSummary(result, RESUME, 's').join('\n')).toContain('step=origin_check, waiting_on=db, cause=preparation_overdue');
  });

  test('a preparation this process owns past its allowance ends the drain resumable as preparation_abandoned (exit 0, safe to loop)', async () => {
    const result = await runDrain({ pass: async () => pending(2), probe: probeWith(claim({ step_age_ms: 200_000, owner_pid: process.pid })), pauseMs: 1, stallMs: 20 });
    expect(result.drain).toMatchObject({ outcome: 'resumable', stop_reason: 'preparation_abandoned', stall: { cause: 'preparation_overdue', step: 'origin_check' } });
    expect(syncOutcome(result)).toBe('resumable');
    const next = drainNext(result, RESUME, 's')!;
    expect(next).toMatchObject({ command: RESUME, safe_to_loop: true, docs: 'docs/guides/write-refusals.md#drain-preparation-abandoned' });
    expect(next.why).toContain('outran its budget in this process');
    expect(drainJsonFields(result, RESUME, 's')).toMatchObject({ outcome: 'resumable', next: { safe_to_loop: true } });
  });

  test('a lapsed claim (owner missing) keeps the plain window and names the cause; an unstamped head keeps today\'s rule', async () => {
    const lapsed = await runDrain({ pass: async () => pending(2), probe: probeWith(claim({ lapsed: true, step_age_ms: 5_000 })), pauseMs: 1, stallMs: 20 });
    expect(lapsed.drain).toMatchObject({ outcome: 'blocked', stop_reason: 'drain_stalled', stall: { cause: 'owner_missing', step: 'origin_check' } });
    expect(drainNext(lapsed, RESUME, 's')!.why).toContain('its claim lapsed');
    const unstamped = await runDrain({ pass: async () => pending(2), probe: probeWith(null), pauseMs: 1, stallMs: 20 });
    expect(unstamped.drain).toMatchObject({ outcome: 'blocked', stop_reason: 'drain_stalled', stall: { cause: 'no_progress', step: null } });
    expect(unstamped.drain!.passes).toBeGreaterThanOrEqual(4);
  });

  test('an overdue publication is detected separately from an overdue preparation', async () => {
    const result = await runDrain({ pass: async () => pending(2), probe: probeWith(claim({ phase: 'publishing', step: 'apply', step_age_ms: 400_000, owner_pid: process.pid })), pauseMs: 1, stallMs: 20 });
    expect(result.drain).toMatchObject({ outcome: 'blocked', stop_reason: 'drain_stalled', stall: { cause: 'publication_overdue', phase: 'publishing', step: 'apply' } });
  });

  test('a tripped breaker ends the drain blocked as preparation_systemic with writer status as the next command', async () => {
    const tripped: SyncResult = { ...base, status: 'blocked_by_failures', failedFiles: 1, failureCodes: [{ code: 'preparation_stalled', count: 5 }],
      breaker: { code: 'preparation_systemic', rule: 'consecutive', stalled: 5, consecutive: 5, step: 'knowledge_publication', request_id: 'r5',
        fix: { argv: ['gbrain', 'sources', 'writer', 'status', '--source', 's', '--json'], consent: [], actor: 'agent', requires_exclusive: false, why: 'w' } } };
    const result = await runDrain({ pass: async () => tripped, pauseMs: 1 });
    expect(result.drain).toMatchObject({ outcome: 'blocked', stop_reason: 'preparation_systemic' });
    expect(syncOutcome(result)).toBe('blocked');
    const next = drainNext(result, RESUME, 's')!;
    expect(next).toMatchObject({ command: 'gbrain sources writer status --source s --json', safe_to_loop: false, docs: 'docs/guides/write-refusals.md#preparation_systemic' });
    expect(next.why).toContain('5 writes of this sync could not finish preparing at step knowledge_publication (5 in a row');
    expect(ERROR_CATALOGUE.sync_drain_preparation_systemic.code).toBe('preparation_systemic');
    expect(ERROR_CATALOGUE.sync_drain_preparation_abandoned.code).toBe('preparation_abandoned');
  });
});

describe('drainClaimOf', () => {
  const budgets = { syncMs: 120_000, maintenanceMs: 120_000, ceilingMs: 600_000 };
  const now = Date.parse('2026-10-07T12:00:00Z');
  const stamp = (over: Record<string, unknown> = {}) => ({ phase: 'preparing', claimed_at: '2026-10-07T11:58:00Z', since: '2026-10-07T11:59:00Z', token: 't', ...over });

  test('reads this claim\'s stamp: phase, step, wait cause, ages, pid and the allowance from the head\'s budget plus grace', () => {
    const c = drainClaimOf({ head_state: 'running', head_claim_phase: stamp({ step: 'origin_check', waiting_on: 'pool', pid: 4242 }), head_token: 't', head_lapsed: false, head_kind: 'managed_sync_import' }, budgets, now);
    expect(c).toEqual({ phase: 'preparing', step: 'origin_check', waiting_on: 'pool', step_age_ms: 60_000, claim_age_ms: 120_000, lapsed: false, owner_pid: 4242, allowance_ms: 120_000 + STALL_GRACE_MS });
    expect(drainClaimOf({ head_state: 'running', head_claim_phase: JSON.stringify(stamp({ phase: 'publishing' })), head_token: 't', head_lapsed: false, head_kind: 'put_page' }, { ...budgets, maintenanceMs: 300_000 }, now))
      .toMatchObject({ phase: 'publishing', step: null, waiting_on: 'unknown', allowance_ms: 300_000 + STALL_GRACE_MS });
    // The ceiling caps the allowance.
    expect(drainClaimOf({ head_state: 'running', head_claim_phase: stamp(), head_token: 't', head_lapsed: false, head_kind: 'managed_sync_import' }, { ...budgets, ceilingMs: 60_000 }, now)!.allowance_ms).toBe(60_000 + STALL_GRACE_MS);
  });

  test('an older owner\'s stamp, a stamp of another claim, or no stamp read as null/unknown, never inferred; a lapsed lease is reported', () => {
    expect(drainClaimOf({ head_state: 'running', head_claim_phase: stamp({ token: 'other' }), head_token: 't', head_lapsed: false, head_kind: null }, budgets, now))
      .toMatchObject({ phase: null, step: null, waiting_on: null, step_age_ms: null, owner_pid: null, lapsed: false });
    expect(drainClaimOf({ head_state: 'running', head_claim_phase: null, head_token: 't', head_lapsed: true, head_kind: null }, budgets, now)).toMatchObject({ phase: null, lapsed: true });
    expect(drainClaimOf({ head_state: 'queued', head_claim_phase: stamp(), head_token: 't', head_lapsed: false, head_kind: null }, budgets, now)).toBeNull();
    expect(drainClaimOf({ head_state: 'running', head_claim_phase: stamp({ waiting_on: 'lock' }), head_token: 't', head_lapsed: false, head_kind: null }, budgets, now)!.waiting_on).toBe('unknown');
  });
});

describe('engineStallProbe fingerprint', () => {
  let engine: BrainEngine;
  beforeAll(async () => { const lite = new PGLiteEngine(); await lite.connect({}); await lite.initSchema(); engine = lite; }, 60_000);
  afterAll(async () => { await engine.disconnect(); });

  test('forced probe: lease renewals (updated_at, claim_expires_at) do not change the key; a step change does', async () => {
    const id = `probe-${randomUUID().slice(0, 8)}`;
    await engine.executeRaw("INSERT INTO sources(id,name,local_path,config) VALUES($1,$1,$2,'{}')", [id, `/tmp/${id}`]);
    const [wt] = await engine.executeRaw<{ id: string }>('INSERT INTO persistence_worktrees(owner_host_id) VALUES(gen_random_uuid()) RETURNING id::text AS id');
    const [src] = await engine.executeRaw<{ incarnation: string }>('SELECT incarnation::text AS incarnation FROM sources WHERE id=$1', [id]);
    const token = randomUUID(), requestId = randomUUID();
    const stampOf = (step: string) => JSON.stringify({ phase: 'preparing', claimed_at: new Date(Date.now() - 90_000).toISOString(), since: new Date(Date.now() - 60_000).toISOString(), token, step, waiting_on: 'db', pid: process.pid });
    const [row] = await engine.executeRaw<{ id: string }>(`INSERT INTO persistence_requests(principal_kind,principal_id,request_id,operation,source_id,source_incarnation,slug,worktree_id,digest,authority,intent,intent_bytes,terminal_reservation,
        state,execution_token,claim_expires_at,claim_phase)
      VALUES('local_cli','cli:example',$1::uuid,'submit_job',$2,$3::uuid,'notes/p',$4::uuid,'d','{}'::jsonb,'{"kind":"managed_sync_import","path":"notes/p.md"}'::jsonb,1,16384,'running',$5::uuid,now()+interval '30 seconds',$6::text::jsonb)
      RETURNING id::text AS id`, [requestId, id, src!.incarnation, wt!.id, token, stampOf('origin_check')]);
    const probe = engineStallProbe(engine);
    const result = pending(1, row!.id);
    const first = (await probe.fingerprint(result))!;
    expect(first.claim).toMatchObject({ phase: 'preparing', step: 'origin_check', waiting_on: 'db', lapsed: false, owner_pid: process.pid, allowance_ms: 120_000 + STALL_GRACE_MS });
    expect(first.claim!.step_age_ms).toBeGreaterThanOrEqual(59_000);
    // A renewal: the lease columns move, the key does not.
    await engine.executeRaw("UPDATE persistence_requests SET updated_at=now()+interval '1 second',claim_expires_at=now()+interval '40 seconds' WHERE id=$1::uuid", [row!.id]);
    expect((await probe.fingerprint(result))!.key).toBe(first.key);
    // The owner reaches the next step: the key changes.
    await engine.executeRaw('UPDATE persistence_requests SET claim_phase=$2::text::jsonb WHERE id=$1::uuid', [row!.id, stampOf('knowledge_publication')]);
    const second = (await probe.fingerprint(result))!;
    expect(second.key).not.toBe(first.key);
    expect(second.claim!.step).toBe('knowledge_publication');
    // The lease lapses: the claim reads lapsed and the key changes again.
    await engine.executeRaw("UPDATE persistence_requests SET claim_expires_at=now()-interval '1 second' WHERE id=$1::uuid", [row!.id]);
    const lapsed = (await probe.fingerprint(result))!;
    expect(lapsed.claim!.lapsed).toBe(true);
    expect(lapsed.key).not.toBe(second.key);
  });
});
