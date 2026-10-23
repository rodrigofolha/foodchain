# Period ratings sent by a third account: is a rating still linked to its delivery? (2026-10-11)

Question: a design proposal (not in the code) accepts a rating only against a *period root* of the
worker's ticket tree (the root as it stood at a period boundary, periods of 24 h or 6 h) and has a
third account send the transaction. How well does that hide which delivery a rating refers to? Measured
with the harness of `benchmarking/privacy-eval/` (observer that reads only public data; method in its
README). Every number is in `period-ratings-privacy-2026-10-11.json`. Local in-process Hardhat only
(chainId 31337); nothing was sent to any other network; the contracts were not changed.

Statements are marked **ran** (executed here, output inspected), **simulated** (computed without the
chain on the timeline of deliveries recorded by the chain runs) or **argued**.

## How to read

Each figure is the share of ratings that an observer of public data, who knows the design, assigns to
the right delivery; the result of a case is the figure of its strongest rule, and "uniform" is what a
blind guess among the worker's deliveries of the period gives. With period roots and a third account
as sender, a rating hides among the deliveries the same worker completed in the same period and no
better, so the share linked is set by the worker's volume per period: 9% with 24 h periods (11
deliveries per worker and day here), 33% with 6 h periods (2.8 per worker and period), and 100% for a
delivery that is alone in its worker-period. That holds only when the moment the rater comes back says
nothing about the delivery (behaviours a and b); a rater who comes back at the same time one period
later (c) is linked again from the time of the transaction, 79–80% with 30 min of noise, for either
period. The chain runs are 12 (2 seeds, 4,000 ratings each); the noise sweep, the k rule and the rows
marked *simulated* come from a simulation on the recorded timelines that reproduces the chain runs'
ratings exactly. Arrivals are uniform over the day and the workers are alike: meal-time peaks,
part-time workers, raters who never rate and the off-chain outbox are not modelled.

## Summary

| Period | Rater comes back | **Linked (strongest rule)** | Strongest rule | Uniform guess in the period | Mean candidates | Wait delivery → rating, mean |
|---|---|---|---|---|---|---|
| 24 h | (a) at the boundary + a few minutes | **9.0%** [9.0–9.0] | last under the root (equal to the uniform guess) | 9.0% | 12.1 | 12.5 h |
| 24 h | (b) random time in the next period | **9.4%** [9.0–9.9] | time of day, joint (within noise of the uniform guess) | 9.0% | 12.1 | 24.5 h |
| 24 h | (c) same time next period, noise sd 30 min | **78.8%** [77.8–79.8] | time of day, joint | 8.9% | 12.1 | 24.0 h |
| 6 h | (a) at the boundary + a few minutes | **34.2%** [33.6–34.8] | time of day, joint (within noise of the uniform guess) | 33.2% | 3.7 | 3.1 h |
| 6 h | (b) random time in the next period | **33.9%** [32.6–35.1] | time of day, joint (within noise of the uniform guess) | 33.2% | 3.7 | 6.0 h |
| 6 h | (c) same time next period, noise sd 30 min | **79.6%** [78.8–80.4] | time of day, joint | 32.1% | 3.7 | 6.0 h |

Chain runs, seeds 1 and 2 pooled (8,000 ratings per row), [min–max over the seeds]. Customer and
establishment ratings give the same figures within 2.3 points (section 3).

1. **Behaviours (a) and (b): the rating hides among the worker's deliveries of the period, exactly.**
   No rule does better than a uniform guess among them: 9.0% for 24 h and 33.2% for 6 h (**ran**). The
   rules that name one delivery land on the same value; where the table shows the joint time-of-day
   rule slightly above, the difference is run-to-run noise: over 20 redraws of the return times on each
   timeline its mean is 9.0% and 33.2%, with single runs between 8.1% and 10.3% (24 h) and between
   31.5% and 35.8% (6 h) (**simulated**). The existing harness rule (most recent delivery before the
   rating) and the "last delivery under the root" rule of the relayer report do not exceed it.
2. **Behaviour (c): the time of the transaction gives the delivery away.** If the rater comes back at
   the delivery time plus one period with 30 min (sd) of noise, matching the times links 78.8% (24 h)
   and 79.6% (6 h) of the ratings (**ran**), against 8.9% and 32.1% for the uniform guess. The figure
   depends on the noise and not on the period: 99% at 5 min, 91% at 15 min, 79% at 30 min, 60–62% at
   1 h, 39–41% at 2 h, 22–28% at 4 h (**simulated**, section 4). With 6 h periods and a rater who
   returns at the same time on the next day, the same rule links 79% at 30 min.
3. **The result is a function of the worker's volume in the period** (section 5). Under (a) and (b) a
   delivery in a worker-period of n deliveries is linked with probability 1/n: 100% when alone, 35%
   for 2–4, 13–18% for 5–9, 8% for 10–19, 5% for 20 or more. With 6 h periods 4–5% of the deliveries
   are alone in their worker-period and 67% share it with one to three others; with 24 h periods 75%
   are in a worker-period of 10–19.
4. **A client rule "publish only when k deliveries share the period" trades waiting for set size**
   (**simulated**, section 6). As worded (wait for a period with at least k deliveries of the worker)
   it barely changes 24 h periods at k = 5, and with 6 h periods it leaves 28% of the ratings
   unpublished at k = 5 and all of them at k = 10. Grouping consecutive periods until they hold k
   deliveries works for both: with 6 h periods, k = 5 gives 15.7% linked with a mean wait of 6–9 h, and
   k = 10 gives 8.8% with 11–14 h, about what 24 h periods give without the rule (9.0%, 12.5–24.5 h).
   Under behaviour (c) the rule lowers the figure only in part (6 h, grouping: 61% at k = 5 and 42%
   at k = 10; 24 h: 73–79%).
5. **Against the earlier figures** (section 7): at this delivery volume a relayer without delay is
   linked 99.7%, a relayer with a 5 h random wait by the rater 30%, and 6 h batches 32% when the
   proofs carry no usable root (99.7% as the batches were run, because the root dates the proof). The
   period rule removes the root as a clock, which is what the batch runs lacked, and at equal period
   it gives the batch figure "with the root ignored": 33% at 6 h, 9% at 24 h.
6. **Checks** (**ran**): in all 12 chain runs every proof was made against the tree as of the last
   boundary and was accepted by the unmodified `GlobalReputation` (48,000 ratings, gas-equivalent
   verifiers); a small run with real Groth16 proofs and the real verifiers also passed, including 2
   proofs against a root older than the tree at sending time; two existing arms give the same result
   before and after the change to the workload, apart from the 8 known noise leaves (section 8).

## 1. What was modelled and run

**The proposal** (design file of 2026-10-11, not in the repository). R1: time is cut into periods of
length P with the same boundaries for every worker, and a rating is accepted only against the root of
the worker's tree as it stood at a boundary. R2: the rater never sends the transaction; any funded
account sends it and is reimbursed. R3: after the period of the delivery has ended, the rater's dApp
rebuilds the tree as of the last boundary, proves against that root and hands the rating over.

**How it was run on the unmodified contracts.** R1 only restricts which roots are accepted, and every
period root is a past root, which `GlobalReputation` accepts. So the workload behaves as the proposal
says and the contracts stay as they are: `workload.cjs` has an optional mode (`ratingPeriodSlots`,
section 8) in which each rater (customer and establishment) waits until the period of its delivery has
ended, proves against the worker's tree as it stood at the last boundary before that moment, and the
relayer account of the harness (one account for all ratings) sends the transaction in the same slot.
The contract-side rejection of other roots and the reimbursement of R2 are not part of the experiment.
Boundaries are at slots k·P counted from slot 0 of the run (one slot = 12 s; P = 7200 slots for 24 h,
1800 for 6 h).

**When the rater comes back** (`ratingReturn`):

- **(a) boundary**: at the end of the delivery's period plus the rater's own delay of the harness,
  1 + Exp(mean 25 slots = 5 min). A dApp that is open.
- **(b) uniform**: at a uniform random slot of the following period, independent of the delivery.
- **(c) habit**: at the delivery time plus one period plus Gaussian noise (sd 150 slots = 30 min in
  the chain runs); if that falls before the boundary, as (a). For 24 h periods this is "the same time
  of day, one day later". Section 4 varies the noise and, for 6 h periods, also takes a lag of 24 h.

**The stream.** As the long run of the relayer report (2,000 orders, 20 establishments, 45 workers,
400 customers, one zone, cash-out `S3:10:p5`) with the arrivals stretched from 13 h to 3.8 days:
`orderIntervalPerEst` 275 instead of 40 (0.073 orders per slot, Poisson, uniform over the day). The
last delivery is at slot 27,002 (seed 1) and 27,429 (seed 2), 3.75 and 3.81 days. A worker has
44.4 deliveries in the run on average. Resulting volume (**ran**):

| Period | Seed | Periods with deliveries | Deliveries per worker and period: mean (median, p10–p90, max) | Worker-periods without a delivery | Worker's deliveries in the period, as seen by a delivery: mean (median) | Share of deliveries in a worker-period of 1 / 2-4 / 5-9 / 10-19 / 20+ deliveries |
|---|---|---|---|---|---|---|
| 24h | 1 | 4 | 11.11 (11, 7–15, 22) | 0.0% | 12.13 (12) | 0.1% / 0.2% / 22.4% / 75.2% / 2.1% |
| 24h | 2 | 4 | 11.11 (11, 7–16, 20) | 0.0% | 12.15 (12) | 0.0% / 0.6% / 22.4% / 75.0% / 2.0% |
| 6h | 1 | 16 | 2.78 (3, 1–5, 8) | 9.3% | 3.73 (4) | 4.4% / 67.3% / 28.3% / 0.0% / 0.0% |
| 6h | 2 | 16 | 2.78 (3, 1–5, 9) | 6.3% | 3.72 (3) | 5.3% / 67.5% / 27.1% / 0.0% / 0.0% |

So a worker completes 11.1 deliveries per 24 h period and 2.8 per 6 h period on average. The fourth
day is shorter (409 and 418 deliveries against 512–551 on the other days), and the sixteenth 6 h
period holds 1 delivery (seed 1) and 36 (seed 2); the tables of section 3 give each figure also
without the last period. The workers are alike (a free worker is drawn uniformly), so the spread
between worker-periods is the Poisson spread only.

**Runs.** 12 chain runs: 2 periods × 3 behaviours × seeds 1 and 2; 2,000 concluded orders and 4,000
ratings each, all complete, none retried; 11–14 min and 4.1–4.9 GB peak RSS each, two at a time.
Hardhat 2.28.6 in-process (EDR), Node v20.20.2, 16 CPUs (i5-12500H), 17 GB. Proofs: the harness's
default emulation (gas-equivalent verifiers, placeholder proofs, real public signals; roots and
nullifiers are checked by the real `GlobalReputation`).

```bash
# the grid: 12 experiments, two at a time
PE_WORKDIR=<dir> PARALLEL=2 node benchmarking/privacy-eval/period-ratings/sweep.cjs
# one experiment (the exact command of each is in the JSON, chain.runs[].command)
PE_CONFIG='{"label":"P24h/b-uniform/seed1","arm":"RELAYER","strategy":"S3:10:p5","E":20,"N":2000,"orderIntervalPerEst":275,"ratingPeriodSlots":7200,"ratingReturn":"uniform","seed":1}' \
  PE_OUT=<dir>/P24h_b-uniform_seed1.json MIMALLOC_PURGE_DELAY=0 HARDHAT_NETWORK=hardhat \
  npx hardhat run --no-compile benchmarking/privacy-eval/period-ratings/run-period.cjs
# rules, simulations and the JSON of this folder (plain Node, no chain; about 2 min)
PE_WORKDIR=<dir> DATE=2026-10-11 CHECK_FILE=<check.json> EXTRA_FILE=<extra.json> node benchmarking/privacy-eval/period-ratings/report.cjs
```

| Point | `PE_CONFIG` beyond the base `{"arm":"RELAYER","strategy":"S3:10:p5","E":20,"N":2000,"orderIntervalPerEst":275}` and `"seed"` (1, 2) |
|---|---|
| P24h / P6h | `"ratingPeriodSlots":7200` / `1800` |
| a-boundary | `"ratingReturn":"boundary"` |
| b-uniform | `"ratingReturn":"uniform"` |
| c-habit | `"ratingReturn":"habit","ratingHabitSigma":150` |

The time and the worker of every delivery are the same in the six runs of a seed (**ran**: the
delivery lists are identical, `chain.timelineCheck` in the JSON): the ratings hold no resource of the
workload, and their return times are drawn from a generator of their own.

## 2. The observer

It reads the chain only, as `observer.cjs`: the orders with their worker and the time of their
`deliveryOrder`; each `submitRating` transaction with its worker, its time and the root in its
calldata; and the `TicketAdded` events, from which it rebuilds every worker's tree and reads, for each
root, how many deliveries of the worker are under it. It knows the design: the period, the boundaries
and what the dApp does. It does not use the sender (one account for all ratings), the score, the
nullifier, or the order of the transactions inside a slot (section 9).

| Rule | Candidates | Answer |
|---|---|---|
| Harness rule (`observer.cjs`, P5) | the worker's deliveries before the rating transaction | the most recent one |
| Last under the root (relayer report, 5.2) | the worker's deliveries under the proof's root | the last one |
| Uniform in the closed period | the worker's deliveries of the period that the root closes (the last period with deliveries under the root) | none: the expected value of a uniform guess |
| Last of the closed period | the same | the last one (one fixed choice; equals the uniform expectation when every rating of the period is published) |
| Time of day, per rating | the deliveries under the root; reported against the closed period | the delivery whose time + one period is closest to the rating |
| Time of day, joint | the same | least-squares assignment of all the ratings of a worker to its deliveries, two ratings per delivery, each rating to a delivery under its root |

The harness rule is computed by the unchanged `observer.cjs` and `score.cjs`; recomputed on the
recorded timeline it gives the same counts in every run (**ran**, `checks.harnessRuleEqualsScorer`).
The other rules are in `period-ratings/rules.cjs`; `report.cjs` applies them to the public timeline
each chain run recorded. The joint rule is the most likely assignment when the noise is Gaussian, and
it uses a fact of the workload that favours the observer: every delivery receives exactly two ratings.

*Linked* = share of ratings whose answer is the true delivery; *uniform* = what a uniform guess among
the rule's candidates gets (zero for a rating whose true delivery is not among them); *candidates* =
mean number of candidates.

## 3. Results of the chain runs (**ran**)

Period 24h, behaviour (b) random time in the next period (seeds 1, 2; 8000 ratings; pooled [min–max over the seeds]):

| Observer rule | Linked, all ratings | Customer | Establishment | Uniform guess among the rule's candidates | Mean candidates | True delivery among the candidates | Linked, without the last period of the stream |
|---|---|---|---|---|---|---|---|
| most recent delivery before the rating (harness rule) | 2.8% [2.7%–2.9%] | 2.8% | 2.8% | 3.6% | 33.23 | 100.0% | 0.7% |
| last delivery under the proof's root | 9.0% [9.0%–9.0%] | 9.0% | 9.0% | 4.6% | 28.69 | 100.0% | 8.5% |
| uniform among the deliveries of the period the root closes | 9.0% [9.0%–9.0%] | 9.0% | 9.0% | 9.0% | 12.14 | 100.0% | 8.5% |
| last delivery of the period the root closes | 9.0% [9.0%–9.0%] | 9.0% | 9.0% | 9.0% | 12.14 | 100.0% | 8.5% |
| time of day, per rating | 8.8% [8.8%–8.8%] | 8.6% | 9.0% | 9.0% | 12.14 | 100.0% | 8.6% |
| **time of day, joint assignment** (strongest) | 9.4% [9.0%–9.9%] | 10.1% | 8.8% | 9.0% | 12.14 | 100.0% | 8.9% |

Period 24h, behaviour (c) same time one period later (seeds 1, 2; 8000 ratings; pooled [min–max over the seeds]):

| Observer rule | Linked, all ratings | Customer | Establishment | Uniform guess among the rule's candidates | Mean candidates | True delivery among the candidates | Linked, without the last period of the stream |
|---|---|---|---|---|---|---|---|
| most recent delivery before the rating (harness rule) | 2.3% [2.3%–2.3%] | 2.3% | 2.3% | 3.6% | 33.24 | 100.0% | 0.0% |
| last delivery under the proof's root | 8.3% [8.1%–8.4%] | 8.2% | 8.3% | 4.5% | 28.78 | 100.0% | 7.6% |
| uniform among the deliveries of the period the root closes | 8.9% [8.9%–8.9%] | 8.9% | 8.9% | 8.9% | 12.12 | 99.2% | 8.4% |
| last delivery of the period the root closes | 8.3% [8.1%–8.4%] | 8.2% | 8.3% | 8.9% | 12.12 | 99.2% | 7.6% |
| time of day, per rating | 74.9% [74.3%–75.5%] | 74.4% | 75.4% | 8.9% | 12.12 | 99.2% | 74.7% |
| **time of day, joint assignment** (strongest) | 78.8% [77.8%–79.8%] | 78.5% | 79.2% | 8.9% | 12.12 | 99.2% | 78.8% |

Period 24h, behaviour (a) at the boundary (seeds 1, 2; 8000 ratings; pooled [min–max over the seeds]):

| Observer rule | Linked, all ratings | Customer | Establishment | Uniform guess among the rule's candidates | Mean candidates | True delivery among the candidates | Linked, without the last period of the stream |
|---|---|---|---|---|---|---|---|
| most recent delivery before the rating (harness rule) | 8.7% [8.6%–8.7%] | 8.7% | 8.6% | 4.6% | 28.72 | 100.0% | 8.1% |
| **last delivery under the proof's root** (strongest) | 9.0% [9.0%–9.0%] | 9.0% | 9.0% | 4.6% | 28.69 | 100.0% | 8.5% |
| uniform among the deliveries of the period the root closes | 9.0% [9.0%–9.0%] | 9.0% | 9.0% | 9.0% | 12.14 | 100.0% | 8.5% |
| last delivery of the period the root closes | 9.0% [9.0%–9.0%] | 9.0% | 9.0% | 9.0% | 12.14 | 100.0% | 8.5% |
| time of day, per rating | 5.6% [5.6%–5.6%] | 5.7% | 5.6% | 9.0% | 12.14 | 100.0% | 5.8% |
| time of day, joint assignment | 8.3% [7.9%–8.7%] | 8.1% | 8.5% | 9.0% | 12.14 | 100.0% | 8.0% |

Period 6h, behaviour (b) random time in the next period (seeds 1, 2; 8000 ratings; pooled [min–max over the seeds]):

| Observer rule | Linked, all ratings | Customer | Establishment | Uniform guess among the rule's candidates | Mean candidates | True delivery among the candidates | Linked, without the last period of the stream |
|---|---|---|---|---|---|---|---|
| most recent delivery before the rating (harness rule) | 11.5% [11.3%–11.6%] | 11.2% | 11.7% | 6.2% | 25.85 | 100.0% | 10.9% |
| last delivery under the proof's root | 33.2% [32.6%–33.8%] | 33.2% | 33.2% | 7.4% | 24.48 | 100.0% | 32.9% |
| uniform among the deliveries of the period the root closes | 33.2% [32.7%–33.8%] | 33.2% | 33.2% | 33.2% | 3.73 | 100.0% | 32.9% |
| last delivery of the period the root closes | 33.2% [32.6%–33.8%] | 33.2% | 33.2% | 33.2% | 3.73 | 100.0% | 32.9% |
| time of day, per rating | 31.8% [30.9%–32.7%] | 31.9% | 31.8% | 33.2% | 3.73 | 100.0% | 31.5% |
| **time of day, joint assignment** (strongest) | 33.9% [32.6%–35.1%] | 34.0% | 33.7% | 33.2% | 3.73 | 100.0% | 33.6% |

Period 6h, behaviour (c) same time one period later (seeds 1, 2; 8000 ratings; pooled [min–max over the seeds]):

| Observer rule | Linked, all ratings | Customer | Establishment | Uniform guess among the rule's candidates | Mean candidates | True delivery among the candidates | Linked, without the last period of the stream |
|---|---|---|---|---|---|---|---|
| most recent delivery before the rating (harness rule) | 6.2% [6.0%–6.3%] | 6.2% | 6.1% | 6.2% | 25.87 | 100.0% | 5.6% |
| last delivery under the proof's root | 30.2% [29.3%–31.1%] | 30.0% | 30.3% | 7.3% | 24.58 | 100.0% | 29.8% |
| uniform among the deliveries of the period the root closes | 32.1% [31.4%–32.8%] | 32.0% | 32.2% | 32.1% | 3.70 | 96.7% | 31.8% |
| last delivery of the period the root closes | 30.2% [29.3%–31.1%] | 30.0% | 30.3% | 32.1% | 3.70 | 96.7% | 29.8% |
| time of day, per rating | 75.9% [75.6%–76.1%] | 75.3% | 76.4% | 32.1% | 3.70 | 96.7% | 75.8% |
| **time of day, joint assignment** (strongest) | 79.6% [78.8%–80.4%] | 79.4% | 79.8% | 32.1% | 3.70 | 96.7% | 79.6% |

Period 6h, behaviour (a) at the boundary (seeds 1, 2; 8000 ratings; pooled [min–max over the seeds]):

| Observer rule | Linked, all ratings | Customer | Establishment | Uniform guess among the rule's candidates | Mean candidates | True delivery among the candidates | Linked, without the last period of the stream |
|---|---|---|---|---|---|---|---|
| most recent delivery before the rating (harness rule) | 31.8% [30.8%–32.8%] | 31.9% | 31.7% | 7.3% | 24.52 | 100.0% | 31.4% |
| last delivery under the proof's root | 33.2% [32.6%–33.8%] | 33.2% | 33.2% | 7.4% | 24.48 | 100.0% | 32.9% |
| uniform among the deliveries of the period the root closes | 33.2% [32.7%–33.8%] | 33.2% | 33.2% | 33.2% | 3.73 | 100.0% | 32.9% |
| last delivery of the period the root closes | 33.2% [32.6%–33.8%] | 33.2% | 33.2% | 33.2% | 3.73 | 100.0% | 32.9% |
| time of day, per rating | 19.4% [19.3%–19.5%] | 19.3% | 19.5% | 33.2% | 3.73 | 100.0% | 19.1% |
| **time of day, joint assignment** (strongest) | 34.2% [33.6%–34.8%] | 35.4% | 33.1% | 33.2% | 3.73 | 100.0% | 34.0% |

- **(a), (b).** The three rules that use the root as the design intends give the same number, which
  is the mean of 1/n over the ratings, n being the worker's deliveries in the period: exactly
  (worker-periods with a delivery × 2) / ratings, 360/4000 for 24 h and 1306/4000 and 1350/4000 for
  6 h. The time-of-day rules have nothing to use and scatter around it. The harness rule is far below
  under (b), because it looks at deliveries made after the boundary, which the root excludes.
- **(c).** The uniform guess is unchanged, but the per-rating time rule links three quarters of the
  ratings and the joint rule a little more. "True delivery among the candidates" falls below 100%
  because a rating that comes back after a second boundary carries a later root; the time rules look
  at every delivery under the root and are not affected.
- The strongest rule of each table is the one with the highest pooled figure. Under (a) and (b) that
  choice is made among figures that differ by noise (point 1 of the summary).

## 4. Behaviour (c) and the noise; the simulation (**simulated**)

The simulation (`period-ratings/simulate.cjs`) takes the deliveries of a chain run (worker, time, and
the raters' own delays) and computes the return time of every rating with the function the workload
itself uses (`periodReturnSlot`), then the root of the last boundary before it. With the configuration
of a chain run it must give that run's rating transactions:

| Chain run | Ratings | Ratings with the same delivery, rater, slot and root in the simulation | Difference in linked ratings per rule (simulation − chain) |
|---|---|---|---|
| P24h/b-uniform/seed1 | 4000 | 4000 | 0 / 0 / 0 / 0 / 0 / 0 |
| P6h/b-uniform/seed1 | 4000 | 4000 | 0 / 0 / 0 / 0 / 0 / 0 |
| P24h/b-uniform/seed2 | 4000 | 4000 | 0 / 0 / 0 / 0 / 0 / 0 |
| P6h/b-uniform/seed2 | 4000 | 4000 | -1 / 0 / 0 / 0 / 0 / 0 |
| P24h/c-habit/seed1 | 4000 | 4000 | 0 / 0 / 0 / 0 / 0 / 0 |
| P6h/c-habit/seed1 | 4000 | 4000 | 0 / 0 / 0 / 0 / 0 / 0 |
| P24h/c-habit/seed2 | 4000 | 4000 | 0 / 0 / 0 / 0 / 0 / 0 |
| P6h/c-habit/seed2 | 4000 | 4000 | 0 / 0 / 0 / 0 / 0 / 0 |
| P24h/a-boundary/seed1 | 4000 | 4000 | 0 / 0 / 0 / 0 / 0 / 0 |
| P6h/a-boundary/seed1 | 4000 | 4000 | -3 / 0 / 0 / 0 / 0 / 0 |
| P24h/a-boundary/seed2 | 4000 | 4000 | 0 / 0 / 0 / 0 / 0 / 0 |
| P6h/a-boundary/seed2 | 4000 | 4000 | -1 / 0 / 0 / 0 / 0 / 0 |

The only differences are in the harness rule (1, 3 and 1 ratings in three runs): it goes by block
order and the simulation by slot, which differ when a rating is mined in the same slot as a delivery
of its worker (not checked rating by rating). On that basis the other behaviours, noise levels and
rules are computed on the two timelines, with 20 draws of the return times per timeline (the first is
the chain run's; (a) has no draw of its own). Figures: pooled, [min–max over the single draws].

| Period | Behaviour | Ratings scored | most recent delivery before the rating (harness rule) | last delivery under the proof's root | uniform among the deliveries of the period the root closes | time of day, per rating | time of day, joint assignment | Uniform in the closed period: mean candidates | Strongest | Wait delivery → rating: mean (median, p90) |
|---|---|---|---|---|---|---|---|---|---|---|
| 24h | (a) at the boundary + 1 + Exp(5 min) | 8000 | 8.7% [8.6%–8.7%] | 9.0% [9.0%–9.0%] | 9.0% [9.0%–9.0%] | 5.6% [5.6%–5.6%] | 8.3% [7.9%–8.7%] | 12.14 | last delivery under the proof's root | 12.5 h (12.8 h, 21.7 h) |
| 24h | (b) uniform in the next period | 160000 | 2.8% [2.5%–3.1%] | 9.0% [9.0%–9.0%] | 9.0% [9.0%–9.0%] | 8.9% [8.2%–9.8%] | 9.0% [8.1%–10.3%] | 12.14 | time of day, joint assignment | 24.5 h (24.5 h, 37.5 h) |
| 24h | (c) one period later, noise sd 5 min | 160000 | 2.3% [2.3%–2.3%] | 8.9% [8.8%–9.0%] | 9.0% [9.0%–9.0%] | 98.8% [98.4%–99.3%] | 99.4% [99.0%–99.7%] | 12.14 | time of day, joint assignment | 24.0 h (24.0 h, 24.1 h) |
| 24h | (c) one period later, noise sd 15 min | 160000 | 2.3% [2.3%–2.3%] | 8.7% [8.5%–8.9%] | 9.0% [9.0%–9.0%] | 88.9% [88.0%–89.7%] | 91.3% [90.4%–92.5%] | 12.13 | time of day, joint assignment | 24.0 h (24.0 h, 24.3 h) |
| 24h | (c) one period later, noise sd 30 min | 160000 | 2.3% [2.3%–2.3%] | 8.4% [8.1%–8.7%] | 8.9% [8.9%–9.0%] | 75.1% [73.5%–77.2%] | 79.0% [77.4%–80.9%] | 12.13 | time of day, joint assignment | 24.0 h (24.0 h, 24.6 h) |
| 24h | (c) one period later, noise sd 60 min | 160000 | 2.3% [2.3%–2.3%] | 7.9% [7.5%–8.2%] | 8.9% [8.8%–8.9%] | 56.2% [54.3%–58.4%] | 60.0% [58.1%–62.1%] | 12.11 | time of day, joint assignment | 24.0 h (24.0 h, 25.3 h) |
| 24h | (c) one period later, noise sd 120 min | 160000 | 2.3% [2.3%–2.3%] | 7.3% [6.8%–7.6%] | 8.8% [8.7%–8.8%] | 36.9% [35.8%–38.4%] | 38.6% [36.4%–40.9%] | 12.09 | time of day, joint assignment | 24.0 h (24.0 h, 26.6 h) |
| 24h | (c) one period later, noise sd 240 min | 160000 | 2.3% [2.3%–2.3%] | 6.7% [6.2%–7.0%] | 8.5% [8.5%–8.6%] | 22.2% [20.8%–23.4%] | 22.1% [20.5%–23.6%] | 12.04 | time of day, per rating | 24.2 h (24.0 h, 29.1 h) |
| 6h | (a) at the boundary + 1 + Exp(5 min) | 8000 | 31.7% [30.7%–32.7%] | 33.2% [32.6%–33.8%] | 33.2% [32.7%–33.8%] | 19.4% [19.3%–19.5%] | 34.2% [33.6%–34.8%] | 3.73 | time of day, joint assignment | 3.1 h (3.1 h, 5.5 h) |
| 6h | (b) uniform in the next period | 160000 | 11.4% [10.7%–12.4%] | 33.2% [32.6%–33.8%] | 33.2% [32.7%–33.8%] | 31.3% [29.1%–33.5%] | 33.2% [31.5%–35.8%] | 3.73 | time of day, joint assignment | 6.0 h (6.0 h, 9.3 h) |
| 6h | (c) one period later, noise sd 5 min | 160000 | 6.0% [5.8%–6.3%] | 32.8% [32.0%–33.5%] | 33.0% [32.4%–33.7%] | 98.8% [98.4%–99.3%] | 99.4% [99.0%–99.7%] | 3.73 | time of day, joint assignment | 6.0 h (6.0 h, 6.1 h) |
| 6h | (c) one period later, noise sd 15 min | 160000 | 6.1% [5.8%–6.3%] | 31.8% [30.8%–32.7%] | 32.7% [32.0%–33.4%] | 89.1% [88.3%–90.0%] | 91.5% [90.5%–92.8%] | 3.72 | time of day, joint assignment | 6.0 h (6.0 h, 6.3 h) |
| 6h | (c) one period later, noise sd 30 min | 160000 | 6.1% [5.9%–6.4%] | 30.5% [29.3%–31.6%] | 32.2% [31.4%–33.0%] | 76.0% [74.6%–78.1%] | 79.6% [78.0%–81.5%] | 3.71 | time of day, joint assignment | 6.0 h (6.0 h, 6.6 h) |
| 6h | (c) one period later, noise sd 60 min | 160000 | 6.5% [6.2%–6.9%] | 28.4% [27.4%–29.7%] | 31.2% [30.5%–32.0%] | 58.4% [57.0%–60.2%] | 61.5% [59.5%–63.8%] | 3.69 | time of day, joint assignment | 6.0 h (6.0 h, 7.3 h) |
| 6h | (c) one period later, noise sd 120 min | 160000 | 7.8% [7.3%–8.5%] | 25.5% [24.4%–26.7%] | 29.2% [28.4%–30.0%] | 40.9% [39.9%–41.9%] | 41.4% [39.1%–43.8%] | 3.65 | time of day, joint assignment | 6.2 h (6.0 h, 8.6 h) |
| 6h | (c) one period later, noise sd 240 min | 160000 | 10.8% [10.0%–11.8%] | 22.7% [21.5%–23.7%] | 25.7% [24.8%–26.5%] | 27.6% [26.3%–28.6%] | 25.5% [23.5%–26.9%] | 3.57 | time of day, per rating | 6.7 h (6.0 h, 11.1 h) |
| 6h | (c') 24 h later with 6 h periods, noise sd 15 min | 160000 | 2.3% [2.3%–2.3%] | 2.3% [2.3%–2.3%] | 2.3% [2.3%–2.3%] | 88.8% [87.8%–89.6%] | 91.3% [90.3%–92.5%] | 3.03 | time of day, joint assignment | 24.0 h (24.0 h, 24.3 h) |
| 6h | (c') 24 h later with 6 h periods, noise sd 30 min | 160000 | 2.3% [2.3%–2.3%] | 2.3% [2.3%–2.3%] | 2.3% [2.3%–2.3%] | 74.9% [73.1%–76.9%] | 78.9% [77.2%–80.9%] | 3.03 | time of day, joint assignment | 24.0 h (24.0 h, 24.6 h) |
| 6h | (c') 24 h later with 6 h periods, noise sd 60 min | 160000 | 2.3% [2.3%–2.3%] | 2.3% [2.3%–2.3%] | 2.3% [2.3%–2.3%] | 55.7% [53.7%–57.7%] | 59.6% [57.7%–61.8%] | 3.02 | time of day, joint assignment | 24.0 h (24.0 h, 25.3 h) |
| 6h | (c') 24 h later with 6 h periods, noise sd 120 min | 160000 | 2.3% [2.3%–2.3%] | 2.3% [2.3%–2.3%] | 2.3% [2.2%–2.3%] | 35.9% [34.9%–37.4%] | 37.8% [35.9%–40.4%] | 3.02 | time of day, joint assignment | 24.0 h (24.0 h, 26.6 h) |

- Under (c) the linked share falls with the noise and is the same for both periods at a given noise,
  because what matters is how many deliveries of the worker fall within the noise around the right
  time of day: at one delivery per worker every 2.1 h, a noise of 30 min leaves most deliveries
  distinguishable. A worker with denser deliveries is better hidden (section 5).
- With 6 h periods and a lag of 24 h (rows c'), the rating carries the root of the last boundary, three
  periods after the delivery's own, so the rules built on "the period the root closes" find nothing
  (2.3%) while the time rules link as much as before.
- At a noise of 4 h with 6 h periods the per-rating rule is ahead of the joint one; the two are within
  about two points from 2 h on.

## 5. By the number of deliveries the worker made in the period

Chain runs (pooled over the seeds); in each cell: linked by the strongest rule of the point / uniform guess in the closed period (ratings).

| Period | Behaviour | Strongest rule | 1 | 2-4 | 5-9 | 10-19 | 20+ |
|---|---|---|---|---|---|---|---|
| 24h | (b) random time in the next period | time of day, joint assignment | 100.0% / 100.0% (2) | 15.6% / 25.0% (32) | 14.5% / 13.0% (1794) | 7.9% / 7.8% (6008) | 7.3% / 4.9% (164) |
| 24h | (c) same time one period later | time of day, joint assignment | 100.0% / 100.0% (2) | 90.6% / 25.0% (32) | 84.1% / 13.0% (1794) | 77.5% / 7.7% (6008) | 68.3% / 4.8% (164) |
| 24h | (a) at the boundary | last delivery under the proof's root | 100.0% / 100.0% (2) | 25.0% / 25.0% (32) | 13.0% / 13.0% (1794) | 7.8% / 7.8% (6008) | 4.9% / 4.9% (164) |
| 6h | (b) random time in the next period | time of day, joint assignment | 100.0% / 100.0% (390) | 35.9% / 34.7% (5394) | 17.1% / 17.8% (2216) | none | none |
| 6h | (c) same time one period later | time of day, joint assignment | 97.9% / 97.2% (390) | 82.9% / 33.6% (5394) | 68.3% / 17.2% (2216) | none | none |
| 6h | (a) at the boundary | time of day, joint assignment | 100.0% / 100.0% (390) | 36.0% / 34.7% (5394) | 18.2% / 17.8% (2216) | none | none |

Simulation (2 timelines x draws as in S1); same cells, with the time-of-day joint rule for (c) and the uniform rule otherwise.

| Period | Behaviour | 1 | 2-4 | 5-9 | 10-19 | 20+ |
|---|---|---|---|---|---|---|
| 24h | (a) at the boundary + 1 + Exp(5 min) | 100.0% / 100.0% (2) | 25.0% / 25.0% (32) | 13.0% / 13.0% (1794) | 7.8% / 7.8% (6008) | 4.9% / 4.9% (164) |
| 24h | (b) uniform in the next period | 100.0% / 100.0% (40) | 25.0% / 25.0% (640) | 13.0% / 13.0% (35880) | 7.8% / 7.8% (120160) | 4.9% / 4.9% (3280) |
| 24h | (c) one period later, noise sd 30 min | 100.0% / 100.0% (40) | 93.1% / 25.0% (640) | 84.9% / 13.0% (35880) | 77.4% / 7.7% (120160) | 69.6% / 4.8% (3280) |
| 6h | (a) at the boundary + 1 + Exp(5 min) | 100.0% / 100.0% (390) | 34.7% / 34.7% (5394) | 17.8% / 17.8% (2216) | none | none |
| 6h | (b) uniform in the next period | 100.0% / 100.0% (7800) | 34.7% / 34.7% (107880) | 17.8% / 17.8% (44320) | none | none |
| 6h | (c) one period later, noise sd 30 min | 98.7% / 97.5% (7800) | 82.8% / 33.6% (107880) | 68.3% / 17.3% (44320) | none | none |

- Under (a) and (b) the cell is 1/n averaged over the bucket, by construction of the rule: 100%, about
  35% (25% in the few 24 h cases), 13–18%, 8%, 5%. The chain figures of the strongest rule scatter
  around the uniform ones where a bucket is small.
- Under (c) the bucket matters much less: 68–70% of the ratings are still linked in worker-periods of
  20 or more deliveries (24 h), because the time rule separates deliveries by their time, not by
  their number.
- The buckets 1 and 2–4 of the 24 h runs and the bucket 20+ hold few ratings (2, 32 and 164 of 8,000
  in the chain runs), and no 6 h worker-period has 10 deliveries. Part-time workers, who would fill
  the low buckets of a 24 h period, are not in the workload: for them read the 6 h rows.

## 6. Client rule: do not publish until at least k deliveries of the worker share the root's period (**simulated**)

Two readings were computed. Both are public functions of the worker's deliveries, so every rater and
the observer compute the same groups, and the observer's uniform guess is taken in the published group.

- **thick**: the ratings of a delivery wait for the end of the first period, from the delivery's own
  on, in which the worker made at least k deliveries; the ratings of the thinner periods before it are
  published with it. This is the rule as worded.
- **accumulate**: from the worker's first delivery, consecutive periods are grouped until the group
  holds at least k deliveries, and the group is published at the end of its last period.

A third reading, in which each rater counts forward from its own period until k deliveries have
accumulated, was not computed: the groups then overlap, and the set of deliveries released at one
boundary can be smaller than k (three consecutive periods of 2 deliveries with k = 5 release the first
two alone) (**argued**).

After the release boundary the rater comes back as in (a), (b) or (c) (for (c): at the same time
within the period, in the first period after the release, noise sd 30 min). "Not published" are the
ratings whose group was not complete when the stream ended; in a continuing stream those of a worker
who stops delivering would stay unpublished unless the dApp gives up the rule after some time.

| Period | Behaviour | Rule | Ratings not published within the run | Linked: uniform in the published group | Mean candidates | Smallest group | Linked: strongest rule tried | Wait delivery → rating, published ones: mean (median, p90) |
|---|---|---|---|---|---|---|---|---|
| 24h | (a) at the boundary | none | 0.0% | 9.0% | 12.14 | – | 9.0% (last delivery of the period the root closes) | 12.5 h (12.8 h, 21.7 h) |
| 24h | (a) at the boundary | k = 5, thick | 0.2% | 8.9% | 12.22 | 5 | 8.9% (last delivery of the period the root closes) | 12.6 h (12.8 h, 21.7 h) |
| 24h | (a) at the boundary | k = 10, thick | 12.8% | 6.8% | 16.06 | 10 | 6.8% (uniform among the deliveries of the period the root closes) | 15.9 h (14.0 h, 27.4 h) |
| 24h | (a) at the boundary | k = 5, accumulate | 0.2% | 8.9% | 12.22 | 5 | 8.9% (last delivery of the period the root closes) | 12.6 h (12.8 h, 21.7 h) |
| 24h | (a) at the boundary | k = 10, accumulate | 8.9% | 7.1% | 14.96 | 10 | 7.1% (uniform among the deliveries of the period the root closes) | 15.1 h (14.0 h, 26.4 h) |
| 24h | (b) uniform in the next period | none | 0.0% | 9.0% | 12.14 | – | 9.0% (time of day, joint assignment) | 24.5 h (24.5 h, 37.5 h) |
| 24h | (b) uniform in the next period | k = 5, thick | 0.2% | 8.9% | 12.22 | 5 | 8.9% (time of day, joint assignment) | 24.5 h (24.5 h, 37.6 h) |
| 24h | (b) uniform in the next period | k = 10, thick | 12.8% | 6.8% | 16.06 | 10 | 6.8% (uniform among the deliveries of the period the root closes) | 27.9 h (26.0 h, 43.8 h) |
| 24h | (b) uniform in the next period | k = 5, accumulate | 0.2% | 8.9% | 12.22 | 5 | 8.9% (time of day, joint assignment) | 24.5 h (24.5 h, 37.6 h) |
| 24h | (b) uniform in the next period | k = 10, accumulate | 8.9% | 7.1% | 14.96 | 10 | 7.1% (uniform among the deliveries of the period the root closes) | 27.1 h (26.0 h, 42.9 h) |
| 24h | (c) one period later, noise sd 30 min | none | 0.0% | 8.9% | 12.13 | – | 79.0% (time of day, joint assignment) | 24.0 h (24.0 h, 24.6 h) |
| 24h | (c) one period later, noise sd 30 min | k = 5, thick | 0.2% | 8.8% | 12.21 | 5 | 78.8% (time of day, joint assignment) | 24.1 h (24.0 h, 24.6 h) |
| 24h | (c) one period later, noise sd 30 min | k = 10, thick | 12.8% | 6.8% | 16.05 | 10 | 72.8% (time of day, joint assignment) | 27.5 h (24.1 h, 47.5 h) |
| 24h | (c) one period later, noise sd 30 min | k = 5, accumulate | 0.2% | 8.8% | 12.21 | 5 | 78.8% (time of day, joint assignment) | 24.1 h (24.0 h, 24.6 h) |
| 24h | (c) one period later, noise sd 30 min | k = 10, accumulate | 8.9% | 7.0% | 14.94 | 10 | 74.1% (time of day, joint assignment) | 26.7 h (24.1 h, 47.4 h) |
| 6h | (a) at the boundary | none | 0.0% | 33.2% | 3.73 | – | 34.2% (time of day, joint assignment) | 3.1 h (3.1 h, 5.5 h) |
| 6h | (a) at the boundary | k = 5, thick | 28.1% | 6.9% | 20.25 | 5 | 7.1% (time of day, joint assignment) | 17.6 h (11.1 h, 43.7 h) |
| 6h | (a) at the boundary | k = 10, thick | 100.0% | n/a | n/a | – | n/a | n/a |
| 6h | (a) at the boundary | k = 5, accumulate | 3.0% | 15.7% | 6.68 | 5 | 16.4% (time of day, joint assignment) | 6.1 h (5.2 h, 11.7 h) |
| 6h | (a) at the boundary | k = 10, accumulate | 8.1% | 8.8% | 11.50 | 10 | 8.8% (uniform among the deliveries of the period the root closes) | 11.1 h (9.9 h, 21.8 h) |
| 6h | (b) uniform in the next period | none | 0.0% | 33.2% | 3.73 | – | 33.2% (time of day, joint assignment) | 6.0 h (6.0 h, 9.3 h) |
| 6h | (b) uniform in the next period | k = 5, thick | 28.1% | 6.9% | 20.25 | 5 | 6.9% (last delivery of the period the root closes) | 20.5 h (13.9 h, 46.7 h) |
| 6h | (b) uniform in the next period | k = 10, thick | 100.0% | n/a | n/a | – | n/a | n/a |
| 6h | (b) uniform in the next period | k = 5, accumulate | 3.0% | 15.7% | 6.68 | 5 | 15.7% (uniform among the deliveries of the period the root closes) | 9.0 h (8.2 h, 15.3 h) |
| 6h | (b) uniform in the next period | k = 10, accumulate | 8.1% | 8.8% | 11.50 | 10 | 8.8% (time of day, joint assignment) | 14.0 h (12.9 h, 24.8 h) |
| 6h | (c) one period later, noise sd 30 min | none | 0.0% | 32.2% | 3.71 | – | 79.6% (time of day, joint assignment) | 6.0 h (6.0 h, 6.6 h) |
| 6h | (c) one period later, noise sd 30 min | k = 5, thick | 28.1% | 6.8% | 20.21 | 5 | 32.3% (time of day, joint assignment) | 20.5 h (12.4 h, 47.8 h) |
| 6h | (c) one period later, noise sd 30 min | k = 10, thick | 100.0% | n/a | n/a | – | n/a | n/a |
| 6h | (c) one period later, noise sd 30 min | k = 5, accumulate | 3.0% | 15.6% | 6.67 | 5 | 61.1% (time of day, joint assignment) | 9.0 h (6.5 h, 12.8 h) |
| 6h | (c) one period later, noise sd 30 min | k = 10, accumulate | 8.1% | 8.8% | 11.50 | 10 | 41.9% (time of day, joint assignment) | 14.0 h (12.2 h, 24.2 h) |

- 24 h periods: k = 5 changes almost nothing (99.6% of the deliveries are already in a worker-period
  of 5 or more); k = 10 lowers the linked share from 9.0% to 6.8–7.1% and adds 3 h to the mean wait,
  with 9–13% of the ratings still waiting at the end of the run.
- 6 h periods: "thick" is not usable (28% unpublished at k = 5 with a mean wait of 18–21 h for the
  rest, nothing published at k = 10: no worker-period reaches 10). "Accumulate" gives 15.7% at k = 5
  and 8.8% at k = 10 under (a) and (b), with mean waits of 6–9 h and 11–14 h.
- The smallest published group is k in every case, so the worst case goes from "alone, linked with
  certainty" to 1/k.
- Under (c) the time rules, adapted to the deferral, still link 79% (24 h, k = 5), 73–74% (24 h,
  k = 10) and 32–61% (6 h): the rule enlarges the set but does not remove the time of day.

## 7. Comparison with the figures already measured

The earlier figures come from streams with other volumes per worker, so the last column repeats each
earlier scheme on the timelines of this report (**simulated**: the rater's recorded delay for "no
delay", sixty times that delay for the 5 h wait, hand-over after the recorded delay for the batches).

| Scheme | Measured earlier: 200 orders, 3 seeds (4.6 deliveries per worker in the run) | Measured earlier: 2,000 orders in 13 h, 1 seed (3.3 deliveries per worker and hour) | This report's timelines: 2,000 orders in 3.8 days, 2 seeds (0.49 per worker and hour) |
|---|---|---|---|
| Today: the rater's own account sends | 100% (200/200 and 200/200; arm FULL, 2026-10-02, reproduced 2026-10-11) | not run | not run (the sender names the order) |
| Relayer, no added delay | 96.3% / 97.5% | 94.5% / 94.3% | 99.7% *simulated* |
| Relayer, the rater waits 5 h on average and proves at sending time | 26.5% / 29.8% (bounded by the run length) | 9.1% / 7.3% (baseline 4.3% / 4.1%) | 30.3% *simulated* (mean wait 5.0 h) |
| Relayer, 6 h batches, proofs made at hand-over | root ignored 22.5% (one batch holds the run); with the root 96.3% / 97.5% | root ignored 5.3% / 5.5% (uniform in the batch window 6.7%, 18.2 candidates); with the root 94.5% / 94.3% | root ignored 32.0% (uniform in the window 32.8%, 3.7 candidates); with the root 99.7% *simulated* |
| **Period roots 24 h, third account, (a) / (b)** | – | – | **9.0% / 9.4%** (uniform 9.0%, 12.1 candidates) **ran** |
| **Period roots 24 h, (c) noise 30 min** | – | – | **78.8%** (uniform 8.9%) **ran** |
| **Period roots 6 h, third account, (a) / (b)** | – | – | **34.2% / 33.9%** (uniform 33.2%, 3.7 candidates) **ran** |
| **Period roots 6 h, (c) noise 30 min** | – | – | **79.6%** (uniform 32.1%) **ran** |

Earlier figures are customer / establishment, read from `relayer-delay-sweep-2026-10-11.json` (table M
below); the figures of this report pool both raters.

| Scheme | Linked: most recent delivery before the rating (root ignored) | its uniform baseline (candidates) | Linked: last delivery under the proof's root | Uniform guess in the batch window (candidates) | Wait: mean (median) |
|---|---|---|---|---|---|
| relayer, no delay (rater's own 1 + Exp(5 min)) | 99.7% [99.6%–99.9%] | 9.8% (23.1) | 99.7% [99.6%–99.9%] | – | 0.09 h (0.06 h) |
| relayer, rater waits 1 + Exp(5 h), proves at sending time | 30.3% [29.8%–30.9%] | 7.3% (25.4) | 30.4% [29.9%–30.9%] | – | 4.97 h (3.40 h) |
| relayer, 6 h batches, proof made at hand-over | 32.0% [31.4%–32.6%] | 7.3% (24.5) | 99.7% [99.6%–99.9%] | 32.8% (3.7) | 3.07 h (3.06 h) |
| relayer, 24 h batches, proof made at hand-over | 8.8% [8.8%–8.9%] | 4.6% (28.7) | 99.7% [99.6%–99.9%] | 9.0% (12.1) | 12.50 h (12.72 h) |

| Point | N | Seeds | Customer: linked | baseline (candidates) | with the root | Establishment: linked | baseline (candidates) | with the root | Uniform in the batch window (candidates), customer |
|---|---|---|---|---|---|---|---|---|---|
| A/delay-0 | 200 | 1,2,3 | 96.3% | 47.8% (2.8) | 96.3% | 97.5% | 48.2% (2.8) | 97.5% | – |
| A/delay-5h | 200 | 1,2,3 | 26.5% | 24.4% (4.4) | 26.5% | 29.8% | 25.1% (4.4) | 29.8% | – |
| B/batch-6h | 200 | 1,2,3 | 22.5% | 22.5% (4.6) | 96.3% | 22.5% | 22.5% (4.6) | 97.5% | 22.5% (4.6) |
| L/delay-0 | 2000 | 1 | 94.5% | 9.7% (22.8) | 94.5% | 94.3% | 9.8% (22.8) | 94.3% | – |
| L/delay-5h | 2000 | 1 | 9.1% | 4.3% (33.1) | 9.1% | 7.3% | 4.1% (33.4) | 7.3% | – |
| L/batch-6h | 2000 | 1 | 5.3% | 3.6% (31.6) | 94.5% | 5.5% | 3.6% (31.6) | 94.3% | 6.7% (18.2) |

- The period rule does what the batches could not: in the batch runs the proof was made at hand-over
  and its root dated it (94–99.7% linked); with period roots every rating published after a boundary
  carries the same root, and the "last delivery under the root" rule falls to the uniform guess.
- At equal period, the period rule gives what the batches gave with the root ignored, because the set
  is the same: the worker's deliveries of the period. The figure of the earlier long stream for 6 h
  (6.7% for a uniform guess among 18.2 candidates) and this report's 33% (3.7 candidates) differ by
  the delivery volume per worker and period, not by the mechanism (**argued**; the earlier stream was
  not re-run with period roots).
- A random wait of 5 h hides about as much as a 6 h period at this volume (30% against 33%), without
  a guarantee on the set: it relies on every rater waiting and proving late.

## 8. Change to the harness, and the existing arms (**ran**)

`workload.cjs` accepts the optional fields `ratingPeriodSlots`, `ratingReturn`, `ratingHabitSigma` and
`ratingHabitLagSlots`, and exports `periodReturnSlot`. None is a key of `DEFAULTS`, so a run without
them records the same configuration as before. In period mode the local mirror of each worker's tree
keeps a copy of the tree as it was before the first insertion of each later period (the roots the
proposal's contract would record). The mode is refused outside the relayer arms and together with
`ratingBatchSlots` (**ran**: the arm `FULL` with the field stops with "ratingPeriodSlots needs a
relayer arm, a whole number of slots and no ratingBatchSlots"). `observer.cjs`, `score.cjs` and
`run-one.cjs` are unchanged. New files: `period-ratings/run-period.cjs`, `rules.cjs`, `sweep.cjs`,
`simulate.cjs`, `report.cjs`, and a paragraph in the harness README.

Two existing arms through the unchanged `run-one.cjs`, before and after the change, seed 1,
configuration `{"label":"D/<ARM>","arm":"<ARM>","strategy":"S3:10:p5","E":20,"N":200,"seed":1}`:

| Arm | P5 before (customer, establishment) | P5 after | Leaves of the result JSON that differ |
|---|---|---|---|
| RELAYER | 198/200, 196/200 | 198/200, 196/200 | 8 of 2,062: `costs/cashoutGas`, `costs/cashoutGasPerOrder`, `costs/cashoutFeesWei`, `run/engine/peakRss`, `run/workloadMs`, `run/collectMs`, `run/analyzeMs`, `run/totalMs` |
| RELAYER_DELAYED | 57/200, 63/200 | 57/200, 63/200 | the same 8 (of 2,063) |

These are the eight leaves that the relayer report found to differ between two runs of the same code.
The lists are in the JSON under `existingArmsCheck`.

A small run with **real Groth16 proofs and the real verifiers** in period mode
(`{"arm":"RELAYER","strategy":"S2:3","E":3,"N":8,"seed":5,"provers":"real","ratingPeriodSlots":60,"ratingReturn":"uniform"}`)
completed: 16 rating proofs against period roots, all accepted, 2 of them against a root older than
the worker's tree at sending time (`extra.realProofRun` in the JSON). The relayer report listed the
acceptance of an old root by the real verifier as not exercised.

## 9. Not verified, and limits

- **Seeds.** 2 seeds for the chain runs (one stream each). The simulation adds draws of the return
  times, not streams. Under (a) there is no redraw.
- **Volume and shape of the demand.** One volume was run: 11.1 deliveries per worker and day, uniform
  over the 24 hours, all workers alike. With meal-time peaks the 6 h periods would be unequal (night
  periods with few deliveries, linked more), and under (c) deliveries would be closer in time at the
  peaks (linked less). Not measured.
- **Every delivery is rated twice.** The uniform figures do not depend on it; the joint time rule does.
  Raters who return several periods late, or never, are not modelled, except for the returns pushed
  over a second boundary by the noise of (c).
- **The contract rule itself was not implemented.** The workload behaves as R1 says and it was checked
  that every proof used the root of the last boundary (0 exceptions in 48,000 ratings); the rejection
  of other roots, the "current root of an inactive worker" case as a contract path, and the
  reimbursement of R2 were not exercised. The sender is one relayer account; senders that are other
  users' dApps could carry information of their own.
- **Off-chain side.** The outbox sees the network address and the time of each post; not modelled.
- **Order inside a slot.** In the harness, ratings sent in the same slot are mined in the order of
  their deliveries (the engine wakes the raters in that order). The rules do not use it. Kept as a
  tie-break, it changes the joint rule by at most 0.7 of a point in these runs (table below); on a
  real network that order is the block builder's.

Joint rule with the chain order of the ratings inside a slot kept (not a rule of the report), against the rule as used.

| Chain run | Joint rule as used | Joint rule keeping the order inside a slot | Uniform in the closed period |
|---|---|---|---|
| P24h/b-uniform/seed1 | 9.9% | 9.9% | 9.0% |
| P6h/b-uniform/seed1 | 32.6% | 32.6% | 32.7% |
| P24h/b-uniform/seed2 | 9.0% | 9.0% | 9.0% |
| P6h/b-uniform/seed2 | 35.1% | 35.1% | 33.8% |
| P24h/c-habit/seed1 | 77.8% | 77.9% | 8.9% |
| P6h/c-habit/seed1 | 78.8% | 78.8% | 31.4% |
| P24h/c-habit/seed2 | 79.8% | 79.9% | 8.9% |
| P6h/c-habit/seed2 | 80.4% | 80.5% | 32.8% |
| P24h/a-boundary/seed1 | 8.7% | 9.3% | 9.0% |
| P6h/a-boundary/seed1 | 33.6% | 34.3% | 32.7% |
| P24h/a-boundary/seed2 | 7.9% | 8.3% | 9.0% |
| P6h/a-boundary/seed2 | 34.8% | 35.3% | 33.8% |

- **The time rules are heuristics.** The joint rule is the most likely assignment for Gaussian noise
  under the stated assumptions; nothing stronger was tried for (c), and for (a) and (b) the claim that
  nothing beats the uniform guess rests on the argument that the return time is independent of the
  delivery within the period, plus the 20 redraws.
- **Behaviour (a) at scale.** All the ratings of a period are sent within minutes of the boundary
  (818 to 1,102 transactions within 49 min of a 24 h boundary in the seed 1 run); block capacity is not modelled.
- **The comparison column for the earlier schemes is simulated**, not re-run on the chain; its "5 h"
  delays are the recorded 5 min delays times sixty.
- **Unpublished ratings under the k rule** are those pending when the stream ended; their share
  depends on the length of the run.
- The rule scores are computed by `report.cjs` from the public timeline each chain run recorded
  (`chain.runs[].deliveries`, `.ratings`), not by the run itself; the run's own printout used an
  earlier version of the joint rule.
