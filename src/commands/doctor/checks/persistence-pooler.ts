/**
 * persistence_pooler_transaction_mode (#6317): the resident consumer's own
 * database URL goes through a transaction-mode pooler. The reporter's wedge
 * reproduced with one process on Supavisor transaction mode (:6543): a
 * consumer round-trip (the expired-claims CTE) whose reply never came back,
 * backend `active` in `ClientRead`, the 5 s phase deadline firing without the
 * awaited promise settling; the same command on the session-mode URL (:5432)
 * drained cleanly. The engine already marks that URL (`prepare: false`, the
 * port-6543 convention db.ts `resolvePrepare` applies, or an explicit
 * `GBRAIN_PREPARE=false`); this check turns the mark into a finding for the
 * processes that hold claims (`serve`, `sync`, `jobs`), with the session-mode
 * URL as the operator's fix. Short-lived readers on the pooler are fine.
 * Reads nothing from the database: the mark is a connection option.
 */
import type { Check } from '../../doctor.ts';
import { connectedEngine, type DoctorContext, type DoctorEntry } from '../context.ts';

const DOCS = 'docs/guides/troubleshooting.md#persistence-pooler-transaction-mode';

async function runPersistencePoolerCheck(ctx: DoctorContext): Promise<Check[]> {
  const checks: Check[] = [];
  const engine = connectedEngine(ctx);
  if (engine.kind !== 'postgres') {
    checks.push({ name: 'persistence_pooler_transaction_mode', status: 'ok', severity: 'info', readiness_state: 'not_applicable', message: 'PGLite has no pooler.', details: { docs: DOCS } });
    return checks;
  }
  const diagnostics = (engine as { getPoolDiagnostics?: () => { prepare?: boolean | null; poolMax?: number | null } | null }).getPoolDiagnostics?.() ?? null;
  const url = (engine as { connectionManager?: { describeMode(): { mode: string; direct_host?: string } } | null }).connectionManager?.describeMode() ?? null;
  const details = { prepare: diagnostics?.prepare ?? null, pool_max: diagnostics?.poolMax ?? null, pool_mode: url?.mode ?? null, direct_host: url?.direct_host ?? null, docs: DOCS };
  if (diagnostics?.prepare !== false) {
    checks.push({ name: 'persistence_pooler_transaction_mode', status: 'ok', message: 'The ordinary pool runs with prepared statements (a session-mode pooler or a direct connection).', details });
    return checks;
  }
  checks.push({ name: 'persistence_pooler_transaction_mode', status: 'warn', readiness_state: 'degraded', details,
    message: 'The ordinary pool is on a transaction-mode pooler (prepared statements off: the port-6543 convention or GBRAIN_PREPARE=false). A resident write consumer (serve, sync, jobs) on it '
      + 'can lose a round-trip inside the pooler (backend active in ClientRead, the reply never arrives) and sit on one claim for as long as the process lives; the same catch-up on the session-mode URL drains.',
    fix: { argv: ['gbrain', 'sources', 'writer', 'status', '--json'], consent: [], actor: 'host_admin', requires_exclusive: false, docs: DOCS,
      why: 'Point the processes that hold write claims (serve, the sync CLI, the jobs worker) at the session-mode pooler URL (port 5432) or the direct URL through DATABASE_URL on their supervisor, then restart them; status then shows their backends by application_name.',
      user_message: 'Set DATABASE_URL for gbrain serve, gbrain sync and the jobs worker to the session-mode pooler URL (port 5432, same host) or the direct database URL, restart them, then run gbrain sources writer movement.',
      verify: { argv: ['gbrain', 'doctor', '--only', 'persistence_pooler_transaction_mode', '--json'] } } });
  return checks;
}

export const persistencePoolerEntry: DoctorEntry = { name: 'persistence_pooler_transaction_mode', emits: ['persistence_pooler_transaction_mode'], run: runPersistencePoolerCheck };
