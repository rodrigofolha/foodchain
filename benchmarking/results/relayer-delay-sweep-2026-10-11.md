# Relayer for ratings: delay sweep, batches, and what a relayer can change (2026-10-11)

Question: would a relayer improve the privacy that still leaks? The rating part is measured with the
harness of `benchmarking/privacy-eval/` (observer that reads only public data; method in its README);
the other leaks are answered from the code. Every number is in `relayer-delay-sweep-2026-10-11.json`.
Local in-process Hardhat only (chainId 31337); nothing was sent to any other network.

Statements below are marked **ran** (executed here, output inspected) or **read** (from the source,
file and line given; lines as of 2026-10-11).

## How to read this report

The runs measure the share of ratings that an observer of public data assigns to their true delivery
when a relayer sends the ratings, for several waiting times and batch periods. A relayer helps the
ratings only when the rater's device generates the proof at sending time; a proof generated earlier
and held by the relayer is linked as if there were no delay, because the proof names the root it was
made against. Quote table A for no delay and for 15 min, and table L for 1 h and 5 h: the table A
figures at 1 h and beyond are truncated by the length of the run, and no run is longer than a 24 h
delay or a 24 h batch period. The batch rows of tables B and L give two figures, "linked, root
ignored" and "with the root"; the second is what the runs as made give. The baseline is not a fixed
reference: it depends on the length of the run and falls as the run gets longer.

## Summary

1. **A relayer alone does not help the ratings.** With the sender hidden and no added delay the
   observer still links 96.3% of customer ratings and 97.5% of establishment ratings to their delivery
   (3 seeds, 600 ratings each), by taking the worker's most recent delivery.
2. **A relayer plus waiting helps, if the wait is long against the worker's pace and it is the rater
   who waits.** With a mean wait of 15 min the linked share is 75%, against a random guess of 42–43%
   (table A). With 1 h / 5 h / 24 h the short runs give 43–45% / 27–30% / 24–25%, against a random
   guess of 31% / 24–25% / 23% (table A), but these three figures are truncated by the run length: a
   worker has only 4.6 deliveries in the whole run, and about 50% / 85% / 96% of the ratings are sent
   after the last delivery. For 1 h and 5 h the figures to use are those of a stream ten times longer
   (one seed, table L): 94% without delay, 26% at 1 h and 7–9% at 5 h, against random guesses of 10%,
   7% and 4%. A 24 h delay was not run on that stream.
3. **Batches every 6 h or 24 h bring an observer that ignores the proof's root to the random guess;
   an observer that reads the root still links 94–98%.** With the root ignored: 22.5% in the short
   runs (where one batch holds every rating, so 6 h and 24 h are the same experiment) and 5.3–5.5% with
   6 h batches in the long stream (random guess 3.6%; a guess among the worker's deliveries of the
   batch period: 6.7%, computed). With the root, in the same runs: 96.3% / 97.5% in the short runs and
   94.5% / 94.3% in the long stream (point 4). The root-ignored figures stand for raters who would all
   prove at the batch time, which was not run as such.
4. **A delay applied by the relayer to a finished proof does not hide the link.** The proof names the
   ticket-tree root it was made against, the root is in the calldata, and the tree is public: the root
   bounds the candidates to the worker's deliveries concluded before the proof was made. A delay by
   the relayer can add candidates only after that point, and the root removes exactly those. In the
   batch runs, taking the worker's last delivery under the proof's root links
   96.3% / 97.5% (short runs) and 94.5% / 94.3% (long stream), the same as with no delay at all. The
   relayer itself sees more than that (who hands it the proof, and when). The gain of points 2 and 3
   exists only when the rater's device waits and proves against the root of the moment of sending.
5. **A relayer cannot alter a rating, only withhold or delay it**; nothing in the contracts pays it.
6. **For the other leaks a relayer changes nothing**: cash-out amounts and times, the stipend and
   funding of the stealth address, the customer's wallet as sender of `makeOrder`, and the main wallet
   as recipient of cash-outs do not depend on who sends the transaction, or cannot be sent by anyone
   else under the present contracts (section 6).

## 1. What was run

Harness sources: `benchmarking/privacy-eval/` (`workload.cjs`, `observer.cjs`, `score.cjs`,
`run-one.cjs` as of 2026-10-02, plus the change of section 4). New scripts:
`benchmarking/privacy-eval/relayer-sweep/run-rating.cjs` (one experiment: the same workload → observer →
scorer pipeline as `run-one.cjs`, keeping the per-rating numbers that `run-one.cjs` drops) and
`relayer-sweep/sweep.cjs` (grid, at most two experiments at a time, aggregation). Hardhat 2.28.6
in-process (EDR), Node v20.20.2, 16 CPUs (i5-12500H), 17 GB. Proofs: the harness's default emulation
(gas-equivalent verifiers, placeholder proofs, real public signals; roots and nullifiers are checked by
the real `GlobalReputation`).

```bash
# main grid: 21 experiments (5 delays + 2 batch periods, seeds 1, 2, 3), about 65 s each, 1.6 GB peak RSS
PE_WORKDIR=<dir> node benchmarking/privacy-eval/relayer-sweep/sweep.cjs
# longer stream: 4 more experiments (N = 2000, seed 1), about 11.5 min each, 4.8–5.1 GB peak RSS
LONG=1 ONLY='^L/' PARALLEL=1 PE_WORKDIR=<dir> node benchmarking/privacy-eval/relayer-sweep/sweep.cjs
# aggregation into this folder
LONG=1 AGGREGATE_ONLY=1 PE_WORKDIR=<dir> CHECK_FILE=<check.json> DATE=2026-10-11 node benchmarking/privacy-eval/relayer-sweep/sweep.cjs
```

Each experiment is one process:

```bash
PE_CONFIG='<config>' PE_OUT=<file> MIMALLOC_PURGE_DELAY=0 HARDHAT_NETWORK=hardhat \
  npx hardhat run --no-compile benchmarking/privacy-eval/relayer-sweep/run-rating.cjs
```

Configurations (`seed` = 1, 2, 3 for A and B; 1 for L). Everything not listed is the harness default,
as in the `D/RELAYER` and `D/RELAYER_DELAYED` runs of 2026-10-02: 20 establishments, 200 orders,
45 workers, 40 customers, one zone, cash-out `S3:10:p5`; the full configuration of every run and its
exact command are in the JSON (`runs[].config`, `runs[].command`).

| Group / point | `PE_CONFIG` (plus `"seed"`) |
|---|---|
| A delay-0 | `{"strategy":"S3:10:p5","E":20,"N":200,"arm":"RELAYER"}` |
| A delay-15min / 1h / 5h / 24h | `{"strategy":"S3:10:p5","E":20,"N":200,"arm":"RELAYER_DELAYED","rateDelayMean":75}` / `300` / `1500` / `7200` |
| B batch-6h / 24h | `{"strategy":"S3:10:p5","E":20,"N":200,"arm":"RELAYER","ratingBatchSlots":1800}` / `7200` |
| L (seed 1) | the same four configurations of delay-0, delay-1h, delay-5h and batch-6h with `"N":2000` (45 workers, 400 customers) |

Meaning of the points (one slot = 12 s):

- **delay-0** is the arm `RELAYER`: no added delay; each rater sends 1 + Exp(mean 25 slots = 5 min)
  after the delivery, as in every arm.
- **delay-X** replaces that by 1 + Exp(mean X) slots (`rateDelayMean`), which is how
  `RELAYER_DELAYED` is defined (`workload.cjs:46`). The rater waits, then builds the proof against the
  root of that moment and the relayer sends it at once (`workload.cjs:646-658`, 670).
- **batch-X**: the rater builds the proof after its own 1 + Exp(5 min) and hands it over; the relayer
  sends everything it holds at slots `start + k·X`, as separate transactions in a seeded random order
  (`workload.cjs:624-645`, 663-669).

A run counts only if its output file is complete (200 or 2000 concluded orders and twice as many
ratings; `sweep.cjs` `readResult`). All 25 are complete; none was retried. One long run was stopped by
hand five minutes in and started again from zero, to run the four long experiments two at a time.

## 2. Reproduction of the 2026-10-02 result (**ran**)

`D/RELAYER_DELAYED` with the recorded configuration (`{"label":"D/RELAYER_DELAYED","arm":"RELAYER_DELAYED","strategy":"S3:10:p5","E":20,"N":200,"seed":1}`,
through the unchanged `run-one.cjs`), before any change to the harness:

| | Customer: linked / ratings (baseline) | Establishment: linked / ratings (baseline) |
|---|---|---|
| recorded 2026-10-02 | 57/200 = 28.5% (24.36%) | 63/200 = 31.5% (25.61%) |
| reproduced 2026-10-11 | 57/200 = 28.5% (24.36%) | 63/200 = 31.5% (25.61%) |

Of all fields the results file keeps for the experiment (configuration, scores P1–P5, costs, amount
statistics, counts, run data), eight leaves differ: three cash-out gas figures (762,870,762 against
762,870,618 gas in total, and the two figures derived from it) and five wall-time / memory figures.
`D/RELAYER` was compared in the same way: 198/200 and 196/200 as recorded, the same eight leaves.
Two runs of the same code differ in the same eight leaves (the note secrets are drawn with
`crypto.randomBytes`, `common.cjs:85-87`, which changes calldata bytes; the likely cause of the gas
difference, not isolated). The runs here took 56–58 s against 95–98 s recorded, with identical scores:
wall time does not enter the results (the harness has its own slot clock), and nothing in the later
runs, made while other jobs used the machine, suggested otherwise.

## 3. Results (**ran**)

Columns: *linked* = share of ratings the observer assigns to their true delivery (the report's P5
recall; the observer answers for every rating, so precision is the same); *baseline* = the scorer's
random guess, the mean of 1 / (the worker's deliveries concluded before the rating transaction);
*candidates* = the mean number of those deliveries (from the observer's per-rating decisions; the
scorer does not expose it); *with the root* = linked by the extra rule of section 5.2. Mean
[min–max] over the seeds.

In the batch rows *linked* is what an observer that ignores the proof's root obtains, and is written
*linked, root ignored*; the figure for an observer that reads the root is next to it under *with the
root*. The baseline is not a fixed reference: it is defined over all the worker's earlier deliveries
of the run, so it falls as the run gets longer, and a linked share close to the baseline in a short
run does not show that nothing would leak in a longer one.

### A. Random delay, relayer as sender (N = 200, seeds 1, 2, 3; 600 ratings per cell)

| Mean delay | Customer: linked | baseline | candidates | Establishment: linked | baseline | candidates |
|---|---|---|---|---|---|---|
| 0 (arm RELAYER) | 96.3% [95.0–99.0], 578/600 | 47.8% [47.2–48.6] | 2.83 [2.80–2.87] | 97.5% [97.0–98.0], 585/600 | 48.2% [48.0–48.4] | 2.82 [2.81–2.85] |
| 15 min | 75.3% [72.0–79.0], 452/600 | 42.7% [42.3–43.4] | 3.11 [3.04–3.15] | 74.7% [72.5–76.5], 448/600 | 42.2% [41.5–43.1] | 3.11 [3.08–3.15] |
| 1 h | 42.8% [39.5–45.5], 257/600 | 31.5% [30.7–32.5] | 3.84 [3.77–3.93] | 45.0% [44.0–45.5], 270/600 | 31.4% [31.2–31.5] | 3.85 [3.83–3.87] |
| 5 h | 26.5% [25.0–28.5], 159/600 | 24.4% [24.0–25.0] | 4.39 [4.29–4.49] | 29.8% [28.5–31.5], 179/600 | 25.1% [24.5–25.6] | 4.37 [4.36–4.39] |
| 24 h | 23.7% [23.0–24.5], 142/600 | 22.8% [22.6–22.9] | 4.55 [4.50–4.63] | 24.5% [24.0–25.0], 147/600 | 23.2% [22.8–23.6] | 4.53 [4.50–4.57] |

- Seed 1 at 5 h is the 2026-10-02 run (28.5% / 31.5%); it is the highest of the three seeds in both
  columns.
- "With the root" equals "linked" in every cell of this table, as it must: the proof is made at
  sending time.
- The realised delays match the configuration (delivery → rating transaction, mean over both raters
  and the three seeds: 0.09 h, 0.24 h, 0.94 h, 4.7 h, 22.5 h).
- **Limit of these runs.** The orders arrive during about 400 slots (1.3 h) and the last delivery is
  at slot 475–501. A worker has 4.59 deliveries in the whole run (mean over ratings; 200 / 45 = 4.44
  per worker). At 1 h about half of the ratings (94–108 of 200 per rater and seed), at 5 h about 85%
  (165–176 of 200) and at 24 h about 96% (190–196 of 200) are sent after the last delivery; at 15 min
  it is 28–36 of 200. For a rating sent after the last delivery the candidates are all the worker's
  deliveries of the run. The figures at 1 h and beyond are therefore truncated by the run length, and
  5 h and 24 h measure mostly the length of the run (4.39 and 4.37 candidates at 5 h against 4.59 for
  the whole run). Quote this table for delay 0 and 15 min; for 1 h and 5 h quote table L.
- The binomial standard error of a cell is about 1.8 points, so the customer figure at 5 h and both
  figures at 24 h are within about one standard error of the baseline. That error is indicative only:
  it treats the 600 ratings as independent, whereas the two ratings of one delivery and the ratings
  of one worker are correlated, and there are 3 seeds.

### B. Batches (N = 200, seeds 1, 2, 3; 600 ratings per cell)

| Batch period | Customer: linked, root ignored | baseline | candidates | with the root | Establishment: linked, root ignored | baseline | candidates | with the root |
|---|---|---|---|---|---|---|---|---|
| 6 h (1800 slots) | 22.5% [22.5–22.5], 135/600 | 22.5% | 4.59 [4.55–4.64] | 96.3% [95.0–99.0] | 22.5%, 135/600 | 22.5% | 4.59 | 97.5% [97.0–98.0] |
| 24 h (7200 slots) | 22.5% [22.5–22.5], 135/600 | 22.5% | 4.59 [4.55–4.64] | 96.3% [95.0–99.0] | 22.5%, 135/600 | 22.5% | 4.59 | 97.5% [97.0–98.0] |

- In every run **one batch holds all 400 ratings** (at slot 1800 or 7200; the last delivery is at slot
  475–501). The two periods are therefore the same experiment here, and the result is the floor of the
  run: every rating has all the worker's deliveries as candidates, the observer's rule (the worker's
  last delivery) is right for exactly one customer rating and one establishment rating per worker,
  45/200 = 22.5%, which is also the baseline.
- "With the root" is identical, seed by seed, to delay-0 of table A: the proofs were made at
  hand-over, and the root excludes the deliveries concluded after that moment (section 5.2). This
  is the figure for the experiment as run. "Linked, root ignored" is what an observer that does not
  read the root obtains; it stands for raters who would all prove at the batch time, which was not
  run as such.
- Both batch periods are longer than the run, so these rows say nothing about a batch period on a
  continuing stream; for the 6 h batch see table L.

### L. Longer stream (N = 2000, seed 1 only; 2000 ratings per cell; orders arrive during 13 h)

| Point | Customer: linked | baseline | candidates | with the root | Establishment: linked | baseline | candidates | with the root |
|---|---|---|---|---|---|---|---|---|
| delay 0 | 94.5%, 1891/2000 | 9.7% | 22.8 | 94.5% | 94.3%, 1885/2000 | 9.8% | 22.8 | 94.3% |
| delay 1 h | 26.3%, 525/2000 | 7.0% | 25.5 | 26.3% | 26.2%, 523/2000 | 6.7% | 25.6 | 26.2% |
| delay 5 h | 9.1%, 182/2000 | 4.3% | 33.1 | 9.1% | 7.3%, 146/2000 | 4.1% | 33.4 | 7.3% |
| batch 6 h | 5.3%, 106/2000 (linked, root ignored) | 3.6% | 31.6 | 94.5% | 5.5%, 109/2000 (linked, root ignored) | 3.6% | 31.6 | 94.3% |

- In the batch row the "linked" figure is for an observer that ignores the proof's root; the figure
  for the experiment as run is "with the root", equal to the delay-0 row.
- A worker has 44.6 deliveries in this run (about 3.3 per hour). The baseline is small because the
  candidates are all the worker's earlier deliveries of the run; it keeps falling with the length of
  the run. "Linked" at a given delay depends on the run length less, but the end of the stream still
  shows at 5 h: 35% of the ratings of that row (700 and 694 of 2000) are sent after the last delivery
  (slot 4000). Linked is 9.3% for the ratings sent before the last delivery, 6.2% for those sent
  after it, and 5.6% for the deliveries in the second quarter of the stream.
- Batches at slots 1800, 3600 and 5400 held 1779, 1761 and 460 ratings. An observer that knows the
  period would restrict the candidates to the worker's deliveries of the period before the batch:
  18.2 on average, containing the true delivery for 98.4% / 98.65% of the ratings; a uniform guess
  among them is right 6.7% of the time (computed, not an attack that was run). The measured 5.3–5.5%
  comes from the harness rule (the worker's last delivery), which is below that uniform guess, so it
  understates what an observer that knows the period obtains.
- One seed: no spread is given. The order stream is the same in the four runs.

### Reading

- Hiding the sender is not enough at any length of run: 94–98% linked.
- What lowers the figure is the number of deliveries the same worker completes between a delivery and
  its rating. At 3.3 deliveries per hour and worker, 1 h of mean delay leaves 26% and 5 h leaves
  7–9% (about 6% away from the ends of the stream). For a 6 h batch, with the root ignored: 5.3–5.5%
  measured with the harness rule, and 6.7% for a uniform guess inside the batch period (computed).
  With the root, the same batch runs give 94.5% / 94.3%.
- These figures are from table L. The table A figures at 1 h and beyond are truncated by the run
  length and should not be quoted as properties of the delay.
- The observer's rule is the simple one of the harness (the worker's most recent delivery). For an
  exponential delay that is the most likely single answer, but a joint assignment (each delivery
  receives one customer and one establishment rating) was not tried and could do better. The figures
  are lower bounds on what leaks.

## 4. Change to the harness, and the existing arms (**ran**)

`workload.cjs` accepts an optional `ratingBatchSlots` (lines 84-86, 624-645, 663-669); nothing else
in the harness changed. The field is not a key of `DEFAULTS`, so a run without it records the same
configuration as before. It is refused outside the relayer arms (**ran**: the `FULL` arm with the
field stops with "ratingBatchSlots needs a relayer arm and a whole number of slots").

Three existing arms were run through the unchanged `run-one.cjs` before and after the change, seed 1,
configuration `{"label":"D/<ARM>","arm":"<ARM>","strategy":"S3:10:p5","E":20,"N":200,"seed":1}`:

| Arm | P5 before (customer, establishment) | P5 after | Leaves of the result JSON that differ |
|---|---|---|---|
| RELAYER | 198/200, 196/200 | 198/200, 196/200 | 8: `costs/cashoutGas`, `costs/cashoutGasPerOrder`, `costs/cashoutFeesWei`, `run/engine/peakRss`, `run/workloadMs`, `run/collectMs`, `run/analyzeMs`, `run/totalMs` |
| RELAYER_DELAYED | 57/200, 63/200 | 57/200, 63/200 | the same 8 |
| FULL | 200/200, 200/200 | 200/200, 200/200 | the same 8 |

The comparison covers every key of the output, including the per-order decisions. The eight leaves
are the ones that also differ between two runs of the unchanged code (section 2). The lists are in the
JSON under `existingArmsCheck`.

A tiny run with **real Groth16 proofs and the real verifiers** and the batched relayer
(`{"arm":"RELAYER","strategy":"S2:3","E":3,"N":8,"seed":5,"provers":"real","ratingBatchSlots":60}`)
completed: 16 rating proofs sent by the relayer in four batches and accepted. In that run no proof
was older than the tree at sending time; old roots were accepted by `GlobalReputation` in the batch
runs of tables B and L, which use the gas-equivalent verifiers.

## 5. Ratings: answers from the code

### 5.1 What the observer uses once the sender is a relayer (**read**)

- The worker, from the calldata of `submitRating` (`observer.cjs:306`, second argument).
- The order of blocks: the candidates are that worker's orders whose `deliveryOrder` is in an earlier
  block than the rating (`observer.cjs:669-674`).
- The answer is the most recent of them (`observer.cjs:688-693`).
- It does not use the score, the nullifier hash or the root: of the call's arguments
  `observer.cjs:306` keeps only the worker and the score, and the score is not read afterwards.
  The baseline is 1 / candidates (`score.cjs`, P5 block, `baseline`).

### 5.2 Does a delay applied by the relayer hide the link?

**From the relayer: no (read).** The relayer receives the complete call: worker, score, nullifier
hash, root and proof (`Chain.sol:110-113`), at the moment the rater hands it over, from a network
address. That is the information of the delay-0 rows (94–98% linked) plus the network identity,
whatever it does afterwards. There is no relayer in the repository (no match for "relay" in
`contracts/`, `circuits/`, `api/src`, `scripts/` or the three front ends), so there is no
implementation whose logging or retention could be read.

**From the public: no, because of the root (read, then ran).**
- Only the rater can make the proof: it needs `identityNullifier` and `identityTrapdoor`
  (`circuits/feedback.circom:36-37`), which the dApps keep in the browser
  (`customer-frontend/src/Components/PastOrder/index.js:110-112`).
- The proof is made against a root of the worker's ticket tree, a public input
  (`feedback.circom:46`, 76), sent in clear as `_root` (`Reputation.sol:218`, 228). The dApp uses the
  root of the tree as it is at that moment (`customer-frontend/src/utils/zkUtils.js:57`, 83-87).
- The contract accepts every root the tree ever had (`Reputation.sol:40-43`, 58, 182, 194-196, 225),
  so a proof held by a relayer does not expire. But each `deliveryOrder` adds two tickets to the
  worker's tree (`Order.sol:309-310`) and each ticket is published (`TicketAdded`,
  `Reputation.sol:83`, 185), so anyone can rebuild every root and read, from the root of a rating, how
  many deliveries the worker had when the proof was made.
- The root is a count of that worker's deliveries, not a clock: it places the proof between two
  consecutive deliveries of the worker. It bounds the candidates to the worker's deliveries concluded
  before the proof was made; a delay by the relayer can add candidates only after that point, and the
  root removes exactly those. When the worker concludes no delivery between proving and sending, the
  root says nothing beyond the time of the transaction, and the delay added no candidate either.
- The contract also records the root between the two tickets of one delivery (`Reputation.sol:181-182`,
  `Order.sol:309-310`). A proof against it is valid and would point at one delivery. The dApp does not
  use it: it rebuilds the tree from all the logs up to the latest block (`zkUtils.js:42-57`).
- `run-rating.cjs` applies this to the public data: the candidates are the worker's deliveries under
  the proof's root and the answer is the last of them. In the batch runs it links 96.3% / 97.5%
  (table B) and 94.5% / 94.3% (table L), exactly the delay-0 figures. A root older than the delivery
  being rated cannot be used (the ticket is not under it), and among the valid roots the newest hides
  most, so the proof has to be made at sending time.

**If the rater's dApp waits before contacting the relayer (read, then ran).** Then the proof is made
against the root of the sending time and the relayer forwards it at once. This is what the harness
models for `RELAYER_DELAYED` (`workload.cjs:646-658`: wait, then read the root, then prove) and what
tables A and L measure; the "linked, root ignored" figures of the batch rows stand for the same case
with the waiting aligned to public batch times, which was not run as such (in the batch runs the
proofs were made at hand-over). The relayer then learns no more than the chain, plus the network
address at the later moment. It requires the rater's device to be available at that later time (the
secrets are in the browser's local storage); that is not modelled.

### 5.3 Can a relayer alter a rating?

**No; it can withhold or delay it.**
- **Read.** The proof's public signals are the nullifier hash, the worker, the score and the root
  (`feedback.circom:44-46`, 51, 82, 86, 91). `GlobalReputation.submitRating` builds them from the
  call's own arguments and requires the proof to verify (`Reputation.sol:227-230`). It does not read
  `msg.sender` (`Reputation.sol:214-237`), and `Chain.submitRating` only forwards (`Chain.sol:110-113`).
- **Ran.** One real Groth16 proof per circuit against the real verifier contracts on the in-process
  network: the rating proof verifies with its own four signals and with none of them changed by one
  (nullifier hash, worker, score, root: `false` each).
- **Read.** A rating can be counted once: the nullifier hash is marked as used (`Reputation.sol:223`,
  232). A relayer that withholds a rating can be detected and bypassed: `usedNullifiers` is public
  (`Reputation.sol:72`; the dApps already query it before proving, `PastOrder/index.js:109-122`), and
  the rater can send the same proof itself or through someone else, since nothing binds it to a sender.
- **Read.** The relayer sees the score before it sends. A relayer with an interest in the outcome
  (the rated worker, for instance) could drop low scores; the contracts cannot prevent that, only the
  rater's check above.

### 5.4 Who pays the gas of a relayed rating? (**read**)

- The sender of the transaction: the relayer. A rating cost about 291,000 gas (customer) and
  284,000 gas (establishment) on Sepolia on 2026-10-02
  (`comparison-report-2026-10-02T12-43-32-267Z.txt`, lines 45 and 47; measured before the change of
  gas schedule described in `sepolia-gas-schedule-2026-10-11.md`, not re-measured here).
- The contracts offer nothing for it: `submitRating` is not payable and has no fee, refund or relayer
  argument (`Chain.sol:110-113`, `Reputation.sol:214-222`); the circuit has no fee or relayer signal
  (`feedback.circom:36-51`). There is no function that takes several ratings in one transaction, so a
  batch is one transaction per rating.
- Today the customer pays from their wallet (`PastOrder/index.js:127-129`) and the establishment from
  the order's stealth address (`manager-frontend/src/components/Order/index.js`, `sendFromStealth`,
  lines 38-60 and 525), whose gas is the stipend that `Chain.makeOrder` takes out of the order total
  (`Chain.sol:29-37`). That holds when the stealth key is stored in the browser; without it
  `sendFromStealth` sends from the main wallet (lines 54-59).
- In the harness the relayer's balance is set directly (`workload.cjs:416-421`); its cost is not part
  of the cost tables.

## 6. The other leaks of the report: can a relayer affect them?

| Leak (report of 2026-10-02) | Can a relayer affect it? | Why (**read** unless marked) |
|---|---|---|
| Cash-out amounts | No | The amount is a public input of the proof and an argument of the call (`mergeWithdraw.circom:71`, `Reputation.sol:263`, 288), and it is in the `MergeWithdrawal` event and in the transfer (`Reputation.sol:305-307`). The observer matches these amounts against the public revenue of the orders (`observer.cjs:570` onwards). None of it depends on the sender. |
| Cash-out timing | No more than the establishment already can | `mergeWithdraw` does not read `msg.sender` (`Reputation.sol:261-309`), so anyone may send a finished proof, later if they wish. But the establishment already chooses when to cash out (strategies S2 and S3:pX of the report do exactly that). A proof held by a relayer also carries its note-tree root in clear (`Reputation.sol:267`, 278, 287), which bounds when it was made as in section 5.2 (not measured for cash-outs). One side signal does depend on the sender: the observer counts the pure merges sent by the main wallet to guess how many notes a withdrawal spends (`observer.cjs:576-582`). Through a relayer that count would have to come from the `_recipient` argument, which the harness also sets to the main wallet in a merge (`workload.cjs:566`) although a merge pays nobody (`Reputation.sol:304`). Not measured. |
| Funding of the stealth address | No | With every mechanism on, the stealth address already sends its own funding withdrawal, paid to itself (`workload.cjs:731-733`; in the dApp `manager-frontend/src/components/Order/index.js`, about lines 381-445), with gas from the stipend (`Chain.sol:31-36`). A relayer as sender would hide no more than the stealth address does. It could not replace the stipend either: `prepareOrder` and `pickupOrder` identify the establishment by `msg.sender` (`Chain.sol:55`, 71; `Order.sol:155-157`, 222, 293), so the stealth address needs its own gas. The stipend and the funding amount stay public. The float deposits of the main wallet carry their value in the transaction (`Reputation.sol:248-252`), so a relayer could only make them by advancing the money. |
| Customer's wallet as sender of `makeOrder` | No | `Chain.makeOrder` records `msg.sender` as the customer and takes the payment from it (`Chain.sol:25`, 40-41; `Order.sol:195`, 204). That address receives refunds (`Order.sol:387`), must sign the delivery confirmation (`Order.sol:304`) and is the only one allowed to store the delivery details (`Storage.sol:48`). A relayer that sent `makeOrder` would be the customer and would pay the order. There is no "on behalf of" argument or signature check. |
| Main wallet as recipient of cash-outs | No | The recipient is chosen by the prover, is a public input of the proof (`mergeWithdraw.circom:72`, 182, 186) and is what the contract pays and logs (`Reputation.sol:289`, 305-307). A relayer can neither change it nor hide it. |

**Does `mergeWithdraw` bind its recipient, and has it a fee field?**
- It binds the recipient. **Read:** `recipient` is a public input (`mergeWithdraw.circom:72`, 186),
  constrained at line 182, and the contract passes the address it will pay as that input
  (`Reputation.sol:283-292`). **Ran:** a real proof on the real `MergeWithdrawVerifier` verifies with
  its own six signals and with none of them changed by one (both nullifier hashes, change commitment,
  root, amount, recipient: `false` each). A relayer cannot redirect a withdrawal.
- It has no fee field. **Read:** the public signals are exactly the two nullifier hashes, the change
  commitment, the root, the amount and the recipient (`mergeWithdraw.circom:70-79`;
  `Reputation.sol:283-290`); the only payment is `_withdrawAmount` to `_recipient`
  (`Reputation.sol:304-306`). A relayer cannot be paid out of a withdrawal.

What a relayer would make possible for cash-outs is a withdrawal to an address that holds no gas
(the sender need not be the recipient). Whether a fresh recipient helps depends on where the money
goes next; the report's `NO_POOL` arm shows that a forward to the main wallet links it. Not measured
here.

## 7. Not verified, and limits

- Tables A and B have 3 seeds; table L has 1.
- The short runs are shorter than the long delays and than both batch periods (section 3): their
  figures at 1 h and beyond are truncated by the run length. Only table L has a stream longer than
  the delay, and there the 24 h delay and the 24 h batch were not run; its 5 h row still has 35% of
  the ratings sent after the last delivery.
- The batch figures under "linked, root ignored" are not what the batch runs give to an observer that
  reads the root (94–98% linked); they stand for raters proving at the batch time, which was not run.
- The baseline depends on the run length, and the standard error given for table A assumes
  independent ratings.
- `meta` of the JSON describes the aggregation call (`AGGREGATE_ONLY=1`), which ran no experiment;
  `meta.command` was corrected by hand to that command. The command of each experiment is in
  `runs[].command`.
- The observer uses one rule per case. A joint assignment of ratings to deliveries, and the
  combination of the root with the sending time when the rater proves late, were not tried.
- What the relayer learns from the network (addresses, sessions) is not modelled; the harness has no
  off-chain side.
- The rater's device being reachable at the later time is assumed.
- Acceptance of an old root by the real verifier was not exercised (the real-proof run had none); the
  root check itself is the contract's and ran in tables B and L.
- The rating gas figures are the Sepolia ones of 2026-10-02, read from the file, not re-measured.
- Front-end line numbers are those of the working tree on 2026-10-11, which is being edited.
