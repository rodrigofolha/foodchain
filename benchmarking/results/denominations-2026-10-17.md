# Larger denominations in the manager dApp's cash-out (local simulation, 2026-10-17)

This note reports a local simulation of the manager dApp's cash-out with larger denominations, made with the
harness behind `privacy-eval-final-2026-10-12.md` (not published) on its in-process Hardhat chain (chain id 31337).
Nothing was sent to any network. Data: `denominations-2026-10-17.json` and
`denominations-2026-10-17/tables-2026-10-17.md`; the outputs of the nine runs at N = 5,000 used in
`denominations-scaled-2026-10-17.md`: `denominations-2026-10-17/`.

## Method

**What changed.** Only the denomination of the dApp's policy. The harness already accepts the strategy
`DAPP:<D>:p<X>` (`workload.cjs`, `parseStrategy`), which sets the policy to `{ denominationUsd: D,
everyNotes: X }`; the runs use `DAPP:100:p5`, `DAPP:500:p5` and `DAPP:2000:p5`, so that the number of notes
stays at the dApp's 5 (`CASHOUT_POLICY` in `manager-frontend/src/utils/cashout.js`). The planning functions
(`cashoutStatus`, `planCashout`, `nextWithdrawalStep`, `planAmounts`) are still evaluated from the dApp's
source file, unchanged. The reference rows (10 USD) run the plain `DAPP` strategy with the configuration of
group A of the grid, and reproduce the archived A/E20/DAPP/seed1–3 in every score, prefix and per-order
answer (see Checks).

**What is the same.** Arm FULL, E = 20, one zone, the order stream of each seed (paired across the
denominations), every delay of the workload, the button pressed 1 + Exp(150) slots (30 minutes on average)
after it becomes possible, withdrawals sent by and paid to the main wallet, the base-fee walk, the
distributed-prover emulation, the observer and the scorer. The float is the one of the existing DAPP rows,
(2 N/E + 20) × 20 USD per establishment in three deposits: 1,401 USD at N = 500 and 10,401 USD at
N = 5,000, so that the collateral of new orders is always covered. Each run is analysed with the three
timing rules of the grid (default, window150, batch). The runs at N = 5,000 with 500 and 2,000 USD were also
analysed with the batch rule without the observer's limit of 2,000 slots between an order and the wallet's
next withdrawal (`windowMax` 20,000; at 2,000 USD an establishment's withdrawals are about 2,200 slots
apart). That limit changed no answer: the two versions of the rule give the same establishment for every
order of the six runs.

**The trigger, from the planner.** The button is enabled when `cashoutStatus` is due and fills one
withdrawal: at least 5 revenue notes have arrived since the previous run started (`everyNotes`), and the
revenue not yet cashed out (`revenueWei − cashedOutWei`, at most what the pool holds) is at least one
denomination D. A run then makes `floor(cashable / D)` withdrawals of exactly D, one per slot, and the
remainder stays for the next run. With 10 and 100 USD the five notes are the binding condition: five notes
hold about 180 USD. With 500 and 2,000 USD the amount is: the revenue carried over plus the new notes must
reach D, which takes about 500 / 35.9 ≈ 14 and 2,000 / 35.9 ≈ 56 orders. Measured, at N = 5,000: 8.3, 8.9,
15.0 and 56.7 orders paid between the end of one run and the start of the next (ranges over all runs 1–33,
3–36, 4–38 and 37–81), runs 1.1, 1.2, 2.0 and 7.4 hours apart, with 32.1, 3.2, 1.07 and 1.00 withdrawals
per run. Each withdrawal spends, per `nextWithdrawalStep`, the smallest note that covers D with the dummy
note, or the two largest notes when together they cover D, or else a pure merge of the two largest notes is
sent first. With the float above no run needed a merge at any denomination: the withdrawals of 500 and
2,000 USD were paid from notes that hold float money, which the dApp does not keep apart from revenue.

**Run lengths.** At N = 500 (25 orders, about 894 USD per establishment, 4.8 simulated hours) a 2,000 USD
withdrawal cannot happen, and 500 USD happens about once per establishment. A test run (2,000 USD,
N = 1,500, seed 1) took 246 s and 2.3 GB, with one withdrawal per establishment. N = 5,000 (250 orders,
about 8,980 USD per establishment, 34–36 simulated hours) gives four withdrawals of 2,000 USD per
establishment; its runs took 14 to 24 minutes and 5.1 to 6.7 GB of resident memory each and ran two at a time. All 24 runs
(4 denominations × 2 lengths × seeds 1, 2, 3) completed.

**Wait of the revenue.** The harness does not report it. Each unit of revenue is taken to enter the pool at
the slot its order paid the establishment and to leave with the next withdrawal of that establishment,
first in, first out. The mean wait is over the revenue that was withdrawn; the revenue still in the pool at
the end is reported apart (share, USD per establishment) and, as a time average over the run, the revenue
an establishment has in the pool and has not received. These figures need the truth's withdrawal times,
which `run-one.cjs` now writes when `PE_TRUTH_OUT` is set (the only change to the harness; see Checks).

**Checks.** Before and after that change, D/DAPP/FULL (E = 20, N = 200, seed 1) gives the archived result in
every score, count and per-order answer of the three rules; after it, so do A/E20/DAPP/seed1–3 (the 10 USD
rows of N = 500). The cash-out gas differs by a few hundred gas per run (in 0.65 to 1.95 billion) because the
note secrets come from `crypto.randomBytes` (`common.cjs`, `randomField`) and change the calldata, as between
any two runs of the harness. `DAPP:10:p5` gives the same results as `DAPP`. The FIFO accounting gives the
same share of revenue left in the pool as the harness in every run.

## Results

Mean over seeds 1, 2, 3, [minimum–maximum of the seeds] (not confidence intervals). E = 20, so the uniform
guess is 5.0 %. Linkage is that of the observer that knows the wallets, over all orders, except the column
"cashed-out orders". The rule that links most is the batch rule wherever there was a withdrawal; its forced
guess equals its recall because it answers every order. Busiest wallet: the establishment whose wallet
received the most value, over the whole run (a guess made after the run) or before the order was made (a
guess made when the order appears; an order without a guess counts as wrong). Gas per withdrawal is
1.10–1.11 million at every denomination; no merges.

| N | D (USD) | Rule that links most: recall | Busiest wallet, whole run | Busiest wallet so far | Recall, cashed-out orders (share of orders cashed out) | Withdrawals / order | Gas / order (million) | Revenue left in the pool at the end | Mean wait of the withdrawn revenue | Revenue in the pool, time average (USD / establishment) | Wallets unknown, grouped |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 500 | 10 | 7.8 % [7.4–8.4] | 6.0 % [5.4–6.8] | 4.6 % [3.6–5.6] | 8.3 % (94 %) | 3.38 [3.23–3.53] | 3.74 [3.57–3.90] | 5.4 % [3.2–6.6] | 41 min [37–46] | 142 | 7.8 % |
| 500 | 100 | 7.7 % [7.0–8.6] | 6.0 % [5.4–6.8] | 3.8 % [2.8–4.8] | 8.1 % (94 %) | 0.32 [0.30–0.34] | 0.35 [0.33–0.37] | 10.6 % [7.4–13.2] | 47 min [44–52] | 169 | 7.7 % |
| 500 | 500 | 6.9 % [6.4–7.2] | 6.1 % [5.2–6.8] | 2.9 % [2.6–3.0] | 8.0 % (85 %) | 0.05 | 0.06 | 28.2 % [24.8–31.0] | 85 min [79–92] | 301 | 6.9 % |
| 500 | 2,000 | none: 0.0 % (forced 5.0 %) | no guess (0.0 %) | no guess (0.0 %) | no order cashed out | 0 | 0 | 100 % | no withdrawal | 484 | 0.0 % |
| 5,000 | 10 | 7.9 % [7.6–8.2] | 5.4 % [5.4–5.5] | 5.1 % [4.6–5.4] | 7.9 % (99 %) | 3.57 [3.48–3.64] | 3.96 [3.85–4.03] | 0.6 % [0.4–0.7] | 46 min [45–47] | 196 | 7.9 % |
| 5,000 | 100 | 7.9 % [7.8–8.2] | 5.4 % [5.4–5.5] | 4.8 % [4.8–4.9] | 8.0 % (100 %) | 0.36 [0.35–0.36] | 0.39 [0.38–0.40] | 1.0 % [0.9–1.1] | 52 min [51–54] | 225 | 7.9 % |
| 5,000 | 500 | 6.8 % [6.6–7.0] | 5.4 % [5.4–5.5] | 4.7 % [4.6–4.8] | 6.9 % (98 %) | 0.07 | 0.08 | 3.2 % [3.1–3.3] | 89 min [87–91] | 389 | 6.8 % |
| 5,000 | 2,000 | 5.7 % [5.5–5.8] | 5.3 % [5.1–5.4] | 3.9 % [3.7–4.0] | 6.3 % (90 %) | 0.02 | 0.02 | 11.7 % [11.4–12.0] | 4.2 h [4.1–4.4] | 1,078 | 5.7 % |

The other two rules link less in every row with a withdrawal (default 0.9–5.1 %, window150 3.6–6.7 %); every rule's figures,
the forced guesses, the cash-out runs and the guesses of the busiest wallet so far with a uniform guess for
the orders without one (4.9–5.6 %) are in `denominations-2026-10-17/tables-2026-10-17.md` and the JSON. The revenue left at the
end of the runs is 48, 94, 252 and 894 USD per establishment at N = 500 and 50, 90, 289 and 1,047 USD at
N = 5,000.

## What can be concluded

At N = 5,000 the batch rule links 7.9, 7.9, 6.8 and 5.7 % of the orders with denominations of 10, 100, 500
and 2,000 USD, against 5.0 % for the uniform guess and 5.3–5.4 % for the busiest wallet over the whole run.
Per seed, the rule exceeds the busiest-wallet guess by 2.5 [2.1–2.8], 2.5 [2.3–2.7], 1.3 [1.2–1.6] and
0.4 [0.1–0.6] percentage points. At 2,000 USD the two figures are separated by little more than the spread of
the seeds (0.3 points for each figure), that is, about 20 of 5,000 orders. At N = 500, 10 and 100 USD give
the same linkage (7.8 and 7.7 %); at 500 USD the figure, 6.9 % [6.4–7.2], is not separated from the
busiest-wallet guess, 6.1 % [5.2–6.8], by more than the spread of the seeds; and at 2,000 USD no
establishment reaches one withdrawal, so no rule links any order and the observer is left with the uniform
guess.

The step from 10 to 100 USD does not change the linkage, at either length. The trigger explains it: at both
denominations a run starts after five notes, so the runs happen at the same times and only their number of
withdrawals changes. The linkage falls when the amount becomes the trigger (500 and 2,000 USD): the runs are
rarer and each carries 15 or 57 orders instead of 8. Restricted to the orders whose revenue was cashed out,
the figures are slightly higher (7.9, 8.0, 6.9 and 6.3 % at N = 5,000) and fall in the same way.

The observer that does not know the wallets finds all 20 wallets in every run and puts as many orders in the
right wallet's group as the other observer names (the "grouped" column, under every rule); it names no
establishment (0.0 %), and with one known order per establishment it names 0.0–1.0 % of the others.

The model gives every establishment the same expected number of orders, which is why the busiest-wallet
guess is close to the uniform guess here; with establishments of different sizes it would be higher, and
the figures above would have to be read against it.

## Trade-off

The cost of the cash-out falls in proportion to the denomination: one withdrawal of about 1.1 million gas per
D of revenue, so 3.96, 0.39, 0.08 and 0.02 million gas per order at N = 5,000 (the mean revenue of an order
is 35.9 USD). The linkage falls only from 7.9 to 5.7 %, and only once the amount sets the trigger.

What the establishment gives up is time and money in the pool. The revenue that was withdrawn waited 46 min,
52 min, 89 min and 4.2 h on average at N = 5,000. With the amount as the trigger the wait is close to half a
denomination at the establishment's revenue rate plus the 30 minutes before the button is pressed: in the
model an establishment receives about 269 USD per hour, which gives 0.9 + 0.5 h for 500 USD and 3.7 + 0.5 h
for 2,000 USD. The revenue an establishment has in the pool and has not received averages 196, 225, 389 and
1,078 USD over the run, and at the end of a run up to one denomination per establishment stays there (1,047
USD per establishment, 11.7 % of the revenue, at 2,000 USD after 34 hours). At N = 500, about five hours of
business in the model, 2,000 USD leaves the whole revenue in the pool (894 USD per establishment). The wait
scales with the establishment's revenue rate: an establishment with fewer orders than the model's one every
eight minutes waits longer for the same denomination in the same proportion.

## What was not measured

- Establishments with different order rates; every establishment here has the same expected rate.
- A small float. With the large float of the main tables no withdrawal needed a merge; with a small float a
  withdrawal of 500 or 2,000 USD would need notes built from many revenue notes, and the number of merges was
  not measured (group K of the grid used 10 USD only).
- An observer that uses the total of a run or combines evidence across runs, and a global assignment of
  orders to withdrawals; the rules here are the grid's heuristics, so the figures are lower bounds of what
  leaks, as in the result file.
- When people press the button; the 30-minute mean is an assumption of the model, as is the order rate.
- Leaving workers and the other endings without a delivery (off, as in the main rows of the result file).
- Real Groth16 proofs (the gas-equivalent verifier is used, as in the grid) and any network: the gas per
  withdrawal is the harness's, on the local chain.

## Files

- `denominations-2026-10-17.json` and `denominations-2026-10-17/tables-2026-10-17.md`: the figures of every run of
  this sweep.
- `denominations-2026-10-17/D<usd>-N5000-s<seed>.json.gz` and `.truth.json.gz`: the outputs of the nine runs at
  N = 5,000 (D = 10, 500 and 2,000 USD) used in `denominations-scaled-2026-10-17.md`.
- The scripts, the logs, the other per-run outputs and the checks are not published.

## Corrections after the independent check (2026-10-17)

The check (folder `check/`) reproduced every figure of the table with its own script from the per-order answers and the truth dumps, reran one experiment at each scale with identical results apart from a few hundred gas, confirmed that the reference experiment matches the archive, and confirmed that the modelled trigger is the dApp's. It corrects four statements of this file and of its answer:

1. "Up to one full amount stays in the pool at any time" is wrong: revenue keeps arriving during the modelled delay before the button is pressed, and the 5-note rule holds back small denominations, so an establishment's revenue in the pool can exceed one denomination by far (at 2,000 USD it peaks at about 2,300 to 2,400 USD on average and 2,800 USD at most; at 10 USD about 800 USD). What holds: right after a cash-out, less than one denomination of the revenue counted when it started is left.
2. The gas per order and "no merge was needed" hold with the model's float, which grows with N (10,401 USD per establishment at N = 5,000, in three notes): one float note covers each 2,000 USD withdrawal. With a small float, merges appear and the cash-out gas per order is 1.4 to 2.3 times higher, still far below the 10 USD figure. The cost figures carry this condition.
3. In the setting of N = 500 the orders are paid over about 3.6 hours of the model (not five); the 2,000 USD runs end at 3.8 to 4.1 hours.
4. At 500 USD the amount decides the start of a run in about 88 % of the runs (the 5-note rule in the others); at 2,000 USD always. At N = 500 and 500 USD the batch rule links fewer orders than the busiest-wallet guess on one of the three seeds. The "mean wait" follows a first-in, first-out convention and leaves out the revenue still in the pool; the time-average amount held in the pool does not depend on the convention.
