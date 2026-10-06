# Q2 Track C: typing units on development data

All six units are implemented behind `ENABLED_TYPING_UNITS` (empty, so the build types exactly like master) and each
was measured alone and together on development data only. After reworks, no unit has a development type steal or a
new wrong transition by identity, and the all-unit package removes every E5 false start and every wrong single-value
closure while adding 73 current employers to the live read. Two findings change the plan: **U4 depends on U3** (U4
alone loses 0.163 as-of exact on board wording, so U3 and U4 are the joint unit **U34**), and **U2 and U6 depend on
U4's guard** for the E5 probe, which I handled inside U2 and U6 with page-level guards instead of overlapping U4. One
residual remains: U2 adds one general single-value closure on each of two phrasings (details below).

Development data only: temporal-edges dev seeds 3 and 5 with phrasing sets A, A2, A3 and the nine
`test/fixtures/q2-dev-phrasings/` files; world-v1 (H1 runner); relation-line variants dev seeds 1-3 (H2 runner). No
custodian or sealed text was read. Mechanism background: `dev-trace.md`.

## Units, rules and commits

| Unit | Commit(s) | Change | Dev rework |
|---|---|---|---|
| U1 adviser wording | `c1b3233f`, `61934b56` | `adviser` spelling, "advising [X]", local negation, third-party veto | adviser phrase on another entry (window edge) vetoed: it caused 6 steals on signed-on |
| U2 ordinary roles | `1b5a8569` | post-pass where inference returned `mentions`: "<role> for", "led <area> at", "[X] (<role>)", "as <role>" after a join | undated lines only; not on a page that names an advisory/board/investor role; not for an organization two or more dated entries mention |
| U3 board wording | `dd05898d` | board/observer/investor wording vetoes `works_at`; board seat keeps `invested_in` only with an investor prior or a stated investment | veto scoped to the link's own sentence/entry or a board position right before the link (first version stole jobs a neighboring entry's verb had typed) |
| U4 not-employment starts | `0044223c` | `NOT_EMPLOYMENT_ROLE` in the "became … at/of" and "took … role" start cues | none; joint with U3 as U34 (`30717952`) |
| U5 leave idioms | `fe4c334e` | split-object and quitting idioms, "exit from", exchange moves; dated ends only | restart guard (from the trace): an idiom end is dropped when a later dated entry names the organization in words no cue reads |
| U6 start framings | `fd0b1f55`, `c6655db2` | first day/week, day one, kick-off with a job noun, onboarded/onboarding week, began working at, new chapter at | leave guard (mirror of U5's) and the advisory-page guard: alone it had opened former jobs for good (6-8 wrong general single-value closures, 5-24 wrong E5 closures, lower traps) |

Infrastructure: `efd1628e` (rule ids, `explainLinkType`), `192c0870` (unit plumbing, example harness), `30717952`
(package script, U34 alias, 64-subset and world-v1 identity tests), `49b1ae6e` (entailment table and recipe).

## Dependencies the development data shows

- **U4 needs U3 (set-F interaction, confirmed).** On the board-director phrasing, board lines that master types
  `works_at` lose their start under U4 and read as a job on every date: as-of exact 0.946 (master) → 0.783 (U4 alone),
  during-F1 0.931 → 0.890. U3 alone gives 0.950, U3 with U4 0.950. U4 alone would fail the as-of safety gate wherever
  board wording types `works_at`; U3 alone does not need U4. The freeze record should declare **U34** joint, with U4's
  primary metric (preregistration, "What is decided").
- **U2 and U6 expose master's advisory-line start cues.** A newly typed (U2) or newly dated (U6) employer meets the
  false `works_at` start that master's "became … at" / "took … role" cue reads on an advisory line about another
  target (E5 "other" form); the single-value pass then closes the real employer on the advisory date, a new wrong
  closure by identity. U4 removes the cause. I kept U2 and U6 independent of U4 with a page-level guard (they do not
  fire on a page that names any organization in an advisory, board or investor role); the cost is that a person with
  an advisory role elsewhere gets no U2 typing or U6 dating. Alternatives for you: make U2 and U6 joint with U4, or
  let them carry U4's guard (overlap: if U2 is ordered before U34 in the package sequence, U34's increment on E5 false
  starts is zero and the fixed sequence stops there).
- **Count-based E5 metric hides wrong starts.** `e5_extra_works_at_starts` is zero-clamped and counts starts: on
  master a missed correct start masks a wrong advisory start, so a unit that recovers the correct start shows a "new"
  extra start without adding a wrong transition. The identity tables below are the faithful measure (plan §9.3).

## Identity tables (all phrasings, both seeds, arm vs no unit)

Steal: a person-company pair that lost a ledger type or gained more unsupported types than it shed. Transitions by
identity (subject, target, type, kind, date) against the generator ledger; dumps written through `put_page` without the
single-value pass (`scripts/q2-typing-dev.ts`).

| arm | steals | gains | other moves | new wrong transitions | wrong transitions removed | correct transitions added | correct transitions lost | current employers lost from live read | added to live read |
|---|---|---|---|---|---|---|---|---|---|
| U1 | 0 | 176 | 21 | 0 | 0 | 72 | 0 | 0 | 0 |
| U2 | 0 | 73 | 0 | 0 | 0 | 27 | 0 | 0 | 73 |
| U3 | 0 | 0 | 28 | 0 | 28 | 0 | 0 | 0 | 0 |
| U4 | 0 | 0 | 0 | 0 | 570 | 0 | 0 | 0 | 0 |
| U34 | 0 | 0 | 28 | 0 | 570 | 0 | 0 | 0 | 0 |
| U5 | 0 | 0 | 0 | 0 | 0 | 312 | 0 | 0 | 0 |
| U6 | 0 | 0 | 0 | 0 | 0 | 61 | 0 | 0 | 0 |
| all | 0 | 249 | 49 | 0 | 570 | 692 | 0 | 0 | 73 |

Correct `works_at` transitions by identity, starts · ends · wrong transitions (all works_at starts and ends not in the
ledger), per phrasing (seeds 3 and 5; 496 ledger starts, 285 ledger ends):

| phrasing | none | U1 | U2 | U3 | U4 | U34 | U5 | U6 | all |
|---|---|---|---|---|---|---|---|---|---|
| A | 475/496 · 282/285 · 48 | 475/496 · 282/285 · 48 | 475/496 · 282/285 · 48 | 475/496 · 282/285 · 48 | 475/496 · 282/285 · 0 | 475/496 · 282/285 · 0 | 475/496 · 282/285 · 48 | 475/496 · 282/285 · 48 | 475/496 · 282/285 · 0 |
| A2 | 444/496 · 261/285 · 48 | 444/496 · 261/285 · 48 | 444/496 · 261/285 · 48 | 444/496 · 261/285 · 48 | 444/496 · 261/285 · 0 | 444/496 · 261/285 · 0 | 444/496 · 261/285 · 48 | 444/496 · 261/285 · 48 | 444/496 · 261/285 · 0 |
| A3 | 338/496 · 219/285 · 37 | 338/496 · 219/285 · 37 | 338/496 · 219/285 · 37 | 338/496 · 219/285 · 37 | 338/496 · 219/285 · 0 | 338/496 · 219/285 · 0 | 338/496 · 219/285 · 37 | 338/496 · 219/285 · 37 | 338/496 · 219/285 · 0 |
| role-for | 231/496 · 241/285 · 37 | 231/496 · 241/285 · 37 | 231/496 · 241/285 · 37 | 231/496 · 241/285 · 37 | 231/496 · 241/285 · 0 | 231/496 · 241/285 · 0 | 231/496 · 241/285 · 37 | 231/496 · 241/285 · 37 | 231/496 · 241/285 · 0 |
| new-chapter | 231/496 · 157/285 · 33 | 231/496 · 157/285 · 33 | 231/496 · 157/285 · 33 | 231/496 · 157/285 · 33 | 231/496 · 157/285 · 0 | 231/496 · 157/285 · 0 | 231/496 · 157/285 · 33 | 243/496 · 157/285 · 33 | 257/496 · 157/285 · 0 |
| paren-move | 330/496 · 186/285 · 33 | 330/496 · 186/285 · 33 | 342/496 · 186/285 · 33 | 330/496 · 186/285 · 33 | 330/496 · 186/285 · 0 | 330/496 · 186/285 · 0 | 330/496 · 218/285 · 33 | 330/496 · 186/285 · 33 | 342/496 · 218/285 · 0 |
| signed-on | 339/496 · 186/285 · 33 | 339/496 · 186/285 · 33 | 354/496 · 186/285 · 33 | 339/496 · 186/285 · 33 | 339/496 · 186/285 · 0 | 339/496 · 186/285 · 0 | 339/496 · 221/285 · 33 | 339/496 · 186/285 · 33 | 354/496 · 221/285 · 0 |
| adviser | 475/496 · 282/285 · 48 | 475/496 · 282/285 · 48 | 475/496 · 282/285 · 48 | 475/496 · 282/285 · 48 | 475/496 · 282/285 · 0 | 475/496 · 282/285 · 0 | 475/496 · 282/285 · 48 | 475/496 · 282/285 · 48 | 475/496 · 282/285 · 0 |
| board-investor | 475/496 · 282/285 · 72 | 475/496 · 282/285 · 72 | 475/496 · 282/285 · 72 | 475/496 · 282/285 · 72 | 475/496 · 282/285 · 0 | 475/496 · 282/285 · 0 | 475/496 · 282/285 · 72 | 475/496 · 282/285 · 72 | 475/496 · 282/285 · 0 |
| board-director | 479/496 · 282/285 · 100 | 479/496 · 282/285 · 100 | 479/496 · 282/285 · 100 | 479/496 · 282/285 · 72 | 479/496 · 282/285 · 0 | 479/496 · 282/285 · 0 | 479/496 · 282/285 · 100 | 479/496 · 282/285 · 100 | 479/496 · 282/285 · 0 |
| leave-start-idioms | 231/496 · 157/285 · 48 | 231/496 · 157/285 · 48 | 231/496 · 157/285 · 48 | 231/496 · 157/285 · 48 | 231/496 · 157/285 · 0 | 231/496 · 157/285 · 0 | 282/496 · 252/285 · 48 | 258/496 · 157/285 · 48 | 376/496 · 261/285 · 0 |
| onboarding | 231/496 · 157/285 · 33 | 231/496 · 157/285 · 33 | 231/496 · 157/285 · 33 | 231/496 · 157/285 · 33 | 231/496 · 157/285 · 0 | 231/496 · 157/285 · 0 | 231/496 · 256/285 · 33 | 253/496 · 157/285 · 33 | 361/496 · 278/285 · 0 |

## Runner metrics (temporal-edges, seeds 3 and 5, `--e5-probe --pack works-at-one-per-from --single-value-pass`)

Primary metrics on development data:

| Unit | Primary metric | Development effect |
|---|---|---|
| U1 | advisor-trap accuracy | signed-on 0/28 → 28/28, adviser 0/28 → 28/28; flat elsewhere |
| U2 | live-edge recall | role-for 0.640 → 0.727, new-chapter 0.597 → 0.741, paren-move 0.597 → 0.734, signed-on 0.583 → 0.727; flat elsewhere |
| U3 (U34) | investment-trap accuracy | flat on every phrasing (no development investment line is typed `works_at` by board wording); board-director live recall 0.712 → 0.899, now-precision 0.766 → 1.000 |
| U4 (U34) | false employment starts per E5 probe person | removes all 33-100 wrong starts per phrasing (identity); E5 extra starts and E5 wrong closures 0 on every phrasing |
| U5 | correct end transitions | paren-move 186 → 218/285, signed-on 186 → 221, leave-start-idioms 157 → 252, onboarding 157 → 256 |
| U6 | correct start transitions | new-chapter 231 → 243/496, leave-start-idioms 231 → 258, onboarding 231 → 253 |

Residuals the safety conditions may see:

- **U2, general single-value pass:** +1 wrong closure on paren-move (3 → 4/160) and signed-on (3 → 4/160). A former
  employer master already keeps live (its leave, "Exit from" / "Handed in her notice at", is unread without U5) is
  closed at the date of the newly typed current employer's start, not at its true end. The closure is wrong by date
  only, on a relationship master already had wrong. With U5 in the package it disappears (all-unit arm: 0/160). I left
  it rather than drop U2; drop U2 if the preregistered "new wrong transitions = 0" bar should apply to it on
  development data too.
- **U6 alone:** as-of exact moves by -0.002 to -0.004 on three phrasings (new-chapter 0.535 → 0.531, onboarding
  0.598 → 0.596; leave-start-idioms during-F1 0.819 → 0.815): a correctly dated restart hides an earlier stint whose
  start no cue reads. No new wrong transition by identity.
- Trap counts: no unit lowers any trap family on any phrasing; U5 raises investment and alumni traps where leaves were
  unread.

Full per-arm runner tables (refs built by `scripts/q2-typing-package.ts` on `c6655db2`; U1 and all-units arms on
`61934b56`):

#### A

| arm | live recall | as-of exact | during F1 | now prec. | now recall | advisor traps | investment traps | alumni traps | E5 extra starts | E5 wrong closures | general SV wrong closures |
|---|---|---|---|---|---|---|---|---|---|---|---|
| none | 0.871 | 0.933 | 0.921 | 1.000 | 0.867 | 28/28 | 26/26 | 20/20 | 48/72 | 24/72 | 0/160 |
| U1 | 0.871 | 0.933 | 0.921 | 1.000 | 0.867 | 28/28 | 26/26 | 20/20 | 48/72 | 24/72 | 0/160 |
| U2 | 0.871 | 0.933 | 0.921 | 1.000 | 0.867 | 28/28 | 26/26 | 20/20 | 48/72 | 24/72 | 0/160 |
| U3 | 0.871 | 0.933 | 0.921 | 1.000 | 0.867 | 28/28 | 26/26 | 20/20 | 48/72 | 24/72 | 0/160 |
| U4 | 0.871 | 0.933 | 0.921 | 1.000 | 0.867 | 28/28 | 26/26 | 20/20 | 0/72 | 0/72 | 0/160 |
| U34 | 0.871 | 0.933 | 0.921 | 1.000 | 0.867 | 28/28 | 26/26 | 20/20 | 0/72 | 0/72 | 0/160 |
| U5 | 0.871 | 0.933 | 0.921 | 1.000 | 0.867 | 28/28 | 26/26 | 20/20 | 48/72 | 24/72 | 0/160 |
| U6 | 0.871 | 0.933 | 0.921 | 1.000 | 0.867 | 28/28 | 26/26 | 20/20 | 48/72 | 24/72 | 0/160 |
| all | 0.871 | 0.933 | 0.921 | 1.000 | 0.867 | 28/28 | 26/26 | 20/20 | 0/72 | 0/72 | 0/160 |

#### A2

| arm | live recall | as-of exact | during F1 | now prec. | now recall | advisor traps | investment traps | alumni traps | E5 extra starts | E5 wrong closures | general SV wrong closures |
|---|---|---|---|---|---|---|---|---|---|---|---|
| none | 0.827 | 0.892 | 0.890 | 1.000 | 0.829 | 28/28 | 26/26 | 20/20 | 48/72 | 24/72 | 0/160 |
| U1 | 0.827 | 0.892 | 0.890 | 1.000 | 0.829 | 28/28 | 26/26 | 20/20 | 48/72 | 24/72 | 0/160 |
| U2 | 0.827 | 0.892 | 0.890 | 1.000 | 0.829 | 28/28 | 26/26 | 20/20 | 48/72 | 24/72 | 0/160 |
| U3 | 0.827 | 0.892 | 0.890 | 1.000 | 0.829 | 28/28 | 26/26 | 20/20 | 48/72 | 24/72 | 0/160 |
| U4 | 0.827 | 0.892 | 0.890 | 1.000 | 0.829 | 28/28 | 26/26 | 20/20 | 0/72 | 0/72 | 0/160 |
| U34 | 0.827 | 0.892 | 0.890 | 1.000 | 0.829 | 28/28 | 26/26 | 20/20 | 0/72 | 0/72 | 0/160 |
| U5 | 0.827 | 0.892 | 0.890 | 1.000 | 0.829 | 28/28 | 26/26 | 20/20 | 48/72 | 24/72 | 0/160 |
| U6 | 0.827 | 0.892 | 0.890 | 1.000 | 0.829 | 28/28 | 26/26 | 20/20 | 48/72 | 24/72 | 0/160 |
| all | 0.827 | 0.892 | 0.890 | 1.000 | 0.829 | 28/28 | 26/26 | 20/20 | 0/72 | 0/72 | 0/160 |

#### A3

| arm | live recall | as-of exact | during F1 | now prec. | now recall | advisor traps | investment traps | alumni traps | E5 extra starts | E5 wrong closures | general SV wrong closures |
|---|---|---|---|---|---|---|---|---|---|---|---|
| none | 0.633 | 0.648 | 0.628 | 0.886 | 0.642 | 28/28 | 26/26 | 20/20 | 21/72 | 8/72 | 0/160 |
| U1 | 0.633 | 0.692 | 0.642 | 0.958 | 0.642 | 28/28 | 26/26 | 20/20 | 21/72 | 8/72 | 0/160 |
| U2 | 0.633 | 0.648 | 0.628 | 0.886 | 0.642 | 28/28 | 26/26 | 20/20 | 21/72 | 8/72 | 0/160 |
| U3 | 0.633 | 0.648 | 0.628 | 0.886 | 0.642 | 28/28 | 26/26 | 20/20 | 21/72 | 8/72 | 0/160 |
| U4 | 0.633 | 0.648 | 0.628 | 0.886 | 0.642 | 28/28 | 26/26 | 20/20 | 0/72 | 0/72 | 0/160 |
| U34 | 0.633 | 0.648 | 0.628 | 0.886 | 0.642 | 28/28 | 26/26 | 20/20 | 0/72 | 0/72 | 0/160 |
| U5 | 0.633 | 0.648 | 0.628 | 0.886 | 0.642 | 28/28 | 26/26 | 20/20 | 21/72 | 8/72 | 0/160 |
| U6 | 0.633 | 0.648 | 0.628 | 0.886 | 0.642 | 28/28 | 26/26 | 20/20 | 21/72 | 8/72 | 0/160 |
| all | 0.633 | 0.692 | 0.642 | 0.958 | 0.642 | 28/28 | 26/26 | 20/20 | 0/72 | 0/72 | 0/160 |

#### role-for

| arm | live recall | as-of exact | during F1 | now prec. | now recall | advisor traps | investment traps | alumni traps | E5 extra starts | E5 wrong closures | general SV wrong closures |
|---|---|---|---|---|---|---|---|---|---|---|---|
| none | 0.640 | 0.637 | 0.648 | 0.934 | 0.640 | 28/28 | 26/26 | 20/20 | 0/72 | 0/72 | 0/160 |
| U1 | 0.640 | 0.637 | 0.648 | 0.934 | 0.640 | 28/28 | 26/26 | 20/20 | 0/72 | 0/72 | 0/160 |
| U2 | 0.727 | 0.683 | 0.715 | 0.979 | 0.724 | 28/28 | 26/26 | 20/20 | 0/72 | 0/72 | 0/160 |
| U3 | 0.640 | 0.637 | 0.648 | 0.934 | 0.640 | 28/28 | 26/26 | 20/20 | 0/72 | 0/72 | 0/160 |
| U4 | 0.640 | 0.637 | 0.648 | 0.934 | 0.640 | 28/28 | 26/26 | 20/20 | 0/72 | 0/72 | 0/160 |
| U34 | 0.640 | 0.637 | 0.648 | 0.934 | 0.640 | 28/28 | 26/26 | 20/20 | 0/72 | 0/72 | 0/160 |
| U5 | 0.640 | 0.637 | 0.648 | 0.934 | 0.640 | 28/28 | 26/26 | 20/20 | 0/72 | 0/72 | 0/160 |
| U6 | 0.640 | 0.637 | 0.648 | 0.934 | 0.640 | 28/28 | 26/26 | 20/20 | 0/72 | 0/72 | 0/160 |
| all | 0.727 | 0.683 | 0.715 | 0.979 | 0.724 | 28/28 | 26/26 | 20/20 | 0/72 | 0/72 | 0/160 |

#### new-chapter

| arm | live recall | as-of exact | during F1 | now prec. | now recall | advisor traps | investment traps | alumni traps | E5 extra starts | E5 wrong closures | general SV wrong closures |
|---|---|---|---|---|---|---|---|---|---|---|---|
| none | 0.597 | 0.535 | 0.552 | 0.755 | 0.602 | 28/28 | 19/26 | 16/20 | 0/72 | 0/72 | 0/160 |
| U1 | 0.597 | 0.573 | 0.565 | 0.819 | 0.602 | 28/28 | 19/26 | 16/20 | 0/72 | 0/72 | 0/160 |
| U2 | 0.741 | 0.623 | 0.656 | 0.816 | 0.753 | 28/28 | 19/26 | 16/20 | 0/72 | 0/72 | 0/160 |
| U3 | 0.597 | 0.535 | 0.552 | 0.755 | 0.602 | 28/28 | 19/26 | 16/20 | 0/72 | 0/72 | 0/160 |
| U4 | 0.597 | 0.535 | 0.552 | 0.755 | 0.602 | 28/28 | 19/26 | 16/20 | 0/72 | 0/72 | 0/160 |
| U34 | 0.597 | 0.535 | 0.552 | 0.755 | 0.602 | 28/28 | 19/26 | 16/20 | 0/72 | 0/72 | 0/160 |
| U5 | 0.597 | 0.535 | 0.552 | 0.755 | 0.602 | 28/28 | 19/26 | 16/20 | 0/72 | 0/72 | 0/160 |
| U6 | 0.597 | 0.531 | 0.552 | 0.755 | 0.602 | 28/28 | 19/26 | 16/20 | 0/72 | 0/72 | 0/160 |
| all | 0.741 | 0.660 | 0.669 | 0.869 | 0.753 | 28/28 | 19/26 | 16/20 | 0/72 | 0/72 | 0/160 |

#### paren-move

| arm | live recall | as-of exact | during F1 | now prec. | now recall | advisor traps | investment traps | alumni traps | E5 extra starts | E5 wrong closures | general SV wrong closures |
|---|---|---|---|---|---|---|---|---|---|---|---|
| none | 0.597 | 0.640 | 0.608 | 0.793 | 0.602 | 28/28 | 22/26 | 18/20 | 14/72 | 5/72 | 3/160 |
| U1 | 0.597 | 0.640 | 0.608 | 0.793 | 0.602 | 28/28 | 22/26 | 18/20 | 14/72 | 5/72 | 3/160 |
| U2 | 0.734 | 0.727 | 0.712 | 0.858 | 0.744 | 28/28 | 22/26 | 18/20 | 14/72 | 5/72 | 4/160 |
| U3 | 0.597 | 0.640 | 0.608 | 0.793 | 0.602 | 28/28 | 22/26 | 18/20 | 14/72 | 5/72 | 3/160 |
| U4 | 0.597 | 0.640 | 0.608 | 0.793 | 0.602 | 28/28 | 22/26 | 18/20 | 0/72 | 0/72 | 3/160 |
| U34 | 0.597 | 0.640 | 0.608 | 0.793 | 0.602 | 28/28 | 22/26 | 18/20 | 0/72 | 0/72 | 3/160 |
| U5 | 0.597 | 0.671 | 0.623 | 0.958 | 0.602 | 28/28 | 26/26 | 20/20 | 14/72 | 5/72 | 0/160 |
| U6 | 0.597 | 0.640 | 0.608 | 0.793 | 0.602 | 28/28 | 22/26 | 18/20 | 14/72 | 5/72 | 3/160 |
| all | 0.741 | 0.760 | 0.727 | 1.000 | 0.753 | 28/28 | 26/26 | 20/20 | 0/72 | 0/72 | 0/160 |

#### signed-on

| arm | live recall | as-of exact | during F1 | now prec. | now recall | advisor traps | investment traps | alumni traps | E5 extra starts | E5 wrong closures | general SV wrong closures |
|---|---|---|---|---|---|---|---|---|---|---|---|
| none | 0.583 | 0.579 | 0.583 | 0.737 | 0.589 | 0/28 | 22/26 | 18/20 | 16/72 | 7/72 | 3/160 |
| U1 | 0.583 | 0.629 | 0.598 | 0.791 | 0.589 | 28/28 | 22/26 | 18/20 | 16/72 | 7/72 | 3/160 |
| U2 | 0.727 | 0.673 | 0.693 | 0.806 | 0.738 | 0/28 | 22/26 | 18/20 | 16/72 | 7/72 | 4/160 |
| U3 | 0.583 | 0.579 | 0.583 | 0.737 | 0.589 | 0/28 | 22/26 | 18/20 | 16/72 | 7/72 | 3/160 |
| U4 | 0.583 | 0.579 | 0.583 | 0.737 | 0.589 | 0/28 | 22/26 | 18/20 | 0/72 | 0/72 | 3/160 |
| U34 | 0.583 | 0.579 | 0.583 | 0.737 | 0.589 | 0/28 | 22/26 | 18/20 | 0/72 | 0/72 | 3/160 |
| U5 | 0.583 | 0.612 | 0.598 | 0.874 | 0.589 | 0/28 | 26/26 | 20/20 | 16/72 | 7/72 | 0/160 |
| U6 | 0.583 | 0.579 | 0.583 | 0.737 | 0.589 | 0/28 | 22/26 | 18/20 | 16/72 | 7/72 | 3/160 |
| all | 0.734 | 0.758 | 0.723 | 1.000 | 0.747 | 28/28 | 26/26 | 20/20 | 0/72 | 0/72 | 0/160 |

#### adviser

| arm | live recall | as-of exact | during F1 | now prec. | now recall | advisor traps | investment traps | alumni traps | E5 extra starts | E5 wrong closures | general SV wrong closures |
|---|---|---|---|---|---|---|---|---|---|---|---|
| none | 0.871 | 0.883 | 0.906 | 0.945 | 0.867 | 0/28 | 26/26 | 20/20 | 48/72 | 24/72 | 0/160 |
| U1 | 0.871 | 0.933 | 0.921 | 1.000 | 0.867 | 28/28 | 26/26 | 20/20 | 48/72 | 24/72 | 0/160 |
| U2 | 0.871 | 0.883 | 0.906 | 0.945 | 0.867 | 0/28 | 26/26 | 20/20 | 48/72 | 24/72 | 0/160 |
| U3 | 0.871 | 0.883 | 0.906 | 0.945 | 0.867 | 0/28 | 26/26 | 20/20 | 48/72 | 24/72 | 0/160 |
| U4 | 0.871 | 0.883 | 0.906 | 0.945 | 0.867 | 0/28 | 26/26 | 20/20 | 0/72 | 0/72 | 0/160 |
| U34 | 0.871 | 0.883 | 0.906 | 0.945 | 0.867 | 0/28 | 26/26 | 20/20 | 0/72 | 0/72 | 0/160 |
| U5 | 0.871 | 0.883 | 0.906 | 0.945 | 0.867 | 0/28 | 26/26 | 20/20 | 48/72 | 24/72 | 0/160 |
| U6 | 0.871 | 0.883 | 0.906 | 0.945 | 0.867 | 0/28 | 26/26 | 20/20 | 48/72 | 24/72 | 0/160 |
| all | 0.871 | 0.933 | 0.921 | 1.000 | 0.867 | 28/28 | 26/26 | 20/20 | 0/72 | 0/72 | 0/160 |

#### board-investor

| arm | live recall | as-of exact | during F1 | now prec. | now recall | advisor traps | investment traps | alumni traps | E5 extra starts | E5 wrong closures | general SV wrong closures |
|---|---|---|---|---|---|---|---|---|---|---|---|
| none | 0.871 | 0.933 | 0.921 | 1.000 | 0.867 | 28/28 | 26/26 | 20/20 | 72/72 | 36/72 | 0/160 |
| U1 | 0.871 | 0.933 | 0.921 | 1.000 | 0.867 | 28/28 | 26/26 | 20/20 | 72/72 | 36/72 | 0/160 |
| U2 | 0.871 | 0.933 | 0.921 | 1.000 | 0.867 | 28/28 | 26/26 | 20/20 | 72/72 | 36/72 | 0/160 |
| U3 | 0.871 | 0.933 | 0.921 | 1.000 | 0.867 | 28/28 | 26/26 | 20/20 | 72/72 | 36/72 | 0/160 |
| U4 | 0.871 | 0.933 | 0.921 | 1.000 | 0.867 | 28/28 | 26/26 | 20/20 | 0/72 | 0/72 | 0/160 |
| U34 | 0.871 | 0.933 | 0.921 | 1.000 | 0.867 | 28/28 | 26/26 | 20/20 | 0/72 | 0/72 | 0/160 |
| U5 | 0.871 | 0.933 | 0.921 | 1.000 | 0.867 | 28/28 | 26/26 | 20/20 | 72/72 | 36/72 | 0/160 |
| U6 | 0.871 | 0.933 | 0.921 | 1.000 | 0.867 | 28/28 | 26/26 | 20/20 | 72/72 | 36/72 | 0/160 |
| all | 0.871 | 0.933 | 0.921 | 1.000 | 0.867 | 28/28 | 26/26 | 20/20 | 0/72 | 0/72 | 0/160 |

#### board-director

| arm | live recall | as-of exact | during F1 | now prec. | now recall | advisor traps | investment traps | alumni traps | E5 extra starts | E5 wrong closures | general SV wrong closures |
|---|---|---|---|---|---|---|---|---|---|---|---|
| none | 0.712 | 0.946 | 0.931 | 0.766 | 0.719 | 0/28 | 26/26 | 20/20 | 72/72 | 36/72 | 26/160 |
| U1 | 0.712 | 0.946 | 0.931 | 0.766 | 0.719 | 0/28 | 26/26 | 20/20 | 72/72 | 36/72 | 26/160 |
| U2 | 0.712 | 0.946 | 0.931 | 0.766 | 0.719 | 0/28 | 26/26 | 20/20 | 72/72 | 36/72 | 26/160 |
| U3 | 0.899 | 0.950 | 0.940 | 1.000 | 0.896 | 0/28 | 26/26 | 20/20 | 72/72 | 36/72 | 0/160 |
| U4 | 0.899 | 0.783 | 0.890 | 0.803 | 0.896 | 0/28 | 26/26 | 20/20 | 0/72 | 0/72 | 0/160 |
| U34 | 0.899 | 0.950 | 0.940 | 1.000 | 0.896 | 0/28 | 26/26 | 20/20 | 0/72 | 0/72 | 0/160 |
| U5 | 0.712 | 0.946 | 0.931 | 0.766 | 0.719 | 0/28 | 26/26 | 20/20 | 72/72 | 36/72 | 26/160 |
| U6 | 0.712 | 0.946 | 0.931 | 0.766 | 0.719 | 0/28 | 26/26 | 20/20 | 72/72 | 36/72 | 26/160 |
| all | 0.899 | 0.950 | 0.940 | 1.000 | 0.896 | 0/28 | 26/26 | 20/20 | 0/72 | 0/72 | 0/160 |

#### leave-start-idioms

| arm | live recall | as-of exact | during F1 | now prec. | now recall | advisor traps | investment traps | alumni traps | E5 extra starts | E5 wrong closures | general SV wrong closures |
|---|---|---|---|---|---|---|---|---|---|---|---|
| none | 0.871 | 0.750 | 0.819 | 0.787 | 0.867 | 28/28 | 17/26 | 14/20 | 0/72 | 0/72 | 0/160 |
| U1 | 0.871 | 0.750 | 0.819 | 0.787 | 0.867 | 28/28 | 17/26 | 14/20 | 0/72 | 0/72 | 0/160 |
| U2 | 0.871 | 0.750 | 0.819 | 0.787 | 0.867 | 28/28 | 17/26 | 14/20 | 0/72 | 0/72 | 0/160 |
| U3 | 0.871 | 0.750 | 0.819 | 0.787 | 0.867 | 28/28 | 17/26 | 14/20 | 0/72 | 0/72 | 0/160 |
| U4 | 0.871 | 0.750 | 0.819 | 0.787 | 0.867 | 28/28 | 17/26 | 14/20 | 0/72 | 0/72 | 0/160 |
| U34 | 0.871 | 0.750 | 0.819 | 0.787 | 0.867 | 28/28 | 17/26 | 14/20 | 0/72 | 0/72 | 0/160 |
| U5 | 0.871 | 0.800 | 0.880 | 0.921 | 0.867 | 28/28 | 16/26 | 18/20 | 0/72 | 0/72 | 0/160 |
| U6 | 0.871 | 0.750 | 0.815 | 0.787 | 0.867 | 28/28 | 17/26 | 14/20 | 0/72 | 0/72 | 0/160 |
| all | 0.871 | 0.883 | 0.903 | 0.940 | 0.867 | 28/28 | 18/26 | 18/20 | 0/72 | 0/72 | 0/160 |

#### onboarding

| arm | live recall | as-of exact | during F1 | now prec. | now recall | advisor traps | investment traps | alumni traps | E5 extra starts | E5 wrong closures | general SV wrong closures |
|---|---|---|---|---|---|---|---|---|---|---|---|
| none | 0.633 | 0.598 | 0.635 | 0.655 | 0.633 | 28/28 | 17/26 | 14/20 | 0/72 | 0/72 | 0/160 |
| U1 | 0.633 | 0.635 | 0.648 | 0.697 | 0.633 | 28/28 | 17/26 | 14/20 | 0/72 | 0/72 | 0/160 |
| U2 | 0.633 | 0.598 | 0.635 | 0.655 | 0.633 | 28/28 | 17/26 | 14/20 | 0/72 | 0/72 | 0/160 |
| U3 | 0.633 | 0.598 | 0.635 | 0.655 | 0.633 | 28/28 | 17/26 | 14/20 | 0/72 | 0/72 | 0/160 |
| U4 | 0.633 | 0.598 | 0.635 | 0.655 | 0.633 | 28/28 | 17/26 | 14/20 | 0/72 | 0/72 | 0/160 |
| U34 | 0.633 | 0.598 | 0.635 | 0.655 | 0.633 | 28/28 | 17/26 | 14/20 | 0/72 | 0/72 | 0/160 |
| U5 | 0.633 | 0.631 | 0.708 | 0.900 | 0.633 | 28/28 | 26/26 | 20/20 | 0/72 | 0/72 | 0/160 |
| U6 | 0.633 | 0.596 | 0.631 | 0.655 | 0.633 | 28/28 | 17/26 | 14/20 | 0/72 | 0/72 | 0/160 |
| all | 0.633 | 0.785 | 0.752 | 0.958 | 0.633 | 28/28 | 26/26 | 20/20 | 0/72 | 0/72 | 0/160 |

## world-v1 (H1 runner, grammar on)

| arm | type accuracy | any-type match | edges correctly typed newly | edges no longer correctly typed | pages grammar on/off differ |
|---|---|---|---|---|---|
| none | 0.7534246575342466 | 0.9452054794520548 | 0 | 0 (any-type lost 0) | 0/240 |
| U1 | 0.7602739726027398 | 0.9452054794520548 | 1 | 0 (any-type lost 0) | 0/240 |
| U2 | 0.7534246575342466 | 0.9452054794520548 | 0 | 0 (any-type lost 0) | 0/240 |
| U3 | 0.7671232876712328 | 0.9452054794520548 | 2 | 0 (any-type lost 0) | 0/240 |
| U4 | 0.7534246575342466 | 0.9452054794520548 | 0 | 0 (any-type lost 0) | 0/240 |
| U34 | 0.7671232876712328 | 0.9452054794520548 | 2 | 0 (any-type lost 0) | 0/240 |
| U5 | 0.7534246575342466 | 0.9452054794520548 | 0 | 0 (any-type lost 0) | 0/240 |
| U6 | 0.7534246575342466 | 0.9452054794520548 | 0 | 0 (any-type lost 0) | 0/240 |
| all | 0.773972602739726 | 0.9452054794520548 | 3 | 0 (any-type lost 0) | 0/240 |

No arm loses an edge master typed correctly; any-type match is unchanged (0.945) and grammar on/off parity stays
240/240. With no unit, `scripts/q2-typing-dev.ts world-v1` reproduces master `c5fb0201`'s digest
(`ce8f52bd…`, committed in `test/fixtures/q2-typing-units/world-v1-master.sha256` and checked by
`test/link-typing-units-subsets.test.ts`). The all-unit package changes 7 of 725 extraction lines: U3 drops two
board-worded `works_at` (and their tense rows), and U1 types one "Started advising [X]" occurrence `advises` (with its
dated start) where the investor role prior had typed it `invested_in`. H1 counts all three as newly correct.

## Relation-line variants (H2 runner, dev seeds 1-3, grammar on, `--type-rows`)

| arm | relation-line typed recall | decoy types reached | type rows: correctly typed | relation rows lost vs none | edge rows no longer correctly typed | edge rows newly correct |
|---|---|---|---|---|---|---|
| none | 1.000 | 34/120 | 0.442 | 0 | 0 | 0 |
| U1 | 1.000 | 34/120 | 0.444 | 0 | 0 | 2 |
| U2 | 1.000 | 34/120 | 0.442 | 0 | 0 | 0 |
| U3 | 1.000 | 34/120 | 0.448 | 0 | 0 | 5 |
| U4 | 1.000 | 34/120 | 0.442 | 0 | 0 | 0 |
| U34 | 1.000 | 34/120 | 0.448 | 0 | 0 | 5 |
| U5 | 1.000 | 34/120 | 0.442 | 0 | 0 | 0 |
| U6 | 1.000 | 34/120 | 0.442 | 0 | 0 | 0 |
| all | 1.000 | 34/120 | 0.450 | 0 | 0 | 7 |

Relation-line typed recall stays 1.000, no decoy type is added by any arm (decoy_types_added_by_grammar 0), and no
arm loses a relation line or a correctly typed world-v1 edge.

## Reproduce

```bash
bun scripts/q2-typing-package.ts --base <ref> --arm U2            # or --units U1,U2,U34,U5,U6
bun eval/runner/temporal-edges.ts --gbrain ../gbrain@<sha> --seeds 3,5 --e5-probe \
  --pack eval/data/p3-single-value/works-at-one-per-from.yaml --single-value-pass \
  --dev-phrasing-file ../gbrain/test/fixtures/q2-dev-phrasings/signed-on.json      # in gbrain-evals
GBRAIN_EVAL_CONFIG=line_grammar.enabled=true bun eval/runner/line-grammar-typing.ts --gbrain ../gbrain@<sha>
GBRAIN_EVAL_CONFIG=line_grammar.enabled=true bun eval/runner/relation-line-variants.ts --seeds 1,2,3 --type-rows --gbrain ../gbrain@<sha>
bun scripts/q2-typing-dev.ts dump --evals ../gbrain-evals --root . --units U2 --phrasing test/fixtures/q2-dev-phrasings/signed-on.json --out /tmp/u2.json
bun scripts/q2-typing-dev.ts compare --base /tmp/none.json --arm /tmp/u2.json
```

`--dev-phrasing-file` was patched into a local gbrain-evals copy the way the harness lane adds it (not yet pushed
there when these runs were made). Zero model calls; no paid run.
