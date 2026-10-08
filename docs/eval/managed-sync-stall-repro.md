# Managed-sync preparation stall: Phase 0 reproduction record (#6278)

Phase 0 of the #6278 plan (`docs/plans/2026-10-07-001-fix-managed-sync-preparation-stall-plan.md`)
asked for a reproduction of the reporter's stall (one write in `running` /
claim phase `preparing` for 700 s while its owner renews the lease, the
sync making no progress until the non-TTY watchdog kills it) on a 16-vCPU
Ubicloud VM behind a transaction-mode pooler, and for the name of the await
that hangs. This page records what ran, what stalled, and what did not. The
script is `scripts/bench/managed-sync-stall-repro.ts` (opt-in, never in CI);
`scripts/bench/stall-repro-vm-setup.sh` bootstraps a VM, and
`scripts/bench/stall-debug-instrument.py` installs a debug-only SIGUSR2 dump
of every preparation in flight (its current step and age) into a checkout
under test. Captures live under `.context/bench/stall-run*/` on the VM;
every number below comes from those captures.

## Verdict

- **The reporter's stall did not reproduce naturally** in 2 × 100 minutes on
  v0.60.105.0 (8e11aa1f) with PgBouncer in transaction mode, 57 ms injected
  round trip, pool sizes 10 and 3, the 15k-page fixture, fence defects seeded
  as the reporter saw them and fact-adoption writes landing every two
  minutes. No request sat in `preparing` for more than one sample (30 s).
  Cause unproven on this topology.
- **What does reproduce the exact signature is a server-side wait with no
  statement timeout.** Through the pooler, gbrain's `statement_timeout` and
  `idle_in_transaction_session_timeout` startup parameters are dropped
  (`SHOW statement_timeout` = `0` via the pooler, `5min` direct). A
  transaction-mode pooler either refuses those startup parameters (stock
  PgBouncer, see `engine-graduation.ts`) or is configured to ignore them,
  and an ignored parameter is a dropped one; whether Supavisor drops them is
  exactly what the 0.1 `SHOW statement_timeout` ask to the reporter answers. Preparation reads run outside
  the publication transaction, so none of the per-transaction
  `set_config('statement_timeout', '5s')` guards cover them. A forced probe
  that holds `LOCK TABLE pages IN ACCESS EXCLUSIVE MODE` in an open
  transaction through the pooler produces, on 0.60.105 and on the GBRA-45
  head alike: `managed_sync_import` members in `running` / `preparing` for as
  long as the lock is held (240 s and 200 s tested, no upper bound), the
  claim renewed every 10 s (`since_update_ms` 0.2–7 s, `claim_lapsed` false),
  `pg_stat_activity` showing the sync's connections in
  `wait_event_type = Lock` / `relation`, zero committed pages, and the
  moment the lock lifts everything resumes. The hanging await is
  `assertSyncPageOrigin` in `prepareManagedSyncMutation` (step
  `page_origin`): `SELECT id,slug,source_path FROM pages WHERE source_id=$1
  AND source_path=ANY($2::text[])`, which is simply the first `pages` read
  after the lock appeared; any other preparation read would block the same
  way. What held or queued such a lock in the reporter's environment is not
  known (candidates: a schema migration's `ALTER TABLE` queued behind a long
  publication, which blocks every later reader until it runs; the reporter
  upgraded 0.60.99 → 0.60.105 during the incident).
- **A second zero-progress mode did reproduce on 0.60.105, and it is not a
  stuck preparation:** when `extract_facts` has hundreds of legacy rows to
  adopt, its adoption submissions time out their short receipt wait
  ("The write is accepted and is still pending") and leave ~200
  `managed_maintenance_adopt_fact_fence` requests queued on the worktree
  root ahead of the sync's single admitted import. Each adoption publishes
  in 5–20 s at 57 ms, so the sync committed nothing for 888 s (pool 10) and
  668 s (pool 3) while every running request kept changing. `writer status`
  shows a different `running` request every sample. The GBRA-45 head drains
  the same load at 57–126 pages/min and finished the 15k backlog in three
  passes.
- **A dark connection does not give the reporter's signature.** With a
  toxiproxy `timeout` toxic (responses never arrive, connection stays open)
  on half the connections, the consumer's own tick hangs in `refresh_roots`
  (its 5 s phase deadline fires but the abort never reaches the socket), one
  connection stays `idle in transaction` on `begin` for 397 s, nothing holds
  a claim, and the process has to be killed. Zero progress, but no
  `preparing` blocker.

## Phase 0.5: which request fails with `repeated_marker`

Every `repeated_marker` refusal at preparation came from
`managed_maintenance_adopt_fact_fence` (operation `submit_job`) on a page
whose stored body already carries two facts fences in its timeline; the
adoption's `planFence` parses only the first fence (`parseFactsFence` reports
no warning for the second), so the write is submitted and
`compileCanonicalProjections` refuses it. On the head run that was 471
refusals for 20 marker pages over 24 adoption runs, plus 276 "The adopted
fence row does not render its legacy fact." refusals for 12 pages carrying
one of the four non-round-tripping shapes (trailing whitespace, leading
whitespace, whitespace-only, CRLF). A `managed_sync_import` member whose
file carries the same defect never reached preparation: the managed screen
held it before admission (20 `invalid_fence` / `repeated_marker` holds, one
per backlog marker page, `sync-hold-summary.fences = 20`). So Phase 2.6
(scan maintenance writes before submission) is the fix for the reporter's
two refusals if their pages were adoption targets, and the `prepare_time`
hold path is not what produced them.

## Runs

16-vCPU `standard-16` Ubicloud VMs (`UBI_OWNER=gbra59`), pgvector/pg16 in
Docker, PgBouncer 1.26 transaction mode (`IGNORE_STARTUP_PARAMETERS` includes
`statement_timeout`), toxiproxy with 57 ms round trip in front of the
pooler, `GBRAIN_PREPARE=false`, `timeout 3600 gbrain sync --source bench
--no-pull --no-embed` in a non-TTY (stdout/stderr piped). Fixture: 1,500
history pages imported in classic mode, 15,000 backlog pages committed after
activation, 20 history entity pages and 20 backlog pages with a repeated
facts-fence marker in the timeline, legacy `row_num IS NULL` facts seeded
before activation. "Heavy" adoption: 1,000 legacy rows over 250 pages, 12
doomed pages, `gbrain dream --phase extract_facts` every 60 s with 20 rows
dripped before each run. "Light" (the reporter's scale, nine refusals per
pass): 60 rows over 15 pages, 9 doomed, every 120 s, 6 rows dripped.

| run | gbrain | pool | adoption load | pass 1 (3600 s) | pages/min | longest window with no committed page | `preparing` blocker > 30 s |
|---|---|---|---|---|---|---|---|
| A heavy | 0.60.105.0 | 10 | heavy | 102 pages in 48 min, then stopped | 2.6 → 16 → 0 | 888 s (queued adoptions ahead of the sync) | none |
| C heavy | 0.60.105.0 | 3 | heavy | 62 pages in 44 min, then stopped | 1.4 → 0 | 668 s (same) | none |
| A light | 0.60.105.0 | 10 | light | 964 | 16.1 (pass 2: 647 in 45 min) | 63 s | none |
| C light | 0.60.105.0 | 3 | light | 256 | 4.3 (pass 2: 186 in 45 min) | 0 s | none |
| B heavy | head (d99e2b43) | 10 | heavy | 3,900; pass 2: 7,538; pass 3: 3,542 → synced | 65 / 126 / 75 | 285 s (tail: 20 holds written behind adoption writes) | none |
| D heavy | head (d99e2b43) | 3 | heavy | 3,425; pass 2: 4,747 | 57 / 79 | 33 s | none |

Throughput note: 0.60.105 at 57 ms publishes one page every ~4 s (16/min)
when nothing else runs on the root and 2.6/min while an adoption run
interleaves one write at a time, which brackets the reporter's 7–19/min.
The adoption pass itself is the difference: the first `extract_facts` run
on 1,000 legacy rows took longer than 20 minutes on every build (killed by
the harness), because each page's adoption waits for its receipt at
~5–20 s per write.

## Forced probes (local 4-core machine, PgBouncer, 20 ms round trip, 600-page backlog)

| probe | gbrain | what the sync did | step in flight (SIGUSR2 dump) | `pg_stat_activity` | renewals |
|---|---|---|---|---|---|
| `--chaos-kind lock` (hold `LOCK TABLE pages IN ACCESS EXCLUSIVE MODE` via the pooler, 240 s) | 0.60.105.0 | 1 `managed_sync_import` `preparing` 23 → 240 s, 0 pages committed, resumed within 15 s of release | `page_origin` for the whole hold (`steps`: dispatch, sync_active@0, authority@22, binding@65, source_path@110, knowledge_guard@153, git_rev_parse@196, page_origin@215 ms) | 2 sync connections `active`, `Lock`/`relation`, blocked by the holder (`idle in transaction`); a `dream` connection joins the queue | every 10 s, `since_update_ms` ≤ 7 s |
| same, 200 s | head (GBRA-45) | 25 lane members `preparing` for the hold, 345 → 345 pages | `page_origin` on every member | 11 lock waiters | same |
| `--chaos-kind timeout --chaos-toxicity 0.5` (responses never arrive on half the connections) | 0.60.105.0 | 0 pages after the toxic; consumer tick stuck in `refresh_roots` (`deadline_exceeded: true`, abort never completes); one connection `idle in transaction` on `begin` for 397 s; killed after 6 min | no preparation in flight | sync connections idle; one idle in transaction | no claim held |

Rerun the lock probe on any checkout:

```bash
bun scripts/bench/managed-sync-stall-repro.ts --cli-repo <checkout> --files 600 --history 100 \
  --legacy-facts 30 --marker-pages 3 --doomed-pages 3 --backlog-marker-pages 3 --rtt 20 \
  --passes 1 --sample-seconds 15 --stall-minutes 1 --stall-signal SIGUSR2 \
  --chaos-at 1 --chaos-kind lock --chaos-for 240 --out .context/bench/stall-lock
# with the step dump: python3 scripts/bench/stall-debug-instrument.py <checkout> first (debug only; git checkout -- src undoes it)
```

The reporter-shape run on a VM:

```bash
UBI_OWNER=gbra59 scripts/ubicloud/ubi-runner.sh run -s standard-16 --setup scripts/bench/stall-repro-vm-setup.sh \
  --env RELEASE_COMMIT=8e11aa1f -- 'bun scripts/bench/managed-sync-stall-repro.ts --cli-repo ../gbrain-release \
  --files 15000 --history 1500 --legacy-facts 60 --marker-pages 6 --doomed-pages 9 --drip-rows 6 --backlog-marker-pages 20 \
  --rtt 57 --pool-size 10 --max-minutes 170 --passes 3 --adoption-interval 120 --stall-signal SIGUSR2 --out .context/bench/stall-run'
```

## What this rules in and out for the plan

- Pool starvation (0.3 candidate 1): not observed on either build at pool 10
  or pool 3; renewals and preparations share the ordinary pool on the group
  path and the renewals always got through.
- Git or filesystem wait: `git_rev_parse` took under 50 ms in every dump;
  synchronous and bounded, as the plan's claim 2 says.
- A JS promise that never settles (`transactionMemo`,
  `sharedSyncValidation`, `MaintenanceWriteWait`, `preparationReads`): every
  stuck preparation observed had a database statement in flight on the
  server side; no in-process wait without a server-side counterpart was
  seen.
- A Postgres wait that `statement_timeout` does not break (0.3 candidate 2):
  reproduced on demand, and the pooler is why the timeout is absent. This is
  the one candidate that matches all of the reporter's evidence (phase
  `preparing`, lease renewed, `resumes_on_its_own: false`, several minutes,
  survives until the process dies and recurs on the next pass if the lock
  holder is still there). The cause-specific fix the plan reserves for 1.4
  is therefore a transaction-local or per-statement timeout on preparation
  reads (`set_config('statement_timeout', …, true)` inside a transaction, or
  the cancellation the Phase 1 deadline already adds), not a pool cap.
- The adoption-flood starvation is a separate 0.60.105 behaviour the plan's
  Phase 2 (fewer doomed adoptions) and GBRA-45's throughput work both shrink;
  it needs its own note on the issue because the reporter's `queued=73`
  could be either the sync's own admitted window or queued adoptions, and
  `writer status` does not say which without `intent->>'kind'`.
