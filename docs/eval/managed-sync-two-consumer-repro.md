# Managed sync: two-consumer `preparing` wedge, Phase 0 reproduction record (#6317)

Phase 0 of the #6317 plan
(`docs/plans/2026-10-08-001-fix-managed-sync-reliability-contract-6317-plan.md`, §2)
asks for a two-process reproduction of the reporter's wedge: a bulk group
claimed by the process that does not hold the lane run (a `gbrain serve` that
booted first, the sync CLI started 60–90 s later), its head member sitting in
`running` / `claim_phase.phase = preparing` past five minutes with nothing in
flight at the database, the lease renewing every 10 s, and the same rows
preparing in seconds from a scratch process. This page is the record of that
reproduction. The deployment, hosts and paths use placeholders (the
`AGENTS.md` privacy rule); the real names stay in thread GBRA-61.

## Where to find it

The content of this page is written by Phase 0 (plan task T-09, thread GBRA-61)
from the captures it takes on its Ubicloud VM (`UBI_OWNER=gbra61`), not by the
build lanes. Until it lands here:

- the live evidence it starts from is in #6278 (the reporter's comments of
  2026-10-08 15:15Z and 15:25Z: E1–E5 in the plan's §1);
- the preregistered reading of the arms, which decides the default of
  `persistence.single_consumer` and what lane A fixes, is in the plan's §2;
- the previous record, for the other stall class (a relation lock wait a
  transaction-mode pooler hides), is
  [`managed-sync-stall-repro.md`](managed-sync-stall-repro.md); its scripts
  (`scripts/bench/managed-sync-stall-repro.ts`,
  `scripts/bench/stall-repro-vm-setup.sh`) are the starting point for this
  one.

## What this page records once Phase 0 lands

Written in the order the plan lists them (§2, deliverables 1–4):

1. **The timeline.** Fixture size, lane count, when `serve` booted, when the
   CLI started, when the group was claimed and by which pid, the claim stamps
   (`claim_phase.step`, `waiting_on`, owner kind, pid, build) read every 10 s
   with `gbrain sources writer status --json`, and `pg_stat_activity` at the
   same instants, on current master first and then on #6298's head.
2. **The named await**, or the statement that it could not be named inside
   the three-hour box: the `enterClaimStep` stamp first, the
   `bun --inspect` `Debugger.paused` frames and `asyncStackTrace` where the
   second instrument was available.
3. **Which arms wedged**: (i) `serve` plus the sync CLI on the reporter's
   timeline, (ii) one long-lived consumer only, (iii) arm (i) plus a `jobs`-kind
   process submitting adoption writes every 20 s; and which of the four
   candidates the code supports held: (a) pool self-deadlock in the claiming
   process, (b) a cross-process wait on state only the other process has,
   (c) a per-process resource exhausted in a long-lived owner, (d) a response
   lost between the pooler and the driver.
4. **What #6298's containment did to it**: whether the budget cut the
   preparation at 120 s, whether the entry was held after two attempts, and
   how long the root stayed blocked per occurrence (the ceiling at the latest).

The verdict's first line states the preregistered reading that applied: arm (i)
wedges and arm (ii) does not (the second consumer is the cause class, B1 is a
cause fix), both wedge (the cause is in the long-lived owner, B1 is policy), or
neither wedges in the box (the trigger is unreproduced and the production
capture from the plan's §6 step (4) is the evidence).

## Mirror into gbrain-evals

Every measured verdict for a shipped feature is mirrored into gbrain-evals
(project rule). For #6317 the integrator's gbrain-evals PR carries:

- this page, once Phase 0 has written it, with the same placeholders;
- the per-arm timelines (`writer status --json` samples every 10 s) and the
  `pg_stat_activity` captures that back the verdict, as fixtures;
- the preregistration (the plan's §2 reading) next to the outcome, so the
  default chosen for `persistence.single_consumer` is traceable to the arm
  that decided it;
- the T1 two-process regression test's forced-probe result (fails on #6298's
  head, passes with the fix) and, if lane A named the await, the A1
  regression's before/after;
- the containment numbers from deliverable 4 (time to cut-off, time the root
  stayed blocked, entries held) beside #6298's own measurements in
  `managed-sync-catchup.md`.
