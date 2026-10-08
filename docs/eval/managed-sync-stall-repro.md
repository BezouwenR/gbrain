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

## Phase 4.1: fixed head

The same fixture and topology (16-vCPU `standard-16`, PgBouncer transaction
mode with `statement_timeout` dropped, 57 ms, heavy adoption, non-TTY
`timeout 3600 gbrain sync --source bench --no-pull --no-embed` looped until
the source reports synced) against the complete PR 1 head (14962f947 plus the
Phase 4.1 bench captures, `capy/6278-phase41` 846bea44, VERSION 0.60.108.0
with the 0.60.109.0 changelog). The bench now records, per pass, the hold
records by code and reason, writer status, `preparation_stalled` receipts and
the drain's closing lines (`post-pass-N.json`); one `gbrain dream --phase
fence_repair` run 20 minutes into pass 1 (`fence-repair.json`); the fate of
every seeded legacy row by shape (`legacy_outcome`); `gbrain doctor --only
fence_integrity --json`; and `gbrain sources retry-held` plus the sync it
prints after the passes (`retry-held.json`). `scripts/bench/stall-repro-summarize.py
<dir>` prints the figures below from `report.json` and `samples.jsonl`
(steady pages/min is the middle 80% of a pass by time; the longest no-commit
window is the largest `committed_stale_ms` the 30 s sampler saw).

### Before/after

| run | gbrain | pool | passes to synced | pages per pass | pages/min per pass (wall; steady) | longest window with no committed page | `sync_deadline_stop` | failed receipts | holds at end |
|---|---|---|---|---|---|---|---|---|---|
| A heavy (Phase 0) | 0.60.105.0 | 10 | never (stopped after 48 min) | 102 | 2.6 → 16 → 0 | 888 s (queued adoptions) | none | 471 `repeated_marker` + 276 round-trip refusals on the comparable head run; 0.60.105 killed before the tail | 20 `invalid_fence` |
| C heavy (Phase 0) | 0.60.105.0 | 3 | never (stopped after 44 min) | 62 | 1.4 → 0 | 668 s (same) | none | — | 20 |
| B heavy (Phase 0) | GBRA-45 head d99e2b43 | 10 | 3 | 3,900 / 7,538 / 3,542 | 65 / 126 / 75 | 285 s (tail) | none | 471 `repeated_marker` + 276 "does not render its legacy fact" | 20 |
| D heavy (Phase 0) | GBRA-45 head d99e2b43 | 3 | not reached in 170 min | 3,425 / 4,747 | 57 / 79 | 33 s | none | same classes | 20 |
| **4.1 pool 10** | this head | 10 | **2** (91 min) | 7,719 / 7,261 | 128.7 (119.8) / 231.1 (262.5) | 605 s (pass 1, queued adoptions); 285 s (pass 2 tail: 20 holds + links pass, queue empty) | none (pass 1 ended rc 124 from the outer `timeout 3600`; pass 2 `Managed sync synced`) | **0** | 20 `invalid_fence` / `repeated_marker` |
| **4.1 pool 3** | this head | 3 | 3 passes committed every page; the third was cut by the outer `timeout` at 14,996/15,000 processed and the `retry-held` sync closed it `synced` | 3,076 / 6,355 / 5,545 | 51.3 (46.5) / 106 (104.8) / 92.5 (93.5) | 544 s (pass 1, queued adoptions); 0 s; 64 s | none (every pass rc 124 from the outer `timeout`) | **0** | 20 `invalid_fence` / `repeated_marker` |

Every pass ended at the outer `timeout 3600` (rc 124, SIGTERM from the
reporter's loop) or `synced`; no pass stopped on the non-TTY watchdog
(`sync_deadline_stop`, rc 143) or on a drain stop reason, and no pass
printed `restart_required`. Each pass checkpointed and the next resumed at
the cursor without re-walking entries (pass 2 of the pool-10 run started at
7,719, pass 3 of the pool-3 run at 9,435). The 15,000-entry fixture does not
drain in one 3600 s pass on this topology at 120-260 pages/min, which is a
throughput ceiling, not a stall: the reporter's own loop ran under `timeout
14400`.

The one zero-progress window that remains is Phase 0's second mode, not a
stuck preparation: after the first `extract_facts` run of the heavy load
(killed by the harness at 20 minutes, as on every build), 70-100
`managed_maintenance_adopt_fact_fence` requests sit queued on the worktree
root ahead of the sync's admitted imports and publish one at a time. In the
pool-10 run the sync committed nothing from 09:59:12 to 10:09:51 (605 s)
while 22 different adoption requests ran and committed (every sample shows a
different `running` request, `claim_phase` ages of seconds, `writer status`
`assessment: pending`); the pool-3 run's 544 s window is the same shape (34
different running requests). 0.60.105 took 888 s and 668 s here and never
recovered its rate; the GBRA-45 head took 285 s; this head's windows are
longer than GBRA-45's because every adoption now succeeds (255-285 committed
adoption writes per run, 0 refusals), so more of them publish. Nothing in the
window is a single request holding the root.

### Writer status during the runs (G2)

Across the two reporter-shape runs the deep samples saw 3,676 `preparing`
blockers in `writer status --json`; none was past its budget (oldest phase
age 29.6 s), so `claim.stall` was null on all of them, as it should be. 58 of
them carried `diagnostic.reason: cause_unknown`: that field is computed from
the request's `created_at` (older than 120 s, mostly time spent queued) and
not from the claim, so a request that waited in the queue and is now a few
seconds into preparing reads `cause_unknown` next to a `claim` block that
says `phase: preparing`, `phase_age_ms: 3000`. In the lock run (below) all 39
overdue observations carried `claim.stall = { reason: preparation_overdue,
step, step_age_ms, waiting_on: db, budget_ms: 120000 }` and, at the same
time, `diagnostic.reason: cause_unknown` and `diagnostic.assessment:
stalled`. The step is always named once a preparer has entered one; the two
fields disagree in wording on the same row.

### Forced stall inside the real run (lock run, `--chaos-kind lock`, 2 × 300 s)

Same topology and load on a 3,000-entry backlog (so one pass completes),
pool 10, `LOCK TABLE pages IN ACCESS EXCLUSIVE MODE` held through the pooler
from 09:41:26 to 09:46:26 and from 09:51:26 to 09:56:26. Captures:
`chaos.jsonl`, `stall-1.json`, `samples.jsonl`, `post-pass-1.json`,
`retry-held.json`.

- **Budget fires at 120 s; the group members are not released while the
  lock is held.** 18 `managed_sync_import` members of six lane groups entered
  `preparing` at 09:41:25 (steps `canonical_projections` ×4,
  `page_snapshot` ×4, `origin_check` ×8, `knowledge_publication` ×1, all
  `waiting_on: db`); 14 later members sat `running` without a stamp. The
  consumer logged `[persistence] phase=preparation reason=deadline_exceeded`
  between the 300 s and 360 s watchdog ticks (09:43:25-09:44:25, the budget
  after a 09:41:25 claim) and `writer status` showed `claim.stall: preparation_overdue`
  with the step from the 09:43:41 sample on. But the members stayed
  `running` / `preparing` with `preparation_attempts: 0` and no
  `blocked_reason` until the lock dropped: `pg_stat_activity` had 9 of the
  sync's 10 pool connections in `Lock` / `relation` on the blocked statements
  for the whole hold, and the only statements the sync completed between
  09:43:30 and 09:46:20 were 51 claim renewals on the one free connection
  plus two `UPDATE persistence_requests SET state='queued'` releases. The
  release of member k needs a connection and the lock-blocked statements
  (the zombies) pinned them. Releases that did land took five members off
  the running set (18 → 12 preparing by 09:44:17). This is the condition
  lane A9 is changing (the budget cancels the blocked statement, which frees
  its connection); on this head the deadline is observed and named but the
  root stays held by the zombies.
- **Root release and resumption:** 300 s after the lock was taken (the lock
  duration, 2.5× the budget), not at 120 s. First committed page after
  release 1: 09:46:54 (28 s after the lock dropped, 176 → 196). No
  `preparation_abandoned` (the 300 s hold is inside the 600 s ceiling, so the
  ceiling path and `restart_required` never engaged), no `preparation_stalled`
  receipt for any sync member (each member was charged at most once per
  episode and committed on its next claim, which resets the count), so no
  `preparation_stalled` hold was written and that hold path was not exercised
  by a 300 s lock. A lock held past the ceiling would be the test for it.
- **The single path did complete the budget contract.** The adoption write
  for `companies/scale-0-582` was claimed as the second lock began, cut off
  at 120 s at step `page_snapshot` (`waiting_on: db`), reclaimed, cut off
  again and finished `failed` / `preparation_stalled` at 09:55:29 (about 240
  s after its first claim, inside budget × attempts + slack), with the
  receipt naming the step, the wait cause, the attempt limit and the
  writer-status route. `preparation_attempts` on the row: 2.
- **Progress line:** zero `stalled <N>s on <step>` lines in either hold.
  The pass stderr went silent between `160/3000` and `179/3000` for the
  first hold (five watchdog ticks) and between `256/3000` and the next line
  for the second. The drain's stall ticker reads `stall`, which is set only
  when `performManagedSync` returns `writer_pending` and the drain
  fingerprints the head between passes; a stall inside the group publish
  (the drain's own consumer holding the preparation) never reaches it. The
  drain-level `drain_stalled` / `preparation_abandoned` stops therefore did
  not fire either; the run came back on its own.
- **Second hold:** the sync had no member in flight when the lock was taken
  (the root was serving the queued adoption writes); the lock blocked the
  adoption write above and, through the pooler, the `extract_facts` run's own
  reads. The pass finished `synced` (2,980 of 3,000 written, 20 held) in
  3,471 s at 51.5 pages/min wall; 665 s was the longest no-commit window
  (lock 2 plus the adoption queue behind it).
- **After the run:** `gbrain sources retry-held bench --json` scheduled 20
  held files (all `invalid_fence` / `repeated_marker`) and printed `gbrain
  sync --source bench --no-pull` (the backlog was done, so the resume args
  came from the plain source command, not from a managed cursor; the
  `--no-embed` the run used was not carried). The printed sync re-screened
  the 20 files and held them again, as a manual-tier fence hold should.

### Fence outcomes (G3)

- Every seeded repeated-marker page in the backlog (20) ended held
  `invalid_fence` / `repeated_marker` with the line, in every run, written
  before admission (the sync's stdout lists each with `gbrain repair fences
  --source bench --only <path>` as the next step).
- The 20 history pages with a repeated marker were never submitted as
  adoption writes: `extract_facts` reports them as `FACTS_FENCE_FAILED:
  <slug> (Fence repeated_marker: in the facts fence (timeline), at line 18
  ...)` and skips the page; the stable count per run is 23 tokens (20 marker
  pages + 3 whitespace-only rows). Phase 0's 471 `repeated_marker` refusals
  at preparation are gone: 0 failed receipts of any class in both
  reporter-shape runs, 1 in the lock run (the `preparation_stalled` above).
- The four shapes: `trailing_ws`, `leading_ws` and `crlf` adopted (3 of 3
  each, in every run); `whitespace_only` stayed pending (3 rows, 0 adopted).
  The 83 rows left at the end of each run are those 3 plus the 80 rows on
  the 20 marker pages. `doctor --only fence_integrity --json` lists exactly
  3 `unrenderable_legacy_facts` rows on 3 pages, class `empty` / reason
  `fence_unrenderable`, status `warn` with `next: report`. Zero "does not
  render its legacy fact" refusals (Phase 0 head: 276).
- Controls: 908 of 988 seeded control rows adopted (the 80 on marker pages
  did not), plus every dripped row (100 / 220 / 60 across the runs).

### Concurrent maintenance (G4, PR 2 territory)

`gbrain dream --phase fence_repair --source bench --json` 20 minutes into
pass 1 on the same host: status `ok`, `candidates: 22`, `repaired: 0`,
`held_by_reason: { sync_in_progress: 22 }`, `owner_unavailable` absent,
`scan_partial: true`, 9.6-9.8 s (pool 10 and pool 3 alike). As expected on
this head: the repair kind skips the source while the sync runs; Phase 3 /
PR 2 changes that. In the local smoke the same phase run during a `pages`
lock blocked for the lock's duration (158 s) and reported `repeated_marker 6`
held, manual. A `dream` holds the cycle lock, so the adoption loop's
`extract_facts` runs that overlapped it were refused ("another cycle is
already running"); the bench records that in `adoption.jsonl` (`json_head`).

### Other observations

- The first `extract_facts` run on 1,000 legacy rows still exceeds 20
  minutes on every build and the harness kills it (exit 143); its ~100
  accepted adoption submissions are what queue ahead of the sync. On the
  pool-3 run, later `extract_facts` runs grew from 319 s to over 1,200 s as
  the synced page count grew (the phase reconciles every page), and the
  last three were killed too; with pool 10 they stayed at 450-1,160 s.
- The pool-10 pass 2 tail: 14,980 pages committed by 11:05:00, process exit
  11:10:13; the queue was empty and the stdout shows the 20 holds and the
  links pass (`Links: 2958 created across 998 page(s)`) landing in that gap.
- Source id in these runs is `bench` (the bench's fixture source), where the
  reporter's is `default`; nothing in the measured paths keys on the id.

### Verdict per plan goal

- **G1 (no catch-up stops because of one request): met for the write path
  as specified, with one caveat recorded.** No pass stalled on a single
  request; a cut-off single write became `preparation_stalled` with the step
  inside 240 s; the group members' budget fired and was reported, but under
  a lock that pins the pool their release waits for the lock (the zombie
  bound is the 600 s ceiling, not the 120 s budget), and the
  `preparation_stalled` sync hold was not reached by a 300 s lock. Lane A9's
  statement cancellation is what turns the 120 s release into a real one.
- **G2 (writer status names the step): met.** Every overdue claim carried
  `claim.stall` with step, step age, `waiting_on: db` and the budget;
  `diagnostic.reason` still reads `cause_unknown` on the same rows (and on
  young claims of long-queued requests), which is a wording clash rather
  than missing evidence.
- **G3 (fence defects never consume the write path): met.** 0 refusals in
  two 15k runs; marker pages held or skipped with the reason; three shapes
  adopt, whitespace-only is counted in `fence_integrity`.
- **G4 (fence_repair runs during the sync): not met on this head, as PR 1
  scoped it.** 22 candidates, all `sync_in_progress`, none repaired; no
  `owner_unavailable`. PR 2's criterion.
- **G5 (one pass drains at ≥ the GBRA-45 head's rate, zero
  `sync_deadline_stop`): rate and watchdog met, one pass not.** Zero
  `sync_deadline_stop` in 6 passes; steady 120 / 263 pages/min at pool 10
  against GBRA-45's 65 / 126 / 75 wall on the same fixture, 47 / 105 / 94 at
  pool 3 against 57 / 79; the whole 15k drained in 2 passes (91 min) where
  GBRA-45 took 3 (~167 min). One 3600 s pass cannot hold 15,000 entries at
  these rates, so under the reporter's `timeout 3600` loop it is two passes
  by arithmetic, not by a stall; under the reporter's actual `timeout 14400`
  it would be one.
