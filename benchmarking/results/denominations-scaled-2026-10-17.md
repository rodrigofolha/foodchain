# Larger denominations with more establishments and more customers (local simulation, 2026-10-17/18; updated 2026-10-18)

This note reports cash-outs with larger denominations (500, 1,000 and 2,000 USD) and with more establishments and
more customers. The runs used the privacy-evaluation harness (not published; the one behind
`privacy-eval-final-2026-10-12.md` and the first sweep, `denominations-2026-10-17.md`) on its in-process Hardhat
chain (chain id 31337). Nothing was sent to any network. Data: `denominations-scaled-2026-10-17.json`; per-run
outputs and truth dumps: `denominations-scaled-2026-10-17/`.

**Update of 2026-10-18.** The 500 USD rows with 50 and 100 establishments now have three seeds (seeds 2 and 3
were run on 2026-10-18; the dApp's default denomination stays at 10 USD). The tables,
the conclusions and the trade-off below use the three seeds. What changed, and the earlier one-seed figures, are
in the section "Update of 2026-10-18: three seeds at 500 USD with 50 and 100 establishments" at the end.

All figures are figures of a model: simulated establishments, customers and orders, emulated proofs, a
local gas schedule, and a person who presses the cash-out button 30 minutes on average after it becomes
possible (an assumption, not a measurement). Linkage is that of heuristic timing rules, so it is what these
rules find, not a bound on what an observer could find.

## Method

**What is the same as in the first sweep.** Arm FULL, one zone, one order per establishment every 40 slots
of 12 s on average (8 minutes), order values log-normal with a median of 25 USD, W = 2E + 5 workers, every delay
of the workload, the button pressed 1 + Exp(150) slots after it becomes possible, withdrawals sent by and paid to
the main wallet, the base-fee walk, the distributed-prover emulation, the observer and the scorer. The cash-out
is the manager dApp's: the plain `DAPP` strategy for 10 USD (its `CASHOUT_POLICY`: offered after 5 new notes when
the unpaid revenue covers one denomination), `DAPP:<D>:p5` for D = 500, 1,000 and 2,000 USD (only the denomination
changes; the planning code is evaluated from `manager-frontend/src/utils/cashout.js`, unchanged). The float of
the DAPP rows is the default, (2 N/E + 20) × 20 USD per establishment in three deposits, so the collateral of new
orders is always covered and no withdrawal needs a merge. Every run is analysed with the four rules of the first
sweep: default (20-slot window), window150, batch (an order goes to the wallet with the next burst of
withdrawals within 2,000 slots), and batchWide (batch without that limit, 20,000 slots). Wait of the revenue:
first in, first out per establishment, as in the first sweep (the same function, copied unchanged).

**What changes.** The number of establishments E, the number of orders N and the number of customers C. The
harness takes all three as configuration keys; no file of the harness was changed for this sweep (hashes in
`sha256-before.txt`; `run-one.cjs` is the first sweep's version with its opt-in `PE_TRUTH_OUT` dump).

## Design and why

**Customers.** C = N/2 in the new runs (the harness's default is N/5): each customer orders twice on average and
86 % of them order at least once. The observer's attacks on the establishment never use the customer (the
customer's account only takes it out of the set of possible wallets), so C changes the order stream through the
seeded draws but no attack. A check with only C changed is in "Controls".

**Establishments and orders.** Memory decides what can be run. A run's memory grows with its chain blocks (about
0.1 GiB per 1,000 blocks, about 10 blocks per order at D ≥ 500 and 13.6 at D = 10, measured in short runs at
E = 50 and 100 and in the first sweep), and the machine has about 12.5 GiB available, of which 2 GiB were kept
free. Chosen:

- **E = 50 and E = 100, N = 7,500, C = 3,750.** 150 and 75 orders per establishment, about 21 and 11 simulated
  hours, 5,400 and 2,700 USD of revenue per establishment: two and one withdrawals of 2,000 USD per
  establishment. One run took 6.7 to 7.4 GiB and 21 to 32 minutes, so the big runs ran one at a time.
- **D = 10 (the reference) at E = 50 and 100: N = 5,000, C = 2,500** (100 and 50 orders per establishment). The
  first attempt at N = 7,500 (E = 50, seed 1) reached 9.9 GiB in the workload and 13.7 GiB during the observer's
  collection of the public data, left 0.2 GiB of the machine available, used 1.7 GiB of swap and exited without
  output (log in `runs/failed/`). At N = 5,000 the D = 10 runs took 6.7 to 6.9 GiB. The comparison with the
  busiest-wallet guess is made within each run, so the different N does not enter it; at E = 20 the D = 10
  linkage did not depend on N (8.0 % at N = 1,500, 7.9 % at N = 5,000, three seeds each).
- **E = 20: the first sweep's N = 5,000 and C = 1,000** (250 orders per establishment), with the new D = 1,000
  runs; D = 10, 500 and 2,000 are the first sweep's runs. The new runs have the first sweep's order stream (the
  same establishment for all 5,000 orders as its D = 2,000 run of the same seed), so the row is paired across D.

**What cannot be done on this machine, and why.** Several withdrawals of 2,000 USD per establishment at E = 100
(200 orders each: N = 20,000, about 20 GiB); the first sweep's 250 orders per establishment at E = 50
(N = 12,500, about 12.5 GiB) or at E = 100 (N = 25,000, about 25 GiB); D = 10 at N = 7,500 (above). The number of
orders per establishment therefore falls as E grows (250, 150, 75), and the share of the revenue still in the
pool at the end of a run grows with it at the large denominations; the controls below separate the two.

**Seeds.** Three seeds (1, 2, 3) for every D at every E. In the sweep of 2026-10-17/18, D = 500 had one seed (seed 1)
at E = 50 and 100: three seeds of every configuration would have taken about 11.5 hours of machine time plus the
controls, beyond the ten hours set for the sweep, and the task allowed fewer seeds for D = 500. Seeds 2 and 3 of
D = 500 at E = 50 and 100 were run on 2026-10-18 (see the last section).

**Controls** (E = 20, C = N/2; the small ones ran beside the big runs, the larger ones at the end):
- N = 1,500 (75 orders per establishment, as at E = 100), D = 10, 500, 1,000, 2,000, seeds 1-3;
- N = 3,000 (150 orders per establishment, as at E = 50), the same D, seed 1;
- N = 5,000 with C = 2,500 instead of 1,000, D = 2,000, seed 1: the customers alone.


## The runs

- **44 runs in the sweep, all complete** (exit 0, output and truth dump written; `run-scaled.sh` writes `.part` files
  and renames them only after a complete run):
  - main: 3 at E = 20 (D = 1,000), 12 at E = 50 and 12 at E = 100 (of which D = 500 seeds 2 and 3, 2026-10-18);
  - controls: 12 at E = 20, N = 1,500; 4 at N = 3,000; 1 at C = 2,500.
- With the 9 runs of the first sweep at E = 20, N = 5,000 (D = 10, 500 and 2,000), the tables use 53 runs (49 before
  2026-10-18).
- Four calibration runs (`calib/`) are not used in the tables.
- **One failed attempt**, D = 10 at E = 50, N = 7,500 (see Design). It is not in any table, and it was replaced by
  the N = 5,000 runs.
- **Time and memory per run**, run one at a time:

  | Runs | Time | Max RSS |
  |---|---|---|
  | E = 50, N = 7,500, D ≥ 500 | 21-25 min | 7.1-7.4 GiB |
  | E = 100, N = 7,500, D ≥ 500 | 27-32 min | 6.7-7.4 GiB |

  (The four D = 500 runs of 2026-10-18 are within these ranges: 23.6-23.7 min at E = 50, 31.2-31.7 min at
  E = 100, 7.3-7.4 GiB.)
  | D = 10, N = 5,000, E = 50 | 24-25 min | 6.7-6.9 GiB |
  | D = 10, N = 5,000, E = 100 | about 36 min | 6.7 GiB |

  The E = 20 runs, two at a time or beside a big run, took 12-15 min at N = 5,000 (4.9-5.1 GiB), 4-9 min at
  N = 1,500 (1.8-2.4 GiB), and 7-14 min at N = 3,000 (3.4-3.8 GiB).
- **Machine time.** About 10.8 hours with the machine awake:
  - calibration and the first part of the sweep, 17 Oct 19:52-22:27;
  - the rest, 18 Oct about 07:10-15:24;
  - the four D = 500 runs added on 18 Oct, 17:23-19:14 (about 1.85 hours, one at a time).

  The machine was suspended twice (about 22:27-01:52 and 02:05-06:50), which delays the runs but does not change
  their results: the simulated time is the slot number, and the wall clock is only logged. The wall time of
  E50-N5000-C2500-D10-s1 includes both suspensions.
- **Memory.**
  - A guard (`guard.sh`) was ready to pause the youngest run if the available memory fell below 1.5 GiB. It never
    had to.
  - The machine kept at least 5.6 GiB available during every big run after the failed attempt (sampled every 10 s).
- **Checks.**
  - The harness files and `cashout.js` have the same SHA-256 before and after the sweep (`sha256-before.txt`).
  - The new aggregation script reproduces every figure of the first sweep's N = 5,000 table that it recomputes
    (7.9 / 6.8 / 5.7 %, 3.96 / 0.08 / 0.02 million gas, 46 min / 89 min / 4.2 h, 0.6 / 3.2 / 11.7 %).
  - In each of the 50 runs analysed with both batch and batchWide (46 before 2026-10-18), the two rules give the
    same answer for every order: the observer's limit of 2,000 slots changes nothing. The first sweep's three D = 10 runs had no
    batchWide.
  - No withdrawal needed a merge.
  - A withdrawal costs 1.103 to 1.109 million gas at every E and D.


## Results

**How to read the tables.** The figures are means over the seeds, with [minimum–maximum of the seeds] after
them; these are not confidence intervals. Linkage is that of the observer that knows the wallets, over all orders
(except the column "cashed-out orders"). The rule that links most is the batch rule in every row. It answers
nearly every order, so its forced guess equals its recall (to 0.1 point). Three reference guesses stand next to
every linkage figure:

- the uniform guess, 1/E;
- the busiest wallet over the whole run: the establishment whose wallet received the most value, a guess made
  after the run, like the attacks;
- the busiest wallet so far: the same sum over the blocks before the order; an order without a guess counts as
  wrong.

The column "rule minus busiest whole run" is the paired difference per seed, in percentage points. "Larger than
the spread" asks whether the mean of that difference exceeds the range over the seeds of the rule's recall and of
the guess, and whether the difference is positive on every seed. "excess / spread" is the mean difference divided
by the larger of the two ranges; the paper's wording "by more / less than twice the spread" refers to this ratio.

Gas per order counts the cash-out transactions only, on the local node with emulated proofs, with the float of the
model, so no merge is ever needed. Wait: the mean time that a withdrawn unit of revenue spent in the pool, first in,
first out. "Revenue in the pool, time average": what an establishment has in the pool and has not received,
averaged over the run.

All columns of every configuration, the second table of each setting (every rule's recall, withdrawals per
establishment, orders before a cash-out run, the share of the most frequent establishment and the rule's per-seed
difference from it (added 2026-10-18), revenue left in USD, float, simulated hours, memory and time) and the
controls are in `denominations-scaled-2026-10-17/tables-2026-10-17.md` and in the JSON.

### E = 20, N = 5,000 (250 orders per establishment), C = 1,000, W = 45 (uniform guess 5.00 %; D 10: seeds 1,2,3 (first sweep); D 500: seeds 1,2,3 (first sweep); D 1000: seeds 1,2,3; D 2000: seeds 1,2,3 (first sweep))

| D (USD) | N | rule that links most: recall | its forced guess | busiest wallet, whole run | busiest wallet so far | rule minus busiest whole run, per seed (points) | excess larger than the spread of the seeds? (seeds above; spread of the rule / of the guess, points) | recall, cashed-out orders (share cashed out) | withdrawals / order | merges / order | gas / order (M) | revenue left in the pool at the end | revenue in the pool, time average (USD / est.) | mean wait of withdrawn revenue | wallets unknown, grouped (same rule) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 10 | 5,000 | batch: 7.9 % [7.6–8.2] | 7.9 % [7.6–8.2] | 5.4 % [5.4–5.5] | 5.1 % [4.6–5.4] | +2.5 [+2.1 to +2.8] | yes: above on 3 of 3; spreads 0.6 / 0.1; excess / spread 4.0 | 7.9 % [7.7–8.3] (99 %) | 3.572 [3.480–3.640] | 0.0000 [0.0000–0.0000] | 3.96 [3.85–4.03] | 0.6 % [0.4–0.7] | 196 [194–198] | 46 min [45 min–47 min] | 7.9 % [7.6–8.2] |
| 500 | 5,000 | batch: 6.8 % [6.6–7.0] | 6.8 % [6.6–7.0] | 5.4 % [5.4–5.5] | 4.7 % [4.6–4.8] | +1.3 [+1.2 to +1.6] | yes: above on 3 of 3; spreads 0.4 / 0.1; excess / spread 3.2 | 6.9 % [6.8–7.2] (98 %) | 0.070 [0.068–0.071] | 0.0000 [0.0000–0.0000] | 0.08 [0.08–0.08] | 3.2 % [3.1–3.3] | 389 [387–391] | 89 min [87 min–91 min] | 6.8 % [6.6–7.0] |
| 1,000 | 5,000 | batch: 6.2 % [5.9–6.6] | 6.2 % [5.9–6.6] | 5.3 % [5.2–5.4] | 4.6 % [4.4–4.7] | +0.9 [+0.6 to +1.2] | yes: above on 3 of 3; spreads 0.7 / 0.2; excess / spread 1.3 | 6.6 % [6.3–7.0] (95 %) | 0.034 [0.033–0.034] | 0.0000 [0.0000–0.0000] | 0.04 [0.04–0.04] | 6.1 % [5.9–6.3] | 626 [620–633] | 2.4 h [2.4 h–2.5 h] | 6.2 % [5.9–6.6] |
| 2,000 | 5,000 | batch: 5.7 % [5.5–5.8] | 5.7 % [5.5–5.8] | 5.3 % [5.1–5.4] | 3.9 % [3.7–4.0] | +0.4 [+0.1 to +0.6] | yes: above on 3 of 3; spreads 0.3 / 0.3; excess / spread 1.2 | 6.3 % [6.1–6.5] (90 %) | 0.016 [0.015–0.016] | 0.0000 [0.0000–0.0000] | 0.02 [0.02–0.02] | 11.7 % [11.4–12.0] | 1,078 [1,053–1,090] | 4.2 h [4.1 h–4.4 h] | 5.7 % [5.5–5.8] |

### E = 50, N = 7,500 (150 orders per establishment), C = 3,750 (D = 10: N = 5,000, C = 2,500, 100 orders per establishment), W = 105 (uniform guess 2.00 %; D 10: seeds 1,2,3; D 500: seeds 1,2,3; D 1000: seeds 1,2,3; D 2000: seeds 1,2,3)

| D (USD) | N | rule that links most: recall | its forced guess | busiest wallet, whole run | busiest wallet so far | rule minus busiest whole run, per seed (points) | excess larger than the spread of the seeds? (seeds above; spread of the rule / of the guess, points) | recall, cashed-out orders (share cashed out) | withdrawals / order | merges / order | gas / order (M) | revenue left in the pool at the end | revenue in the pool, time average (USD / est.) | mean wait of withdrawn revenue | wallets unknown, grouped (same rule) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 10 | 5,000 | batch: 3.65 % [3.40–3.90] | 3.65 % [3.40–3.90] | 2.35 % [2.30–2.40] | 2.03 % [1.96–2.14] | +1.31 [+1.06 to +1.60] | yes: above on 3 of 3; spreads 0.50 / 0.10; excess / spread 2.6 | 3.70 % [3.45–3.94] (99 %) | 3.562 [3.452–3.643] | 0.0000 [0.0000–0.0000] | 3.95 [3.82–4.04] | 1.2 % [1.0–1.5] | 186 [182–192] | 45 min [44 min–45 min] | 3.65 % [3.40–3.90] |
| 500 | 7,500 | batch: 2.98 % [2.92–3.09] | 2.98 % [2.92–3.09] | 2.19 % [2.08–2.24] | 1.67 % [1.53–1.79] | +0.80 [+0.69 to +0.85] | yes: above on 3 of 3; spreads 0.17 / 0.16; excess / spread 4.6 | 3.07 % [2.99–3.18] (97 %) | 0.069 [0.067–0.070] | 0.0000 [0.0000–0.0000] | 0.08 [0.07–0.08] | 4.4 % [4.3–4.5] | 374 [366–382] | 87 min [86 min–89 min] | 2.98 % [2.92–3.09] |
| 1,000 | 7,500 | batch: 2.50 % [2.40–2.65] | 2.50 % [2.40–2.65] | 2.20 % [2.08–2.31] | 1.74 % [1.69–1.80] | +0.29 [+0.09 to +0.57] | yes: above on 3 of 3; spreads 0.25 / 0.23; excess / spread 1.2 | 2.68 % [2.58–2.84] (93 %) | 0.033 [0.032–0.033] | 0.0000 [0.0000–0.0000] | 0.04 [0.04–0.04] | 8.8 % [8.6–9.2] | 593 [588–600] | 2.3 h [2.3 h–2.4 h] | 2.50 % [2.40–2.65] |
| 2,000 | 7,500 | batch: 2.54 % [2.39–2.61] | 2.54 % [2.39–2.61] | 2.20 % [2.08–2.31] | 1.39 % [1.31–1.49] | +0.33 [+0.16 to +0.53] | yes: above on 3 of 3; spreads 0.23 / 0.23; excess / spread 1.5 | 3.13 % [2.88–3.29] (81 %) | 0.014 [0.014–0.015] | 0.0000 [0.0000–0.0000] | 0.02 [0.02–0.02] | 20.9 % [19.5–22.8] | 1,037 [1,028–1,046] | 4.2 h [4.1 h–4.3 h] | 2.54 % [2.39–2.61] |

### E = 100, N = 7,500 (75 orders per establishment), C = 3,750 (D = 10: N = 5,000, C = 2,500, 50 orders per establishment), W = 205 (uniform guess 1.00 %; D 10: seeds 1,2,3; D 500: seeds 1,2,3; D 1000: seeds 1,2,3; D 2000: seeds 1,2,3)

| D (USD) | N | rule that links most: recall | its forced guess | busiest wallet, whole run | busiest wallet so far | rule minus busiest whole run, per seed (points) | excess larger than the spread of the seeds? (seeds above; spread of the rule / of the guess, points) | recall, cashed-out orders (share cashed out) | withdrawals / order | merges / order | gas / order (M) | revenue left in the pool at the end | revenue in the pool, time average (USD / est.) | mean wait of withdrawn revenue | wallets unknown, grouped (same rule) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 10 | 5,000 | batch: 2.03 % [1.78–2.16] | 2.03 % [1.78–2.16] | 1.41 % [1.36–1.50] | 0.96 % [0.84–1.12] | +0.62 [+0.28 to +0.80] | yes: above on 3 of 3; spreads 0.38 / 0.14; excess / spread 1.6 | 2.07 % [1.81–2.21] (98 %) | 3.541 [3.526–3.568] | 0.0000 [0.0000–0.0000] | 3.92 [3.91–3.95] | 2.2 % [1.9–2.4] | 156 [153–158] | 43 min [42 min–44 min] | 2.03 % [1.78–2.16] |
| 500 | 7,500 | batch: 1.70 % [1.57–1.87] | 1.70 % [1.57–1.87] | 1.13 % [1.05–1.25] | 0.79 % [0.69–0.89] | +0.57 [+0.41 to +0.77] | yes: above on 3 of 3; spreads 0.29 / 0.20; excess / spread 1.9 | 1.81 % [1.67–1.99] (94 %) | 0.065 [0.064–0.066] | 0.0000 [0.0000–0.0000] | 0.07 [0.07–0.07] | 9.5 % [8.8–10.2] | 345 [336–356] | 84 min [82 min–86 min] | 1.70 % [1.57–1.87] |
| 1,000 | 7,500 | batch: 1.36 % [1.32–1.44] | 1.36 % [1.32–1.44] | 1.14 % [1.05–1.25] | 0.70 % [0.63–0.80] | +0.23 [+0.19 to +0.28] | yes: above on 3 of 3; spreads 0.12 / 0.20; excess / spread 1.1 | 1.62 % [1.57–1.68] (84 %) | 0.029 [0.029–0.029] | 0.0000 [0.0000–0.0000] | 0.03 [0.03–0.03] | 19.5 % [19.3–19.9] | 558 [557–560] | 2.3 h [2.3 h–2.3 h] | 1.36 % [1.32–1.44] |
| 2,000 | 7,500 | batch: 1.31 % [1.25–1.41] | 1.31 % [1.25–1.41] | 1.13 % [1.03–1.25] | 0.50 % [0.44–0.60] | +0.18 [+0.15 to +0.24] | no: above on 3 of 3; spreads 0.16 / 0.23; excess / spread 0.8 | 1.69 % [1.58–1.85] (76 %) | 0.013 [0.013–0.013] | 0.0000 [0.0000–0.0000] | 0.01 [0.01–0.01] | 29.1 % [28.7–29.8] | 928 [914–939] | 4.1 h [4.1 h–4.1 h] | 1.31 % [1.25–1.41] |


### Controls (E = 20, C = N/2; full tables in `denominations-scaled-2026-10-17/tables-2026-10-17.md`)

| Setting | D = 10 | 500 | 1,000 | 2,000 |
|---|---|---|---|---|
| N = 1,500, 75 orders per establishment, seeds 1-3: batch rule | 8.0 % [7.3–8.5] | 6.6 % [5.9–7.1] | 6.3 % [6.0–6.9] | 6.3 % [5.7–7.2] |
| the same runs: busiest wallet, whole run | 5.6 % [4.9–6.4] | 5.7 % [5.3–6.4] | 5.2 % [4.9–5.4] | 4.8 % [4.8–4.9] |
| per-seed difference (points); larger than the spread? | +2.4 [+2.1 to +2.6]; yes (1.5) | +0.9 [+0.3 to +1.7]; no (0.7) | +1.1 [+0.6 to +2.1]; yes (1.2) | +1.4 [+0.8 to +2.3]; no (0.9) |
| revenue left in the pool at the end | 1.6 % | 8.2 % | 19.0 % | 27.6 % |
| N = 3,000, 150 orders per establishment, seed 1: batch rule / busiest whole run | 7.8 / 5.4 % | 6.0 / 5.1 % | 5.8 / 5.1 % | 5.6 / 5.1 % |

The uniform guess is 5.0 % in every row.

The customers alone (N = 5,000, D = 2,000, seed 1): with C = 2,500 the batch rule links 5.68 %, against 5.32 % for
the busiest wallet over the whole run. With the first sweep's C = 1,000 the three seeds give 5.54 to 5.82 %,
against 5.08 to 5.42 %. One run shows no difference.

## What can be concluded

In the result file's terms: each linkage figure goes with its reference guesses, there is no multiple of the
uniform guess, the spread of the seeds is given, and every figure is a figure of a model.

1. **The dApp's 10 USD.** With more establishments and more customers the cash-out still links more orders than
   the reference guesses.
   - The batch rule links 7.9 % [7.6–8.2], 3.65 % [3.40–3.90] and 2.03 % [1.78–2.16] of the orders with 20, 50 and
     100 establishments.
   - The reference guesses are 5.0, 2.00 and 1.00 % for the uniform guess, 5.4 % [5.4–5.5], 2.35 % [2.30–2.40] and
     1.41 % [1.36–1.50] for the busiest wallet over the whole run, and 5.1, 2.03 and 0.96 % for the busiest wallet
     so far.
   - The rule is above the whole-run guess on every seed at every E, by +2.5, +1.3 and +0.6 points.
   - The excess is larger than the spread of the seeds at every E: by more than twice at E = 20 and 50 (ratios 4.0
     and 2.6), by less than twice at E = 100 (1.6).
   - At E = 50 and 100 these runs have 5,000 orders (100 and 50 per establishment).
2. **500 USD** (three seeds at every E since 2026-10-18).
   - The rule links 6.8 % [6.6–7.0], 2.98 % [2.92–3.09] and 1.70 % [1.57–1.87] of the orders with 20, 50 and 100
     establishments.
   - The whole-run guess is 5.4 % [5.4–5.5], 2.19 % [2.08–2.24] and 1.13 % [1.05–1.25].
   - The rule is above it on every seed at every E, by +1.3 [+1.2 to +1.6], +0.80 [+0.69 to +0.85] and
     +0.57 [+0.41 to +0.77] points.
   - The excess is larger than the spread of the seeds at every E: by more than twice at E = 20 and 50 (ratios 3.2
     and 4.6), by less than twice at E = 100 (1.9).
   - Against the share of the most frequent establishment (5.6, 2.43 and 1.32 %; computed from the true order
     counts, which no observer has), the rule is above on every seed at every E, by +1.21 [+1.00 to +1.54],
     +0.56 [+0.41 to +0.75] and +0.38 [+0.25 to +0.57] points. With the draft's measure of the spread of one run
     (the binomial standard deviation at that share: 0.32, 0.18 and 0.13 points), the mean excess is about 3.7, 3.1
     and 2.9 times that spread, so more than twice at every E; the smallest seed at E = 100 (+0.25) is just below
     twice (0.26).
3. **1,000 and 2,000 USD.**
   - The rule links:

     | E | 1,000 USD | 2,000 USD | Busiest wallet, whole run |
     |---|---|---|---|
     | 20 | 6.2 % [5.9–6.6] | 5.7 % [5.5–5.8] | 5.3 % |
     | 50 | 2.50 % [2.40–2.65] | 2.54 % [2.39–2.61] | 2.20 % |
     | 100 | 1.36 % [1.32–1.44] | 1.31 % [1.25–1.41] | 1.13-1.14 % |

   - The rule is above the whole-run guess on each of the three seeds at every E.
   - The excess is +0.9 and +0.4 points at E = 20, +0.29 and +0.33 at E = 50, and +0.23 and +0.18 at E = 100.
   - Against the spread of the seeds, the ratio is 1.3 and 1.2 at E = 20, 1.2 and 1.5 at E = 50, and 1.1 and 0.8 at
     E = 100. At E = 100 and 2,000 USD the excess is smaller than the spread of the guess over the seeds.
   - So the data suggest a small excess at 1,000 and 2,000 USD and do not fix its size. At E = 100 and 2,000 USD the
     excess is not separated from the whole-run guess by this criterion: 98 orders of 7,500 linked, against 85 for
     the guess and 75 for the uniform guess.
4. **Where the linkage falls.**
   - From 10 to 500 USD, where the amount takes over from the five notes as the trigger of a cash-out (as in the
     first sweep), the excess over the whole-run guess falls from +2.5 to +1.3 points at E = 20 and from +1.31
     [+1.06 to +1.60] to +0.80 [+0.69 to +0.85] at E = 50 (the ranges do not overlap). At E = 100 it goes from
     +0.62 [+0.28 to +0.80] to +0.57 [+0.41 to +0.77]: the ranges overlap, so the fall is not separated there.
     Against the most frequent establishment the same holds (+0.62 [+0.28 to +0.80] and +0.38 [+0.25 to +0.57]
     at E = 100). At E = 50 and 100 the D = 10 runs have N = 5,000 and another order stream, so this comparison
     is not paired per seed.
   - From 500 to 1,000 USD the linkage falls at every E and on every seed. The runs of the same seed with
     D = 500, 1,000 and 2,000 have the same order stream (the same establishment for every one of the 7,500
     orders, checked at E = 50 and 100), so the comparison is paired:
     - recall of the rule at 500 minus at 1,000 USD: +0.40, +0.66, +0.54 points at E = 20; +0.27, +0.49, +0.69
       at E = 50; +0.24, +0.23, +0.55 at E = 100 (seeds 1, 2, 3);
     - excess over the whole-run guess, 500 → 1,000 USD: +1.3 → +0.9 at E = 20, +0.80 → +0.29 at E = 50,
       +0.57 → +0.23 at E = 100 (means), lower at 1,000 USD on every seed;
     - excess over the most frequent establishment: +1.21 → +0.67, +0.56 → +0.07, +0.38 → +0.04, lower on
       every seed;
     - at E = 50 and 100 the ranges of the recall do not overlap (2.92–3.09 against 2.40–2.65 %, 1.57–1.87
       against 1.32–1.44 %); at E = 20 they overlap slightly (6.60–7.02 against 5.94–6.62 %).
   - With one seed (the version of 2026-10-17) this fall could be stated only for seed 1 at E = 50 and 100; with
     three seeds it holds on each of them.
   - Between 1,000 and 2,000 USD the two figures are not separated at E = 50 or E = 100 (their ranges over the
     seeds overlap). At E = 20 the figure for 2,000 USD is lower than for 1,000 USD on every seed.
   - The controls with 75 orders per establishment do not show this order at E = 20 (6.6, 6.3, 6.3 % at 500, 1,000
     and 2,000 USD). The busiest-wallet guess is weak there (4.8 % at 2,000 USD, below the uniform guess), because
     each establishment has then made about one withdrawal of the same amount.
5. **The orders whose revenue was cashed out.** Restricted to those orders, the figures are higher at the large
   denominations: 3.13 % (81 % of the orders cashed out) at E = 50 and 1.69 % (76 %) at E = 100 with 2,000 USD.
   - The revenue still in the pool at the end of a run cannot be linked by any timing rule.
   - Its share depends on the length of the run: about 35, 21 and 11 to 13 simulated hours at E = 20, 50 and 100.
   - Part of the fall of the overall figure at 2,000 USD therefore comes from the length of the runs. Longer runs
     at E = 50 and 100 do not fit in the memory of this machine.
6. **More establishments.** The figures fall with E at every denomination, together with the uniform guess. The
   excess over the whole-run guess, in points, falls with E too: from +2.5 to +0.6 at 10 USD, and from +0.4 to
   +0.18 at 2,000 USD. Every figure shrinks with the uniform guess, so these points are not on one scale, and the
   E are not ranked by them. The fewer orders per establishment at larger E do not explain it alone: at E = 20 with the 75
   orders per establishment of E = 100, the excess at 2,000 USD is +1.4 [+0.8 to +2.3]. In that control the
   whole-run guess is below the uniform guess, and at E = 100 it is above.
7. **More customers** change nothing detectable, as expected, since no attack of the observer uses the customer
   (control above, one run).
8. **The observer that does not know the wallets.**
   - It finds all 50 and all 100 main wallets and no other account in every run. This is a property of the model:
     every establishment deposits and cashes out from its main wallet, and nobody else uses the pool.
   - It puts as many orders in the right wallet's group as the other observer names, under every rule.
   - It names no establishment (0.00 %).
   - Knowing one order per establishment, it names 0.10 to 0.68 % of the other orders at E = 50 and 100 (means over the seeds of each configuration). The
     reference guesses were not computed for this observer.

## The trade-off

The cost and the wait of each denomination are the same at every E, because every establishment has the same
order rate in the model (one order every 8 minutes, about 270 USD of revenue per hour). Revenue per order is 35.9
to 36.2 USD on average per configuration in these runs (35.9 to 36.6 in the one-seed version).

| D (USD) | Cash-out gas per order (million) | Withdrawals per order | Mean wait of the withdrawn revenue | Revenue in the pool, time average (USD per establishment) | Revenue left at the end: E = 20 (35 h) / 50 (21 h) / 100 (11-13 h) |
|---|---|---|---|---|---|
| 10 | 3.92-3.96 | 3.54-3.57 | 43-46 min | 156-196 | 0.6 / 1.2 / 2.2 % (runs of 35, 15 and 9 h) |
| 500 | 0.072-0.077 | 0.065-0.070 | 84-89 min | 345-389 | 3.2 / 4.4 / 9.5 % |
| 1,000 | 0.032-0.037 | 0.029-0.034 | 137-144 min | 558-626 | 6.1 / 8.8 / 19.5 % |
| 2,000 | 0.014-0.018 | 0.013-0.016 | 247-252 min | 928-1,078 | 11.7 / 20.9 / 29.1 % |

(ranges over the three settings; means over the seeds; the 500 USD row with three seeds at every E since
2026-10-18, before: 0.073-0.077, 0.066-0.070, 82-89 min, 336-389 USD, 3.2 / 4.5 / 8.8 %.)

- **10 → 500 USD.**
  - The cash-out gas per order falls by a factor of about 50, from about 3.9 to about 0.075 million.
  - The excess over the whole-run guess falls (item 4).
  - The withdrawn revenue waits 84-89 instead of 43-46 minutes on average.
  - The revenue an establishment has in the pool averages 345-389 instead of 156-196 USD.
- **500 → 1,000 USD.**
  - The gas falls to about 0.035 million.
  - The excess falls again (+0.9, +0.29 and +0.23 points), on every seed at every E.
  - The wait is 2.3-2.4 hours, and 558-626 USD per establishment is held in the pool on average.
- **1,000 → 2,000 USD.**
  - The gas falls to about 0.016 million, a saving of about 0.02 million gas per order.
  - The linkage is not separated from 1,000 USD at E = 50 and 100, and is 0.5 points lower at E = 20.
  - The wait grows to about 4.1-4.2 hours, and the money held in the pool to 928-1,078 USD per establishment.
  - Up to one denomination per establishment stays in the pool at the end (790 to 1,130 USD).
  - With 75 orders per establishment (E = 100), 3 to 6 of the 100 establishments had made no withdrawal at all by
    the end of the run.
- **The wait and the money held scale with the order rate.** An establishment with fewer orders than the model's
  one every 8 minutes waits proportionally longer for the same denomination.

On these runs, nearly all of the saving in gas is reached at 500 USD. At 500 USD the cash-out still links more
orders than the busiest-wallet guess and the most frequent establishment at every E, on every seed. The excess
linkage keeps falling up to 1,000 USD, on every seed at every E. Going to 2,000 USD separates no further fall at
E = 50 and 100 (a small one at E = 20), and it doubles the wait and the money held in the pool compared with
1,000 USD. This is a reading of a model, with an assumed delay before the button is pressed and equal order rates.

## What was not measured

- **Establishments with different order rates.** Every establishment has the same expected rate here, so the
  busiest-wallet guess stays close to the uniform guess. With establishments of different sizes it would be higher,
  and the figures above would have to be read against it.
- **Longer runs at E = 50 and 100** (several withdrawals of 2,000 USD per establishment at E = 100), for memory (see
  Design).
- **D = 10 at the N of the other denominations** at E = 50 and 100: N = 5,000, for memory.
- **A small float.** With the model's float no withdrawal needed a merge. The first sweep's check found merges and
  1.4 to 2.3 times the cash-out gas per order with a small float at E = 20; that was not repeated here.
- **Other observers.** An observer that uses the total of a cash-out run or combines evidence across runs, or a
  global assignment of orders to withdrawals. The rules are heuristics, so the figures are what these rules find,
  not a bound.
- **When people press the button** (the 30-minute mean is an assumption), and the endings without a delivery and
  the workers who leave (off, as in the main rows of the result file).
- **Real Groth16 proofs and any network.** The gas per withdrawal is the local node's with the gas-equivalent
  verifier.
- **Confidence intervals.** Only the minimum and maximum of three seeds (one for some controls) are given.

## Files

- `denominations-scaled-2026-10-17.json`: the groups, the runs and the rules, from the per-run outputs and truth
  dumps of the 44 runs of this sweep and of the nine runs of the first sweep at E = 20 and N = 5,000.
- `denominations-scaled-2026-10-17/tables-2026-10-17.md`: the full tables, with the controls.
- `denominations-scaled-2026-10-17/<run>.json.gz` and `<run>.truth.json.gz`: the per-run outputs and truth dumps,
  gzipped; the nine runs of the first sweep are in `denominations-2026-10-17/`. The `file` fields of the JSON give
  the names under which the runs were written (`runs/` and `../denominations/runs/`).
- The scripts, the job lists, the logs, the calibration runs and the earlier version of this note are not published.

## Update of 2026-10-18: three seeds at 500 USD with 50 and 100 establishments

Seeds 2 and 3 of D = 500 at E = 50 and E = 100 (N = 7,500, C = 3,750) were run; the dApp's default
denomination stays at 10 USD, and nothing in `manager-frontend/` was changed.

**How.** The four jobs dropped for time on 2026-10-17 (`E50-N7500-C3750-D500-s2`, `-s3`, `E100-N7500-C3750-D500-s2`,
`-s3`), with the same lines as in `jobs-sweep.txt`, in `jobs-d500-seeds-2026-10-18.txt`, run by `run-scaled.sh`
one at a time (estimate 7.5 GiB each, 13.5 GiB available, 2 GiB kept free) with `guard.sh` ready; on the
in-process Hardhat chain only, nothing sent to any network. 18 Oct 17:23-19:14.

**Checks.**
- Each run exited with status 0 and wrote its `.json` and `.truth.json`; each has 7,500 scored orders, 7,500 orders in
  its truth dump (all paid), and the variants batch, window150 and batchWide. Wall 23.6-23.7 min (E = 50) and
  31.2-31.7 min (E = 100), max RSS 7.3-7.4 GiB. The guard never paused a run.
- The seed-1 outputs of D = 500 at E = 50 and 100 have the same SHA-256 after the runs as before
  (`runs/sha256-D500-s1-before-2026-10-18.txt`).
- The harness files and `cashout.js` have the hashes of `sha256-before.txt` after the runs.
- The new runs have the order stream of the same seed at D = 1,000 and 2,000 (the same establishment for each of
  the 7,500 orders), so the comparison across D ≥ 500 is paired per seed.
- batch and batchWide give the same answer for every order in the four runs; no withdrawal needed a merge; a
  withdrawal costs 1.103 to 1.109 million gas, as in the other runs.
- The observer that does not know the wallets finds all 50 or 100 main wallets and no other account, its grouped
  recall equals the recall under every rule, and it names no establishment. Knowing one order per establishment
  it names 0.31 to 0.97 % of the other orders in the four new runs (default rule); the means over the three seeds
  at 500 USD, 0.65 % at E = 50 (0.35 % on seed 1 alone) and 0.31 % at E = 100, stay within the 0.10 to 0.68 % of
  the configuration means in item 8.

**Per seed** (batch rule, the rule that links most in every run; percent of the orders; differences in points):

| E | seed | batch rule | busiest wallet, whole run | most frequent establishment | rule minus whole-run guess | rule minus most frequent | at 1,000 USD, same seed: batch rule | gas / order (M) | withdrawals / order | mean wait | revenue left at the end | revenue in the pool, time average (USD / est.) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 50 | 1 (2026-10-17) | 2.92 | 2.08 | 2.41 | +0.84 | +0.51 | 2.65 | 0.077 | 0.070 | 86 min | 4.5 % | 373 |
| 50 | 2 | 2.93 | 2.24 | 2.52 | +0.69 | +0.41 | 2.44 | 0.077 | 0.070 | 88 min | 4.5 % | 382 |
| 50 | 3 | 3.09 | 2.24 | 2.35 | +0.85 | +0.75 | 2.40 | 0.074 | 0.067 | 89 min | 4.3 % | 366 |
| 100 | 1 (2026-10-17) | 1.57 | 1.05 | 1.27 | +0.52 | +0.31 | 1.33 | 0.073 | 0.066 | 82 min | 8.8 % | 336 |
| 100 | 2 | 1.67 | 1.25 | 1.41 | +0.41 | +0.25 | 1.44 | 0.073 | 0.066 | 84 min | 9.6 % | 341 |
| 100 | 3 | 1.87 | 1.09 | 1.29 | +0.77 | +0.57 | 1.32 | 0.071 | 0.064 | 86 min | 10.2 % | 356 |

**The rows before and after** (means; ranges [minimum–maximum] of the seeds where there are three):

| | E = 50, seed 1 only (2026-10-17) | E = 50, seeds 1-3 | E = 100, seed 1 only (2026-10-17) | E = 100, seeds 1-3 |
|---|---|---|---|---|
| batch rule | 2.92 % | 2.98 % [2.92–3.09] | 1.57 % | 1.70 % [1.57–1.87] |
| busiest wallet, whole run | 2.08 % | 2.19 % [2.08–2.24] | 1.05 % | 1.13 % [1.05–1.25] |
| busiest wallet so far | 1.68 % | 1.67 % [1.53–1.79] | 0.69 % | 0.79 % [0.69–0.89] |
| most frequent establishment | 2.41 % | 2.43 % [2.35–2.52] | 1.27 % | 1.32 % [1.27–1.41] |
| rule minus whole-run guess | +0.84, not ranked | +0.80 [+0.69 to +0.85]; larger than the spread of the seeds (ratio 4.6) | +0.52, not ranked | +0.57 [+0.41 to +0.77]; larger than the spread (ratio 1.9) |
| rule minus most frequent establishment | +0.51 | +0.56 [+0.41 to +0.75], above on 3 of 3 | +0.31 | +0.38 [+0.25 to +0.57], above on 3 of 3 |
| recall, cashed-out orders (share cashed out) | 2.99 % (98 %) | 3.07 % [2.99–3.18] (97 %) | 1.67 % (94 %) | 1.81 % [1.67–1.99] (94 %) |
| withdrawals / order | 0.070 | 0.069 [0.067–0.070] | 0.066 | 0.065 [0.064–0.066] |
| gas / order (M) | 0.077 | 0.076 [0.074–0.077] | 0.073 | 0.072 [0.071–0.073] |
| mean wait of withdrawn revenue | 86 min | 87 min [86–89] | 82 min | 84 min [82–86] |
| revenue left in the pool at the end | 4.5 % | 4.4 % [4.3–4.5] | 8.8 % | 9.5 % [8.8–10.2] |
| revenue in the pool, time average (USD / est.) | 373 | 374 [366–382] | 336 | 345 [336–356] |

Seed 1 lies at the bottom of the range of the batch rule at both E, so the one-seed figures understated the
linkage at 500 USD slightly (by 0.06 and 0.13 points on the mean).

**What changed in the conclusions.**
1. **500 USD is now ranked at E = 50 and 100.** The rule is above the whole-run guess and the most frequent
   establishment on every seed, and the excess over the whole-run guess is larger than the spread of the seeds
   (more than twice at E = 50, less than twice at E = 100). Against the most frequent establishment the mean excess
   is about three times the binomial spread of one run at both E (item 2). Before, the single runs were not ranked.
2. **The fall from 500 to 1,000 USD holds at every E on every seed** (item 4), both for the recall (paired order
   streams) and for the excess over either reference. Before, it rested on seed 1 at E = 50 and 100.
3. **The fall from 10 to 500 USD at E = 100 is not separated** (+0.62 [+0.28 to +0.80] to +0.57 [+0.41 to +0.77]
   over the whole-run guess; the one-seed version gave +0.62 to +0.52). At E = 20 and 50 it is separated (ranges
   apart). The D = 10 runs at E = 50 and 100 have N = 5,000, so this step is not paired per seed.
4. **Costs and waits at 500 USD** move within a few percent: gas 0.072-0.077 million per order (was 0.073-0.077),
   withdrawals 0.065-0.070 per order, wait 84-89 min (was 82-89), 345-389 USD held per establishment (was 336-389),
   revenue left at E = 100 9.5 % (was 8.8 %).
5. Unchanged: every 10, 1,000 and 2,000 USD figure, the E = 20 rows, the controls, and the reading of 1,000 against
   2,000 USD.

**For the draft** (`../drafts/denominations.tex`, not changed here): the sentences that give the 500 USD rows with
50 and 100 establishments as one run ("which was run once", "the single run at 500~USD gives 2.92\% and
1.57\%") and the 500 USD rows of `tab:denominations` (2.92 / 2.08 / 1.68 / 2.41 / +0.51 / 0.077 / 86 min / 4.5 %
and 1.57 / 1.05 / 0.69 / 1.27 / +0.31 / 0.073 / 82 min / 8.8 %) would take the three-seed figures above; the wait
range "82 to 89 minutes" becomes 84 to 89 and the held range "336 to 389" becomes 345 to 389 USD.
