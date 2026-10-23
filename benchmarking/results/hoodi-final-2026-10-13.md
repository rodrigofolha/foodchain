# FoodChain on Hoodi: gas and cost of the order cycle under the main network's gas schedule (2026-10-13)

**Changed on 2026-10-13, 22:00 UTC:** two closing steps by the session that sent the transactions: Sepolia was read to settle whether anything had been sent there since its own measurement (nothing: section 13.11), and the read-back scripts, the rate file and the address list to which section 13 points were copied out of the temporary folder into a local records folder (section 13.12 and "Files and commands"); no figure changed.

**Changed on 2026-10-13, 21:55 UTC:** two checks that are independent of the task that wrote section 13 read the cash-out again from the chain and found every figure of that section as written; their corrections, all of wording and none of a number, were applied in this header, in the summary, in sections 5.2, 10.3, 10.4, 11.3, 12 and 13 and in the two closing lists, and are listed in the new section 13.12.

**Changed on 2026-10-13, 21:21 UTC:** the payment pool was cashed out on Hoodi that day between 19:33 and 20:58 UTC (37 withdrawals sent by scripts, not by the dApp, among them each of the five kinds of withdrawal that the tool's description derives from the dApp's code) and the ten one-time addresses of the sequential privacy run were swept (10 transfers); the cash-out is the new section 13, the summary, sections 1, 11.3 and 12 and the two closing lists were brought up to date, and dated notes were added in sections 5.2, 10.3, 11 and 11.2, while every figure of sections 2 to 10 is as it was.

**Changed on 2026-10-13, 18:49 UTC:** the cycle workload of the concurrency test was repeated on Hoodi that day between 17:19 and 17:51 UTC with the corrected benchmark and completed 30 of 30 cycles, the six orders that the first run had left open were cancelled and their money recovered between 18:21 and 18:27 UTC, and the rows, the read-back and the totals of both were added to the summary and to sections 1 and 8 to 12, while every figure of sections 2 to 7 is as it was.

Measured on the Hoodi test network (chain id 560048) on 2026-10-13 between 09:24 and 11:14 UTC (the package), between 17:19 and 17:51 UTC (the repeat of the cycle workload), between 18:21 and 18:27 UTC (the recovery of the six open orders) and between 19:33 and 20:58 UTC (the cash-out of the pool and the sweep of ten one-time addresses, section 13), on contracts deployed there at 09:25 to 09:28 UTC the same day (`deployments/hoodi-2026-10-13/deployment.json` and `deployment-no-privacy.json`; copies in `deployment-hoodi-2026-10-13.json` and `deployment-hoodi-no-privacy-2026-10-13.json`). Hoodi runs the gas schedule of the Ethereum main network; Sepolia has run another one since 2026-10-06 (`sepolia-final-2026-10-13.md`). Machine-readable copy: `hoodi-final-2026-10-13.json`. Every gas figure below is the `gasUsed` of a mined transaction, read back from the chain through two endpoints, unless a line says *local*, *computed*, *rehearsal* or *a model's figure*. "The package" is what was sent between 09:24 and 11:14 UTC; "the first run" of the concurrency test is the package's, "the repeat" is the cycle workload run again at 17:19 UTC, and "the recovery" is the cancellation of the six open orders at 18:21 UTC. "The cash-out" is the withdrawal of the pool's 64 revenue notes and the sweep of the ten one-time addresses of the sequential privacy run, sent between 19:33 and 20:58 UTC (section 13).

## Summary

- **The question for the paper: is the gas on a public network with the main network's schedule the same as the local measurement, call by call? Yes.** All 618 calls that reached the deployed contracts on Hoodi (250 of the three sequential runs, 338 of the concurrency run, 30 cancellations) have the gas of the same call on a local Hardhat node (hardfork osaka), to the gas, once four things are counted that depend on the call's data and not on the network: the leaf index of the note a call inserts (2,079 gas per 1 bit, 17,100 when it opens a tree level), the dummy note of an establishment's first withdrawal, the zero bytes of the calldata (12 gas each) and the last byte of a signature (17 gas). Nothing is left unexplained (section 5). The 11 deployment transactions are equal in the same way (section 7). The 330 calls of the repeat of the cycle workload and the 6 cancellations of the recovery fall on the same constants: 954 of 954 calls in all (sections 8.1 and 10.3).
- **Privacy cycle**, 11 transactions, 10 cycles, none failed: 4,864,694 gas for the first cycle of the deployment, **4,830,506.3** for a later cycle (mean of cycles 2 to 10; 4,820,707 to 4,848,226). Without the pool deposit: 3,994,291 and **3,972,301.7**. Local: 4,869,916, 4,833,322.3; 4,016,613, 3,976,555.7. Notes on leaves 1 to 30 of the note tree (local: 2 to 31).
- **Baseline (a)**, the no-privacy contracts, 7 transactions, 10 cycles, none failed: 927,259 first, **893,044.9** later (892,994 to 893,088). Local: 927,283 and 893,072.3.
- **Baseline (b)**, the privacy contracts with every mechanism off, 7 transactions, 10 cycles, none failed: **1,061,364.4** (cycles 2 to 10; 1,061,340 to 1,061,386; cycle 1: 1,061,386). Local later: 1,061,353. As on Sepolia it has no first cycle of a deployment: the privacy run had made the first order of `Chain` and the worker's first delivery.
- **Ratios, later cycles:** the privacy cycle is **5.41×** baseline (a) and **4.55×** baseline (b); without the pool deposit 4.45× and 3.74×. Local: 5.41× and 4.55×; 4.45× and 3.75×. On Sepolia's schedule: 3.70× and 3.08×; 3.39× and 2.82×.
- **Price and cost:** Hoodi has a real fee market. The base fee was 0.841 to 1.120 gwei during the package (mean 0.983); the transactions paid base fee + 0.2 gwei, 1.041 to 1.319 gwei. A later privacy cycle cost 0.005728 ETH = 14.37 USD at 2509.195 USD per ETH; baseline (a) 0.001059 ETH = 2.66 USD. This is a test network's price: its base fee was 9.4 times the median base fee of the main network over the 27 hours before (0.1045 gwei). The USD figures show the arithmetic, not a main-network cost (section 6). In the repeat (base fee 0.778 to 1.118 gwei) a cycle cost 0.005864 ETH = 14.70 USD at 2506.245 USD per ETH, the rate read for the repeat.
- **Concurrency:** 1, 2, 4 and 8 clients, two units each. Ordering workload: 30 of 30 orders. Cycle workload, first run (10:36 UTC): **24 of 30 cycles** (2 of 2, 3 of 4, 6 of 8, 13 of 16), incomplete because of two faults of the benchmark. **Cycle workload, repeat with the corrected benchmark (17:19 to 17:51 UTC): 30 of 30 cycles** (2 of 2, 4 of 4, 8 of 8, 16 of 16), none failed, no transaction refused. With 8 clients: 0.347 orders/s and **0.0462 cycles/s** (16 cycles in 346.0 s; the first run's 0.0434 counted 13 completed cycles of 16), in blocks that other users filled to 51 % on average (section 8).
- **What bounds the cycle rate** (the repeat, section 8.1): the closed loop of each client. Of the 163.9 s of a cycle with 8 clients, 95.3 % is the eleven transactions sent one after the other (waiting for each to be mined 67.9 %, preparing and sending 13.1 %, reads between the steps 14.3 %); the proof step is 3.0 % (the queue for the single prover of this host 2.0 %, proving 0.4 %). The shared blocks add to the waiting: 27 of 160 steps were not mined in the next block, and 12 of the 27 blocks they passed over were full. The closed loop includes the benchmark client's own requests to one public endpoint (preparing and sending, and the reads between the steps: about 27 % of a cycle with 8 clients), which are a property of this benchmark and of that endpoint, not of the chain or of the contracts. Measured rate against the ideal closed-loop rate of one transaction per 12 s slot, a reference and not a bound: 88 %, 82 %, 72 % and 76 % with 1, 2, 4 and 8 clients; against one transaction per block at the mean block time of each level: 92 %, 86 %, 83 % and 82 %. Gas ceiling computed from the measured gas (4,835,605 per cycle): 12.4 cycles per block, 1.03 cycles/s.
- **The six failed cycles of the first run are faults of the benchmark, not of the contracts or of the dApps' rules** (section 9). Five were refused by the node before sending ("insufficient funds") at the establishment's pool deposit: the benchmark funds each temporary establishment for two deposits at the gas price of the moment of funding, the deposit's amount follows the gas price of the moment of the deposit (× 4,725,000 gas), the base fee moved by up to 12.5 % per block, and the benchmark sent the deposit with a gas limit of 2,000,000, which the node prices at the maximum fee. They were short by 0.00011 to 0.00043 ETH. The sixth was refused with "nonce has already been used": a one-time address's `prepareOrder` was signed with nonce 0 right after its withdrawal (nonce 0) was mined, i.e. the endpoint answered a transaction count one block old. No transaction reverted on the chain: all 783 transactions sent in the package have status 1.
- **What the failures left:** six orders in state ORDERED holding 0.027462 ETH of their customers' payments. Everything else of those cycles went back to the funder in the run's own refunds. A recovery can bring back about 0.026 ETH (section 10). **Recovered on 2026-10-13 between 18:21 and 18:27 UTC** (section 10.3): the six orders were cancelled by their customers' temporary wallets, 0.027462 ETH went back to those wallets and 0.026653 ETH from them to the funder, which had sent 0.000178 ETH of gas: **0.026446 ETH net, 96.3 % of what the orders held**, for 0.001050 ETH of fees in 14 transactions. No order of the deployment is open now: of its 110 orders 74 are concluded and 36 were cancelled by the customer.
- **Prepared, then sent** (section 10): the fix of the benchmark, rehearsed on a private node with chain id 560048; the recovery command; the command for a repeat of the cycle workload. `recover-ephemeral.cjs` as it was could not have recovered the six orders (two reasons, both fixed and rehearsed). **Both commands were authorised by the owner later the same day and run from the main session: the repeat at 17:19 UTC, the recovery at 18:16 UTC.**
- **The fix on the real network** (section 9.4): no transaction of the repeat was refused, and all 15 second cycles of a client in a level completed (the six failures of the first run were all second cycles). The 30 deposits were sent with gas limits of 1,038,520 to 1,046,064 (the node's estimate × 1.2) and used 855,382 to 863,698; the lowest margin of a deposit over what the node asks was 0.013097 ETH (0.000039 ETH in the first run). The node never answered a nonce below the script's own count (0 times by the script's counter), so the stale answer of section 9.2 did not recur and the nonce book was not put to the test. The funder's outlay before the refunds was 0.908774 ETH against about 0.757 printed by the run; what the run spent, 0.310875 ETH, is 1.026 of its estimate.
- **The cash-out on a public network** (section 13; 2026-10-13, 19:33 to 20:58 UTC; sent by scripts that follow the dApp's rules, not by the dApp): the 64 revenue notes were taken out of the pool in **37 `mergeWithdraw` transactions, all mined, none refused or reverted, and all 37 equal, to the unit, the local leaf rule extended by two constants that are not in the local file** (−22,370 with the zero-value note, found on Hoodi in the package; −8,940 for a pure merge, first seen in the tool's rehearsal on a private node and sent twice here): 1,117,064 gas for two notes with a payout when the change note falls on a leaf with one 1 bit and the calldata has 39 zero bytes, +2,079 per further 1 bit of that leaf index, −22,370 when the second input is the pool's zero-value note, −8,940 for a pure merge (two notes into one, nothing paid out), −12 per further zero byte. The 27 withdrawals of two notes in full used 1,121,186 to 1,127,459 gas (mean 1,124,451; 30,360,180 in all) and cost 0.036292 ETH at a gas-weighted 1.1954 gwei, 0.001344 ETH = 3.37 USD each at 2507.445 USD per ETH, for 0.239532 ETH paid out: 15.2 % of the amount, with notes of 0.0044 ETH. The ten withdrawals that exercise the five kinds the dApp makes used 11,143,929 gas and cost 0.013124 ETH for 0.045603 ETH paid out. A pure merge costs 0.8 % less than a withdrawal, so one denomination of the dApp's policy (0.01 ETH) from notes below it is two transactions: 2,241,676 and 2,237,506 gas, 0.002574 and 0.002474 ETH on Hoodi. A change note with value costs the same as an empty one. The price is a test network's; the gas is the figure that carries over. The per-order cost of the dApp's cash-out remains a model's figure (3.74 million gas per order in the privacy evaluation), not a measurement on Hoodi. The ten one-time addresses were swept to the establishment in 10 transfers (0.056508 ETH). The pool holds 0 wei.
- **What was sent in all** (sections 11 and 13.9): **1,273 transactions, all with status 1**: 783 of the package; 429 of the repeat (330 calls of the 30 cycles, 45 funding transfers from the funder, its nonces 153 to 197, and 54 refund transfers); 14 of the recovery (one gas transfer from the funder, its nonce 198, six cancellations, three gas transfers between temporary wallets, four sweeps); 47 of the cash-out (27 withdrawals from the funder, its nonces 199 to 225; 10 sweep transfers from the ten one-time addresses; 10 withdrawals from the establishment, its nonces 70 to 79). At 18:35 UTC, after the first 1,226, the three accounts held 0.825363 ETH less than before the measurement, accounted for to the wei: fees 0.481836 ETH; 0.285134 ETH in the payment pool; 0.056822 ETH at ten one-time addresses; 0.001570 ETH of dust at 146 temporary addresses. After the cash-out (block 3810706, 21:06 UTC) they hold **0.533138 ETH less than before the measurement**, accounted for to the wei: fees of the 1,273 transactions 0.531539 ETH; dust 0.001599 ETH at 156 temporary and one-time addresses; nothing in the pool.
- **Still on Hoodi** (section 11.3). At block 3810028, 18:35 UTC, not touched by the repeat or by the recovery: 0.285134 ETH in the pool as 64 revenue notes (10 of the sequential run, 24 of the first concurrency run, 30 of the repeat) and 0.056822 ETH of unused gas money at the ten one-time addresses of the sequential privacy run, with their secrets in three git-ignored files in `benchmarking/`, named in section 11.3; a cash-out and a sweep of those addresses had not been sent then. **Both were sent between 19:33 and 20:58 UTC (section 13).** At block 3810706, 21:06 UTC: the pool holds 0 wei and the ten addresses 0.000029 ETH of dust; what belongs to the project on Hoodi is the three accounts' 7.498112 ETH (funder 7.104933, establishment 0.333836, worker 0.059343) and 0.001599 ETH of dust at 156 temporary and one-time addresses.
- **Not sent on Hoodi:** the endings that insert a note, the leaving and the replacement of a worker, the manager dApp's return of unused gas money (a deposit into the pool from a one-time address). The local file measures the endings and the worker's paths and describes the return of gas money without running it. The cash-out, which this line listed as not sent until 18:49 UTC, was sent afterwards by scripts (section 13); the dApp itself was not used, and its "withdraw all" was not sent as such.

## 1. Settings

| | Privacy cycle | Baseline (b), mechanisms off | Baseline (a), no-privacy contracts |
|---|---|---|---|
| Command (in `benchmarking/`) | `ITERATIONS=10 node benchmark-privacy.js` | `ITERATIONS=10 node benchmark-privacy.js --mechanisms-off` | `ITERATIONS=10 node benchmark-no-privacy.js` |
| Result file (in `hoodi-2026-10-13/`) | `privacy-2026-10-13T10-01-25-710Z.json` | `mechanisms-off-2026-10-13T10-18-51-831Z.json` | `no-privacy-2026-10-13T10-35-24-831Z.json` |
| Started, ended (UTC) | 2026-10-13T09:29:09Z, 10:01:25Z | 2026-10-13T10:01:50Z, 10:18:51Z | 2026-10-13T10:18:54Z, 10:35:24Z |
| Chain id | 560048 | 560048 | 560048 |
| Blocks of the transactions | 3807615 to 3807752 | 3807755 to 3807829 | 3807831 to 3807901 |
| Fork id (start, end of the run) | `0x23aa1351`, `0x23aa1351` | `0x23aa1351`, `0x23aa1351` | `0x23aa1351`, `0x23aa1351` |
| At the start: block, `eth_gasPrice`, base fee (wei) | 3807613, 986,427,186, 936,244,105 | 3807754, 1,144,223,720, 1,073,985,020 | 3807829, 1,092,502,384, 1,024,206,045 |
| At the end: block, `eth_gasPrice`, base fee (wei) | 3807752, 1,148,934,912, 1,071,898,548 | 3807829, 1,092,502,384, 1,024,206,045 | 3807901, 1,069,722,536, 1,001,426,197 |
| Base fee of the run's blocks (gwei): min, mean, max | 0.8857, 0.9802, 1.0977 | 0.8829, 0.9861, 1.1056 | 0.8414, 0.9800, 1.1191 |
| Effective gas price of the transactions (gwei) | 1.0857 to 1.2977 | 1.0855 to 1.3056 | 1.0414 to 1.3191 |
| Cycles completed, failed steps | 10 of 10, 0 | 10 of 10, 0 | 10 of 10, 0 |
| Transactions, gas | 110, 48,339,251 | 70, 10,613,666 | 70, 8,964,663 |
| Host load average (1 min) at the start and the end | 0.07; 0.23 | 0.24; 0.04 | 0.04; 0.15 |

- **Fork.** Activation 1762955544 (2025-11-12), fork id `0x23aa1351`, no next fork announced, block gas limit 60,000,000: recorded by the scripts at the start and the end of each run (`eth_config`, publicnode) and read again after the package. The main network's `eth_config`, read the same way on 2026-10-13 (`ethereum-rpc.publicnode.com`), has the same set of precompiles, the same blob schedule (target 14, maximum 21), no next fork and the same block gas limit of 60,000,000; its fork id is another, as it is per chain (`0x07c9462e`). Sepolia's has been another configuration since 2026-10-06.
- **Fee settings.** `PRIORITY_FEE_GWEI=0.2`: every transaction is of type 2 with a tip of 0.2 gwei (the node suggested 0.050 to 0.077) and a maximum fee of 2 × base fee + tip. The one-time addresses send the same, with the maximum fee capped to what their balance covers. All 783 transactions of the package are of type 2 (read from the chain). The effective price is the base fee of the block plus 0.2 gwei in every one of the 250 transactions of the three runs and of the 338 of the concurrency run's units (checked against the block headers).
- **The order's total is 0.006 ETH (fee 0.001 ETH), not 0.001 ETH as on Sepolia.** `Chain.makeOrder` takes the customer's gas stipend, `eth_gasPrice` × 2,400,000, out of the total and refuses an order whose stipend exceeds it. At Hoodi's price (about 1 gwei) the stipend is about 0.0024 ETH. The scripts' rule is the smallest multiple of 0.001 ETH that is at least twice the stipend at the price read at the start, which gives 0.005 or 0.006 ETH depending on the minute, so `ORDER_TOTAL_WEI=6000000000000000` fixed it for all runs. The stipend itself is computed for each order at the price of that moment, as the customer dApp does. The amounts change the gas only through zero bytes of calldata.
- **Rate.** 2509.195 USD per ETH, Coinbase spot price API, api.coinbase.com/v2/prices/ETH-USD/spot, read at 2026-10-13T09:24:59Z; the last transaction of the package was mined at 11:14 UTC. The repeat of the cycle workload has its own rate, used for its own rows: 2506.245 USD per ETH, the same source, read at 2026-10-13T17:18:44Z. The cash-out has its own as well: 2507.445 USD per ETH, the same source, read at 2026-10-13T19:32:01Z (section 13.1).
- **Gas limits.** The two sequential scripts send every transaction with the node's estimate × 1.25 (customer, worker) or × 1.2 (establishment and its one-time address); the gas used does not depend on the limit.
- **Payload.** One item and a delivery address of 30 characters, as locally and on Sepolia.
- **Order of the runs matters for the first cycle.** The privacy run was the first use of `Chain`; baseline (b) ran second on the same `Chain` with the same worker; baseline (a) was the first use of `No_Chain`.
- **Times.** The host was idle during the runs (load averages above), unlike during the Sepolia measurement. Off-chain steps of the privacy run, cycles 2 to 10, mean (min to max): withdrawal proof 1,065 ms (1,031 to 1,147), derivation of the one-time address 8 ms, sealing 352 ms, opening 531 ms. The sealing and the opening include reads from the endpoint. The local file remains the reference for these times.

## 2. Gas per call

### 2.1 Privacy cycle

| Call | Sent by | First cycle | Later cycles, mean | Min–max |
|---|---|---:|---:|---:|
| `stealthAnnounce` | customer | 26,245 | 26,242.3 | 26,233–26,245 |
| `makeOrder` | customer | 1,230,393 | 1,213,289 | 1,213,269–1,213,293 |
| `poolDeposit` | establishment (own wallet) | 870,403 | 858,204.7 | 853,291–874,561 |
| `poolWithdraw` | establishment (one-time address) | 1,094,718 | 1,120,530.3 | 1,117,076–1,123,313 |
| `prepareOrder` | establishment (one-time address) | 137,392 | 137,390.7 | 137,380–137,392 |
| `confirmIntention` | worker | 230,257 | 230,257 | 230,257–230,257 |
| `addInformation` | customer | 60,130 | 60,130 | 60,130–60,130 |
| `pickupOrder` | establishment (one-time address) | 68,787 | 68,771.7 | 68,758–68,787 |
| `deliveryOrder` | worker | 1,030,480 | 999,801.7 | 996,256–1,017,555 |
| `rateOrder_client` | customer | 57,957 | 57,957 | 57,957–57,957 |
| `rateOrder_restaurant` | establishment (one-time address) | 57,932 | 57,932 | 57,932–57,932 |
| **Cycle, 11 transactions** | | **4,864,694** | **4,830,506.3** | 4,820,707–4,848,226 |
| **Cycle without `poolDeposit`** | | **3,994,291** | **3,972,301.7** | 3,965,332–3,990,765 |

- The first cycle pays, once per deployment or per worker: the first order of `Chain` in `makeOrder` (+17,100) and the worker's first delivery in `deliveryOrder` (+17,100). Two of its notes open a tree level (leaves 1 and 3; +17,100 each). Its `poolWithdraw` is cheaper than any later one, because the first input is the dummy note, whose nullifier is never written (−22,370 before the leaf terms).
- `poolDeposit`, `poolWithdraw` and `deliveryOrder` each insert one note; their gas follows the leaf index (section 5.2). Cycles 1 to 10: 4,864,694, 4,820,707, 4,839,893, 4,824,817, 4,848,226, 4,820,736, 4,826,944, 4,829,011, 4,831,054, 4,833,169.

### 2.2 Baseline (a): the no-privacy contracts, items and delivery address in the clear

| Call | Sent by | First cycle | Later cycles, mean | Min–max |
|---|---|---:|---:|---:|
| `makeOrder` | customer | 393,194 | 376,094 | 376,094–376,094 |
| `prepareOrder` | establishment (own wallet) | 109,991 | 109,985.7 | 109,979–109,991 |
| `confirmIntention` | worker | 106,599 | 106,593.7 | 106,587–106,599 |
| `pickupOrder` | establishment (own wallet) | 68,434 | 68,433 | 68,422–68,451 |
| `deliveryOrder` | worker | 98,923 | 98,931.2 | 98,918–98,947 |
| `rateOrder_client` | customer | 92,152 | 75,046.7 | 75,040–75,052 |
| `rateOrder_restaurant` | establishment (own wallet) | 57,966 | 57,960.7 | 57,954–57,966 |
| **Cycle, 7 transactions** | | **927,259** | **893,044.9** | 892,994–893,088 |

- The first cycle is the first order of `No_Chain` (`makeOrder` +17,100) and the first rating of the worker's record (`rateOrder_client` +17,100).

### 2.3 Baseline (b): the privacy contracts with every mechanism off

| Call | Sent by | First cycle | Later cycles, mean | Min–max |
|---|---|---:|---:|---:|
| `makeOrder` | customer | 429,685 | 429,685 | 429,685–429,685 |
| `prepareOrder` | establishment (own wallet) | 117,108 | 117,108 | 117,108–117,108 |
| `confirmIntention` | worker | 189,929 | 189,929 | 189,929–189,929 |
| `pickupOrder` | establishment (own wallet) | 68,787 | 68,776.8 | 68,758–68,787 |
| `deliveryOrder` | worker | 139,988 | 139,976.7 | 139,971–139,988 |
| `rateOrder_client` | customer | 57,957 | 57,957 | 57,957–57,957 |
| `rateOrder_restaurant` | establishment (own wallet) | 57,932 | 57,932 | 57,932–57,932 |
| **Cycle, 7 transactions** | | **1,061,386** | **1,061,364.4** | 1,061,340–1,061,386 |

- Cycle 1 of this run is not a first cycle of the deployment (section 1): its figures are those of a later cycle, and the mean of all ten cycles is 1,061,366.6. The first cycle of (b), 1,095,557 locally, was not measured on Hoodi and cannot be measured on this deployment any more.

## 3. The cycle, both baselines, the ratios

| | First cycle | Later cycles, mean | Min–max | Local, first | Local, later mean |
|---|---:|---:|---:|---:|---:|
| Privacy cycle | 4,864,694 | 4,830,506.3 | 4,820,707–4,848,226 | 4,869,916 | 4,833,322.3 |
| Privacy cycle without `poolDeposit` | 3,994,291 | 3,972,301.7 | 3,965,332–3,990,765 | 4,016,613 | 3,976,555.7 |
| Baseline (a) | 927,259 | 893,044.9 | 892,994–893,088 | 927,283 | 893,072.3 |
| Baseline (b) | not measured (see 2.3) | 1,061,364.4 | 1,061,340–1,061,386 | 1,095,557 | 1,061,353 |

| Later cycles | Hoodi, measured | Local, main network's schedule | Hoodi − local | Sepolia, measured (its own schedule) |
|---|---:|---:|---:|---:|
| Privacy cycle | 4,830,506.3 | 4,833,322.3 | −2,816 | 11,429,559.1 |
| Privacy cycle without the pool deposit | 3,972,301.7 | 3,976,555.7 | −4,254 | 10,452,553.1 |
| Baseline (a) | 893,044.9 | 893,072.3 | −27.4 | 3,087,890.4 |
| Baseline (b) | 1,061,364.4 | 1,061,353 | +11.4 | 3,712,047.8 |
| Privacy / baseline (a) | **5.41×** | 5.41× | | 3.70× |
| Privacy / baseline (b) | **4.55×** | 4.55× | | 3.08× |
| Without the deposit / baseline (a) | 4.45× | 4.45× | | 3.39× |
| Without the deposit / baseline (b) | 3.74× | 3.75× | | 2.82× |
| Overhead against (a), gas | +3,937,461.4 | +3,940,250 | | +8,341,668.7 |
| Overhead against (b), gas | +3,769,141.9 | +3,771,969.3 | | +7,717,511.3 |
| Baseline (b) − baseline (a), gas | +168,319.6 (1.19×) | +168,280.7 | | +624,157.3 (1.20×) |

- First cycles: privacy 4,864,694 against baseline (a) 927,259, 5.25×; without the pool deposit 4.31×. Local: 5.25× and 4.33×.
- **The means differ from the local ones by 2,816 gas in the privacy cycle (0.06 %) and by at most 27 gas in the baselines, and the whole difference is the data of the calls, not the network.** The notes of the nine later cycles sit on leaves 4 to 30 here and 5 to 31 locally, so the local nine cycles have one note more that opens a level (leaf 31; 17,100 gas) and four 1 bits more (4 × 2,079): 25,416 gas in nine cycles, 2,824 per cycle (section 5.2). The rest, a few gas either way, is zero bytes and signature bytes. The ratios agree to the second decimal except the last one (3.743 against 3.747).
- What the ratios leave out is unchanged from the local file (`local-gas-final-2026-10-12.md`, section 4): the cash-out that turns the establishment's notes into money, the fill level of the note tree, and orders of more than one item. None of the three was measured on Hoodi.

## 4. Per call, next to the local figures

"Local" is `local-gas-final-2026-10-12.md` (in-process Hardhat network, hardfork osaka, 10 cycles).

### 4.1 Privacy cycle

| Call | Hoodi, first | Hoodi, later mean (min–max) | Local, first | Local, later mean (min–max) | Hoodi − local, later mean |
|---|---:|---:|---:|---:|---:|
| `stealthAnnounce` | 26,245 | 26,242.3 (26,233–26,245) | 26,245 | 26,243.7 (26,233–26,245) | −1.3 |
| `makeOrder` | 1,230,393 | 1,213,289 (1,213,269–1,213,293) | 1,230,393 | 1,213,290.3 (1,213,269–1,213,293) | −1.3 |
| `poolDeposit` | 870,403 | 858,204.7 (853,291–874,561) | 853,303 | 856,766.7 (853,303–859,540) | +1,438 |
| `poolWithdraw` | 1,094,718 | 1,120,530.3 (1,117,076–1,123,313) | 1,136,231 | 1,122,658.7 (1,119,107–1,140,401) | −2,128.3 |
| `prepareOrder` | 137,392 | 137,390.7 (137,380–137,392) | 137,392 | 137,388 (137,380–137,392) | +2.7 |
| `confirmIntention` | 230,257 | 230,257 (230,257–230,257) | 230,245 | 230,245 (230,245–230,245) | +12 |
| `addInformation` | 60,130 | 60,130 (60,130–60,130) | 60,130 | 60,130 (60,130–60,130) | +0 |
| `pickupOrder` | 68,787 | 68,771.7 (68,758–68,787) | 68,770 | 68,775.7 (68,770–68,787) | −4 |
| `deliveryOrder` | 1,030,480 | 999,801.7 (996,256–1,017,555) | 1,011,318 | 1,001,935.3 (994,201–1,019,634) | −2,133.7 |
| `rateOrder_client` | 57,957 | 57,957 (57,957–57,957) | 57,957 | 57,957 (57,957–57,957) | +0 |
| `rateOrder_restaurant` | 57,932 | 57,932 (57,932–57,932) | 57,932 | 57,932 (57,932–57,932) | +0 |
| **Cycle** | **4,864,694** | **4,830,506.3** (4,820,707–4,848,226) | 4,869,916 | 4,833,322.3 (4,820,671–4,854,451) | −2,816 |

### 4.2 Baseline (a)

| Call | Hoodi, first | Hoodi, later mean (min–max) | Local, first | Local, later mean (min–max) | Hoodi − local, later mean |
|---|---:|---:|---:|---:|---:|
| `makeOrder` | 393,194 | 376,094 (376,094–376,094) | 393,194 | 376,094 (376,094–376,094) | +0 |
| `prepareOrder` | 109,991 | 109,985.7 (109,979–109,991) | 109,991 | 109,989.7 (109,979–109,991) | −4 |
| `confirmIntention` | 106,599 | 106,593.7 (106,587–106,599) | 106,599 | 106,597.7 (106,587–106,599) | −4 |
| `pickupOrder` | 68,434 | 68,433 (68,422–68,451) | 68,434 | 68,437.6 (68,422–68,451) | −4.6 |
| `deliveryOrder` | 98,923 | 98,931.2 (98,918–98,947) | 98,947 | 98,938.1 (98,918–98,947) | −6.9 |
| `rateOrder_client` | 92,152 | 75,046.7 (75,040–75,052) | 92,152 | 75,050.7 (75,040–75,052) | −4 |
| `rateOrder_restaurant` | 57,966 | 57,960.7 (57,954–57,966) | 57,966 | 57,964.7 (57,954–57,966) | −4 |
| **Cycle** | **927,259** | **893,044.9** (892,994–893,088) | 927,283 | 893,072.3 (892,994–893,100) | −27.4 |

### 4.3 Baseline (b)

| Call | Hoodi, first | Hoodi, later mean (min–max) | Local, first | Local, later mean (min–max) | Hoodi − local, later mean |
|---|---:|---:|---:|---:|---:|
| `makeOrder` | 429,685 | 429,685 (429,685–429,685) | 446,785 | 429,685 (429,685–429,685) | +0 |
| `prepareOrder` | 117,108 | 117,108 (117,108–117,108) | 117,108 | 117,108 (117,108–117,108) | +0 |
| `confirmIntention` | 189,929 | 189,929 (189,929–189,929) | 189,917 | 189,917 (189,917–189,917) | +12 |
| `pickupOrder` | 68,787 | 68,776.8 (68,758–68,787) | 68,770 | 68,775.7 (68,770–68,787) | +1.1 |
| `deliveryOrder` | 139,988 | 139,976.7 (139,971–139,988) | 157,088 | 139,978.3 (139,959–139,988) | −1.7 |
| `rateOrder_client` | 57,957 | 57,957 (57,957–57,957) | 57,957 | 57,957 (57,957–57,957) | +0 |
| `rateOrder_restaurant` | 57,932 | 57,932 (57,932–57,932) | 57,932 | 57,932 (57,932–57,932) | +0 |
| **Cycle** | **1,061,386** | **1,061,364.4** (1,061,340–1,061,386) | 1,095,557 | 1,061,353 (1,061,328–1,061,374) | +11.4 |

In 4.3 the Hoodi "first" column is cycle 1 of a run that came after the privacy run: compare it with the local later cycles, not with the local first cycle.

Raw figures, before any normalisation: of the 250 calls of the three runs, 215 have a gas that is the local first-cycle figure (cycle 1) or lies within the local range of the later cycles (218 if cycle 1 of baseline (b), which is a later cycle on this deployment, is compared with the local later range). The other calls are listed with their causes in section 5.1: privacy: poolDeposit (3); privacy: poolWithdraw (2); privacy: confirmIntention (10); privacy: pickupOrder (3); privacy: deliveryOrder (1); (a): deliveryOrder (1); (b): confirmIntention (10); (b): pickupOrder (2).

## 5. Every difference from the local measurement

### 5.1 By call

| Call | Hoodi | Local | Difference and its cause |
|---|---|---|---|
| `stealthAnnounce` | 26,245 (8), 26,233 (2) | 26,245 first; 26,233–26,245 | none in 8 cycles; −12 in cycles 9 and 10, one more zero byte in the announcement's random data (168 against 167 zero bytes of calldata) |
| `makeOrder`, privacy | 1,230,393 first; later 1,213,293 (7), 1,213,269 (1), 1,213,281 (1) | 1,230,393 first; 1,213,269–1,213,293 | first: none (the first order of the deployment, +17,100). Later: 12 gas per zero byte of the two ciphertexts (346, 347 or 348 zero bytes) |
| `poolDeposit` | 853,291 to 874,561; first 870,403 | 853,303 first; 853,303–859,540 | the leaf index only: every one of the 10 deposits is base 853,303 + the rule of 5.2. The first cycle's deposit is on leaf 1, which opens a level (+17,100; locally leaf 2); cycle 3's on leaf 7 (+17,100 + 2 × 2,079); cycle 2's has one zero byte in its commitment (−12) |
| `poolWithdraw` | 1,094,718 first; 1,117,076 to 1,123,313 later | 1,136,231 first; 1,119,107–1,140,401 | first: the benchmark on a network merges the dummy note with the first deposit (change note on leaf 2); the local benchmark's first cycle merges two notes and its change note opens a level, so the two first cycles are different calls. One note with the dummy note is 1,094,665 to 1,096,713 in the local file (its section 9). Later: the leaf index and 12 gas per zero byte of the proof and the amounts (37 to 41 zero bytes); with the zero bytes added back all nine are 1,117,532 + the rule, and 1,117,532 is the local base 1,117,064 + 39 zero bytes |
| `prepareOrder` | privacy 137,392 (9), 137,380 (1); (b) 117,108 (10); (a) 109,991 (6), 109,979 (4) | 137,392, 137,380–137,392; 117,108; 109,991 | 12 gas per zero byte of the random payment commitment or of the order's address |
| `confirmIntention` | privacy 230,257 (10); (b) 189,929 (10); (a) 106,599 (6), 106,587 (4) | 230,245; 189,917; 106,599 | privacy and (b): +12 in every cycle, one zero byte fewer in the calldata of this deployment. The call carries the address of `Storage`, which is another address on each deployment; the local run's calldata was not kept, so which byte it is, is inferred. The rehearsal chain of the readiness task, a third deployment, also gave 230,257. (a): none, or −12 for a zero byte of the order's address |
| `addInformation` | 60,130 (10) | 60,130 | none |
| `pickupOrder` | privacy and (b) 68,758 to 68,787; (a) 68,422 to 68,451 | 68,770–68,787; 68,434 (a) | 17 gas when the last byte of the worker's signature is 28 instead of 27, 12 gas per zero byte of the signature or of the order's address (read from the calldata of the 30 transactions) |
| `deliveryOrder`, privacy | 1,030,480 first; 996,256 to 1,017,555 later | 1,011,318 first; 994,201–1,019,634 | the leaf index (5.2), the worker's first delivery in cycle 1 (+17,100), the signature byte and zero bytes. Cycle 1 inserts at leaf 3, which opens a level: 994,201 + 2,079 + 17,100 + 17,100 = 1,030,480, the measured figure. Locally cycle 1 inserted at leaf 4 |
| `deliveryOrder`, baselines | (b) 139,971 (6), 139,988 (4); (a) 98,918 to 98,947 | (b) 157,088 first, 139,959–139,988; (a) 98,947, later mean 98,938.1 | 17 gas of the signature byte and 12 per zero byte. The local 157,088 is the worker's first delivery in (b): not measured, the worker had delivered in the privacy run |
| `rateOrder_client`, `rateOrder_restaurant` | 57,957 and 57,932 (privacy and (b), all 40); (a) 92,152 then 75,052 or 75,040, and 57,966 or 57,954 | 57,957; 57,932; 92,152, 75,050.7; 57,966 | none in the privacy contracts; in (a) −12 for a zero byte of the order's address (4 of 10 orders) |

No difference is left unexplained. The table compares with the local file's published figures; section 5.3 makes the same comparison without that file, transaction by transaction.

### 5.2 The leaf-index rule on Hoodi

gas(i) = base + 2,079 × (number of 1 bits of the leaf index − 1) + 17,100 if i = 2^k − 1 (the note opens a tree level): the rule of the local file with the local bases, `depositPayment` 853,303, `mergeWithdraw` with two notes 1,117,064, `deliveryOrder` 994,201. With the zero bytes of the calldata and the signature byte counted, all 30 insertions of the privacy run (leaves 1 to 30) and all 74 of the concurrency run (leaves 31 to 104; 25 deposits, 25 withdrawals, 24 deliveries) equal the rule: largest difference 0 gas. Leaves 31 and 63 open a level in the concurrency run. A withdrawal whose first input is the dummy note is 22,370 gas below the two-note rule (9 of 35: the sequential run's first and each of the 8 temporary establishments' first); a worker's first delivery is 17,100 above (9 of 34).

| Cycle | `poolDeposit`: leaf, gas | `poolWithdraw`: leaf, gas | `deliveryOrder`: leaf, gas | Cycle gas |
|---:|---|---|---|---:|
| 1 | 1 (opens a level), 870,403 | 2, 1,094,718 | 3 (opens a level), 1,030,480 | 4,864,694 |
| 2 | 4, 853,291 | 5, 1,119,155 | 6, 996,285 | 4,820,707 |
| 3 | 7 (opens a level), 874,561 | 8, 1,117,076 | 9, 996,280 | 4,839,893 |
| 4 | 10, 855,382 | 11, 1,121,198 | 12, 996,256 | 4,824,817 |
| 5 | 13, 857,461 | 14, 1,121,234 | 15 (opens a level), 1,017,555 | 4,848,226 |
| 6 | 16, 853,303 | 17, 1,119,143 | 18, 996,297 | 4,820,736 |
| 7 | 19, 857,461 | 20, 1,119,167 | 21, 998,364 | 4,826,944 |
| 8 | 22, 857,461 | 23, 1,123,289 | 24, 996,297 | 4,829,011 |
| 9 | 25, 857,461 | 26, 1,121,198 | 27, 1,000,455 | 4,831,054 |
| 10 | 28, 857,461 | 29, 1,123,313 | 30, 1,000,426 | 4,833,169 |

- A cycle whose three notes open no level costs 4,820,707 to 4,833,169 gas here (cycles 2, 4, 6 to 10). A note that opens a level adds 17,100: at leaves 2^k − 1, at most 25 times in the life of the depth-25 tree.
- Not measured on Hoodi: any leaf beyond 104. The local file measured the fill levels up to 2^25.
- Added with the repeat of the cycle workload (2026-10-13, 17:19 UTC): the lines above describe the package. The repeat inserted 90 more notes, on leaves 105 to 194, and all 90 equal the same rule with the same bases, largest difference 0 gas; leaf 127 opens a level (section 8.1).
- Added with the cash-out (2026-10-13, 19:33 to 20:58 UTC): its 37 withdrawals inserted 37 more notes, on leaves 195 to 231, and all 37 equal the same rule with the base of `mergeWithdraw`, largest difference 0 gas; one further term was measured there, −8,940 for a pure merge, and the −22,370 of the dummy note occurs in 4 of them (section 13.4).

### 5.3 Transaction by transaction: the same constants as on a local node

For every mined call to the deployed contracts the calldata was read from the chain and the gas normalised: gas + 12 × (zero bytes of the calldata) − 17 if the signature's last byte is 28 − the leaf terms of 5.2. If the network charged anything differently from the local node, the normalised gas of a call would differ. It does not: the 618 calls on Hoodi fall on the constants below, and the 161 calls of the readiness task's rehearsal chain (a private Hardhat node, hardfork osaka, the same scripts, 2026-10-13; `hoodi/sim/rehearsal-txs.json` of the session's scratch folder) fall on exactly the same ones. Where a call has two constants they are 17,100 apart (a first write) or 22,370 (the dummy note); `Chain.confirmIntention` and `Chain.prepareOrder` have one constant for the privacy cycle and one for baseline (b), which sends other arguments (no key, no payment commitment).

| Call (calldata bytes) | Normalised gas on Hoodi: constant (calls) | On the local rehearsal chain |
|---|---|---|
| `Chain.cancelOrder`, 36 | 102,103 (30) | 102,103 (6) |
| `Chain.confirmIntention`, 164 | 191,357 (10), 231,157 (34) | 191,357 (3), 231,157 (9) |
| `Chain.deliveryOrder`, 196 | 141,231 (10) | 141,231 (3) |
| `Chain.deliveryOrder`, 196, inserts a note | 995,461 (25), 1,012,561 (9) | 995,461 (6), 1,012,561 (3) |
| `Chain.makeOrder`, 1572 | 1,217,445 (69), 1,234,545 (1) | 1,217,445 (14), 1,234,545 (1) |
| `Chain.makeOrder`, 548 | 433,993 (10) | 433,993 (3) |
| `Chain.pickupOrder`, 196 | 70,030 (44) | 70,030 (12) |
| `Chain.prepareOrder`, 132 | 118,404 (10), 138,304 (34) | 118,404 (3), 138,304 (9) |
| `Chain.rateOrder score 4`, 100 | 58,617 (44) | 58,617 (12) |
| `Chain.rateOrder score 5`, 100 | 58,592 (44) | 58,592 (12) |
| `GlobalReputation.poolDeposit`, 36, inserts a note | 853,303 (35) | 853,303 (9) |
| `GlobalReputation.poolWithdraw`, 452, inserts a note | 1,095,162 (9), 1,117,532 (26) | 1,095,162 (3), 1,117,532 (7) |
| `No_Chain.confirmIntention`, 164 | 108,267 (10) | 108,267 (3) |
| `No_Chain.deliveryOrder`, 196 | 100,190 (10) | 100,190 (3) |
| `No_Chain.makeOrder`, 292 | 377,810 (9), 394,910 (1) | 377,810 (3), 394,910 (1) |
| `No_Chain.pickupOrder`, 196 | 69,694 (10) | 69,694 (3) |
| `No_Chain.prepareOrder`, 36 | 110,135 (10) | 110,135 (3) |
| `No_Chain.rateOrder score 4`, 100 | 75,712 (9), 92,812 (1) | 75,712 (2), 92,812 (1) |
| `No_Chain.rateOrder score 5`, 100 | 58,626 (10) | 58,626 (3) |
| `StealthAnnouncer.stealthAnnounce`, 228 | 28,249 (70) | 28,249 (15) |
| `Storage.addInformation`, 868 | 62,386 (34) | 62,386 (9) |

- Same set of constants in every row: yes. The local figures of the published file follow from these constants: for example the deposit base 853,303 (a commitment without a zero byte) and `deliveryOrder` 994,201 = 995,461 − 12 × 105.
- The readiness task had replayed the rehearsal chain's 206 transactions on Hoodi's state with `eth_simulateV1` before anything was sent: 206 of 206 equal. This section is the same statement for the transactions that were then mined.
- Added with the repeat of the cycle workload (2026-10-13, 17:19 UTC): the table above counts the 618 calls of the package. The 330 calls of the repeat fall on the same constants, with no new one (section 8.1), and so do the 6 cancellations of the recovery (`Chain.cancelOrder`, 102,103; section 10.3): 954 calls on Hoodi in all.

## 6. Gas price and cost

| | Privacy | Baseline (b) | Baseline (a) |
|---|---:|---:|---:|
| Base fee of the run's blocks, min to max (gwei) | 0.8857 to 1.0977 | 0.8829 to 1.1056 | 0.8414 to 1.1191 |
| Base fee, mean over the blocks (gwei) | 0.9802 | 0.9861 | 0.9800 |
| Effective gas price, min to max (gwei) | 1.0857 to 1.2977 | 1.0855 to 1.3056 | 1.0414 to 1.3191 |
| Effective gas price, gas-weighted mean (gwei) | 1.1875 | 1.1979 | 1.1859 |
| Fees of the run, 10 cycles (ETH) | 0.057402218 | 0.012714358 | 0.010631289 |
| Fees of the run (USD) | 144.03 | 31.90 | 26.68 |

**A real fee market.** Hoodi's blocks are shared with other users: during the package (blocks 3807597 to 3808077, 481 blocks, mean block time 13.75 s: 70 of the 551 slots of 12 s had no block) they were 53 % full on average, 68 of them more than 99 % and 233 under half, full and almost empty blocks alternating. The base fee therefore moved between 0.8414 and 1.1200 gwei (median 0.9943), by up to 12.5 % from one block to the next (largest rise ×1.1250). Every transaction paid the base fee of its block plus the 0.2 gwei tip.

**This is a test network's price.** The main network's base fee, read on 2026-10-13 at 11:26 UTC from two public endpoints (`ethereum-rpc.publicnode.com`, `eth.drpc.org`, `eth_feeHistory` over the last 8,192 blocks, about 27 hours, to block 26183263): median 0.1045 gwei, mean 0.1618, 10th to 90th percentile 0.0636 to 0.3782, 0.4519 at the moment of reading. Hoodi's mean base fee during the package, 0.9832 gwei, is 9.4 times that median and 6.1 times that mean. The gas is the main network's; the price is not.

Cost of a cycle per party: gas used × effective gas price of each transaction, summed over the ten cycles and divided by ten (the scripts' own figures); USD = ETH × 2509.195.

| Run | Party | Transactions per cycle | Gas per cycle | ETH per cycle | USD per cycle |
|---|---|---:|---:|---:|---:|
| Privacy | customer | 4 | 1,359,329 | 0.001610020 | 4.04 |
| Privacy | establishment (own wallet) | 1 | 859,424.5 | 0.001043873 | 2.62 |
| Privacy | establishment (one-time address) | 4 | 1,382,045.1 | 0.001664186 | 4.18 |
| Privacy | worker | 2 | 1,233,126.5 | 0.001422144 | 3.57 |
| Privacy | **all parties** | 11 | **4,833,925.1** | **0.005740222** | **14.40** |
| Baseline (b) | customer | 2 | 487,642 | 0.000585847 | 1.47 |
| Baseline (b) | establishment (own wallet) | 3 | 243,817.8 | 0.000289247 | 0.73 |
| Baseline (b) | worker | 2 | 329,906.8 | 0.000396342 | 0.99 |
| Baseline (b) | **all parties** | 7 | **1,061,366.6** | **0.001271436** | **3.19** |
| Baseline (a) | customer | 2 | 454,561.2 | 0.000540704 | 1.36 |
| Baseline (a) | establishment (own wallet) | 3 | 236,380.5 | 0.000275180 | 0.69 |
| Baseline (a) | worker | 2 | 205,524.6 | 0.000247245 | 0.62 |
| Baseline (a) | **all parties** | 7 | **896,466.3** | **0.001063129** | **2.67** |

- These means include the first cycle. A later cycle (mean of cycles 2 to 10, each transaction at its own price): privacy 0.005727900 ETH = 14.37 USD; baseline (b) 0.001275639 ETH = 3.20 USD; baseline (a) 0.001059361 ETH = 2.66 USD.
- In the privacy cycle the customer pays 28.1 % of the gas (`makeOrder`), the establishment 46.4 % (the deposit from its wallet, four transactions from the one-time address) and the worker 25.5 % (`deliveryOrder` inserts the establishment's note). On Sepolia's schedule the shares were 52 %, 27 % and 21 %: there new storage dominates and `makeOrder` writes most of it.
- The same gas at another price is a multiplication (computed): at the main network's median base fee of the 27 hours, 0.1045 gwei and no tip, a later privacy cycle is 0.000505 ETH = 1.27 USD and baseline (a) 0.000093 ETH = 0.23 USD; at 1 gwei, 0.004831 ETH and 0.000893 ETH. The ratio between them is the gas ratio, 5.41×, at any price.
- **Money moved besides fees, per privacy cycle:** the customer pays 0.007 ETH (0.006 total + 0.001 fee), of which the stipend, `eth_gasPrice` × 2,400,000 (0.00237 to 0.00276 ETH in this run), goes to the one-time address at once; the establishment deposits and withdraws again delivery fee + `eth_gasPrice` × 4,725,000 (0.00566 to 0.00643 ETH; 0.059067 ETH in ten cycles); the worker receives the 0.001 ETH fee; the establishment's revenue, total − stipend + fee, becomes a note in the pool.

## 7. Deployment (part of the authorised package; done before the runs)

| Transaction | Block | Gas used | Local | Hoodi − local | Effective gas price (gwei) |
|---|---:|---:|---:|---:|---:|
| Poseidon | 3807599 | 2,157,126 | 2,157,126 | 0 | 1.1217 |
| MergeWithdrawVerifier | 3807600 | 450,071 | 450,071 | 0 | 1.2369 |
| GlobalReputation | 3807601 | 3,721,625 | 3,721,625 | 0 | 1.1353 |
| Util | 3807602 | 882,183 | 882,183 | 0 | 1.2504 |
| Storage | 3807603 | 489,610 | 489,610 | 0 | 1.1403 |
| Chain | 3807604 | 4,049,304 | 4,049,292 | +12 | 1.2522 |
| GlobalReputation.setChain | 3807605 | 44,156 | 44,156 | 0 | 1.1445 |
| Storage.setChain | 3807606 | 44,088 | 44,088 | 0 | 1.2537 |
| StealthAnnouncer | 3807607 | 151,293 | 151,293 | 0 | 1.1404 |
| **Privacy contracts, 9 transactions** | 3807607 (deploy block) | **11,989,456** | 11,989,444 | +12 | |
| No_Util | 3807609 | 882,183 | 882,183 | 0 | 1.1430 |
| No_Chain | 3807610 | 3,660,265 | 3,660,265 | 0 | 1.2550 |
| **Baseline (a), 2 transactions** | 3807610 | **4,542,448** | 4,542,448 | 0 | |

- Ten of the eleven transactions use exactly the local gas. `Chain` uses 12 gas more: one zero byte fewer in its creation code, which carries the addresses of the contracts deployed before it, and those differ per deployment. Checked against the rehearsal chain, whose creation transactions are available: with the zero bytes of the calldata added (12 gas each), all nine privacy transactions give the same figure on Hoodi and on the private node (9 of 9 equal; `Chain` 4,065,912 on both). The local file's own creation calldata was not kept.
- Every deployment transaction was sent with the node's estimate as its gas limit and `MAX_FEE_GWEI=3 PRIORITY_FEE_GWEI=0.2`. Fees paid by the deployer: 0.014211958 ETH (35.66 USD) and 0.005602033 ETH (14.06 USD). All far below the 16,777,216 gas limit of one transaction.
- Addresses: Chain `0xAa5FDAB5D55D76da97C15D435f5b0C059e72BF07`, GlobalReputation `0x2785120d91f169F7d6B196a35730206Bf7fa681f`, Storage `0x56bAA20bE01075979A598acD02f666fAeA14e7d7`, StealthAnnouncer `0xe4D8ebC06747594C6F7c3F9f414f89fD058Ae457`, No_Chain `0x5414B5f0F6E08609cac99a8dd5D96E8189d89Bd9`.
- Checked after the deployments with `scripts/verify_deployment.js` (`STRICT_CODE=1`, read-only) on both records: 70 checks passed, none failed (run with the deployer as caller, as the configuration provides; run without any account, the check "the implementation is a blank order" of the baseline reports a failure that is not a defect of the deployment: `No_Chain.getOrder` passes the caller to the order, and the zero address equals a blank order's customer); the deployed code equals the compiled artifacts (`deployments/hoodi-2026-10-13/verify.log`; read, not run again by this task).

## 8. Concurrency on Hoodi

As on Sepolia: 1, 2, 4 and 8 clients, closed loop, two units per client and level, the ordering workload (`makeOrder`: derivation, announcement, order) and the full cycle with one real withdrawal proof, one proof at a time on this host. Command: `node benchmark-concurrent-sepolia.js --yes` with `BENCH_NETWORK=hoodi` (the settings of section 1). Files: `hoodi-2026-10-13/concurrent-hoodi-2026-10-13T10-36-02-836Z.txt`, `.csv`, `-summary.json`, `-raw.json`. Started 2026-10-13T10:35:56Z, ended 2026-10-13T11:14:34Z; blocks of the units' transactions 3807906 to 3808061 (funding and refunds: 3807905 to 3808077); fork id `0x23aa1351`; `eth_gasPrice` 956,259,894 wei at the start and 1,109,222,290 wei at the end, base fee 887,963,555 and 1,042,974,842 wei. The run was not aborted. Host load average 0.09 at the start, 0.18 at the end.

**The repeat of the cycle workload.** Six cycles of that run failed through two faults of the benchmark (section 9). With the corrected benchmark (section 10.1) the cycle workload alone was run again from the main session, after the owner's authorisation: `WORKLOAD=cycle node benchmark-concurrent-sepolia.js --yes` with the settings of section 10.4, 1, 2, 4 and 8 clients, two cycles each. Files: `hoodi-2026-10-13/concurrent-hoodi-2026-10-13T17-19-28-266Z.txt`, `.csv`, `-summary.json`, `-raw.json`; log `hoodi-2026-10-13/run5-concurrency-cycle-repeat.log`. Started 2026-10-13T17:19:16Z, ended 2026-10-13T17:51:28Z; blocks of the cycles' transactions 3809686 to 3809812 (funding and refunds: 3809685 to 3809830); fork id `0x23aa1351`; `eth_gasPrice` 1,093,837,957 wei at the start and 1,108,394,506 wei at the end, base fee 1,019,106,804 and 1,017,501,964 wei. The run was not aborted. Host load average 0.00 at the start, 0.06 at the end. The ordering workload was not repeated: its rows were complete. In the table the rows of the first run's cycle workload stay as the record of what happened and are marked incomplete; the rows of the repeat are the complete ones.

| Workload | Clients | Units completed / attempted | Failed | Window (s) | Completed units per second | Transactions per second | Unit latency p50 / p90 / max (s) | Blocks spanned | Block use, mean / max (all users) | Blocks over 90 % full | Most of our transactions in one block | Base fee (gwei) |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| ordering | 1 | 2 / 2 | 0 | 50.8 | 0.0393 | 0.079 | 25.2 / 25.7 / 25.7 | 4 | 52 % / 100 % | 2 | 1 | 0.978–1.114 |
| ordering | 2 | 4 / 4 | 0 | 47.9 | 0.0835 | 0.167 | 23.6 / 24.3 / 24.3 | 4 | 54 % / 100 % | 2 | 2 | 0.956–1.076 |
| ordering | 4 | 8 / 8 | 0 | 60.3 | 0.1327 | 0.265 | 22.9 / 37.4 / 37.4 | 4 | 52 % / 100 % | 2 | 4 | 0.906–1.028 |
| ordering | 8 | 16 / 16 | 0 | 46.1 | 0.3473 | 0.695 | 22.2 / 24.3 / 24.6 | 4 | 57 % / 98 % | 1 | 8 | 0.920–1.030 |
| full cycle, first run (**incomplete**) | 1 | 2 / 2 | 0 | 309.4 | 0.0065 | 0.071 | 130.8 / 178.6 / 178.6 | 22 | 51 % / 100 % | 10 | 1 | 0.896–1.069 |
| full cycle, first run (**incomplete**) | 2 | 3 / 4 | 1 | 315.1 | 0.0095 | 0.117 | 169.9 / 170.3 / 170.3 | 23 | 51 % / 100 % | 11 | 2 | 0.882–1.100 |
| full cycle, first run (**incomplete**) | 4 | 6 / 8 | 2 | 322.8 | 0.0186 | 0.217 | 154.1 / 166.7 / 166.7 | 25 | 53 % / 100 % | 12 | 4 | 0.892–1.120 |
| full cycle, first run (**incomplete**) | 8 | 13 / 16 | 3 | 299.8 | 0.0434 | 0.497 | 154.7 / 155.6 / 167.6 | 23 | 55 % / 100 % | 11 | 8 | 0.892–1.115 |
| full cycle, **repeat** | 1 | 2 / 2 | 0 | 299.8 | 0.0067 | 0.073 | 146.2 / 153.6 / 153.6 | 24 | 53 % / 100 % | 12 | 1 | 0.792–1.096 |
| full cycle, **repeat** | 2 | 4 / 4 | 0 | 320.2 | 0.0125 | 0.137 | 140.6 / 163.6 / 163.6 | 26 | 51 % / 100 % | 12 | 2 | 0.897–1.078 |
| full cycle, **repeat** | 4 | 8 / 8 | 0 | 367.7 | 0.0218 | 0.239 | 164.0 / 204.8 / 204.8 | 27 | 51 % / 100 % | 11 | 4 | 0.778–1.118 |
| full cycle, **repeat** | 8 | 16 / 16 | 0 | 346.0 | 0.0462 | 0.509 | 165.3 / 181.9 / 190.3 | 27 | 51 % / 100 % | 12 | 8 | 0.934–1.116 |

The age of the root a withdrawal proof was made for (the notes inserted between the proof's snapshot of the tree and its check on the chain; every past root stays valid) and the inclusion latency of the transactions, by level (the script's figures):

| Full cycle | Clients | Withdrawals mined | Root age, mean / max (insertions) | Proofs made again because the root was not known | Inclusion latency p50 / p95 / max (s) |
|---|---:|---:|---:|---:|---:|
| first run (incomplete) | 1 | 2 | 0.00 / 0 | 0 | 10.3 / 23.7 / 33.1 |
| first run (incomplete) | 2 | 4 | 0.50 / 1 | 0 | 10.8 / 36.3 / 36.5 |
| first run (incomplete) | 4 | 6 | 1.00 / 3 | 0 | 10.3 / 23.8 / 34.7 |
| first run (incomplete) | 8 | 13 | 2.92 / 7 | 0 | 10.2 / 20.8 / 22.3 |
| **repeat** | 1 | 2 | 0.00 / 0 | 0 | 8.5 / 18.2 / 21.0 |
| **repeat** | 2 | 4 | 0.25 / 1 | 0 | 9.6 / 19.8 / 21.8 |
| **repeat** | 4 | 8 | 1.25 / 3 | 0 | 9.3 / 31.4 / 46.3 |
| **repeat** | 8 | 16 | 3.75 / 8 | 0 | 8.3 / 20.1 / 35.2 |

- A unit is an order (two transactions) or a cycle (eleven). "Completed units per second" is completed units over the window from the level's start to its last receipt; the latencies are those of the completed units. **The cycle rows of the first run with failed units are not rates of 4, 8 or 16 cycles:** a client whose second cycle was refused stopped after two of its eleven transactions (four in the level of 2), so the level offered less than its nominal load, and the rate of 13 completed cycles in the 8-client window is not what 16 would have given. They are not comparable with the Sepolia rows, where nothing failed. The ordering rows are complete. The rows of the repeat are complete: every client ran its two cycles, so each level carried its nominal load.
- **What bounds the throughput here.** Each client sends its next transaction after the previous receipt, so a client offers one transaction per block: the ideal closed-loop rate at one transaction per 12 s slot is k / (2 × 12 s) orders per second and k / (11 × 12 s) cycles per second, i.e. 0.333 and 0.0606 for 8 clients (a reference, not a strict bound). Measured with 8 clients: 0.347 orders/s (16 of 16 in four blocks; the window starts inside a slot, so the figure can exceed k / 24 s by a little) and 0.0434 cycles/s (13 of 16). Hoodi's slots are 12 s, but about one slot in eight had no block during the package: the mean block time was 13.33 s in this run. For the cycle workload the repeat gives the complete figures and the split of a cycle's time (section 8.1).
- **Latency columns.** The unit-latency p50 is a nearest-rank value: with two units it is the smaller of the two (cycle workload, 1 client: 130.8 s where the two cycles took 130.8 and 178.6 s). For levels of two to eight units the p50 should not be quoted. In the repeat the two cycles of the 1-client level took 146.2 and 153.6 s; the 8-client level has 16 cycles (mean 163.9 s, 131.9 to 190.3 s).
- **Fullness of the blocks.** The blocks of the levels were 51 to 57 % full on average with all users' transactions, and in every level some were full (98 to 100 %): 12 of the 25 blocks of the 4-client cycle level were more than 90 % full. Our transactions carried a 0.2 gwei tip, above the lowest tip of the full blocks of the 27 hours before the run (0.065 to 0.123 gwei, readiness report), and the inclusion latency (p50 8.3 to 10.9 s per level, p95 up to 36 s) shows that most went into the next block and some waited one or two blocks. The chain was not the limit at these levels, but it was not empty either: this is the difference from Sepolia (36 to 39 % full, never above 50 %). The levels of the repeat were 51 to 53 % full on average, with 11 or 12 blocks of each level over 90 % full (section 8.1).
- **Gas ceiling (computed).** Block gas limit 60,000,000, slots of 12 s. From the gas measured in this run, 4,832,128.8 per cycle (the sum of the eleven per-call means): 12.4 cycles per block, **1.03 cycles/s**. `makeOrder` alone, 1,213,291.4 gas: 49.5 per block by gas used, 4.12/s; 46 per block, 3.83/s, when each must find its gas limit of 5,000,000 free (the script's fixed limit; the dApps send the estimate × 1.25). These assume the whole block for this application; here other users had half of it. The local throughput file (`throughput-final-2026-10-13.md`) measures these ceilings. From the gas of the repeat's 30 complete cycles, 4,835,605.2 per cycle: 12.41 cycles per block, **1.03 cycles/s**, the same ceiling.

Gas per call in the concurrency run:

| Call | Ordering workload: n, mean (min–max) | Full cycle, first run: n, mean (min–max) | Full cycle, repeat: n, mean (min–max) | Sequential run, later mean |
|---|---:|---:|---:|---:|
| `stealthAnnounce` | 30, 26,243 (26,233–26,245) | 30, 26,241.8 (26,221–26,245) | 30, 26,241.8 (26,221–26,245) | 26,242.3 |
| `makeOrder` | 30, 1,213,291.4 (1,213,269–1,213,293) | 30, 1,213,289.8 (1,213,245–1,213,293) | 30, 1,213,290.6 (1,213,269–1,213,293) | 1,213,289 |
| `poolDeposit` |  | 25, 859,057.8 (855,370–878,719) | 30, 860,232.2 (855,382–863,698) | 858,204.7 |
| `poolWithdraw` |  | 25, 1,116,083.9 (1,094,718–1,144,571) | 30, 1,118,254.6 (1,094,718–1,127,483) | 1,120,530.3 |
| `prepareOrder` |  | 24, 137,388.5 (137,368–137,392) | 30, 137,390 (137,380–137,392) | 137,390.7 |
| `confirmIntention` |  | 24, 230,256.5 (230,245–230,257) | 30, 230,257 (230,257–230,257) | 230,257 |
| `addInformation` |  | 24, 60,130 (60,130–60,130) | 30, 60,130 (60,130–60,130) | 60,130 |
| `pickupOrder` |  | 24, 68,776.3 (68,758–68,787) | 30, 68,776.2 (68,758–68,787) | 68,771.7 |
| `deliveryOrder` |  | 24, 1,005,018.2 (994,206–1,017,555) | 30, 1,005,143.8 (996,280–1,019,634) | 999,801.7 |
| `rateOrder_client` |  | 24, 57,955.5 (57,945–57,957) | 30, 57,957 (57,957–57,957) | 57,957 |
| `rateOrder_restaurant` |  | 24, 57,930.5 (57,920–57,932) | 30, 57,932 (57,932–57,932) | 57,932 |
| **Cycle** (sum of the means) | | **4,832,128.8** | **4,835,605.2** | 4,830,506.3 |

- The counts of the cycle column are what was mined: 30 announcements and 30 orders, 25 deposits and 25 withdrawals, 24 of each later call. The notes of this run are on leaves 31 to 104, and every one of its 74 insertions equals the rule of section 5.2; 8 of the 25 withdrawals use the dummy note and 8 of the 24 deliveries are a worker's first. In the repeat every call was mined 30 times; its notes are on leaves 105 to 194, 8 of its 30 withdrawals use the dummy note and 8 of its 30 deliveries are a worker's first (section 8.1).
- **`cancelOrder` in ORDERED, sent by the customer** (the cleanup of the ordering workload; read back from the chain, the result files do not list it): 30 transactions, all successful, 101,959 gas each. Local gas table: 101,959.
- **Effective gas prices.** Ordering workload: 1.1061 to 1.3135 gwei, gas-weighted mean 1.1959. Cycle workload: 1.0815 to 1.3200 gwei, gas-weighted mean 1.1948. Cost of a cycle in this run (the script's figure, 24 complete cycles): 0.005762287 ETH = 14.46 USD; of an order (30): 0.001482333 ETH = 3.72 USD. Repeat: 0.9780 to 1.3177 gwei, gas-weighted mean 1.2127; cost of a cycle (the script's figure, 30 complete cycles, equal to the fees read from the chain divided by 30): 0.005864235 ETH = 14.70 USD at the repeat's rate of 2506.245 USD per ETH.
- **Estimate and budget.** Printed before sending: gas 0.207376 ETH + locked 0.141149 ETH = 0.348526 ETH. Spent by the funder: 0.337898 ETH, 0.970 of the estimate, with six cycles incomplete. Repeat: printed gas 0.162633 ETH + locked 0.140294 ETH = 0.302926 ETH; spent by the funder 0.310875 ETH, 1.026 of the estimate, with every cycle complete (section 9.4).
- **After the run** (read from the chain at block 3808109): the 80 orders ever made on `Chain` are 44 CONCLUDED (20 of the two sequential runs, 24 of this run), 30 CANCELED BY CLIENT (the ordering workload) and **6 ORDERED** (section 9); the 10 orders on `No_Chain` are concluded (the run's result file; their states were not read back). The temporary wallets were refunded by the run: 0.613960 ETH back to the funder in 92 transfers (read from the chain: 92 transfers, the same sum). **After the repeat** (read from both endpoints at block 3809858, 17:57 UTC): `Chain` has 110 orders; the 30 of the repeat (indices 81 to 110) are all CONCLUDED and hold nothing; the six of section 9 were still ORDERED then and were cancelled half an hour later (section 10.3). The repeat refunded its temporary wallets and one-time addresses: 0.597899 ETH back to the funder in 54 transfers (read from the chain: 54 transfers, the same sum).
- **Against Sepolia the same day:** 8 clients gave 0.268 orders/s and 0.0325 cycles/s there (16 of 16), 0.347 and 0.0434 (13 of 16) here in the first run, and 0.0462 cycles/s (16 of 16) in the repeat. All are closed-loop figures of a few units on a shared network; none is a capacity.

### 8.1 The repeat of the cycle workload: what bounds the rate, gas, read-back

**Rate against the closed loop.** A client sends a transaction only after the receipt of the one before, so a cycle of eleven transactions takes at least eleven blocks. The ideal closed-loop rate at one transaction per 12 s slot is k / (11 × 12 s) cycles per second: 0.0076, 0.0152, 0.0303 and 0.0606 for 1, 2, 4 and 8 clients. Measured: 0.0067, 0.0125, 0.0218 and 0.0462, i.e. 88 %, 82 %, 72 % and 76 % of that rate. It is a reference, not a strict bound: it counts every slot as a block, and the levels differed in empty slots. Their mean block times were 12.52, 12.48, 13.85 and 12.92 s (24, 26, 27 and 27 blocks in 288, 312, 360 and 336 s; 4 of the 31 slots of the 4-client level had no block). Against k / (11 × the level's mean block time) the measured rates are 92 %, 86 %, 83 % and 82 %. A level's window is the two cycles of its slowest client.

**Where the time of a cycle goes** (mean per cycle and share of the cycle, from the script's timers in the raw file; "reads between the steps" is what the timers of the steps leave over, the requests a client makes between one step and the next, and is not timed per step):

| Clients | Cycle, mean (s) | Waiting for the eleven transactions to be mined | Preparing and sending them | Reads between the steps | Queue for the prover | Building the proof's input | Proving | Other off-chain steps |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 1 | 149.9 | 112.1 (74.8 %) | 25.8 (17.2 %) | 6.7 (4.5 %) | 0.0 (0.0 %) | 1.7 (1.1 %) | 0.8 (0.6 %) | 2.8 (1.9 %) |
| 2 | 148.8 | 116.1 (78.1 %) | 20.2 (13.6 %) | 8.2 (5.5 %) | 0.3 (0.2 %) | 1.3 (0.9 %) | 0.7 (0.4 %) | 2.0 (1.4 %) |
| 4 | 171.2 | 131.4 (76.7 %) | 20.9 (12.2 %) | 13.9 (8.1 %) | 0.9 (0.5 %) | 1.1 (0.6 %) | 0.7 (0.4 %) | 2.4 (1.4 %) |
| 8 | 163.9 | 111.3 (67.9 %) | 21.5 (13.1 %) | 23.4 (14.3 %) | 3.3 (2.0 %) | 0.9 (0.6 %) | 0.7 (0.4 %) | 2.7 (1.7 %) |

- **The closed loop of eleven sequential transactions** (waiting, preparing and sending, reads between the steps) is 96.4 %, 97.1 %, 97.0 % and 95.3 % of a cycle. Waiting for inclusion alone is 10.2, 10.6, 11.9 and 10.1 s per transaction, against slots of 12 s. Preparing a transaction (estimate, fees, nonce, signature, sending) takes about 2 s at every level; the reads between the steps grow with the clients, from 6.7 to 23.4 s per cycle, all through one public endpoint.
- **The single prover of this host** (one proof at a time): proving takes 0.66 to 0.83 s per cycle at every level; the queue for the prover is 0, 0.26, 0.88 and 3.33 s per cycle (with 8 clients: median 3.05 s, the two middle values of the 16 being 2.9 and 3.2 s; longest 8.3 s). The whole proof step, with the building of the input while the prover is held, is 1.7 %, 1.5 %, 1.6 % and 3.0 % of a cycle. The queue also costs blocks: with 8 clients 10 of the 16 withdrawals were mined two blocks after their deposit instead of one, and 6 of those 10 passed over a block that was 5 % full, i.e. they were sent too late for it. The script's printed sentence that at high k the rate "is bounded by this host, not by the chain" does not hold for these figures: the queue is 2.0 % of a cycle with 8 clients.
- **The shared blocks.** A cycle with every transaction in the block after the one before spans 11 blocks; the cycles spanned 12.0, 12.0, 13.0 and 12.7 on average. Of the steps that follow another transaction of the same cycle (ten per cycle), 2 of 20, 4 of 40, 12 of 80 and 27 of 160 were not mined in the next block. With 8 clients 12 of the 27 blocks passed over were more than 99 % full with other users' transactions and 6 more were 98 % full; the other 9 were almost empty (3 to 5 %), so those transactions arrived too late for them. The table counts a block once for each transaction that passed it over. Slots without a block lengthen every wait: the mean block time of the levels was 12.52, 12.48, 13.85 and 12.92 s.

| Clients | Blocks of the level | Mean block time (s) | Slots without a block | Block use, mean (all users) | Blocks over 99 % full / under half | Blocks from the first to the last transaction of a cycle, mean (min–max) | Steps mined in the next block / later | Blocks passed over | Of them over 99 % / over 90 % full |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 1 | 24 | 12.52 | 1 | 53.2 % | 3 / 11 | 12.0 (12–12) | 18 / 2 | 2 | 1 / 1 |
| 2 | 26 | 12.48 | 1 | 51.4 % | 6 / 13 | 12.0 (11–13) | 36 / 4 | 4 | 2 / 3 |
| 4 | 27 | 13.85 | 4 | 51.4 % | 4 / 13 | 13.0 (12–14) | 68 / 12 | 16 | 6 / 9 |
| 8 | 27 | 12.92 | 2 | 50.8 % | 5 / 14 | 12.7 (11–14) | 133 / 27 | 27 | 12 / 18 |

- During the whole repeat (blocks 3809685 to 3809830, 146 blocks, mean block time 13.08 s: 13 of the 159 slots had no block) the blocks were 52 % full on average, 23 of them more than 99 % and 71 under half; the base fee moved between 0.7780 and 1.1177 gwei (mean 0.9878, median 0.9948), by up to ×1.1250 from one block to the next. The same market as in the morning (section 6).
- **Root age and retries.** No proof had to be made again: every withdrawal's root was known to the contract, although up to 8 notes of other clients were inserted between a proof's snapshot and its check (8 clients: mean 3.75). No transaction was refused and none reverted.
- **One run.** Each level ran once with two cycles per client: 2, 4, 8 and 16 cycles. There is no spread across runs, and the levels of 1 and 2 clients rest on 2 and 4 cycles.

**Gas of the repeat.** All 330 calls were read back (section 12). Gas per cycle: mean 4,835,605.2 (4,821,693 to 4,855,413); by level 4,835,746.0, 4,838,111.2, 4,833,485.8 and 4,836,020.8. The script's report prints "Gas per cycle: 4,835,841": that is the mean of the four level means, each level counted once; the mean of the 30 cycles is 4,835,605.2, the figure of the script's own cost table and of the chain.

- **Leaf-index rule (section 5.2).** The repeat inserted 90 notes (30 deposits, 30 withdrawals, 30 deliveries), on leaves 105 to 194 without a gap, as section 10.4 expected; they are the only `NoteAdded` events of the window. With the zero bytes of the calldata and the signature byte counted, all 90 equal the rule with the constants of section 5.3: largest difference 0 gas. Leaf 127 opens a level: it was inserted by a `poolWithdraw` of the 4-client level (client 2, first cycle, a withdrawal with the dummy note), which used 1,124,292 gas = 1,095,162 + 6 × 2,079 + 17,100 − 12 × 37 zero bytes. 8 of the 30 withdrawals have the dummy note as first input (the first of each of the 8 temporary establishments) and 8 of the 30 deliveries are a worker's first.
- **The same constants as on a local node (section 5.3).** After the same normalisation the 330 calls fall on constants that the package and the local rehearsal chain both have, and on no other: `stealthAnnounce` 28,249 (30); `makeOrder` 1,217,445 (30); `poolDeposit` 853,303 (30); `poolWithdraw` 1,095,162 (8), 1,117,532 (22); `prepareOrder` 138,304 (30); `confirmIntention` 231,157 (30); `addInformation` 62,386 (30); `pickupOrder` 70,030 (30); `deliveryOrder` 995,461 (22), 1,012,561 (8); `rateOrder` with score 4 58,617 (30) and with score 5 58,592 (30). **330 of 330 equal the local gas; with the 618 of the package, 948 of 948** (954 of 954 with the six cancellations of the recovery, section 10.3). The stopped read-back task and this task each made the normalisation with code of their own, from the same blocks, and got the same 330.
- **Fees.** All 429 transactions of the repeat are of type 2, and the effective price is the base fee of the block plus 0.2 gwei in every one of them (checked against the block headers).

## 9. The six failed cycles

All six were the second cycle of their client in a level. In each, the node refused a transaction when it was sent (ethers reports the refusal of `eth_sendRawTransaction`); nothing of the refused step reached the chain, and no transaction of the package reverted.

| # | Clients | Client, cycle | Step refused | Sender of that step | Node's answer | Refused at (UTC), head block | Steps of the cycle that were mined |
|---:|---:|---|---|---|---|---|---|
| 1 | 2 | 1, 2 of 2 | `prepareOrder` | the order's one-time address `0xA35bD65ebf42c54bB572b217981C76ADAD8b89f2` | nonce has already been used | 10:56:25, 3807994 | stealthAnnounce, makeOrder, poolDeposit, poolWithdraw |
| 2 | 4 | 2, 2 of 2 | `poolDeposit` | temporary establishment wallet `0x8e2125cEd45b83E539a2969a64832518ec6e281C` | insufficient funds for intrinsic transaction cost | 11:02:03, 3808018 | stealthAnnounce, makeOrder |
| 3 | 4 | 1, 2 of 2 | `poolDeposit` | temporary establishment wallet `0xa0d3Dcf792A65dfdE7ea0d828cC1d4e664Da5434` | insufficient funds for intrinsic transaction cost | 11:02:03, 3808018 | stealthAnnounce, makeOrder |
| 4 | 8 | 3, 2 of 2 | `poolDeposit` | temporary establishment wallet `0xFBc157A1aC77d9988FBa5A90C0aDE8820C8F14D7` | insufficient funds for intrinsic transaction cost | 11:09:17, 3808052 | stealthAnnounce, makeOrder |
| 5 | 8 | 1, 2 of 2 | `poolDeposit` | temporary establishment wallet `0xa0d3Dcf792A65dfdE7ea0d828cC1d4e664Da5434` | insufficient funds for intrinsic transaction cost | 11:09:17, 3808052 | stealthAnnounce, makeOrder |
| 6 | 8 | 0, 2 of 2 | `poolDeposit` | temporary establishment wallet `0xa6f6B4b90BfaDb24De0422B1528D2Eb86Ee2bbCF` | insufficient funds for intrinsic transaction cost | 11:09:18, 3808052 | stealthAnnounce, makeOrder |

### 9.1 The five "insufficient funds": the deposit of a wallet funded to the wei

**What the node checks.** A node takes a transaction only if the sender's balance covers gas limit × maximum fee + value. The benchmark sent `depositPayment` with a fixed gas limit of 2,000,000 (it uses 0.86 million) and the level's maximum fee (2 × base fee + tip, read when the level starts), and a value of delivery fee + `eth_gasPrice` × 4,725,000, read at the moment of the deposit (the amount the manager dApp withdraws for an order: 3,150,000 gas × 1.5).

**What the wallet was funded with.** Before each level the benchmark tops every temporary wallet up to its need for the level's two cycles. For an establishment: 2 × (859,540 gas × 1.25 × (base fee + tip) + one deposit at the `eth_gasPrice` of that moment) + 2,000,000 × the fee cap of that moment. Reconstructed from the funding transfers and the balances on the chain, to the wei (the three unknowns, the base fee the fees were read at, the node's tip suggestion and `eth_gasPrice`, come out as integers that match a block):

| # | Wallet | Funded up to (ETH), block | Fees read at head | Fee cap of the funding (gwei) | Each deposit funded at `eth_gasPrice` (gwei) = (ETH) | Gas reserve per cycle (ETH) | Reserve for the upfront (ETH) |
|---:|---|---|---:|---:|---|---:|---:|
| 2 | `0x8e21…281C` | 0.017457771, 3808004 | 3808002 | 1.995256 | 0.963875 = 0.005554311 | 0.001179319 | 0.003990511 |
| 3 | `0xa0d3…5434` | 0.017457771, 3808004 | 3808002 | 1.995256 | 0.963875 = 0.005554311 | 0.001179319 | 0.003990511 |
| 4 | `0xFBc1…14D7` | 0.017730726, 3808035 | 3808031 | 2.030253 | 0.981374 = 0.005636991 | 0.001198120 | 0.004060505 |
| 5 | `0xa0d3…5434` | 0.017730726, 3808033 | 3808031 | 2.030253 | 0.981374 = 0.005636991 | 0.001198120 | 0.004060505 |
| 6 | `0xa6f6…bbCF` | 0.017730726, 3808032 | 3808031 | 2.030253 | 0.981374 = 0.005636991 | 0.001198120 | 0.004060505 |

**What happened.** The node's tip suggestion was 0.066247448 gwei throughout (it is `eth_gasPrice` − base fee in every amount of the run), so `eth_gasPrice` followed the base fee of the head block, which alternated between about 0.93 and 1.05 gwei from block to block and reached 1.12:

| # | First deposit of the level: block, `eth_gasPrice` (gwei), value (ETH), fee (ETH) | Balance when the second was sent (ETH) | Level's maximum fee (gwei) | Head block: base fee, `eth_gasPrice` (gwei) | Value of the second deposit (ETH) | 2,000,000 × maximum fee (ETH) | Node asks (ETH) | Short by (ETH) |
|---:|---|---:|---:|---|---:|---:|---:|---:|
| 2 | 3808007, 1.186217, 0.006604875, 0.001037493 | 0.009815403 | 1.982923 | 3808018: 1.051532, 1.117780 | 0.006281508 | 0.003965846 | 0.010247355 | **0.000431952** |
| 3 | 3808007, 1.186217, 0.006604875, 0.001037493 | 0.009815403 | 1.982923 | 3808018: 1.051532, 1.117780 | 0.006281508 | 0.003965846 | 0.010247355 | **0.000431952** |
| 4 | 3808041, 1.065632, 0.006035112, 0.001130237 | 0.010565378 | 2.227125 | 3808052: 1.039655, 1.105903 | 0.006225391 | 0.004454250 | 0.010679640 | **0.000114263** |
| 5 | 3808041, 1.065632, 0.006035112, 0.001124785 | 0.010570829 | 2.227125 | 3808052: 1.039655, 1.105903 | 0.006225391 | 0.004454250 | 0.010679640 | **0.000108811** |
| 6 | 3808041, 1.065632, 0.006035112, 0.001127519 | 0.010568096 | 2.227125 | 3808052: 1.039655, 1.105903 | 0.006225391 | 0.004454250 | 0.010679640 | **0.000111545** |

Where the shortfall comes from (mETH; the four terms add up to the shortfall exactly):

| # | First deposit above its funding | Second deposit above its funding | Upfront at the level's fee above the reserve | Unused gas reserve (minus) | Short by |
|---:|---:|---:|---:|---:|---:|
| 2 | +1.050564 | +0.727197 | −0.024665 | −1.321144 | **+0.431952** |
| 3 | +1.050564 | +0.727197 | −0.024665 | −1.321144 | **+0.431952** |
| 4 | +0.398121 | +0.588400 | +0.393745 | −1.266002 | **+0.114263** |
| 5 | +0.398121 | +0.588400 | +0.393745 | −1.271454 | **+0.108811** |
| 6 | +0.398121 | +0.588400 | +0.393745 | −1.268720 | **+0.111545** |

- **Levels of 4 clients (failures 2 and 3).** Funded at an `eth_gasPrice` of 0.9639 gwei (head 3808002, base fee 0.8976). The first deposits were priced four blocks later at 1.1862 gwei (base fee 1.1200, the highest of the level): +1.050564 mETH above the funding each. The second deposits were priced at head 3808018, base fee 1.0515, 12.3 % above the block before. Clients 1 and 2 were refused. Clients 0 and 3 passed: client 3 had read the price one block earlier (base fee 0.9361; 0.000116 ETH to spare) and client 0 one block later (0.9512; 0.000039 ETH to spare). Had client 1 or 2 read the price in either neighbouring block, the node would have asked 0.009702 or 0.009773 ETH and the wallet held 0.009815.
- **Level of 8 clients (failures 4 to 6).** Here the level's fees were read after the funding transfers were mined, seven blocks later, when the base fee was higher: the level's maximum fee was 2.2271 gwei against a funded cap of 2.0303, which alone takes +0.393745 mETH of a wallet's room. The second deposits of clients 0, 1 and 3 were priced at head 3808052 (base fee 1.0397, 12.0 % above the block before) and refused; the other five clients had read the price one block earlier and passed with 0.00042 ETH or more to spare.
- **The same wallet twice.** The establishment wallet of client 1, `0xa0d3…5434`, was refused in the level of 4 and again in the level of 8: a top-up only restores the same need.
- **How close the other wallets were.** For every mined transaction of the cycle workload sent by a temporary wallet, the balance one block earlier was compared with gas limit × maximum fee + value. Deposits: the lowest margin among the 25 that passed is 0.000039 ETH. Customers: the second `makeOrder` of the two customers of the 2-client level had 0.000915 ETH to spare of 0.018332 asked (5,000,000 × 2.2665 gwei + 0.007; the cap of their funding was 2.0214 gwei). Workers: at least 0.001805 ETH. The customer's reserve has the same weakness as the establishment's and was not hit by a margin of 5 %.

**Whose fault.** The benchmark's funding and its fixed gas limit, on a network whose base fee moves by 12 % from block to block. Not the contracts: `depositPayment` was never reached, and the 25 deposits that were sent used the gas of the local rule. Not the fee settings: a tip or a maximum fee does not change what the node asks for a given limit. On Sepolia the same code had no failure because the price there is about 0.001 gwei and does not move: two deposits cost 0.002 ETH whatever the block.

**Would the manager dApp's rules have met the same?**

- *Its gas limit.* The dApp sends every transaction with the node's estimate × 1.2 and has no fixed limit (`manager-frontend/src/utils/oneTimeSend.js`, `sendFromWallet` and `oneTimeOverrides`; read, not run). With 1.2 × 861,619 = 1,033,942 as the deposit's limit and the same maximum fee, the node would have asked 0.008332 ETH in the level of 4 and 0.008528 ETH in the level of 8: all five wallets held 0.0015 to 0.0020 ETH more than that (computed from the balances above).
- *Its deposit.* The dApp has no deposit per order. An establishment deposits into the pool from its own wallet on the Menu page, when it chooses, through the browser wallet, and orders are funded from notes already in the pool (revenue notes or a deposit). The benchmark's deposit per cycle from a wallet holding exactly two deposits is a construction of the benchmark (the local file gives the cycle with and without it for that reason).
- *Its balance check.* For the transactions of an order's one-time address the dApp checks, before sending, that the balance covers gas limit × `eth_gasPrice` + value, and otherwise sends nothing and says how much is missing (`upfrontCost`, `shortOfGasError`). A wallet that is short is told so in the browser; it does not get a node error. For a transaction from the establishment's own wallet the check is the browser wallet's (not examined here).
- *What it does not avoid.* The amount an order withdraws from the pool, delivery fee + `eth_gasPrice` × 4,725,000, moves with the gas price in the dApp exactly as in the benchmark. On a network at 1 gwei that is 0.0057 ETH per order, and an establishment whose notes hold less cannot accept the order until it deposits. That is a property of the gas budget at this price, noted in the readiness report, and not a failure of this run.

### 9.2 The "nonce has already been used"

- **Which account, which two transactions.** The one-time address `0xA35bD65ebf42c54bB572b217981C76ADAD8b89f2` of client 1's second order in the level of 2 clients. Its first transaction, the funding withdrawal `0x8784b9da892abeb2c36e5fc4d964f77c423dfe00468104e997824baa2840b03d` (nonce 0), was mined in block 3807994 and its receipt reached the script 216.750 s into the level. The script then built `prepareOrder` 216.915 s into the level, 165 ms later, and the node refused it 217.754 s into the level. ethers reports "nonce has already been used" when the node answers "nonce too low" to `eth_sendRawTransaction`: the refused `prepareOrder` was signed with nonce 0, the nonce of the withdrawal. It never reached the chain: the address's only other transaction is the run's refund transfer (nonce 1, block 3808071).
- **Cause.** The script does not keep nonces; ethers asks the endpoint for the pending transaction count before each transaction. The count it got was 0, the count before block 3807994, although the same endpoint had just delivered that block's receipt. The public endpoint is a pool of nodes, and the answer came from one that had not imported the block yet. This is an inference from the two facts above (a signed nonce of 0, a receipt already seen); the request itself was not logged. The readiness check had found 0 of 60 such answers on this endpoint and 4 of 60 on the second one; here it happened once in the run.
- **Whose fault.** The benchmark's sending (no nonce of its own, no retry) against a load-balanced public endpoint. Not the contracts. In the rehearsal a proxy that answers every ninth pending count one block late reproduces the failure (section 10.2).
- **Would the manager dApp have met the same?** It can. The dApp sends `prepareOrder` from the one-time address right after it has waited for the funding withdrawal's receipt, and its nonce also comes from the endpoint's pending count (ethers v5 signer; `sendOneTime`). Before that it makes four more requests (balance, estimate, gas price, balance), which gives a lagging node more time, but nothing rules it out. The consequence there is an error message and nothing lost: the order stays ORDERED, the address stays funded, and pressing "Accept order" again sends only `prepareOrder`, because the dApp reads from the chain what the pool already paid to the address (`fundingPlan`). Read from the code; not tried against a lagging endpoint.

### 9.3 What each failure left

Addresses from the raw result file and the chain's events; balances and states read at block 3808246 (11:54 UTC).

| # | Order (index) | State | ETH in the order | Customer's temporary wallet: balance | One-time address: received, sent back by the run's refund, holds now | Establishment's temporary wallet: balance now |
|---:|---|---|---:|---|---|---:|
| 1 | `0x5f457eBC9e7d838a6d741c04E6a15aD2b7065837` (55) | ORDERED | 0.004433607 | `0x38EE…88C3`: 0.000010 | `0xA35b…89f2`: stipend 0.002566 + withdrawal 0.005478; 0.006549 back in block 3808071; 0.000009 | about 0.00001 |
| 2 | `0xF26BcBc14b5Ca5cC1C75542340d4BB3426fb8bA9` (63) | ORDERED | 0.004594320 | `0xB132…7633`: 0.000013 | `0x98C7…7357`: stipend 0.002406; 0.002370 back in block 3808072; 0.000012 | `0x8e21…281C`: about 0.00001 |
| 3 | `0x9d11ff1EC7A88Cc11c49744772f24649f1093112` (62) | ORDERED | 0.004594320 | `0x38EE…88C3`: 0.000010 | `0xD214…f567`: stipend 0.002406; 0.002370 back in block 3808073; 0.000009 | `0xa0d3…5434`: about 0.00001 |
| 4 | `0xD8Bf6cCd2f416485439Ce91F8035E7656843304B` (78) | ORDERED | 0.004613417 | `0xD371…2A46`: 0.000010 | `0x018c…9f55`: stipend 0.002387; 0.002351 back in block 3808076; 0.000012 | `0xFBc1…14D7`: about 0.00001 |
| 5 | `0x80bcF90ce57921B14326fED72Cc4B955bEB07074` (79) | ORDERED | 0.004613417 | `0x38EE…88C3`: 0.000010 | `0xa838…DAdC`: stipend 0.002387; 0.002351 back in block 3808077; 0.000010 | `0xa0d3…5434`: about 0.00001 |
| 6 | `0x0720B928Fd67B7a827867f6678e5479797566576` (80) | ORDERED | 0.004613417 | `0x53Df…B9aC`: 0.000010 | `0x1d92…7f10`: stipend 0.002387; 0.002351 back in block 3808077; 0.000010 | `0xa6f6…bbCF`: about 0.00001 |
| | **Six orders** | | **0.027462497** | | | |

- **The orders.** Each holds its customer's payment minus the stipend: 0.007 ETH − `eth_gasPrice` × 2,400,000. In ORDERED the customer can cancel and gets it back (`cancelOrder`, 101,959 gas in the 30 cancellations of this run). Only the order's two parties can act on it in this state: the customer, and the order's one-time address (acceptance, or a refusal that also returns the money). The keys of both are in the run's wallet file.
- **The pool.** The five refused deposits never entered it. In failure 1 the deposit (0.005478 ETH) and the withdrawal of the same amount were both mined, so the pool holds nothing of that cycle but a change note of zero value. The pool's balance is 0.153309162 ETH and equals the 34 revenue notes of the completed cycles to the wei (section 11).
- **Temporary wallets and one-time addresses.** The run refunded them after each workload, the six one-time addresses included. The 92 addresses of the concurrency run (32 wallets, 60 one-time addresses of both workloads) hold 0.000955816 ETH together, at most 0.000013 each: less than the fee of a transfer (21,000 gas at 1.2 gwei is 0.000025 ETH). Not worth recovering.
- **What a recovery can bring back to the funder: 0.027462 ETH minus about 0.0012 ETH of fees, about 0.026 ETH** (section 10.3). The recovery of 2026-10-13, 18:21 UTC, brought back 0.026446 ETH; the table above is the state before it.

### 9.4 The fix on the real network: the repeat of 17:19 UTC

The repeat of the cycle workload (section 8.1) ran the corrected benchmark of section 10.1 on Hoodi: funding with room, the deposit's gas limit from the node's estimate, nonces kept per sender. The recovery (section 10.3) ran the corrected `recover-ephemeral.cjs`.

- **No refusal.** 330 of 330 transactions of the 30 cycles were accepted and mined with status 1; no level has a failed unit. The six failures of the first run were all the second cycle of a client in a level; the repeat had 15 such second cycles (1, 2, 4 and 8) and all completed.
- **The same market.** The base fee moved between 0.7780 and 1.1177 gwei during the repeat, by up to ×1.1250 from one block to the next (during the package: 0.8414 to 1.1200, ×1.1250). Whether a deposit of the repeat was priced in a block that would have failed the old funding was not reconstructed; the margins below show how far every wallet was from a refusal.
- **Deposit limits against gas used.** The 30 deposits were sent with gas limits of 1,038,520 to 1,046,064 (mean 1,042,710; the node's estimate × 1.2, where the first run sent 2,000,000) and used 855,382 to 863,698 gas (mean 860,232.2): 82.0 to 82.8 % of the limit. Their values were 0.005751 to 0.006711 ETH (0.187184588 ETH in 30 deposits, all withdrawn again).
- **Margins** (balance one block before the transaction against gas limit × maximum fee + value, for every mined transaction of a temporary wallet): deposits, lowest margin 0.013097 ETH, the node asking 0.008484 of a balance of 0.021581 (first run: 0.000039 among the 25 that passed, and five short by 0.00011 to 0.00043); customers' `makeOrder`, 0.004752 ETH of 0.019142 asked (first run 0.000915 of 0.018332); workers, at least 0.004924 ETH (first run 0.001805). No margin is negative in any of the 120 transactions compared.
- **Nonces.** The script counts how often the endpoint's pending count is below its own count for a sender: 0 times in the repeat (`staleNonceAnswers` in the run's summary file; printed as "the node answered below the book 0 time(s)"). The stale answer of section 9.2 therefore did not occur, and the repeat does not show that the nonce book removes it on a public endpoint: that rests on the rehearsal against a proxy (section 10.2, rehearsals 05 and 06). In the first run it occurred once.
- **Funding against what was spent.** The funder sent 0.907645300 ETH to the 24 temporary wallets in 45 transfers, before each level: 0.077082 ETH (3 transfers), 0.122942 (6), 0.235346 (12) and 0.472275 (24). Refunds come only after the last level, so the funder's balance was lowest after the last funding transfer (block 3809784): 6.277349 ETH, 0.908774 ETH below its start. The run had printed "Funder balance needed: about 0.756962 ETH" and section 10.4 expected 0.79 to 0.82: the outlay was 0.09 to 0.15 ETH above both, a difference this task did not break down; the funder held 7.186 ETH. Of the 0.907645 ETH funded, 0.175927 paid the fees of the 330 calls, 0.131825 stayed in the pool as the 30 revenue notes, 0.597899 came back in 54 refund transfers costing 0.001346 in fees, and 0.000648 is dust at the 54 addresses: the five add up to the funding to the wei.
- **Spent against the estimate.** Printed before sending: gas 0.162633 ETH + locked 0.140294 ETH = 0.302926 ETH. Spent by the funder: 0.310875 ETH, 1.026 of the estimate (rehearsals with the fix: 1.01 to 1.05; section 10.4 expected 0.30 to 0.32 ETH). The estimate priced 4,888,656 gas per cycle at 1.0934 gwei (the base fee when it was printed, 0.8934 gwei, plus the 0.2 gwei tip the run sends; `eth_gasPrice` was 0.9681 gwei then). The transactions used 4,835,605 gas per cycle at a gas-weighted mean of 1.2127 gwei, because the base fee was higher during the run: fees 0.175927 ETH against 0.160360 ETH in the estimate. The amount locked in the pool was smaller than estimated, 0.131825 against 0.140294 ETH. The rest of the spend is the fees of the funding transfers (0.002475 ETH; 0.002273 ETH in the estimate) and dust left at the temporary wallets (0.000648 ETH; not in the estimate).
- **The recovery script.** Both of its fixes were used on the real endpoint (section 10.3): the endpoint refused the log query by customer and the script read the 110 orders from `Chain`'s registry; no wallet could pay the first cancellation and the funder sent its gas in one transfer. Its 14 transactions were all accepted.

## 10. Prepared on a private node; the repeat and the recovery were then sent

When this section was written (2026-10-13, 12:00 UTC) nothing of it had been sent to Hoodi or to any real network. The rehearsals ran on a private Hardhat node (chain id 560048, hardfork osaka, 60,000,000-gas blocks, one block per second, a throwaway key), started and stopped by the task that wrote it. Both commands of 10.3 and 10.4 send transactions, and the owner decided: **the repeat of 10.4 was run on 2026-10-13 from 17:19 to 17:51 UTC and the recovery of 10.3 from 18:16 to 18:30 UTC, both from the main session after the owner's authorisation.** The tasks that wrote and updated this file sent nothing. Sections 10.1 and 10.2 are unchanged; 10.3 and 10.4 give the outcome first and keep the preparation as it was written.

### 10.1 The fix of the benchmark

| File | Change | When it is active |
|---|---|---|
| `benchmarking/concurrent-lib.cjs` | **Funding with room** (`depositPriceWithRoom`, `walletNeed`): each deposit of a level is funded at the fee cap (2 × base fee + tip; or twice `eth_gasPrice` if that is higher), the highest price at which the level's own transactions can still be mined, and the reserve for the upfront is 1.5 × the largest gas limit × the fee cap, because the level's fees are read again after the funding. **The deposit's gas limit** is the node's estimate × 1.2, as the manager dApp sends it, instead of 2,000,000. **Nonces kept per sender** (`trackNonces`): a wallet signs with the larger of the endpoint's pending count and its own count, so a stale answer cannot repeat a nonce; the funder's transfers use the same book; the number of stale answers met is written to the result file. | `FUNDING_ROOM=1` and `NONCE_TRACKING=1`. Default 1 on a network named with `BENCH_NETWORK`, 0 on Sepolia and `--local`, which run as before |
| `benchmarking/benchmark-concurrent-sepolia.js` | Asks for both on a named network; header text | |
| `benchmarking/recover-ephemeral.cjs` | (1) `GAS_FROM_FUNDER=1`: when no wallet of the run can pay a cancellation, the run's funder sends the gas (its key is used only if its address is the funder the wallet file names). (2) The customers' orders are read from `Chain`'s registry when the endpoint refuses a log query without an address. (3) Own nonce count per sender. (4) The dry run lists what each open order holds and what its cancellation needs | (1) only with `--yes` and the variable; (2) by itself, or `ORDERS_FROM_REGISTRY=1` |

- What is not spent of the larger funding comes back in the run's refunds; the cost of a run does not change, the funder's largest top-up does (10.4).
- Not changed: the sequential scripts (`benchmark-privacy.js`, `benchmark-no-privacy.js`). They also take their nonces from the endpoint; their 250 transactions had no failure, and their accounts are not funded to the wei.
- Backups of the scripts as they ran on Hoodi are kept in a local records folder, not in the repository. Patch scripts: `edit/` of the scratch folder.

### 10.2 Rehearsal

A sidecar mines one block per second with a given base-fee series and answers `eth_gasPrice` as Hoodi's nodes do (head base fee + 0.066247448 gwei). Cycle workload, `PRIORITY_FEE_GWEI=0.2`, order total 0.006 ETH, real proofs. "As run" is the patched library with `FUNDING_ROOM=0 NONCE_TRACKING=0`, which is the code path of the Hoodi run.

| # | Base fee | Code | Clients | Cycles completed | Refused |
|---:|---|---|---|---:|---|
| 01 | Hoodi's own, blocks 3807950 to 3808077 of the run, in a loop (0.882 to 1.120 gwei) | as run | 1, 2, 4, 8 | 30 of 30 | none |
| 02 | a step: 20 blocks at 0.892 gwei, 20 at 1.120 | as run | 1, 2, 4, 8 | 26 of 30 | 4 at `makeOrder`, level of 4: the node asked 0.019200 ETH (5,000,000 × the level's fee + 0.007) and the customers held 0.018846. The customer's reserve, the second face of the same fault |
| 08 | 0.8976 gwei while the level is funded and its fees are read; 1.5 s later up by 12.5 % and then 1.120 gwei, the two base fees of Hoodi's level of 4 | as run | 4 | 4 of 8 | **4 at `poolDeposit`, each client's second cycle: the node asked 0.010596 ETH and the wallets held 0.010236. The failure of Hoodi** |
| 09 | the same | with the fix | 4 | 8 of 8 | none |
| 03 | the step of 02 | with the fix | 1, 2, 4, 8 | 30 of 30 | none |
| 04 | Hoodi's own, as 01 | with the fix | 1, 2, 4, 8 | 30 of 30 | none |
| 07 | stress: runs of up to five rises or falls of 12.5 %, 0.656 to 1.893 gwei | with the fix | 1, 2, 4, 8 | 30 of 30 | none |
| 05 | Hoodi's own; every ninth pending count answered one block late | funding fixed, `NONCE_TRACKING=0` | 2, 4 | 8 of 12 | **4 with "nonce has already been used"** (2 at `makeOrder`, 2 at `prepareOrder`) |
| 06 | the same | with the fix | 1, 2, 4, 8 | 30 of 30 | none; 5 stale answers met and overridden |
| 13 | plain local node (chain id 31337), `--local` | default path | 1, 2 | 6 of 6 orders, 6 of 6 cycles | none; funding and limits as before (deposit limit 2,000,000, legacy price for the one-time addresses) |

- **Hoodi's base-fee series alone did not reproduce the failure** (01): the failure depends on the block in which a deposit's price is read, and with one block per second the clients' steps fell differently against the series than they had on Hoodi. With the rise placed after the funding (08) the unpatched path fails as on Hoodi, in all four clients, and the patched one passes (09).
- With the fix the deposits went out with limits of 1,023,963 to 1,064,442 gas (the highest in the stress rehearsal 07) and used 853,291 to 878,719. The funding of the 8-client level was 0.61 to 0.62 ETH against 0.45 to 0.50 as run. Spent against the printed estimate: 1.01 (04), 1.02 (06), 1.05 (07): the estimate prices the gas at the base fee of the moment it is printed.
- On the private node ethers reports the node's refusal as "could not coalesce error"; the node's log has the text ("Sender doesn't have enough funds to send tx. The max upfront cost is … and the sender's balance is …"). Geth's text is the one ethers maps to "insufficient funds for intrinsic transaction cost".
- Not rehearsed: 8 clients under the triggered rise; the two fixes on a real public endpoint.

### 10.3 The recovery of what the failed cycles left (done on 2026-10-13, 18:16 to 18:30 UTC)

**The script as it was would have recovered nothing.** (1) It asked the endpoint for all `OrderActors` events of a customer without naming an address; publicnode answers "Please specify an address in your request" (tried read-only on Hoodi with a customer's public address; the second endpoint, drpc, refuses the same query with a message about the block range), so it would have stopped before listing anything. (2) Past that, it cancels an order with gas from the customer or from another wallet of the run, and every wallet of this run was swept down to about 0.00001 ETH by the run's own refund: in the rehearsal of exactly that state it printed "no wallet can cover the gas … skipped" four times and "Recovered: 0.0 ETH in 0 transfers; orders cancelled: 0". Both are fixed (10.1).

```bash
cd benchmarking   # from the root of the repository
export BENCH_NETWORK=hoodi DEPLOYMENT_RECORD=../deployments/hoodi-2026-10-13/deployment.json
# 1. Dry run: reads the wallet file and the chain, sends nothing, reads no funder key.
#    Expected: 6 open orders holding 0.0274624974936 ETH; "Recoverable: 0.0 ETH" for the wallets (dust).
node recover-ephemeral.cjs ephemeral-wallets-hoodi-2026-10-13T10-36-02-836Z.json
# 2. The recovery. SENDS TRANSACTIONS.
GAS_FROM_FUNDER=1 node recover-ephemeral.cjs ephemeral-wallets-hoodi-2026-10-13T10-36-02-836Z.json --yes
```


**Done.** The second command was run from the main session on 2026-10-13, after the owner's authorisation: started 18:16:26 UTC, ended 18:30:37 UTC, exit code 0. Log: `hoodi-2026-10-13/run6-recovery-open-orders.log` (the output of that command; it holds no dry run). It printed "orders cancelled: 6", "Recovered: 0.026653437528625742 ETH in 4 transfers" and "Gas sent by the funder for cancellations: 0.000177969186060732 ETH in 1 transfers". Its transactions were found by reading every block from 3809831 to 3810016 (17:51 to 18:32 UTC) with its transactions and keeping those sent from or to the funder, the establishment, the worker, any of the 156 temporary addresses of the three runs, the contracts or an order: 14 transactions, in blocks 3809966 to 3809992 (18:21:24 to 18:27:00 UTC), with receipts equal on both endpoints.

| # | Block, UTC | Transaction | From (nonce) | To | Type | Gas limit | Gas used | Effective price (gwei) | Value (ETH) | Fee (ETH) |
|---:|---|---|---|---|---:|---:|---:|---:|---:|---:|
| 1 | 3809966, 18:21:24 | gas for the first cancellation | funder `0x82fD…156d` (198) | customer wallet `0x53Df…B9aC` | 0 | 21,000 | 21,000 | 1.4063 | 0.000177969 | 0.000029533 |
| 2 | 3809967, 18:21:36 | `cancelOrder` of order 80 | customer wallet `0x53Df…B9aC` (31) | `Chain` | 2 | 133,986 | 101,959 | 1.4063 | 0.000000000 | 0.000143388 |
| 3 | 3809969, 18:22:12 | gas passed to the next customer wallet | customer wallet `0x53Df…B9aC` (32) | customer wallet `0x38EE…88C3` | 0 | 21,000 | 21,000 | 1.3027 | 0.000164089 | 0.000027357 |
| 4 | 3809970, 18:22:24 | `cancelOrder` of order 55 | customer wallet `0x38EE…88C3` (19) | `Chain` | 2 | 133,986 | 101,959 | 1.3027 | 0.000000000 | 0.000132826 |
| 5 | 3809972, 18:22:48 | `cancelOrder` of order 62 | customer wallet `0x38EE…88C3` (20) | `Chain` | 2 | 133,986 | 101,959 | 1.2855 | 0.000000000 | 0.000131070 |
| 6 | 3809973, 18:23:00 | `cancelOrder` of order 79 | customer wallet `0x38EE…88C3` (21) | `Chain` | 2 | 133,986 | 101,959 | 1.4287 | 0.000000000 | 0.000145670 |
| 7 | 3809975, 18:23:36 | gas passed to the next customer wallet | customer wallet `0x53Df…B9aC` (33) | customer wallet `0xB132…7633` | 0 | 21,000 | 21,000 | 1.2705 | 0.000157527 | 0.000026680 |
| 8 | 3809976, 18:23:48 | `cancelOrder` of order 63 | customer wallet `0xB132…7633` (15) | `Chain` | 2 | 133,986 | 101,959 | 1.2705 | 0.000000000 | 0.000129538 |
| 9 | 3809980, 18:24:36 | gas passed to the next customer wallet | customer wallet `0x53Df…B9aC` (34) | customer wallet `0xD371…2A46` | 0 | 21,000 | 21,000 | 1.3999 | 0.000177089 | 0.000029398 |
| 10 | 3809981, 18:24:48 | `cancelOrder` of order 78 | customer wallet `0xD371…2A46` (15) | `Chain` | 2 | 133,986 | 101,959 | 1.3999 | 0.000000000 | 0.000142731 |
| 11 | 3809986, 18:25:48 | sweep to the funder | customer wallet `0x53Df…B9aC` (35) | funder `0x82fD…156d` | 0 | 21,000 | 21,000 | 1.3165 | 0.004045907 | 0.000027646 |
| 12 | 3809988, 18:26:12 | sweep to the funder | customer wallet `0x38EE…88C3` (22) | funder `0x82fD…156d` | 0 | 21,000 | 21,000 | 1.4608 | 0.013372583 | 0.000030676 |
| 13 | 3809990, 18:26:36 | sweep to the funder | customer wallet `0xB132…7633` (16) | funder `0x82fD…156d` | 0 | 21,000 | 21,000 | 1.2674 | 0.004605733 | 0.000026616 |
| 14 | 3809992, 18:27:00 | sweep to the funder | customer wallet `0xD371…2A46` (16) | funder `0x82fD…156d` | 0 | 21,000 | 21,000 | 1.2570 | 0.004629215 | 0.000026396 |
| | | **14 transactions, all with status 1** | | | | | **779,754** | | | **0.001049526** |

- **What happened, in order.** The funder sent the gas of the first cancellation to the customer wallet `0x53Df…B9aC`, which cancelled its order. That wallet, now holding its order's money, passed the gas of a first cancellation to each of the other three customer wallets in turn, and each cancelled its orders (`0x38EE…88C3` three of them). Then the four wallets sent their balances to the funder.
- **Gas.** Each `cancelOrder` used 101,959 gas: the figure of the 30 cancellations of the first run and of the local gas table. Normalised as in section 5.3 (36 bytes of calldata, 12 zero bytes): 102,103, the constant of that section, in all six. The gas limit was 133,986, i.e. 1.2 × the estimate of 111,655 that this section had read before the run.
- **Prices.** The script sends at `eth_gasPrice` × 1.3 and no tip of its own. The eight transfers are legacy transactions (type 0) at 1.257 to 1.461 gwei. The six cancellations are of type 2 with the maximum fee and the maximum priority fee both set to that price, so they paid it in full: 1.270 to 1.429 gwei in blocks whose base fee was 0.904 to 1.032 gwei, i.e. 0.261 to 0.524 gwei above the base fee, where the benchmark's runs paid 0.2 gwei above it.
- **The orders** (read from both endpoints, equal):

| Order (index) | Customer's temporary wallet | Before, block 3809965: state, ETH held | At block 3810028: state, ETH held |
|---|---|---|---|
| `0x5f457eBC9e7d838a6d741c04E6a15aD2b7065837` (55) | `0x38EE…88C3` | ORDERED, 0.004433607 | CANCELED BY CLIENT, 0 |
| `0x9d11ff1EC7A88Cc11c49744772f24649f1093112` (62) | `0x38EE…88C3` | ORDERED, 0.004594320 | CANCELED BY CLIENT, 0 |
| `0xF26BcBc14b5Ca5cC1C75542340d4BB3426fb8bA9` (63) | `0xB132…7633` | ORDERED, 0.004594320 | CANCELED BY CLIENT, 0 |
| `0xD8Bf6cCd2f416485439Ce91F8035E7656843304B` (78) | `0xD371…2A46` | ORDERED, 0.004613417 | CANCELED BY CLIENT, 0 |
| `0x80bcF90ce57921B14326fED72Cc4B955bEB07074` (79) | `0x38EE…88C3` | ORDERED, 0.004613417 | CANCELED BY CLIENT, 0 |
| `0x0720B928Fd67B7a827867f6678e5479797566576` (80) | `0x53Df…B9aC` | ORDERED, 0.004613417 | CANCELED BY CLIENT, 0 |
| **Six orders** | four wallets | **0.027462497** | **0** |

- **The money.** The six orders returned 0.027462497 ETH to the four customer wallets, which held 0.000044097 ETH before. The wallets paid 0.001019993 ETH of fees (six cancellations, three transfers between them, four sweeps), sent 0.026653438 ETH to the funder and keep 0.000011133 ETH (the sweep leaves 1.1 × the fee of its own transfer and sends the rest; the log's line per wallet prints the balance before that deduction, its total the sum actually sent). The funder had sent 0.000177969 ETH and paid 0.000029533 ETH for that transfer: **net +0.026445935 ETH**, which is the change of the funder's balance between block 3809965 and block 3809992 to the wei (6.875248 to 6.901694 ETH). What the orders held minus what came back, 0.001016562 ETH, is the fees of the 14 transactions, 0.001049526 ETH, less the 0.000032964 ETH by which the four wallets' dust went down.
- **Against what this section expected:**

| | Expected in this section before the run | Measured |
|---|---|---|
| Transactions | about 14, 1 from the funder | 14, 1 from the funder (its nonce 198) |
| Gas sent by the funder for the first cancellation | about 0.00020 ETH at 1.50 gwei | 0.000177969 ETH at 1.406 gwei; fee of the transfer 0.000029533 ETH |
| Gas passed between temporary customer wallets | up to 3 transfers, about 0.0002 ETH each | 3 transfers, 0.000158 to 0.000177 ETH |
| `cancelOrder` | 6, estimate 111,655 gas, 101,959 used in the first run; fees about 0.00092 ETH | 6, limit 133,986 (the estimate × 1.2), 101,959 gas used each; fees 0.000825224 ETH |
| Returned by the orders to the four wallets | 0.027462497 ETH | 0.027462497 ETH (the six orders hold 0 now) |
| Sweep to the funder | 4 transfers | 4 transfers, 0.026653438 ETH |
| Back to the funder, net of the gas it sent | about 0.0263 ETH | **0.026445935 ETH** (96.30 % of what the orders held; the rehearsal: 95.4 %) |
| Fees | about 0.0012 ETH at that price | 0.001049526 ETH |
| Duration | about 10 minutes | 14 minutes for the command; 5.6 minutes from the first to the last transaction |

- **The two fixes on the real endpoint.** The log has "orders read from Chain's registry: 110 (the endpoint refused the log query by customer: could not coalesce error)": the path of fix (2) of section 10.1. No wallet of the run could pay a cancellation, and the funder's key was used for one transfer: fix (1).
- **The other 88 addresses of the file** were skipped as dust, as expected: their balances and nonces at block 3810028 are those of 11:54 UTC (read for all 92; only the four customer wallets changed).
- **Not part of the recovery, and not touched:** the 0.056822 ETH at the ten one-time addresses of the sequential privacy run (their unused gas money; `RECOVER_TO=<address> node recover-ephemeral.cjs ephemeral-wallets-privacy-run-hoodi-2026-10-13T09-29-09-980Z.json`, 10 transfers, rehearsed by the readiness task) and the revenue notes in the pool, 0.285134 ETH after the repeat (a cash-out, not in the authorised package). Section 11.3. Both were taken out later the same day (section 13).
- **The preparation, as written before the run:** the second command was expected to send about 14 transactions, 1 from the funder (its real key, nonce 153 then, 198 after the repeat), at legacy `eth_gasPrice` × 1.3; the dry run on Hoodi was not done by the task that prepared it, because it reads the wallet file, which that task did not open; the six orders, their balances and the estimates were read from the chain with the public addresses. Rehearsed on the private node on the leftovers of rehearsal 08 and of a second run of it (four orders in ORDERED holding 0.016612 ETH, every wallet at 0.000009 ETH): the dry run lists the four orders; `--yes` alone recovers nothing; with `GAS_FROM_FUNDER=1` four orders cancelled, 0.016059 ETH swept in 4 transfers, 1 transfer of 0.000179 ETH from the funder, funder's balance +0.015851 ETH (95.4 % of what the orders held); again through a proxy that refuses log queries without an address, where the script took the orders from the registry: 0.016102 ETH swept. A key that is not the funder's is refused before anything is sent.

**Time limit of this command (history).** On the public endpoint the script reads each order's events from the deploy block to the latest block in one query, and the endpoint refuses ranges above 50,000 blocks. From deploy block 3807607 that is reached about 7.7 days after the deployment, around 2026-10-21: after that the command stops before sending anything and recovers nothing, unless the script is changed to query in ranges (found by the independent check). The recovery ran eight days before that limit. Nothing is left for this command to recover: none of the 110 orders of the deployment is open, and the repeat left no open order.

### 10.4 A repeat of the cycle workload alone, with the fix (run on 2026-10-13, 17:19 to 17:51 UTC)

**Run.** The last command below (`--yes`) was run from the main session after the owner's authorisation, with `ETH_USD=2506.245` and `ETH_USD_AT=2026-10-13T17:18:44Z`; log `hoodi-2026-10-13/run5-concurrency-cycle-repeat.log`, exit code 0. The log holds that command's output, which begins with the estimate; whether the two read-only commands before it were run is not in the log. Results in sections 8 and 8.1, the fix in 9.4, the transactions in 11.1. Against what this section expected (the text after the table is the preparation as written before the run):

| | Expected | Measured |
|---|---|---|
| First lines of the run | `Funding: with room for a moving base fee … nonces: kept per sender` | as expected |
| Cycles | 30, none failing from the two causes of section 9 | 30 of 30, no failed unit, no refusal |
| Estimate printed by the run | 0.29 to 0.30 ETH | 0.302926 ETH |
| Spent by the funder | 0.30 to 0.32 ETH | 0.310875 ETH |
| Funder's outlay at the largest top-up | about 0.79 to 0.82 ETH (the run printed 0.756962) | 0.908774 ETH after the last funding transfer; refunded 0.597899 ETH afterwards |
| Transactions | 330 calls, up to 45 funding transfers (nonces from 153), 54 refunds: about 430 | 330 + 45 (nonces 153 to 197) + 54 = 429, all with status 1 |
| Duration | about 40 minutes | 32 minutes |
| Orders, notes | indices 81 to 110; leaves 105 to 194; leaf 127 opens a level | as expected; leaf 127 was inserted by a `poolWithdraw` |
| Wallet file | a new `ephemeral-wallets-hoodi-<time>.json` | `ephemeral-wallets-hoodi-2026-10-13T17-19-28-266Z.json` |
| "Sweep aborted" | a reason to stop | not printed |


```bash
cd benchmarking   # from the root of the repository
export BENCH_NETWORK=hoodi DEPLOYMENT_RECORD=../deployments/hoodi-2026-10-13/deployment.json
export PRIORITY_FEE_GWEI=0.2 ORDER_TOTAL_WEI=6000000000000000 RESULTS_DIR=results/hoodi-2026-10-13
export ETH_USD=<rate> ETH_USD_SOURCE="Coinbase spot price API, api.coinbase.com/v2/prices/ETH-USD/spot" ETH_USD_AT=<ISO time>   # read again
node hoodi-preflight.cjs                                   # read-only; must end with "Nothing found against sending"
WORKLOAD=cycle node benchmark-concurrent-sepolia.js        # the estimate; sends nothing
WORKLOAD=cycle node benchmark-concurrent-sepolia.js --yes  # SENDS TRANSACTIONS: 1, 2, 4, 8 clients, 2 cycles each
```

- Its first lines must say `Funding: with room for a moving base fee … nonces: kept per sender`. `FUNDING_ROOM` and `NONCE_TRACKING` need not be set.
- **Estimate** (the script's own, printed without the network and without a key: `--estimate-only` with `GAS_PRICE_GWEI=1.07 FEE_CAP_GWEI=2.2`, and again with 1.20): gas 0.159 to 0.178 ETH + 0.124 to 0.133 ETH locked in the pool as 30 revenue notes = **0.29 to 0.30 ETH by the estimate, which prices gas at `eth_gasPrice`; expect 0.30 to 0.32 ETH, since the transactions pay base fee + 0.2 gwei**; the funder needs about 0.79 to 0.82 ETH at the largest top-up (peak funding of the 24 wallets of the 8-client level 0.66 to 0.68 ETH, refunded) and holds 7.186 ETH. The rehearsals with the fix spent 0.308 to 0.317 ETH. The Hoodi run spent 0.338 ETH on both workloads.
- **Transactions:** 330 for the 30 cycles (11 each), up to 45 funding transfers from the funder (the real key, nonces from 153, or 154 after a recovery), 54 refund transfers: about 430. About 40 minutes.
- **What it adds to the chain:** 30 orders (indices 81 to 110), 90 notes on leaves 105 to 194. Leaf 127 opens a level (+17,100 gas for the call that inserts it); the rest follows section 5.2. A new wallet file `ephemeral-wallets-hoodi-<time>.json`.
- **Stop** if the estimate printed by the second command is far from 0.30 ETH expected and 0.8 ETH needed, if the first lines do not name the funding with room, or if the run prints "Sweep aborted". A failed unit no longer comes from the two causes of section 9; if one fails, its order stays open as now and the recovery of 10.3 applies with the new wallet file.
- The repeat gives complete cycle rows for section 8. It does not change any gas figure of sections 2 to 5: those are complete.

## 11. What was sent

The package was sent from the main session with the commands of the readiness report (the logs are in `deployments/hoodi-2026-10-13/` and `hoodi-2026-10-13/`): `hoodi-fund.cjs --yes` (two transfers), `scripts/deploy_all.js` and `scripts/deploy_no_privacy.js` once each, `benchmark-privacy.js` (twice, the second time with `--mechanisms-off`), `benchmark-no-privacy.js` and `benchmark-concurrent-sepolia.js --yes`. This task sent nothing. **The tables of this section down to "Budget" are the package as it stood at 11:54 UTC; the repeat and the recovery, sent later the same day, are in 11.1, the whole measurement up to the recovery in 11.2 and what remains on Hoodi in 11.3.** The cash-out, sent after them, is in section 13, with the totals of the whole campaign in 13.9. Every transaction the three accounts ever sent on Hoodi was read back by nonce (all three had nonce 0 before the package); other networks were not looked at:

| Account | Nonces | What | Transactions | Value sent (ETH) | Fees (ETH) |
|---|---|---|---:|---:|---:|
| deployer, customer, funder `0x82fD…156d` | 0 to 1 | the two authorised transfers (0.2 and 0.05 ETH) | 2 | 0.250000000 | 0.000050115 |
| deployer, customer, funder `0x82fD…156d` | 2 to 12 | deployment (9 + 2 transactions) | 11 | 0.000000000 | 0.019813990 |
| deployer, customer, funder `0x82fD…156d` | 13 to 52 | privacy run | 40 | 0.070000000 | 0.016100195 |
| deployer, customer, funder `0x82fD…156d` | 53 to 72 | baseline (b) run | 20 | 0.070000000 | 0.005858466 |
| deployer, customer, funder `0x82fD…156d` | 73 to 92 | baseline (a) run | 20 | 0.070000000 | 0.005407043 |
| deployer, customer, funder `0x82fD…156d` | 93 to 152 | concurrency run: funding transfers to its 32 temporary wallets | 60 | 0.950377087 | 0.001480283 |
| establishment `0xEd27…b9E7` | 0 to 9 | privacy run | 10 | 0.059066535 | 0.010438727 |
| establishment `0xEd27…b9E7` | 10 to 39 | baseline (b) run | 30 | 0.010000000 | 0.002892471 |
| establishment `0xEd27…b9E7` | 40 to 69 | baseline (a) run | 30 | 0.010000000 | 0.002751798 |
| worker `0xb89b…8EE2` | 0 to 19 | privacy run | 20 | 0.000000000 | 0.014221437 |
| worker `0xb89b…8EE2` | 20 to 39 | baseline (b) run | 20 | 0.000000000 | 0.003963422 |
| worker `0xb89b…8EE2` | 40 to 59 | baseline (a) run | 20 | 0.000000000 | 0.002472448 |

Deployer 153 transactions (nonces 0 to 152), establishment 70 (0 to 69), worker 60 (0 to 59): no gap, no failed transaction, **nothing but the authorised package** (the state at 11:54 UTC; the deployer's nonces 153 to 198 are in 11.1). No other address sent a transaction to the deployed contracts or to an order in the window (checked over all 16,879 transactions of blocks 3807590 to 3808092).

The other senders of the package:

| Senders | Transactions | Fees (ETH) | |
|---|---:|---:|---|
| 10 one-time addresses of the sequential privacy run | 40 | 0.016641859 | withdrawal, `prepareOrder`, `pickupOrder`, rating; in the result file |
| 32 temporary wallets and 60 one-time addresses of the concurrency run: the units' calls | 338 | 0.194281525 | in the raw file; all read back |
| the same: cancellations of the ordering workload | 30 | 0.003703506 | not in the raw file; read from the chain |
| the same: refund transfers to the funder | 92 | 0.002307405 | 0.613959791 ETH returned; read from the chain |
| **All senders of the package** | **783** | | all of type 2, all with status 1 |

**Balances** (read from the chain at the block before the first transfer and after the last transaction; unchanged at block 3808246, 11:54 UTC, on both endpoints, pending nonce equal to the latest):

| Account | Transactions | Before (ETH) | After the transfers | After the deployments | After the privacy run | After baseline (b) | After baseline (a) | After the concurrency run | Change (ETH) |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| deployer, customer, funder `0x82fD…156d` | 153 | 8.031250 | 7.781200 | 7.761386 | 7.675286 | 7.599427 | 7.524020 | **7.186123** | -0.845127388 |
| establishment `0xEd27…b9E7` | 70 | 0.000000 | 0.200000 | 0.200000 | 0.130495 | 0.187602 | 0.244850 | **0.244850** | +0.244850469 |
| worker `0xb89b…8EE2` | 60 | 0.000000 | 0.050000 | 0.050000 | 0.045779 | 0.051815 | 0.059343 | **0.059343** | +0.059342693 |
| **The three together** | 283 | 8.031250 | | | | | | 7.490316 | -0.540934227 |

**Where the 0.540934 ETH went** (every line read from the chain; the lines add up to the change with nothing left over):

| | ETH | USD | |
|---|---:|---:|---|
| Fees of all 783 transactions | 0.302384691 | 758.74 | deployment 0.019814; the three sequential runs 0.080748; the concurrency run 0.201773; the two transfers 0.000050 |
| In the payment pool | 0.153309162 | 384.68 | 34 revenue notes: 10 of the sequential run (0.045602616) and 24 of the concurrency run (0.107706546) |
| At the 10 one-time addresses of the sequential privacy run | 0.056822061 | 142.58 | their unused gas money (stipend and funding withdrawal); the benchmark has no gas return |
| In the six open orders | 0.027462497 | 68.91 | section 9.3 |
| Dust at the 92 addresses of the concurrency run | 0.000955816 | 2.40 | |
| **Sum** | **0.540934227** | 1357.31 | |

- **The pool, checked.** 35 deposits (0.208252507 ETH) and 35 withdrawals of the same sum; what remains is what the 34 concluded orders with a payment commitment paid in at delivery, total − stipend + fee each, and their sum equals the pool's balance to the wei. The note tree has 105 leaves: the dummy note, 30 of the sequential run, 74 of the concurrency run.
- **Where the secrets are** (file names only; neither file was opened by this task; both are git-ignored, mode 0600, in `benchmarking/`): `ephemeral-wallets-privacy-run-hoodi-2026-10-13T09-29-09-980Z.json` holds the notes and the ten one-time keys of the sequential privacy run (the script's own check at the end of the run: 11 unspent notes found in the tree, 0 not found, 0 created but not inserted; unspent 0.0456026158456 ETH, the pool's share above); `ephemeral-wallets-hoodi-2026-10-13T10-36-02-836Z.json` holds the 32 temporary wallets, the 60 one-time keys and the notes of the concurrency run (by the script's design; not checked).
- **Unlike on Sepolia, the sequential run's notes can be withdrawn:** the script now keeps their secrets. A cash-out is not part of the authorised package and was not sent. (It was authorised and sent later the same day: section 13.)
- **Budget.** Estimated for the whole package by the readiness report: the deployer ends at about 7.16 ETH, the establishment at about 0.244, the worker at about 0.059. Measured: 7.186123, 0.244850, 0.059343. The concurrency run spent 0.337898 ETH against an estimate of 0.348526.

### 11.1 The repeat and the recovery

Both were sent from the main session, each after the owner's authorisation (as the main session states it to this task; the authorisations themselves are not a record this task can read): the repeat with the commands of section 10.4, the recovery with the second command of section 10.3. The task that updated this file sent nothing.

| Senders | Nonces | What | Transactions | Value sent (ETH) | Fees (ETH) |
|---|---|---|---:|---:|---:|
| deployer, customer, funder `0x82fD…156d` | 153 to 197 | repeat: funding transfers to its 24 temporary wallets | 45 | 0.907645300 | 0.001128550 |
| 24 temporary wallets and 30 one-time addresses of the repeat | | repeat: the 330 calls of the 30 cycles | 330 | | 0.175927037 |
| the same | | repeat: refund transfers to the funder | 54 | 0.597899204 | 0.001346308 |
| **Repeat** | | | **429** | | **0.178401895** |
| deployer, customer, funder `0x82fD…156d` | 198 | recovery: gas for the first cancellation | 1 | 0.000177969 | 0.000029533 |
| four temporary customer wallets of the first concurrency run | | recovery: `cancelOrder` of the six orders | 6 | 0.000000000 | 0.000825224 |
| the same | | recovery: gas passed from one to the next | 3 | 0.000498705 | 0.000083436 |
| the same | | recovery: sweep to the funder | 4 | 0.026653438 | 0.000111334 |
| **Recovery** | | | **14** | | **0.001049526** |

- **The funder's nonces 153 to 198 are these 46 transfers and nothing else:** 45 plain transfers to the 24 temporary wallets of the repeat's raw file and one to a customer wallet of the first run, no contract call, none failed. Its nonce is 199 now (latest and pending, both endpoints). The establishment and the worker sent nothing after the package: nonces 70 and 60, balances unchanged to the wei.
- **No other sender.** Blocks 3809670 to 3809838 (169 blocks, 5,903 transactions) and 3809831 to 3810016 (186 blocks, 7,002 transactions) were read in full: no address other than the run's own sent a transaction to the deployed contracts or to an order, and after the repeat's last refund the only transactions from or to any address of the measurement are the 14 of the recovery.
- **Between the package and the repeat** (blocks 3808093 to 3809669, 11:18 to 17:16 UTC) the blocks were not read in full. At block 3809684 the three accounts' nonces and balances, the pool's balance and `Chain`'s order count (80) were those of block 3808246 (11:54 UTC), and at block 3810028 the balance and nonce of 98 of the 102 temporary addresses of the package are those of 11:54 UTC, the other four being the customer wallets of the recovery.
- **Types and prices.** The 429 transactions of the repeat are of type 2 and paid the base fee of their block plus 0.2 gwei, every one. The recovery sent 8 legacy transfers and 6 type-2 cancellations at `eth_gasPrice` × 1.3 (section 10.3).
- **Cost of a cycle in the repeat, per party** (the script's figures, mean of the 30 cycles, each transaction at its own price; USD at the repeat's own rate, 2506.245 USD per ETH, Coinbase spot price API, read at 2026-10-13T17:18:44Z):

| Party | Transactions per cycle | Gas per cycle | ETH per cycle | USD per cycle |
|---|---:|---:|---:|---:|
| customer | 4 | 1,357,619.4 | 0.001653754 | 4.14 |
| establishment (own wallet) | 1 | 860,232.2 | 0.001055829 | 2.65 |
| establishment (one-time address) | 4 | 1,382,352.7 | 0.001681943 | 4.22 |
| worker | 2 | 1,235,400.8 | 0.001472709 | 3.69 |
| **all parties** | 11 | **4,835,605.2** | **0.005864235** | **14.70** |

### 11.2 The whole measurement, by step and by account

Everything sent on Hoodi for this measurement up to the recovery (the state at 18:35 UTC; the cash-out added 47 transactions, and section 13.9 brings the totals up to date: 1,273 transactions): **1,226 transactions, all with status 1**, 329 from the three accounts and 897 from temporary wallets and one-time addresses.

| Step | UTC | Transactions of the three accounts | Transactions of temporary and one-time addresses | Fees of the step (ETH) | Change of the three accounts together (ETH) | Of the change, not fees (ETH) |
|---|---|---:|---:|---:|---:|---|
| The two transfers to the establishment and the worker | 09:24 | 2 | 0 | 0.000050115 | −0.000050115 |  |
| Deployment (9 + 2 transactions) | 09:25 to 09:28 | 11 | 0 | 0.019813990 | −0.019813990 |  |
| Privacy run, 10 cycles | 09:29 to 10:01 | 70 | 40 | 0.057402218 | −0.159826895 | at the ten one-time addresses 0.056822; in the pool 0.045603 |
| Baseline (b) run, 10 cycles | 10:01 to 10:18 | 70 | 0 | 0.012714358 | −0.012714358 |  |
| Baseline (a) run, 10 cycles | 10:18 to 10:35 | 70 | 0 | 0.010631289 | −0.010631289 |  |
| Concurrency run (30 orders, 24 of 30 cycles) | 10:35 to 11:14 | 60 | 460 | 0.201772719 | −0.337897578 | in the pool 0.107707; in the six orders 0.027462; dust 0.000956 |
| **Repeat of the cycle workload (30 of 30 cycles)** | 17:19 to 17:51 | 45 | 384 | 0.178401895 | −0.310874646 | in the pool 0.131825; dust 0.000648 |
| **Recovery of the six open orders** | 18:16 to 18:30 | 1 | 13 | 0.001049526 | +0.026445935 | out of the six orders 0.027462; dust −0.000033 |
| **Whole measurement** | | **329** | **897** | **0.481836112** | **−0.825362937** | |

- The fees of a step are those of all its senders. The change of the three accounts is what they hold less (or, in the recovery, more) after the step: fees, plus what the step left outside the three accounts, minus what it brought back. The last column names that part; the lines of each row add up.

| Account | Transactions (nonce now) | Before (ETH) | After the package | After the repeat (block 3809830) | After the recovery (block 3809992) | At block 3810028, 18:35 UTC | Change (ETH) |
|---|---:|---:|---:|---:|---:|---:|---:|
| deployer, customer, funder `0x82fD…156d` | 199 | 8.031250 | 7.186123 | 6.875248 | 6.901694 | **6.901694** | −1.129556098 |
| establishment `0xEd27…b9E7` | 70 | 0.000000 | 0.244850 | 0.244850 | 0.244850 | **0.244850** | +0.244850469 |
| worker `0xb89b…8EE2` | 60 | 0.000000 | 0.059343 | 0.059343 | 0.059343 | **0.059343** | +0.059342693 |
| **The three together** | 329 | 8.031250 | 7.490316 | 7.179441 | 7.205887 | **7.205887** | −0.825362937 |

**Where the 0.825363 ETH went** (every line read from the chain at block 3810028, 18:35 UTC, on both endpoints; the lines add up to the change with nothing left over):

| | ETH | |
|---|---:|---|
| Fees of all 1,226 transactions | 0.481836112 | the package 0.302384691 (758.74 USD at 2509.195); the repeat 0.178401895 (447.12 USD at 2506.245, its own rate); the recovery 0.001049526 (no rate was read for it) |
| In the payment pool | 0.285134337 | 64 revenue notes: 10 of the sequential run (0.045602616), 24 of the first concurrency run (0.107706546), 30 of the repeat (0.131825175) |
| At the 10 one-time addresses of the sequential privacy run | 0.056822061 | their unused gas money, unchanged since 11:54 UTC |
| In open orders | 0.000000000 | the six orders were cancelled (section 10.3); the 110 orders of `Chain` hold nothing |
| Dust at the 92 addresses of the first concurrency run | 0.000922852 | was 0.000955816; the four customer wallets of the recovery hold less than before |
| Dust at the 54 addresses of the repeat | 0.000647576 | at most 0.000013 each |
| **Sum** | **0.825362937** | the change of the three accounts, with nothing left over |

### 11.3 What remains on Hoodi, and where its secrets are

**After the cash-out** (read at block 3810706, 2026-10-13, 21:06 UTC, on both endpoints, equal; section 13):

| Where | ETH | What it is | What would move it | Secrets, by file name |
|---|---:|---|---|---|
| Payment pool `0x2785…681f` | 0 | all 64 revenue notes were paid out; the note tree has 232 leaves and no unspent note with value | nothing | none needed any more |
| The ten one-time addresses of the sequential privacy run | 0.000028568 | dust left by the sweep, a tenth of a transfer fee each, at most 0.000003101; nonce 5 each | nothing: less than the fee of a transfer | `ephemeral-wallets-privacy-run-hoodi-2026-10-13T09-29-09-980Z.json` |
| 92 addresses of the first concurrency run | 0.000922852 | dust, at most 0.000013 each, unchanged since 18:35 UTC | nothing: less than the fee of a transfer | `ephemeral-wallets-hoodi-2026-10-13T10-36-02-836Z.json` |
| 54 addresses of the repeat | 0.000647576 | dust, at most 0.000013 each, unchanged since 18:35 UTC | nothing | `ephemeral-wallets-hoodi-2026-10-13T17-19-28-266Z.json` |
| Orders, `Chain`, `Storage`, `StealthAnnouncer` and the other deployed contracts | 0 | the 110 orders hold nothing; their states, read again at block 3810858 (21:42 UTC), are those of 18:35 UTC, 74 CONCLUDED and 36 CANCELED BY CLIENT; no transaction reached them in the blocks read after 18:35 UTC (sections 13.10 and 13.12) | | |
| The three accounts | 7.498112 | funder 7.104933 (nonce 226), establishment 0.333836 (nonce 80), worker 0.059343 (nonce 60) | | the owner's own configuration; not read |

- **Nothing of value depends on a secrets file any more.** The 64 notes are spent and the ten addresses are swept. That every note could be proved and every address could sign also shows what the lines below could only state from the scripts' design: the three wallet files held the secrets of all 64 notes and the ten one-time keys.
- **The files that hold secrets now** (in `benchmarking/`; names, sizes and modes were listed, none was opened by this task): the three wallet files named above, still of mode 0600, which now guard only the keys of 156 addresses with dust; and two files that the tool of the third part of the cash-out left beside them: `ephemeral-wallets-privacy-run-hoodi-2026-10-13T09-29-09-980Z.cashout-kinds.json` (mode 0600, 15,291 bytes, git-ignored by the same rule as the wallet files; by the tool's description it holds the frozen plan of the ten steps and the secrets of their change notes, of which the six that held value are all spent) and `ephemeral-wallets-privacy-run-hoodi-2026-10-13T09-29-09-980Z.cashout-kinds.json.lock` (mode 0600, 4 bytes, git-ignored by the rule `benchmarking/*`; a lock file, which holds no secret: the tool writes its process number into it while it runs and the word "free" when it ends; it holds "free", as one of the two checks of section 13.12 and the task that applied their corrections each read, so no run holds it). A second copy of the state file, of the same size, is kept with the copies of the three wallet files in a local records folder outside the repository. All of them should stay out of the repository.
- **The dApps** still point to the Sepolia deployment: the md5 of the three `config.js` files is `0ea32ea6efcc7dfcdacba9ab4f2cc7a3`, as before.

**The state at 18:35 UTC, before the cash-out** (the rest of this section, kept as it was written): read at block 3810028 (2026-10-13, 18:35 UTC) on both endpoints, equal. **None of it was touched by the repeat or by the recovery.**

| Where | ETH | What it is | What would move it | Secrets, by file name |
|---|---:|---|---|---|
| Payment pool `0x2785…681f`: 10 revenue notes of the sequential privacy run | 0.045602616 | total − stipend + fee of each concluded order | a cash-out (not sent, not in any authorised package) | `ephemeral-wallets-privacy-run-hoodi-2026-10-13T09-29-09-980Z.json` |
| The same: 24 revenue notes of the first concurrency run | 0.107706546 | the same | the same | `ephemeral-wallets-hoodi-2026-10-13T10-36-02-836Z.json` |
| The same: 30 revenue notes of the repeat | 0.131825175 | the same | the same | `ephemeral-wallets-hoodi-2026-10-13T17-19-28-266Z.json` |
| **The pool's balance** | **0.285134337** | the three lines, equal to the balance to the wei; 195 leaves in the note tree | | |
| The ten one-time addresses of the sequential privacy run | 0.056822061 | unused gas money (stipend and funding withdrawal), at most 0.006149 each, nonce 4 each | a sweep (`RECOVER_TO=<address> node recover-ephemeral.cjs <file>`; not sent) | `ephemeral-wallets-privacy-run-hoodi-2026-10-13T09-29-09-980Z.json` |
| 92 addresses of the first concurrency run | 0.000922852 | dust, at most 0.000013 each | nothing: less than the fee of a transfer | `ephemeral-wallets-hoodi-2026-10-13T10-36-02-836Z.json` |
| 54 addresses of the repeat | 0.000647576 | dust, at most 0.000013 each | nothing | `ephemeral-wallets-hoodi-2026-10-13T17-19-28-266Z.json` |
| Orders, `Chain`, `Storage`, `StealthAnnouncer` | 0 | the 110 orders are 74 CONCLUDED and 36 CANCELED BY CLIENT | | |
| The three accounts | 7.205887 | funder 6.901694 (nonce 199), establishment 0.244850 (nonce 70), worker 0.059343 (nonce 60) | | the owner's own configuration; not read |

- **The pool, checked again.** Over the repeat: 30 deposits (0.187184588 ETH) and 30 withdrawals of the same sum; the pool's balance rose from 0.153309162 to 0.285134337 ETH, by the revenue of the 30 concluded orders to the wei. Since the deployment: 65 deposits and 65 withdrawals; what remains is what the 64 concluded orders with a payment commitment paid in at delivery. The note tree has 195 leaves: the dummy note, 30 of the sequential run, 74 of the first concurrency run, 90 of the repeat.
- **Where the secrets are.** Three files in `benchmarking/`, git-ignored (`benchmarking/**/ephemeral-wallets-*.json` in `.gitignore`) and of mode 0600, with second copies of the same sizes in a local records folder outside the repository (a directory of mode 0700, files 0600): `ephemeral-wallets-privacy-run-hoodi-2026-10-13T09-29-09-980Z.json` (the notes and the ten one-time keys of the sequential privacy run), `ephemeral-wallets-hoodi-2026-10-13T10-36-02-836Z.json` (the 32 temporary wallets, the 60 one-time keys and the notes of the first concurrency run) and `ephemeral-wallets-hoodi-2026-10-13T17-19-28-266Z.json` (the 24 temporary wallets, the 30 one-time keys and the notes of the repeat). Names, sizes and modes were listed; **none of the three was opened by the task that wrote this**, so what each holds is stated from the scripts' design and, for the first, from the script's own check at the end of its run. Without these files the 0.341956 ETH cannot be moved.
- **The dApps** point to the Sepolia deployment and were not touched: the md5 of the three `config.js` files is `0ea32ea6efcc7dfcdacba9ab4f2cc7a3`, as before the package.

## 12. Read back from the chain

All blocks 3807590 to 3808092 (503 blocks, 16,879 transactions) were read with their transactions from `ethereum-hoodi-rpc.publicnode.com` and their receipts from that endpoint and from `hoodi.drpc.org`; the two sets of receipts agree in every transaction (gas used, status, sender, block, effective gas price, number of logs; block hashes equal). Read-only: no key, no `eth_send*`.

- Privacy: all 110 receipts of the result file; 110 equal in gas used, status 1, block, sender, effective gas price and gas limit.
- Baseline (b): all 70; 70 equal. Baseline (a): all 70; 70 equal.
- Concurrency: all 338 transactions the raw file marks successful; 338 equal in the same six fields. The six failed steps have no hash in the raw file and no transaction on the chain: the nonces of each of their senders are gapless, and the nonce after the last mined step is a later successful transaction (a deposit of the next level, or the run's refund transfer).
- Deployment: 9 + 2 transactions of the two records; all equal, and each created the recorded address. The two transfers of `fund.log`: equal (blocks 3807597 and 3807598, 21,000 gas each).
- Not in any result file and read from the chain: the 30 cancellations, the 60 funding and 92 refund transfers of the concurrency run.
- Leaf indices: the `NoteAdded` event of each of the 104 inserting transactions. Calldata bytes and the signature byte: from the transactions. Stipends, order addresses, one-time addresses: from the calldata and the events of `makeOrder` and of the announcements.
- Balances at earlier blocks (the failed wallets at the block of the refusal, the accounts between the runs): `hoodi.drpc.org`, which keeps historical state; publicnode does not. Order states and present balances: both endpoints.
- Fork: `eth_config` on both endpoints after the package: fork id `0x23aa1351`, activation 1762955544, no next fork.
- **The repeat** (read by the task that was stopped before editing, from blocks 3809670 to 3809838 with receipts from both endpoints, no receipt differing): all 330 transactions of the raw file equal on the chain in gas used, status 1, block, sender, effective gas price, gas limit and type; the 45 funding transfers and the 54 refunds, which are in no result file; the `NoteAdded` event of each of the 90 inserting transactions; the states of the 30 orders. Checked again by this task: 33 of the 330 transactions drawn at random, their receipts and calldata read again from both endpoints (33 equal, 7 of them with a leaf index), the funder's balance and nonce before, during and after the repeat, and the normalisation of all 330 calls with code of its own (330 on the constants of section 5.3).
- **The recovery**: blocks 3809831 to 3810016 read in full from `ethereum-hoodi-rpc.publicnode.com` with receipts from both endpoints (7,002 transactions, no receipt differing); its 14 transactions are in no result file and were found by their senders and recipients (section 10.3).
- **State at 18:35 UTC** ("now" when this line was written): block 3810028, both endpoints, equal: the three accounts (latest and pending nonce), the pool, the 110 orders (state and balance of each), the 156 temporary and one-time addresses of the three runs (balance and nonce of each). Fork id `0x23aa1351`, no next fork.
- **The cash-out** (section 13.10; read by the task that wrote section 13, with scripts of its own): the 37 withdrawals by the hashes of the tools' five result files, transaction and receipt from `ethereum-hoodi-rpc.publicnode.com` and the receipt again from `hoodi.drpc.org` (no receipt differing); 912 comparisons with the tools' files (status, block, sender, nonce, gas used, price, fee, calldata bytes and zero bytes, limits, the `NoteAdded` leaf, the `MergeWithdrawal` recipient and amount), none different. Blocks 3810029 to 3810697 (669 blocks, 20,165 transactions) read in full: the 47 transactions of the cash-out, among them the ten sweep transfers, which are in no result file, and no other transaction from or to an address of the measurement.
- **State after the cash-out**: block 3810706 (21:06 UTC), both endpoints, equal: the three accounts (latest and pending nonce), the pool (0 wei, 232 leaves, the root), the 156 temporary and one-time addresses, the 110 orders and the other contracts (balance and nonce of each), the spent flags of the 70 nullifier hashes of the cash-out. Fork id `0x23aa1351`, no next fork.
- `eth_getLogs` over several addresses was refused during this update by publicnode ("Request blocked") and, for most ranges, by drpc ("ranges over 10000 blocks are not supported on free plan"): where this file says that nothing else happened, it rests on blocks read in full or on balances, nonces and counters, not on a log query. A log query over the pool's address alone was answered by publicnode, for the whole range since the deployment: the checks of section 13.12 used it.

## 13. The cash-out (2026-10-13, 19:33 to 20:58 UTC)

After the recovery the payment pool still held the 64 revenue notes of the three runs, 0.285134 ETH, and the ten one-time addresses of the sequential privacy run held 0.056822 ETH of unused gas money (section 11.3). Both were taken out the same day, as a measurement of what a cash-out costs on a public network with the main network's gas schedule: **37 `mergeWithdraw` transactions and 10 plain transfers, all with status 1, none refused, none reverted.** The pool holds 0 wei now. Every figure of this section was read from the chain by the task that wrote it (section 13.10) and compared with the result files of the tools; where a line is a model's figure, a local figure or a computed one, it says so.

### 13.1 What was done

`GlobalReputation.mergeWithdraw` spends up to two notes of the pool, pays an amount to a recipient and inserts a change note; a Groth16 proof binds the recipient, the amount and the change. The withdrawals were sent from the main session in three parts:

| Part | UTC, blocks | Tool (in `benchmarking/`) | Notes spent | Transactions | Sender (pays the gas) | Recipient |
|---|---|---|---|---:|---|---|
| 1. The notes of the two concurrency runs | 19:33:48 to 19:44:12, 3810286 to 3810329 | `pool-cashout.cjs` | 54 revenue notes: 24 of the first concurrency run, 30 of the repeat | 27 `mergeWithdraw`, two notes each, the whole paid out | funder `0x82fD…156d`, nonces 199 to 225 | the funder itself |
| 2. The unused gas money of the ten one-time addresses of the sequential privacy run | 19:45:12 to 19:47:48, 3810334 to 3810345 | `recover-ephemeral.cjs` with `RECOVER_TO` | none | 10 plain transfers | the ten one-time addresses, nonce 4 each | establishment `0xEd27…b9E7` |
| 3. The ten revenue notes of the sequential privacy run | 20:52:36 to 20:57:48, 3810642 to 3810665 | `pool-cashout-kinds.cjs` | 10 revenue notes and the 6 change notes with value that the steps themselves made | 10 `mergeWithdraw` of five kinds, each kind twice | establishment `0xEd27…b9E7`, nonces 70 to 79 | the establishment itself |

- **Authorisation.** The owner authorised the cash-out with the words "Sim é importante calcular o custo do saque na rede pública. Pode sacar." (Yes, it is important to compute the cost of the cash-out on the public network. You may withdraw.), as the main session states it to this task; the authorisation is not a record this task can read. The task that wrote this section sent nothing and read no key.
- **Scripts with the dApp's rules, not the dApp.** No browser and no dApp took part. The three tools are Node scripts that send the contract call the manager dApp sends, `mergeWithdraw` from the establishment's wallet to itself; for part 3 the tool's description says that its planner is a word-for-word copy of the dApp's (`planAmounts` of `manager-frontend/src/utils/cashout.js`) and that a comparison of the two found them equal, which this task did not repeat. Steps 2 to 5 of part 3 are what that planner gives for two withdrawals of the dApp's denomination, 0.01 ETH (10 USD at the dApp's fixed conversion of 10^15 wei per USD). The other steps of part 3 and all of part 1 are fixed by the tools.
- **Settings.** `PRIORITY_FEE_GWEI=0.2`, `MAX_FEE_GWEI=3`: every withdrawal is a type-2 transaction with a maximum priority fee of 0.2 gwei and a maximum fee of 3 gwei (read from the 37 transactions), and every one paid the base fee of its block plus exactly 0.2 gwei. Gas limit: `eth_estimateGas` × 1.2 (the limit of each transaction is 1.2000 times the estimate in the tool's result file; the estimate was 9,905 to 10,115 gas above the gas used in every one of the 37). The sweep's transfers are legacy transactions at `eth_gasPrice` × 1.3, as in the recovery (section 10.3).
- **Rate.** 2507.445 USD per ETH, Coinbase spot price API, read by the main session at 2026-10-13T19:32:01Z (`hoodi4/rate.txt` of the session's scratch folder, which is temporary and not part of the repository, and the tools' result files in `hoodi-2026-10-13/`, which are kept; a copy of the rate file was put in a local records folder afterwards; this task read the file, not the API). It is used for every USD figure of this section, including part 3, which was sent 80 minutes later.
- **Logs and result files** (in `hoodi-2026-10-13/`): `run7-cashout-concurrency-first.log` (1 withdrawal), `run7-cashout-concurrency-rest.log` (11), `run7-cashout-repeat.log` (15) with `pool-cashout-hoodi-2026-10-13T19-33-42-752Z.json`, `…T19-35-11-787Z.json`, `…T19-39-40-417Z.json`; `run8-sweep-dry.log`, `run8-sweep-one-time-addresses.log` (no result file); `run9-cashout-kinds-dry.log`, `run9-cashout-kinds-first.log` (step 1), `run9-cashout-kinds-rest.log` (steps 2 to 10), `run9-cashout-kinds-check.log` with `pool-cashout-kinds-hoodi-2026-10-13T20-52-26-646Z.json` and `…T20-53-36-098Z.json` (the second has the whole plan). The first withdrawal of part 1 and the first of part 3 were each sent alone (`--max 1`) and the rest after them.
- **Words used below.** *Zero-value note*: the note of value 0 that the contract's constructor puts on leaf 0 of the note tree (called the dummy note in sections 2 to 5); a withdrawal of one note names it as its second input. *Change note*: the note each of these `mergeWithdraw` calls inserts; it holds what the inputs held minus the payout, which can be 0. *Pure merge*: a `mergeWithdraw` that pays out nothing and turns two notes into one. *Kind*: the tool's three-character labels of 13.3 (2F0, 2PV, 2MV, 1PV, 1F0), explained there.

### 13.2 The 27 withdrawals of two notes each

Each spends two revenue notes, pays their whole sum to the funder and inserts a change note of value 0 (kind 2F0 of 13.3). The notes were taken in the order of their leaves.

| | Notes | Withdrawals | Funder's nonces | Blocks | Change notes on leaves | Gas, total | Gas, mean (min to max) | Price paid, gas-weighted (min to max), gwei | Fees, ETH | Fees, USD | Paid out, ETH | Fees / paid out |
|---|---:|---:|---|---|---|---:|---|---|---:|---:|---:|---:|
| Notes of the first concurrency run | 24 | 12 | 199 to 210 | 3810286 to 3810307 | 195 to 206 | 13,483,722 | 1,123,643.5 (1,121,186 to 1,125,380) | 1.1853 (1.0891 to 1.3100) | 0.015981619 | 40.07 | 0.107706546 | 14.84 % |
| Notes of the repeat | 30 | 15 | 211 to 225 | 3810312 to 3810329 | 207 to 221 | 16,876,458 | 1,125,097.2 (1,121,222 to 1,127,459) | 1.2035 (1.1108 to 1.2808) | 0.020310748 | 50.93 | 0.131825175 | 15.41 % |
| **All 27** | 54 | 27 | 199 to 225 | 3810286 to 3810329 | 195 to 221 | **30,360,180** | **1,124,451.1 (1,121,186 to 1,127,459)** | 1.1954 (1.0891 to 1.3100) | 0.036292367 | 91.00 | 0.239531722 | 15.15 % |

- **Per withdrawal:** 1,124,451.1 gas and 0.001344162 ETH = 3.37 USD on average (0.001226 to 0.001474 ETH), for 0.008872 ETH paid out on average. The base fee of the 27 blocks was 0.8891 to 1.1100 gwei.
- **Net:** the funder received 0.2395317215352 ETH and paid 0.036292366562796922 ETH of fees: +0.203239354972403078 ETH, which is the change of its balance from block 3810285 to block 3810329 to the wei.
- **Times** (the tool's own, not read from the chain): proving a withdrawal took 662 ms at the median on this host; from sending to the receipt 9.6 s at the median. The 27 are in 27 different blocks, at most one per block: the tool sends one, waits for its receipt, reads the tree again and proves the next.

One row per withdrawal. "1 bits" is the number of 1 bits of the change note's leaf index; "zero bytes" those of the 452 bytes of calldata; "rule" is the leaf rule of 13.4 with the zero bytes counted. Full hashes are in `hoodi-final-2026-10-13.json` (`cashOut.withdrawals`) and in the tools' result files.

| # | Transaction | Block, UTC | Input leaves | Change leaf | 1 bits | Zero bytes | Gas used | Rule | Price (gwei) | Fee (ETH) | Paid out (ETH) |
|---:|---|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| 1 | `0xe939fa61…0821` | 3810286, 19:33:48 | 33 + 36 | 195 | 4 | 39 | 1,123,301 | 1,123,301 | 1.2338 | 0.001385937 | 0.008730465 |
| 2 | `0x75b5a73b…6e6a` | 3810292, 19:35:12 | 41 + 42 | 196 | 3 | 42 | 1,121,186 | 1,121,186 | 1.2164 | 0.001363811 | 0.008818459 |
| 3 | `0x3b7dd241…d98d` | 3810293, 19:35:24 | 47 + 56 | 197 | 4 | 39 | 1,123,301 | 1,123,301 | 1.1119 | 0.001249054 | 0.008879015 |
| 4 | `0x3019e284…7979` | 3810294, 19:35:36 | 57 + 58 | 198 | 4 | 39 | 1,123,301 | 1,123,301 | 1.2232 | 0.001374017 | 0.008890815 |
| 5 | `0xece182be…4664` | 3810296, 19:36:00 | 59 + 64 | 199 | 5 | 41 | 1,125,356 | 1,125,356 | 1.2177 | 0.001370345 | 0.008739731 |
| 6 | `0xf57ebf99…2e60` | 3810297, 19:36:12 | 65 + 82 | 200 | 3 | 38 | 1,121,234 | 1,121,234 | 1.0971 | 0.001230145 | 0.009017455 |
| 7 | `0x3bf386fb…9cfa` | 3810298, 19:36:24 | 83 + 84 | 201 | 4 | 38 | 1,123,313 | 1,123,313 | 1.2070 | 0.001355827 | 0.009400252 |
| 8 | `0x2ab0ef98…d8d6` | 3810300, 19:37:00 | 85 + 86 | 202 | 4 | 38 | 1,123,313 | 1,123,313 | 1.2145 | 0.001364252 | 0.009400252 |
| 9 | `0x0ee57654…1589` | 3810302, 19:37:24 | 87 + 88 | 203 | 5 | 40 | 1,125,368 | 1,125,368 | 1.2014 | 0.001352043 | 0.009400252 |
| 10 | `0xac8dd789…9173` | 3810303, 19:37:36 | 89 + 100 | 204 | 4 | 40 | 1,123,289 | 1,123,289 | 1.1007 | 0.001236360 | 0.009046071 |
| 11 | `0x28e32123…0285` | 3810305, 19:38:00 | 101 + 102 | 205 | 5 | 39 | 1,125,380 | 1,125,380 | 1.0891 | 0.001225618 | 0.008691889 |
| 12 | `0xd1ee1d26…1ec1` | 3810307, 19:38:24 | 103 + 104 | 206 | 5 | 39 | 1,125,380 | 1,125,380 | 1.3100 | 0.001474210 | 0.008691889 |
| 13 | `0xb336ff9a…acdc` | 3810312, 19:39:48 | 107 + 110 | 207 | 6 | 39 | 1,127,459 | 1,127,459 | 1.1600 | 0.001307899 | 0.009174456 |
| 14 | `0x760591f0…d29a` | 3810313, 19:40:12 | 115 + 116 | 208 | 3 | 39 | 1,121,222 | 1,121,222 | 1.2704 | 0.001424419 | 0.008896198 |
| 15 | `0x51f85093…f493` | 3810314, 19:40:48 | 121 + 122 | 209 | 4 | 38 | 1,123,313 | 1,123,313 | 1.1622 | 0.001305480 | 0.008581717 |
| 16 | `0x02ab3e63…a32b` | 3810315, 19:41:00 | 131 + 132 | 210 | 4 | 41 | 1,123,277 | 1,123,277 | 1.2808 | 0.001438664 | 0.008873829 |
| 17 | `0x138837ef…dec8` | 3810317, 19:41:24 | 133 + 134 | 211 | 5 | 40 | 1,125,368 | 1,125,368 | 1.2712 | 0.001430547 | 0.008873829 |
| 18 | `0x3e38e54f…e744` | 3810318, 19:41:36 | 143 + 144 | 212 | 4 | 39 | 1,123,301 | 1,123,301 | 1.1484 | 0.001290016 | 0.009293964 |
| 19 | `0x92a74e88…1c4c` | 3810319, 19:41:48 | 145 + 146 | 213 | 5 | 39 | 1,125,380 | 1,125,380 | 1.2572 | 0.001414867 | 0.008493699 |
| 20 | `0x347dd048…9a88` | 3810320, 19:42:12 | 163 + 164 | 214 | 5 | 38 | 1,125,392 | 1,125,392 | 1.1321 | 0.001274026 | 0.008565346 |
| 21 | `0xd9884d6a…3fc4` | 3810321, 19:42:24 | 165 + 166 | 215 | 6 | 40 | 1,127,447 | 1,127,447 | 1.2405 | 0.001398570 | 0.008565346 |
| 22 | `0x71c9ed8c…ce18` | 3810322, 19:42:36 | 167 + 168 | 216 | 4 | 40 | 1,123,289 | 1,123,289 | 1.1182 | 0.001256051 | 0.008565346 |
| 23 | `0xf46a3b6f…4d7a` | 3810323, 19:42:48 | 169 + 170 | 217 | 5 | 38 | 1,125,392 | 1,125,392 | 1.2304 | 0.001384650 | 0.008565346 |
| 24 | `0x401ef493…2126` | 3810324, 19:43:00 | 187 + 188 | 218 | 5 | 43 | 1,125,332 | 1,125,332 | 1.1108 | 0.001250021 | 0.008629818 |
| 25 | `0x5a3ee7b2…838f` | 3810325, 19:43:12 | 189 + 190 | 219 | 6 | 39 | 1,127,459 | 1,127,459 | 1.2222 | 0.001377995 | 0.008915427 |
| 26 | `0x941403ab…0f83` | 3810327, 19:43:36 | 191 + 192 | 220 | 5 | 38 | 1,125,392 | 1,125,392 | 1.2281 | 0.001382134 | 0.008915427 |
| 27 | `0xbfa55933…cd4f` | 3810329, 19:44:12 | 193 + 194 | 221 | 6 | 41 | 1,127,435 | 1,127,435 | 1.2199 | 0.001375408 | 0.008915427 |
| | **27 withdrawals** | | 54 notes | 195 to 221 | | | **30,360,180** | 30,360,180 | | **0.036292367** | **0.239531722** |

Rows 1 to 12 are the notes of the first concurrency run (leaves 33 to 104), rows 13 to 27 those of the repeat (leaves 107 to 194).

### 13.3 The ten withdrawals by kind

The establishment's dApp makes five kinds of `mergeWithdraw` (the tool's description derives them from `cashout.js`; the labels are the tool's):

| Kind | Inputs | Payout | Change note | When the dApp makes it (as the tool's description states it) |
|---|---|---|---|---|
| 2F0 | two notes | the whole | value 0 | two notes that sum to the denomination; the last step of "withdraw all" |
| 2PV | two notes | a part | with value | two notes that together exceed the denomination |
| 2MV | two notes | nothing (a pure merge) | with value | no note and no pair of notes covers the denomination |
| 1PV | one note and the zero-value note | a part | with value | a note larger than the denomination |
| 1F0 | one note and the zero-value note | the whole | value 0 | a note equal to the denomination; "withdraw all" with one note left |

The ten revenue notes of the sequential run (leaves 3, 6, …, 30; 0.0043 to 0.0047 ETH each) were spent in ten steps, each kind twice. Steps 2 to 5 are the dApp planner's answer for two withdrawals of 0.01 ETH: no note and no pair of these notes covers 0.01 ETH, so each denomination is a merge of two notes followed by a withdrawal from the merged note and a third note. Steps 1 and 6 to 10 are fixed by the tool so that every kind occurs twice and nothing stays in the pool; in them the part paid out is 0.002 ETH or what is left.

| Step | Kind | Transaction | Block, UTC | Inputs (leaves) | Paid out (ETH) | Change (ETH) | Change leaf | 1 bits | Zero bytes | Gas used | Rule | Price (gwei) | Fee (ETH) |
|---:|---|---|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 1 | 2F0 | `0xa7122b94…9abd` | 3810642, 20:52:36 | 9 + 24 | 0.0087761114144 | 0 | 222 | 6 | 41 | 1,127,435 | 1,127,435 | 1.2257 | 0.001381949 |
| 2 | 2MV | `0x5280b323…0202` | 3810648, 20:53:48 | 21 + 18 | 0 | 0.0094621270448 | 223 | 7 | 49 | 1,120,478 | 1,120,478 | 1.1756 | 0.001317199 |
| 3 | 2PV | `0xf62743b4…db90` | 3810650, 20:54:12 | 223 (change of step 2) + 27 | 0.01 | 0.0041316707336 | 224 | 3 | 41 | 1,121,198 | 1,121,198 | 1.1213 | 0.001257255 |
| 4 | 2MV | `0x79cb914c…a2b3` | 3810652, 20:54:36 | 3 + 15 | 0 | 0.0092400622064 | 225 | 4 | 48 | 1,114,253 | 1,114,253 | 1.1135 | 0.001240754 |
| 5 | 2PV | `0x525728f0…5a82` | 3810654, 20:55:00 | 225 (change of step 4) + 12 | 0.01 | 0.0038010163616 | 226 | 4 | 43 | 1,123,253 | 1,123,253 | 1.0979 | 0.001233237 |
| 6 | 1PV | `0xb21c1139…ca96` | 3810657, 20:55:36 | 224 (change of step 3) + 0 (zero-value note) | 0.002 | 0.0021316707336 | 227 | 5 | 40 | 1,102,998 | 1,102,998 | 1.2101 | 0.001334696 |
| 7 | 1F0 | `0xf8f6dcbb…dc9e` | 3810659, 20:56:12 | 227 (change of step 6) + 0 (zero-value note) | 0.0021316707336 | 0 | 228 | 4 | 41 | 1,100,907 | 1,100,907 | 1.2056 | 0.001327246 |
| 8 | 1PV | `0x9237e41e…66da` | 3810661, 20:56:48 | 6 + 0 (zero-value note) | 0.002 | 0.002462497412 | 229 | 5 | 41 | 1,102,986 | 1,102,986 | 1.2094 | 0.001333951 |
| 9 | 2F0 | `0xf8e9f288…ff89` | 3810663, 20:57:24 | 229 (change of step 8) + 30 | 0.006893817336 | 0 | 230 | 5 | 41 | 1,125,356 | 1,125,356 | 1.2041 | 0.001355018 |
| 10 | 1F0 | `0x8af367d6…6ead` | 3810665, 20:57:48 | 226 (change of step 5) + 0 (zero-value note) | 0.0038010163616 | 0 | 231 | 6 | 41 | 1,105,065 | 1,105,065 | 1.2154 | 0.001343125 |
| | | **10 withdrawals** | | 10 revenue notes, 6 change notes | **0.0456026158456** | | 222 to 231 | | | **11,143,929** | 11,143,929 | 1.1777 | **0.013124430** |

- The establishment received 0.0456026158456 ETH, the whole of the ten notes, and paid 0.013124429969842685 ETH of fees (32.91 USD): net +0.032478185875757315 ETH. Steps 2 and 4 pay out nothing and emit no `MergeWithdrawal` event; the other eight emit one, to the establishment, for the amount of the table. Every step emits one `NoteAdded`.
- Six change notes held value (steps 2, 3, 4, 5, 6 and 8) and each was spent by a later step; after step 10 no note with value is left, and the pool's balance is 0 wei.

Per kind. "At a one-bit leaf, 39 zero bytes" is the gas used − 2,079 × (1 bits − 1) + 12 × (zero bytes − 39); none of the leaves 195 to 231 is of the form 2^k − 1.

| Kind | Steps | Gas used | At a one-bit leaf, 39 zero bytes | Local figure (`local-gas-final-2026-10-12.md`) | In the tool's rehearsal on a private node (20 withdrawals; read from its description, not run by this task) |
|---|---|---|---:|---|---:|
| 2F0 | 1, 9 | 1,127,435, 1,125,356 | **1,117,064** | base of the rule 1,117,064 (its section 8); 1,117,031 measured at a one-bit leaf (its section 9, carried over from an earlier run) | 1,117,064 |
| 2PV | 3, 5 | 1,121,198, 1,123,253 | **1,117,064** | as 2F0: the local tables do not separate the two | 1,117,064 |
| 2MV | 2, 4 | 1,120,478, 1,114,253 | **1,108,124** | none: the local tables have no pure merge | 1,108,124 |
| 1PV | 6, 8 | 1,102,998, 1,102,986 | **1,094,694** | 1,094,665 measured at a one-bit leaf (its section 9, carried over from an earlier run) | 1,094,694 |
| 1F0 | 7, 10 | 1,100,907, 1,105,065 | **1,094,694** | as 1PV | 1,094,694 |

- The 27 withdrawals of 13.2 are all of kind 2F0 and all give 1,117,064 by the same computation: 29 withdrawals of that kind in all.
- **Constants measured locally before:** the base of a two-note withdrawal, 1,117,064; 2,079 per 1 bit of the leaf index and 17,100 at a leaf 2^k − 1 (local file, section 8).
- **Found on Hoodi in the package, not stated in the local file:** the 22,370 by which a withdrawal with the zero-value note is cheaper, which sections 5.2 and 5.3 of this file found in the first withdrawal of each establishment (1,095,162 against 1,117,532 with every zero byte added back; 1,095,162 − 39 × 12 = 1,094,694). The local file gives no such constant; its two carried-over one-bit-leaf figures differ by 22,366 (1,117,031 − 1,094,665).
- **From the gas schedule:** 12 gas per zero byte of calldata, the difference between the price of a non-zero byte and of a zero byte. The local file does not state it; it says of its rule "largest difference 36 gas (the proofs' calldata)".
- **First measured in the tool's rehearsal on a private node, and on a public network here:** the 8,940 by which a pure merge is cheaper than a two-note withdrawal with a payout (the rehearsal: four merges; Hoodi: steps 2 and 4). The local tables have no pure merge.
- **Measured in the rehearsal only, not on Hoodi:** a withdrawal whose sender is not its recipient used 2,500 gas more (one withdrawal of the rehearsal, as its description reports). Every withdrawal on Hoodi was sent by its recipient.
- **Against the local tables.** The 14 cash-outs of the local file's section 9 (one and two notes, on trees of seven fill levels), brought to a one-bit leaf with the leaf rule, are 1,117,064 or 1,094,694 less a multiple of 12 between 12 and 60, i.e. the constants above with 1 to 5 more zero bytes of calldata (computed by this task from the published table; the calldata of the local runs was not kept, so the zero bytes are inferred). The two one-bit-leaf figures that the local file carries over from an earlier run, 1,117,031 and 1,094,665, are 33 and 29 gas below the constants, which is not a multiple of 12; this task did not examine that difference.

### 13.4 The gas of all 37 against the leaf rule

gas = 1,117,064 + 2,079 × (1 bits of the change note's leaf index − 1) + 17,100 at a leaf 2^k − 1 − 22,370 with the zero-value note − 8,940 for a pure merge − 12 × (zero bytes of the calldata − 39). The rule of section 5.2 with the local base, the two terms of 13.3 that are not in the local file (−22,370 and −8,940) and the calldata.

- **37 of 37 withdrawals equal the rule to the unit; the largest difference is 0 gas.** Computed by this task from the receipts, the `NoteAdded` events and the calldata; the tools' own rule figures, read from their result files, agree.
- What the 37 cover: change notes on leaves 195 to 231, 3 to 7 one bits, 38 to 49 zero bytes; 29 of kind 2F0 and 2 of each other kind. The +17,100 term did not occur (no leaf of the form 2^k − 1 between 195 and 231; the next is 255). The −22,370 term occurs in 4 withdrawals, the −8,940 term in 2; the other 31 (kinds 2F0 and 2PV) equal the local rule with only the zero bytes counted.
- With the earlier withdrawals of this deployment (65 `poolWithdraw` of the package and the repeat, sections 5.2 and 8.1) that is 102 `mergeWithdraw` calls on Hoodi on the same constants, on leaves 2 to 231.
- The gas does not depend on the amounts except through zero bytes: the 27 full withdrawals paid 0.0085 to 0.0094 ETH, and steps 3 and 5 paid exactly 0.01 ETH.

### 13.5 What the kinds show

- **A pure merge costs almost what a withdrawal costs.** At the same leaf and with the same calldata it is 8,940 gas less than a two-note withdrawal with a payout (1,108,124 against 1,117,064, 0.8 %): the contract skips the transfer of ETH to the recipient and the `MergeWithdrawal` event (`contracts/Reputation.sol`, the last lines of `mergeWithdraw`), and still verifies the proof, marks two notes as spent and inserts the change note. Its amount of 0 adds zero bytes to the calldata (48 and 49 against 40 to 43 in the steps with a payout), about another 100 gas. A denomination that needs a merge first therefore costs two withdrawals (13.6). The tool's rehearsal on a private Hardhat node had reported that the node's estimate of a merge equals its gas used; on Hoodi the estimate was about 10,000 gas above the gas used for the merges as for every other withdrawal (10,060 and 10,011 in steps 2 and 4), which this task did not examine.
- **A change note with value costs the same as an empty one.** 2PV and 2F0 give the same 1,117,064, 1PV and 1F0 the same 1,094,694. The contract inserts the commitment the proof outputs in either case; whether the note holds value is not visible on the chain and changes nothing in the gas. Off the chain it matters: a change note with value exists only as its secrets (section 11.3).
- **The zero-value note saves 22,370 gas** (1,094,694 against 1,117,064, 2.0 %). `mergeWithdraw` does not read or write the spent flag of the zero-value note: the two `require` lines accept its nullifier hash without looking it up, and the two lines that mark the inputs as spent skip it ("the zero-value dummy stays reusable"). A withdrawal of one note therefore reads one storage slot less and writes one new storage slot less than a withdrawal of two. Under the main network's schedule a first read of a slot is 2,100 gas and setting a slot from zero 20,000; the remaining 270 gas would be the code around them. That split is this task's reading of the contract and of the schedule, not a measurement. Read at block 3810706: the spent flag of the zero-value note is false after the four withdrawals that used it, and those of all 70 other nullifier hashes of the 37 withdrawals are true.
- **The share of the proof and of the tree.** Not separated on Hoodi. The local file gives the withdrawal circuit and the tree by depth (its section 11).

### 13.6 Cost

**The gas is the figure that carries over; the price is a test network's.** The 37 withdrawals paid the base fee of their block (0.8891 to 1.1100 gwei) plus 0.2 gwei, 1.1906 gwei gas-weighted. Section 6 compares Hoodi's base fee with the main network's (0.1045 gwei at the median of the 27 hours before the package). USD = ETH × 2507.445.

| | Transactions | Gas | Fee paid on Hoodi, ETH | USD | Paid out, ETH | Fee / paid out |
|---|---:|---:|---:|---:|---:|---:|
| One withdrawal, mean of the 37 | 1 | 1,121,732.7 | 0.001335589 | 3.35 | | |
| One withdrawal of two notes in full, mean of the 27 | 1 | 1,124,451.1 | 0.001344162 | 3.37 | 0.008871545 | 15.15 % |
| The same, per revenue note (54 notes in 27 withdrawals) | 0.5 | 562,225.6 | 0.000672081 | 1.69 | 0.004435773 | 15.15 % |
| One denomination of the dApp's policy (0.01 ETH) from notes below it: steps 2 + 3, a merge and a withdrawal | 2 | 2,241,676 | 0.002574453 | 6.46 | 0.010000000 | 25.74 % |
| The same: steps 4 + 5 | 2 | 2,237,506 | 0.002473991 | 6.20 | 0.010000000 | 24.74 % |
| The ten withdrawals of 13.3 together | 10 | 11,143,929 | 0.013124430 | 32.91 | 0.045602616 | 28.78 % |
| All 37 | 37 | 41,504,109 | 0.049416797 | 123.91 | 0.285134337 | 17.33 % |

- **Fee per withdrawal:** 0.001226 to 0.001474 ETH, 3.07 to 3.70 USD at the price paid. The spread comes from the base fee of the block (the gas varies by 2.4 % between the cheapest and the dearest of the 37).
- **The fees as a share of what was paid out depend on the size of the notes, not on the contract:** the fee of a withdrawal does not depend on its amount. These notes are the revenue of orders of 0.006 ETH: 0.004436 ETH on average for the 54 of part 1 (11.12 USD at the rate). Withdrawn in pairs in full, the fees were 15.2 % of the amount paid out; the ten withdrawals of 13.3, which are a measurement of the kinds and not an economical plan (ten transactions for ten notes), 28.8 %.
- **One denomination from notes below the denomination is two transactions:** 2,241,676 and 2,237,506 gas, 0.002574 and 0.002474 ETH on Hoodi, for 0.01 ETH paid out (25.7 % and 24.7 %). Under the dApp's policy the change note of the withdrawal (0.0041 and 0.0038 ETH here) would stay in the pool for a later cash-out; here steps 6, 7 and 10 took both out, and nothing is in the pool.
- **The same gas at another price is a multiplication (computed, not measured):** a two-note withdrawal of 1.1245 million gas is 0.001124 ETH at 1 gwei and 0.000118 ETH = 0.29 USD at the main network's median base fee of section 6 (0.1045 gwei, no tip); a denomination of two transactions (2,241,676 gas) is 0.002242 ETH and 0.000234 ETH = 0.59 USD. As in the summary and in section 6, this shows the arithmetic, not a main-network cost: the base fee is the median of the 27 hours before 11:26 UTC, the rate was read at 19:32 UTC, and no tip is counted.
- **For scale:** a later privacy cycle is 4,830,506 gas on Hoodi (section 2.1). A withdrawal of two notes is 23.3 % of a cycle; per revenue note, withdrawn in pairs in full, 11.6 %.

**A model's figure, not a measurement on Hoodi: the dApp's cash-out per order.** The privacy evaluation (`privacy-eval-final-2026-10-12.md`, point 4 of its findings and its table 4c) runs the manager dApp's cash-out policy in a simulation on an in-process node with the main network's schedule: 20 establishments, 500 orders, three seeds; proofs emulated by a gas-equivalent verifier with placeholder proofs and real public signals, not real proofs; 10 USD per withdrawal once five notes are held, any note of the pool, one withdrawal per denomination, sent by and paid to the establishment's main wallet; a float of 1,400 USD per establishment in three deposits, so that a note covering 10 USD always exists; a mean revenue of 35.76 USD per order. It reports **3.38 withdrawals per order (3.23 to 3.53 over the seeds), no merge, 3.74 million gas per order (3,737,384; 3.57 to 3.90 million)**, and at its own prices (1 ETH = 1,000 USD, 0.95 gwei paid on average) 3.57 USD per order, 10.0 % of the revenue. With a small float (45 to 150 USD) it reports 3.28 to 3.60 million gas per order with 10 to 19 pure merges per run of 500 orders. Next to the figures above:

- The model's 3.74 million gas per order is 77 % of the gas of a later cycle on Hoodi (4,830,506). It is 3,737,384 / 3.38 = about 1.106 million gas per withdrawal, which is consistent with the one-note withdrawals measured here (1,100,907 to 1,105,065 at leaves 227 to 231); that does not make the model's figure a measurement, and Hoodi does not confirm the number of withdrawals per order.
- The model's orders are larger than its denomination (35.76 USD against 10 USD), so one order needs several withdrawals. The notes on Hoodi (about 0.0044 ETH) are smaller than the denomination (0.01 ETH), so the policy needs a merge before each withdrawal (steps 2 to 5: four transactions for six notes of input, 0.02 ETH paid out and 0.0079 ETH left in two change notes; 4,479,182 gas, 746,530 per note of input). Withdrawing the notes in pairs in full, which is not the dApp's denominated policy, cost 562,226 gas per note. None of these three is a measurement of the dApp's cash-out per order on Hoodi: the dApp was not used, and the cash-out here was planned to measure the kinds and to empty the pool.

### 13.7 The sweep of the ten one-time addresses

In the sequential privacy run each order's one-time address received the customer's gas stipend and the withdrawal that funds the order, and spent part of it on its four transactions; the rest stayed at the address, and the benchmark has no step that returns it (section 11). `recover-ephemeral.cjs` with `RECOVER_TO` set to the establishment sent each address's balance to the establishment in one plain transfer, keeping 1.1 times the fee of that transfer back, so that a tenth of a fee is left at each address. In the tool's log the recipient is called "funder": for this wallet file that is the establishment.

| # | One-time address | Block, UTC | Balance before (ETH) | Sent to the establishment (ETH) | Gas | Price (gwei) | Fee (ETH) | Left at the address (ETH) |
|---:|---|---|---:|---:|---:|---:|---:|---:|
| 1 | `0xAcfd4E3be23446D226a84D2C41B031bb873D6F34` | 3810334, 19:45:12 | 0.005846604447882593 | 0.005816941663777793 | 21,000 | 1.2841 | 0.000026966167 | 0.0000026966167 |
| 2 | `0xbCa687c0b0E3cdC8f91249425491032bCC25eC91` | 3810335, 19:45:24 | 0.005396353600114312 | 0.005367145391530912 | 21,000 | 1.2644 | 0.000026552917 | 0.0000026552917 |
| 3 | `0xE4c13c976CeB53652f8fad3Fda487FaE7307f00b` | 3810337, 19:46:00 | 0.005459888498260052 | 0.005427464373118952 | 21,000 | 1.4036 | 0.000029476477 | 0.0000029476477 |
| 4 | `0xc24821C936ea534f9C56E0834c7A45eB1bEEBE2e` | 3810338, 19:46:12 | 0.006149135644253284 | 0.006118328460715384 | 21,000 | 1.3336 | 0.000028006530 | 0.0000028006530 |
| 5 | `0xa782636fEA99dF4c41a9a6D3a39A2d5a5c957716` | 3810339, 19:46:24 | 0.006068025275286452 | 0.006033911032570052 | 21,000 | 1.4768 | 0.000031012948 | 0.0000031012948 |
| 6 | `0x1dD4b1f2d5251746158a80184bc31d66BCDcE70A` | 3810340, 19:46:36 | 0.005633123832546748 | 0.005602405081976548 | 21,000 | 1.3298 | 0.000027926137 | 0.0000027926137 |
| 7 | `0xc14A8A5a45f84cC779fEb085F7f97cd54e543C39` | 3810341, 19:46:48 | 0.005472821052419822 | 0.005438741314519922 | 21,000 | 1.4753 | 0.000030981580 | 0.0000030981580 |
| 8 | `0xF710723c6035C0BC9059C55c80Fdb8A7792e15AF` | 3810342, 19:47:00 | 0.005569168757250656 | 0.005538961979534156 | 21,000 | 1.3077 | 0.000027460707 | 0.0000027460707 |
| 9 | `0xCd30E9020588002EE03aCdE88fC04f4a3717729f` | 3810343, 19:47:24 | 0.005771015292903386 | 0.005737593918909686 | 21,000 | 1.4468 | 0.000030383067 | 0.0000030383067 |
| 10 | `0x3179D96E39531A417195251d658E572D66F1f8Be` | 3810345, 19:47:48 | 0.005455924127984827 | 0.005426318091293827 | 21,000 | 1.2816 | 0.000026914579 | 0.0000026914579 |
| | **10 transfers** | 3810334 to 3810345 | **0.056822060528902132** | **0.056507811307947232** | 210,000 | | **0.000285681110** | **0.0000285681110** |

- The ten transfers were found by reading the blocks in full (13.10), since the tool's log has no hashes: ten legacy transactions (type 0), nonce 4 of each address, 21,000 gas each with a gas limit of 21,000, all with status 1, all to the establishment, at 1.2644 to 1.4768 gwei (1.26 to 1.60 times the base fee of their blocks).
- **Sum sent: 0.056507811307947232 ETH**, the figure of the tool's log ("Recovered: 0.056507811307947232 ETH in 10 transfers"), and the rise of the establishment's balance between blocks 3810333 and 3810345 to the wei. The dry run before it had printed 0.056506809 ETH at the price of that moment.
- Balance before = sent + fee + left, to the wei, for each of the ten. The balances before are those of block 3810028 (18:35 UTC). Fees 0.000285681 ETH (0.72 USD); **left at the ten addresses: 0.000028568 ETH**, at most 0.000003101 each, less than the fee of a transfer; nonce 5 each now.
- Of the 0.056822 ETH, 99.45 % came back. This is a clean-up of the benchmark by a script. It is not the manager dApp's return of unused gas money (a deposit into the pool from the one-time address, which the local file describes and which was not sent on Hoodi), and a transfer from a one-time address to the establishment's own account shows on the chain that the two belong together.

### 13.8 What was sent in the cash-out, and the balances

| Senders | Nonces | What | Transactions | Value sent (ETH) | Fees (ETH) |
|---|---|---|---:|---:|---:|
| deployer, customer, funder `0x82fD…156d` | 199 to 225 | 27 `mergeWithdraw` to the pool, paid out to itself (0.239531722 ETH received from the pool) | 27 | 0.000000000 | 0.036292367 |
| ten one-time addresses of the sequential privacy run | 4 (each) | sweep to the establishment | 10 | 0.056507811 | 0.000285681 |
| establishment `0xEd27…b9E7` | 70 to 79 | 10 `mergeWithdraw` to the pool, paid out to itself (0.045602616 ETH received from the pool) | 10 | 0.000000000 | 0.013124430 |
| **Cash-out** | | | **47** | | **0.049702478** |

- **Nonces.** The funder's nonces 199 to 225 are the 27 withdrawals and the establishment's 70 to 79 the ten, without a gap; the funder's nonce is 226 and the establishment's 80 now, the worker's 60 as before (latest and pending, both endpoints). The worker sent nothing.
- **No other transaction.** Blocks 3810029 to 3810697 (669 blocks, 20,165 transactions; 18:35 to 21:04 UTC) were read in full: the only transactions from or to the three accounts, the deployed contracts, the 110 orders or the 156 temporary and one-time addresses of the runs are these 47. The 37 found this way are the 37 hashes of the tools' result files.
- **Types and prices.** 37 type-2 transactions at the base fee of their block + 0.2 gwei; 10 legacy transfers at `eth_gasPrice` × 1.3.

**Balances** (wei read at the block before the first withdrawal and after the last transaction; the state at block 3810285 is that of block 3810028, 18:35 UTC, for all four):

| Account | Before, block 3810285 (ETH) | After part 1, block 3810329 | After the sweep, block 3810345 | After part 3, block 3810665 | At block 3810706, 21:06 UTC | Change (ETH) | Explained by |
|---|---:|---:|---:|---:|---:|---:|---|
| payment pool `0x2785…681f` | 0.285134337380800000 | 0.045602615845600000 | 0.045602615845600000 | 0.000000000000000000 | **0.000000000000000000** | −0.285134337380800000 | − 0.2395317215352 (27 payouts) − 0.0456026158456 (8 payouts of part 3) |
| deployer, customer, funder `0x82fD…156d` | 6.901693901508347591 | 7.104933256480750669 | 7.104933256480750669 | 7.104933256480750669 | **7.104933256480750669** | +0.203239354972403078 | + 0.2395317215352 paid out − 0.036292366562796922 fees |
| establishment `0xEd27…b9E7` | 0.244850469182613424 | 0.244850469182613424 | 0.301358280490560656 | 0.333836466366317971 | **0.333836466366317971** | +0.088985997183704547 | + 0.056507811307947232 swept + 0.0456026158456 paid out − 0.013124429969842685 fees |
| worker `0xb89b…8EE2` | 0.059342692578279927 | 0.059342692578279927 | 0.059342692578279927 | 0.059342692578279927 | **0.059342692578279927** | 0.000000000000000000 | nothing sent, nothing received |

- Each change equals its explanation to the wei, with nothing left over. The pool went from 0.2851343373808 ETH to 0: the 35 payouts are the whole of the 64 notes.
- **The note tree** went from 195 to **232 leaves**: one change note per withdrawal. Of the 37 change notes 6 held value and are spent; 31 hold nothing. Root at block 3810706: `665281096864866763278773628620784817391918225754209849452957759032080629308` (decimal, from `getNoteTreeInfo`, the same on both endpoints).
- Unchanged at block 3810670 and at block 3810706 on both endpoints, pending nonce equal to the latest: funder 7.104933256480750669 ETH (nonce 226), establishment 0.333836466366317971 ETH (nonce 80), worker 0.059342692578279927 ETH (nonce 60).

### 13.9 The Hoodi campaign closed

Everything sent on Hoodi for this measurement, from the first transfer at 09:24 UTC to the last withdrawal at 20:57 UTC: **1,273 transactions, all with status 1**, 366 from the three accounts (funder 226, establishment 80, worker 60: their nonces, all three having started at 0) and 907 from temporary wallets and one-time addresses. That is the 1,226 of section 11.2 and the 47 of the cash-out.

| Step | UTC | Transactions of the three accounts | Transactions of temporary and one-time addresses | Fees of the step (ETH) | Change of the three accounts together (ETH) | Of the change, not fees (ETH) |
|---|---|---:|---:|---:|---:|---|
| The measurement up to the recovery (section 11.2) | 09:24 to 18:30 | 329 | 897 | 0.481836112 | −0.825362937 | in the pool 0.285134; at the ten one-time addresses 0.056822; dust 0.001570 |
| **Cash-out, part 1: 27 withdrawals** | 19:33 to 19:44 | 27 | 0 | 0.036292367 | +0.203239355 | out of the pool 0.239532 |
| **Sweep of the ten one-time addresses** | 19:45 to 19:48 | 0 | 10 | 0.000285681 | +0.056507811 | out of the ten addresses 0.056793 (what the establishment received and the fees of this row); 0.000029 left there |
| **Cash-out, part 3: 10 withdrawals** | 20:52 to 20:58 | 10 | 0 | 0.013124430 | +0.032478186 | out of the pool 0.045603 |
| **Whole campaign** | | **366** | **907** | **0.531538589** | **−0.533137585** | |

| Account | Transactions (nonce now) | Before the first transfer (ETH) | After the package | After the recovery, block 3810028 | After the cash-out, block 3810706 | Change over the campaign (ETH) |
|---|---:|---:|---:|---:|---:|---:|
| deployer, customer, funder `0x82fD…156d` | 226 | 8.031250 | 7.186123 | 6.901694 | **7.104933** | −0.926316744 |
| establishment `0xEd27…b9E7` | 80 | 0.000000 | 0.244850 | 0.244850 | **0.333836** | +0.333836466 |
| worker `0xb89b…8EE2` | 60 | 0.000000 | 0.059343 | 0.059343 | **0.059343** | +0.059342693 |
| **The three together** | 366 | 8.031250 | 7.490316 | 7.205887 | **7.498112** | −0.533137585 |

The establishment and the worker started at 0 and were funded by the funder with 0.2 and 0.05 ETH (section 11); the establishment's balance also holds what it took out of the pool and the sweep.

**Where the 0.533138 ETH went** (the fees of the first three lines are those of section 11.2, read from the chain by the tasks that wrote it, and read from the chain a second time, with the same sums to the wei, by one of the checks of section 13.12; the other lines were read by this task at block 3810706 on both endpoints; the lines add up to the change of the three accounts with nothing left over):

| | ETH | |
|---|---:|---|
| Fees of the package, 783 transactions | 0.302384691 | deployment 0.019814; the three sequential runs 0.080748; the first concurrency run 0.201773; the two transfers 0.000050 |
| Fees of the repeat, 429 transactions | 0.178401895 | |
| Fees of the recovery, 14 transactions | 0.001049526 | |
| Fees of the 27 withdrawals of the cash-out | 0.036292367 | paid by the funder |
| Fees of the sweep, 10 transfers | 0.000285681 | paid by the ten one-time addresses out of what they held |
| Fees of the 10 withdrawals by kind | 0.013124430 | paid by the establishment |
| **Fees of all 1,273 transactions** | **0.531538589** | 99.70 % of the difference |
| Dust at the 92 addresses of the first concurrency run | 0.000922852 | at most 0.000013 each; unchanged since 18:35 UTC |
| Dust at the 54 addresses of the repeat | 0.000647576 | at most 0.000013 each; unchanged since 18:35 UTC |
| Dust at the ten one-time addresses of the sequential privacy run | 0.000028568 | what the sweep left, at most 0.000003 each |
| In the payment pool | 0.000000000 | all 64 revenue notes paid out |
| In the 110 orders and in the other deployed contracts | 0.000000000 | read for each |
| **Sum** | **0.533137585** | the change of the three accounts; unexplained: 0 wei |

- **Nothing is locked any more.** Of the 0.341956 ETH that section 11.3 listed in the pool and at the ten addresses at 18:35 UTC, 0.341642 ETH came back to the funder and the establishment, for 0.049702 ETH of fees (0.049417 paid by the two accounts, 0.000286 by the ten addresses) and 0.000029 ETH of dust: net +0.292225 ETH for the three accounts since 18:35 UTC.
- **What still belongs to the project on Hoodi:** the three accounts, 7.498112 ETH (funder 7.104933, establishment 0.333836, worker 0.059343), whose keys are the owner's own configuration and were not read; 0.001599 ETH of dust at 156 temporary and one-time addresses, each holding less than the fee of a transfer (their keys are in the three wallet files of section 11.3); and the deployed contracts, which hold no ETH. The 110 orders of `Chain` hold nothing (balances read again; their states, read again at block 3810858, 21:42 UTC, are the 74 concluded and 36 cancelled of section 11.3, and no transaction reached an order in the blocks read since, section 13.12).
- The campaign cost 0.533138 ETH of test-network ETH, of which 0.531539 in fees. No USD figure is given for the whole: three rates were read on the day for three parts and none for the recovery.

### 13.10 Read back from the chain

By the task that wrote this section, with scripts of its own, read-only (no key, no `eth_send*`), from `ethereum-hoodi-rpc.publicnode.com` and `hoodi.drpc.org`, on 2026-10-13 between 21:03 and 21:12 UTC:

- **The 37 withdrawals, by the hashes of the five result files** (the second file of part 3 repeats step 1 of the first: 38 step rows, 37 distinct hashes): transaction and receipt from publicnode, the receipt again from drpc (37 of 37 equal in status, block, block hash, gas used, effective price, sender, recipient and number of logs), the header of each block. Compared with the tools' files, per step: status 1 and "mined", block, sender, nonce, recipient contract (the pool), gas used, effective gas price, fee, calldata bytes (452) and zero bytes, gas limit, maximum fee and maximum priority fee, the leaf of the `NoteAdded` event and that its commitment is the one in the calldata, the amount and the recipient in the calldata, the `MergeWithdrawal` event (recipient and amount; none in the two merges), the number of logs and that all are the pool's, type 2, value 0, the function called: **912 comparisons, 0 different.**
- **The gas against the rule** was computed from those receipts, events and calldata, not taken from the tools (13.4).
- **The sweep and everything else:** blocks 3810029 to 3810697 read in full from publicnode (20,165 transactions) and filtered for 280 addresses: the three accounts, the 11 deployed contracts and implementations, the 110 orders, the 156 temporary and one-time addresses (public addresses collected by an earlier task of this session, `hoodi4/check/data/addrs.json` of the scratch folder, which is not kept with the repository; a copy was put in a local records folder afterwards; this task opened no wallet file). 47 transactions, their receipts equal on both endpoints. This window starts at the block after the state of section 11.3 (3810028), so nothing lies between that state and the cash-out unread.
- **Balances and nonces at earlier blocks** (3810028, 3810285, 3810286, 3810307, 3810329, 3810333, 3810345, 3810640 to 3810642, 3810665, 3810670, 3810697): drpc, which keeps historical state. **State at block 3810706 (21:06:12 UTC):** both endpoints, equal, block hash equal: the three accounts and the pool (balance, latest and pending nonce), `getNoteTreeInfo` (232 leaves, the root of 13.8), the 156 temporary and one-time addresses, the 110 orders and the other contracts (balance and nonce of each), the spent flags of the 70 nullifier hashes and of the zero-value note. Fork id `0x23aa1351`, no next fork, on both.
- **Internal transfers** (ETH sent by a contract) do not appear in a list of transactions; that none reached the three accounts other than the 35 payouts rests on the balances, which are explained to the wei.
- Scripts and their outputs: `hoodi7/writer/` of the session's scratch folder (`rb1.cjs` to `rb5.cjs`, `an.cjs`, `data/`). That folder is temporary and outside the repository. After the checks the whole `hoodi7/` folder (the scripts and outputs of the read-back, of the two checks and of the corrections) was copied to a records folder on the authors' machine that git excludes: the copies are kept, but not in the repository.

### 13.11 Not verified, not measured in the cash-out

- **The dApp was not used.** No browser, no wallet extension, no click: the withdrawals came from scripts that follow the dApp's rules. That the planner of the tool of part 3 is a word-for-word copy of the dApp's is what the tool's description reports; this task did not compare the code.
- **One price level.** A base fee of 0.89 to 1.11 gwei and a tip of 0.2 gwei, on a test network. The USD figures show the arithmetic.
- **Nothing here measures privacy.** Sender and recipient are the same account in every withdrawal, the accounts are the benchmark's known accounts, the notes were withdrawn within minutes, in the order of their leaves and (part 1) in full, so that each payout is the sum of two orders' revenues. The privacy evaluation is the place for linkage; it is a model.
- **Not sent:** the dApp's "withdraw all" as such (its last step is of kind 2F0 or 1F0, which were measured); the dApp's return of unused gas money (a deposit into the pool from a one-time address); a withdrawal to an address other than the sender (2,500 gas more in the tool's rehearsal; not on Hoodi); a withdrawal that opens a tree level (+17,100, not met between leaves 195 and 231); a refused or reverted withdrawal.
- **A single range of tree positions:** change notes on leaves 195 to 231 of a tree of depth 25. The local file measures other fill levels.
- **Each kind twice.** The four kinds other than 2F0 have two withdrawals each; both give the same constant, and the rehearsal's four per kind gave it too, but that rehearsal was read, not run by this task.
- **The per-order cost of the dApp's cash-out was not measured on Hoodi.** The figure quoted in 13.6 is the privacy evaluation's model.
- **The 33 and 29 gas** between the local file's two carried-over one-bit-leaf figures and the constants of 13.3 were not examined.
- **Why the node's estimate** is about 10,000 gas above the gas used in every withdrawal was not examined.
- **The authorisation** is quoted as the main session states it. **The rate** was read from the session's file, not from the price API. **The commands** are given in "Files and commands" as the tools' descriptions give them; the logs record the tools' output, not the command lines.
- **The times** of 13.2 (proving, sending to receipt) are the tools' own figures and were not checked.
- **The value of a change note is not visible on the chain.** The column "Change" of 13.3 and the difference between the kinds with a change of value 0 (2F0, 1F0) and with value (2PV, 1PV) come from the tool's result files. What the chain shows agrees with them: the payouts, the zero-value note as second input in 4 withdrawals, an amount of 0 and no `MergeWithdrawal` event in 2, and the pool reaching 0 wei.
- **That no note with value is left** follows from the pool's balance of 0 wei only if the withdrawal circuit and its verifier are sound (a change note holds the inputs minus the payout); the circuit was not tested here.
- **Other networks were not read** by the tasks that wrote this file or by the checks of section 13.12. That nothing was sent on another network after 18:35 UTC rested on local evidence, as one check reports it: no file under `deployments/` or `benchmarking/` changed after 18:35 UTC refers to another network, and the logs of the cash-out name chain 560048. **Sepolia was then read by the session that sent the transactions** (read-only, the two keyless public endpoints of publicnode and drpc, block 11908886, 2026-10-13 21:51:36 UTC, both equal): the three accounts hold 0.261294084630802021, 1.857913124321605580 and 1.880667223895909147 ETH, to the wei the balances that `sepolia-final-2026-10-13.md` records after the last run of the Sepolia measurement (02:18 UTC that day), with nonces 1019, 814 and 606 and nothing pending. A transaction of an account costs it gas, so none of the three has sent one on Sepolia since that measurement. No third network was read; the scripts of this day name only Sepolia and Hoodi.
- **A transaction on Hoodi from an address that is not in the list** (the three accounts, the deployed contracts, the orders, the 156 temporary and one-time addresses) would not have been found by reading the blocks; the pool's events and its balance show that none touched the pool.
- The secrets files and the state file of part 3 were not opened by the task that wrote this section. The lock file, which holds no secret, was read by a check afterwards (section 11.3).

### 13.12 Checked again, and what was corrected (2026-10-13, 21:25 to 21:55 UTC)

After section 13 was written, two checks read the cash-out again. Each is a separate task with scripts of its own, independent of the task that wrote the section and of the other check; both were read-only on Hoodi and sent nothing. A third task then verified their corrections and applied them. What each read is given as it reports it.

- **The check of the figures** found the 37 withdrawals from the pool's own logs after block 3810028 and the ten sweep transfers from blocks read in full, not from the tools' hashes, and read the whole campaign again (blocks 3807590 to 3810706 in full). It reports no figure of section 13 or of `cashOut` in the JSON file different from the chain: 503 cells of the tables of 13.2 and 13.3 and 823 cells of the JSON file's withdrawal and sweep rows compared by script, about 190 cells of the other tables by reading. 37 of 37 withdrawals equal the rule of 13.4, largest difference 0 gas. The fees of the first 1,226 transactions, which 13.9 takes from section 11.2, read again: 0.302384690797672660, 0.178401894723423276 and 0.001049526013238290 ETH. The campaign: 1,273 transactions (783 + 429 + 14 + 47), 366 from the three accounts and 907 from the 156 addresses; unexplained 0 wei. It read the receipts of the 37 withdrawals and of the 10 transfers from publicnode only.
- **The check of what was sent** read blocks 3810029 to 3810776 in full for 277 addresses and found the 47 transactions of 13.8 and no other, all with status 1 and receipts equal on both endpoints: 27 withdrawals paid to the funder (0.2395317215352 ETH), 10 transfers to the establishment, 10 withdrawals of the establishment (8 payouts to itself, 0.0456026158456 ETH, and 2 merges). The nonces at block 3810028 were 199, 70 and 60 and are 226, 80 and 60, latest and pending, on both endpoints at block 3810791. From the pool's events since the deployment: 232 `NoteAdded` (leaves 0 to 231: the constructor's, 65 deposits, 64 deliveries, 102 `mergeWithdraw`) and 100 `MergeWithdrawal`; into the pool 0.39543709476575 ETH in 65 deposits and 0.2851343373808 ETH at 64 deliveries, out of it 0.68057143214655 ETH in 100 payouts, the difference 0 wei; the pool's balance did not change in any block without one of its events. The 70 nullifier hashes of the cash-out are spent. The orders at block 3810799: 74 CONCLUDED and 36 CANCELED BY CLIENT on `Chain`, 10 CONCLUDED on `No_Chain`, none holding ETH. Dust at the 156 addresses: 0.0015989953977186 ETH, the largest balance 0.0000135 ETH against a transfer fee of 0.0000231 ETH at that time. This check also searched for the values held in the four secrets files of section 11.3: it reports that none of their 604 secret values occurs in any file written that day in the folders of this measurement (602 files), and that the 1,001 distinct 64-hex-digit values in the logs, the result files and the reports of the day are all transaction hashes on Hoodi.
- **The task that applied the corrections** read the pool's logs from block 3810029 to block 3810846 from publicnode (37 transactions) and the receipts from both endpoints: 37 with status 1, 37 equal to the rule of 13.4; brought to a one-bit leaf and 39 zero bytes, 31 give 1,117,064, the 4 with the zero-value note 1,094,694 and the 2 merges 1,108,124; gas, fees and payouts of the 27, of the ten and of all 37 as in 13.2, 13.3 and 13.6; the pool at 0 wei with 232 leaves and the three accounts as in 13.8, on both endpoints. It read the states of the orders at block 3810858 (21:42 UTC) with each order's customer as the caller, on both endpoints: 74 CONCLUDED and 36 CANCELED BY CLIENT on `Chain`, 10 CONCLUDED on `No_Chain`, 0 wei in all of them. It did not read the sweep transfers or the earlier blocks again.

**Corrections applied, all of wording:**

1. Header and opening paragraph: the 37 withdrawals were sent by scripts, and the five kinds are what the tool's description derives from the dApp's code; a gas figure can also be a model's figure.
2. Summary and 13.4: the 37 equal the local leaf rule extended by two constants that are not in the local file, −22,370 (found on Hoodi in the package) and −8,940 (first seen in the tool's rehearsal); 31 of the 37 need neither.
3. 13.3: the 22,370 and the 12 gas per zero byte were listed as measured locally. Neither is stated in the local file; the first was found on Hoodi in the package, the second is the gas schedule's.
4. 5.2, the bullet added with the cash-out: one further term was measured in the cash-out (the pure merge), not two; the zero bytes of the calldata were already counted in 5.2.
5. 13.6: the model's proofs are emulated (placeholder proofs, a gas-equivalent verifier); its gas per withdrawal is consistent with the one-note withdrawals measured here, which does not make it a measurement; the main-network price of a withdrawal is arithmetic, not a main-network cost.
6. 11.3 and 13.9: the lock file holds "free"; the states of the orders were read again and are unchanged. The closing list: the 10 orders of `No_Chain` were read back.
7. 10.3 and 10.4: an absolute path of the machine in two command lines was replaced by the path from the root of the repository. 13.1, 13.10 and "Files and commands": the session's scratch folder, to which several lines point, is temporary and is not kept with the repository.
8. 13.11: four limits added (the value of a change note, the soundness of the circuit, other networks, addresses outside the list).
9. 13.6: the sentence that the change notes of steps 3 and 5 stay in the pool described the dApp's policy; it now says that steps 6, 7 and 10 took them out.

No number of section 13 was changed. Sections 2 to 7 differ from the file as it was before the cash-out only by the one bullet at the end of 5.2.

**Added afterwards by the session that sent the transactions (22:00 UTC):** the read of Sepolia in 13.11, which one check had asked for; and the copies named in 13.1, 13.10 and "Files and commands", in the local records folder: the folder `hoodi7/`, the rate file, the address list and a small table script, and the description of the tool for the kinds with its dry runs on Hoodi and its helper scripts. The folders of the tool's rehearsals on a private node were not copied: they hold throwaway keys.

## Not verified, not measured

- Nothing beyond one item per order, a note tree of at most 232 leaves (105 during the package, 195 after the repeat), a reputation threshold of zero.
- No ending other than delivery and the customer's cancellation in ORDERED; no leaving or replacement of a worker; no return of gas money by the dApp; no cash-out by the dApp. The local file measures the endings, the worker's paths and the cash-out; Sepolia's file lists their simulated gas on that schedule. A cash-out was sent on Hoodi after this line was first written, by scripts and as a measurement (section 13).
- A first cycle of baseline (b) on a new deployment.
- The cycle rate with every cycle completed was measured once (the repeat, section 8.1): one run per level, two cycles per client, 2 to 16 cycles; no spread across runs.
- The recovery and the repeat were run from the main session, not by the tasks that wrote this file; this file has their logs and what the chain shows. The owner's authorisations are stated to this task by the main session. Whether a dry run of the recovery was made on Hoodi before it: the log holds none.
- The three wallet files were not opened: that they hold the secrets of the 64 notes and of the ten one-time addresses is the scripts' design (checked by the script itself for the sequential run's file only). A cash-out of the notes and a sweep of the ten addresses had not been sent when this line was written (18:49 UTC); both were sent between 19:33 and 20:58 UTC, every note was spent and every address swept, which the files' secrets made possible (section 13). The files were still not opened by any task that wrote this file.
- **The cash-out** (the full list is section 13.11): the dApp was not used, the withdrawals came from scripts with its rules; one price level, a test network's; sender and recipient are the same account in every withdrawal and the notes left within minutes of each other, so nothing of the cash-out measures privacy; the dApp's "withdraw all" as such, its return of unused gas money, a withdrawal to another address than the sender and a withdrawal that opens a tree level were not sent; a single range of tree positions (change notes on leaves 195 to 231); each kind other than the two-note full withdrawal was sent twice; the per-order cost of the dApp's cash-out is a model's figure, not measured on Hoodi. The cash-out was sent from the main session; the owner's authorisation is stated to this task by the main session.
- No ETH/USD rate was read for the recovery; its fees are given in ETH only.
- The funder's outlay before the refunds of the repeat (0.909 ETH against about 0.757 printed by the run): the difference was not broken down.
- Whether any deposit of the repeat was priced in a block that would have failed the first run's funding: not reconstructed (section 9.4 gives the margins).
- The blocks between the package and the repeat (3808093 to 3809669) were not read in full (section 11.1 says what was compared instead).
- That the refused `prepareOrder` was signed with nonce 0 because the endpoint answered a stale count: inferred (section 9.2). That the fix removes it on the real endpoint: rehearsed against a proxy that imitates the behaviour; the repeat met no stale answer, so it neither confirms nor contradicts it (section 9.4).
- The calldata of the local file's own runs was not kept: where section 5.1 and section 7 say which byte differs (the 12 gas of `confirmIntention` and of `Chain`'s creation), it follows from the addresses: the local harness deploys `Storage` at an address with one zero byte (0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9, the fifth contract of the first Hardhat account), while Hoodi's `Storage` address has none, and `Storage` is an argument of `Chain`'s constructor and of `confirmIntention` (the independent check computed this; it assumes the harness's deployer starts at nonce 0); section 5.3 and the note of section 7 make the comparison with a local chain whose calldata is available.
- The states of the 10 orders on `No_Chain` were not read back when this line was written (the run reports them concluded and its 70 receipts are equal). They were read on 2026-10-13 at block 3810858, 21:42 UTC (section 13.12): all 10 are CONCLUDED and hold no ETH.
- What a browser wallet does with the fees and the balance of the establishment's own deposit (section 9.1): not examined.
- `benchmark-concurrent.cjs` and `benchmark-concurrent-l2.js` with the changed library: loaded and syntax-checked, not run. The default path of `benchmark-concurrent-sepolia.js --local` was run (rehearsal 13).
- The comparison report's framework scores (`hoodi-2026-10-13/comparison-report-2026-10-13T10-35-42-017Z.txt`) still assume anonymous ratings, as `generate-report.js` itself notes; only its gas, latency and cost tables come from these runs.

## Files and commands

```bash
# as run on 2026-10-13 (the commands of the readiness report, which is not published)
node benchmarking/hoodi-fund.cjs --yes                      # deployments/hoodi-2026-10-13/fund.log
CONFIG_OUT_DIR=deployments/hoodi-2026-10-13 MAX_FEE_GWEI=3 PRIORITY_FEE_GWEI=0.2 \
  npx hardhat --config hardhat.hoodi.config.js run --no-compile scripts/deploy_all.js --network hoodi          # deployment.json
CONFIG_OUT_DIR=deployments/hoodi-2026-10-13 MAX_FEE_GWEI=3 PRIORITY_FEE_GWEI=0.2 \
  npx hardhat --config hardhat.hoodi.config.js run --no-compile scripts/deploy_no_privacy.js --network hoodi   # deployment-no-privacy.json
cd benchmarking
export BENCH_NETWORK=hoodi DEPLOYMENT_RECORD=../deployments/hoodi-2026-10-13/deployment.json NO_PRIVACY_DEPLOYMENT_RECORD=../deployments/hoodi-2026-10-13/deployment-no-privacy.json
export PRIORITY_FEE_GWEI=0.2 ORDER_TOTAL_WEI=6000000000000000 RESULTS_DIR=results/hoodi-2026-10-13
export ETH_USD=2509.195 ETH_USD_SOURCE="Coinbase spot price API, api.coinbase.com/v2/prices/ETH-USD/spot" ETH_USD_AT=2026-10-13T09:24:59Z
ITERATIONS=10 node benchmark-privacy.js                    # privacy-2026-10-13T10-01-25-710Z.json
ITERATIONS=10 node benchmark-privacy.js --mechanisms-off   # mechanisms-off-2026-10-13T10-18-51-831Z.json
ITERATIONS=10 node benchmark-no-privacy.js                 # no-privacy-2026-10-13T10-35-24-831Z.json
node generate-report.js                                    # comparison-report-2026-10-13T10-35-42-017Z.txt, comparison-data-...csv
node benchmark-concurrent-sepolia.js --yes                 # concurrent-hoodi-2026-10-13T10-36-02-836Z.*
# the repeat of the cycle workload, 17:19 UTC (section 10.4), with the corrected scripts
export ETH_USD=2506.245 ETH_USD_AT=2026-10-13T17:18:44Z
WORKLOAD=cycle node benchmark-concurrent-sepolia.js --yes  # concurrent-hoodi-2026-10-13T17-19-28-266Z.*; run5-concurrency-cycle-repeat.log
# the recovery of the six open orders, 18:16 UTC (section 10.3)
GAS_FROM_FUNDER=1 node recover-ephemeral.cjs ephemeral-wallets-hoodi-2026-10-13T10-36-02-836Z.json --yes   # run6-recovery-open-orders.log
# the cash-out, 19:33 to 20:58 UTC (section 13): the commands of the two descriptions of the tools
# (WITHDRAWALS.md, section 3, and CASHOUT-KINDS.md, section 4; not published), with the settings
# and the secrets file, sender, recipient and --max 1 that the heads of the logs and the result files show
export BENCH_NETWORK=hoodi DEPLOYMENT_RECORD=../deployments/hoodi-2026-10-13/deployment.json
export PRIORITY_FEE_GWEI=0.2 MAX_FEE_GWEI=3 RESULTS_DIR=results/hoodi-2026-10-13
export ETH_USD=2507.445 ETH_USD_SOURCE="Coinbase spot price API, api.coinbase.com/v2/prices/ETH-USD/spot" ETH_USD_AT=2026-10-13T19:32:01Z
EST=0xEd2794006D72C83E42B5B7253144359E0947b9E7; FUN=0x82fD55a5eDc8F4242480dde230fe3Aa492eB156d
SEQ=ephemeral-wallets-privacy-run-hoodi-2026-10-13T09-29-09-980Z.json
CON=ephemeral-wallets-hoodi-2026-10-13T10-36-02-836Z.json; REP=ephemeral-wallets-hoodi-2026-10-13T17-19-28-266Z.json
# part 1: the notes of the two concurrency runs, funder -> funder. SENDS TRANSACTIONS.
node pool-cashout.cjs $CON --to $FUN --from funder --yes --max 1   # run7-cashout-concurrency-first.log; pool-cashout-hoodi-2026-10-13T19-33-42-752Z.json
node pool-cashout.cjs $CON --to $FUN --from funder --yes           # run7-cashout-concurrency-rest.log;  pool-cashout-hoodi-2026-10-13T19-35-11-787Z.json
node pool-cashout.cjs $REP --to $FUN --from funder --yes           # run7-cashout-repeat.log;            pool-cashout-hoodi-2026-10-13T19-39-40-417Z.json
# part 2: the ten one-time addresses, to the establishment (GAS_FROM_FUNDER must not be set)
env -u GAS_FROM_FUNDER RECOVER_TO=$EST node recover-ephemeral.cjs $SEQ         # dry run; run8-sweep-dry.log
env -u GAS_FROM_FUNDER RECOVER_TO=$EST node recover-ephemeral.cjs $SEQ --yes   # SENDS TRANSACTIONS; run8-sweep-one-time-addresses.log
# part 3: the ten notes of the sequential run with every kind of withdrawal, establishment -> establishment
node pool-cashout-kinds.cjs $SEQ                  # dry run; run9-cashout-kinds-dry.log
node pool-cashout-kinds.cjs $SEQ --yes --max 1    # SENDS: step 1; run9-cashout-kinds-first.log; pool-cashout-kinds-hoodi-2026-10-13T20-52-26-646Z.json
node pool-cashout-kinds.cjs $SEQ --yes            # SENDS: steps 2 to 10; run9-cashout-kinds-rest.log; pool-cashout-kinds-hoodi-2026-10-13T20-53-36-098Z.json
node pool-cashout-kinds.cjs $SEQ --no-prove       # read-only check; run9-cashout-kinds-check.log
```

- Run logs: `hoodi-2026-10-13/run1-privacy.log` to `run4-concurrency.log`, `run5-concurrency-cycle-repeat.log`, `run6-recovery-open-orders.log`, and for the cash-out `run7-cashout-concurrency-first.log`, `run7-cashout-concurrency-rest.log`, `run7-cashout-repeat.log`, `run8-sweep-dry.log`, `run8-sweep-one-time-addresses.log`, `run9-cashout-kinds-dry.log`, `run9-cashout-kinds-first.log`, `run9-cashout-kinds-rest.log`, `run9-cashout-kinds-check.log`. The lines of the repeat and of the recovery above are as the main session reports them and as the logs show; the logs do not record the command lines. The dApps' `config.js` files point to the Sepolia deployment and were not touched (md5 `0ea32ea6efcc7dfcdacba9ab4f2cc7a3` for all three, before and after this task); the generated Hoodi configuration is under `deployments/hoodi-2026-10-13/`.
- **The commands of the cash-out are not a transcript.** The logs hold the tools' output and `exit=0`, not the command lines. The lines above are the commands of the two descriptions, which were written before the cash-out, adjusted to what is on record: `MAX_FEE_GWEI=3` and the rate (the result files' fee settings and rate), the secrets file, the sender and the recipient (the heads of the logs), `--max 1` for the first withdrawal of the first concurrency run's notes (its log says "(--max 1)"; the description had planned one run for that file), and the log names as they exist. In the descriptions each sending command is piped through `tee` into its log and followed by a line that appends the exit code; those parts are left out above. The description planned to withdraw the sequential run's notes with `pool-cashout.cjs` in five withdrawals; that was replaced by part 3. Whether dry runs of part 1 were made before it is not in the logs. The two tools are `benchmarking/pool-cashout.cjs` (md5 `20fa9ea086505fe5af18bdef9e5eacce`) and `benchmarking/pool-cashout-kinds.cjs` (md5 `9556f16bc9eda10b3f02334c02d2ab49`), both git-ignored; how they were prepared, rehearsed on a private node and checked is in `withdrawals-prep.md`, `repeat-and-withdrawals-check.md`, `cashout-kinds-prep.md` and `cashout-kinds-check.md` of the same folder as the two descriptions.
- The read-back of the cash-out and the scripts that made section 13 and this update are in `hoodi7/writer/` of the session's scratch folder; those of the two checks and of the corrections of section 13.12 in `hoodi7/check-figures/`, `hoodi7/check-sent/` and `hoodi7/correct/`. The scratch folder is temporary and outside the repository. Copies of `hoodi7/`, of `hoodi4/rate.txt` and of `hoodi4/check/data/addrs.json`, to which sections 13.1 and 13.10 point, were put in a records folder on the authors' machine that git excludes; they are kept there, not in the repository. The file as it was before this update is kept in the same records folder.
- The read-back and analysis helpers, the consolidated data and the rehearsal (node configuration, sidecar, logs 01 to 16, results), the read-backs of the repeat and of the recovery, and the earlier versions of this file are not part of the repository. The helpers and the rehearsal use no key of a real account; the rehearsal's throwaway key is not published.
- Nothing in these files is a key: the 64-hex-digit values are transaction hashes.
