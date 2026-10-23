# Local gas of the order cycle on the final contracts (2026-10-12)

This file holds every gas figure of the article's tables for the contracts as they are to be deployed: the contracts of candidate v2 with the owner's decision of 2026-10-12 applied (whatever an order with a payment commitment pays its establishment, in any ending, is a note in the payment pool), and a no-privacy baseline that pays its parties when an order ends. It supersedes `local-gas-candidate-v2-2026-10-12.md`. Machine-readable copy: `local-gas-final-2026-10-12.json`.

**Everything is local.** In-process Hardhat network (Hardhat 2.28.6, hardfork `osaka`, block gas limit 60,000,000, chain id 31337), solc 0.8.20, optimizer 200 runs, EVM target `paris`. This is the gas schedule of the main network (checked call by call by the Sepolia preflight of the same day). **Nothing here was measured on Sepolia**, which has run another schedule since 2026-10-06; its figures are the task of the measurement after the deployment (section 13).

**Payload.** One item, a delivery address of 30 characters. Encrypted: 612 + 508 characters in `makeOrder`, 492 + 177 characters in `addInformation` (the dApps' late-release format). In the clear: one JSON string of 113 characters with the items and the address. An order with more items costs more wherever its text is stored: about 22,100 gas per 32 characters, twice for the two encrypted copies.

**Senders and amounts follow the dApps as they were at 22:40 UTC**: the customer's and the worker's transactions are sent with the node's gas estimate, the one-time address sends with the estimate × 1.2 and a legacy gas price, and withdraws from the pool the delivery fee plus gas price × 3,150,000 × 1.5 (`manager-frontend/src/utils/orderFunding.js`). The gas used does not depend on the limit, and on the amounts only through a few bytes of calldata.

## Summary

- **Privacy cycle**, 11 transactions: 4,869,916 gas for the first cycle of a deployment with a new worker, **4,833,322.3** for a later cycle (mean of cycles 2 to 10; 4,820,671 to 4,854,451). Without the pool deposit: 4,016,613 and **3,976,555.7**. These are for an almost empty note tree; section 8 gives the range by fill level.
- **Baseline (a)**, the no-privacy contracts with the items and the delivery address in the clear: 927,283 first, **893,072.3** later, 7 transactions.
- **Baseline (b)**, the privacy contracts with every mechanism switched off and the same plain string: 1,095,557 first, **1,061,353** later, 7 transactions. It costs 168,280.7 gas more than (a): the privacy contracts keep some of their bookkeeping whatever the arguments (section 3.3).
- **Overhead of the privacy cycle** (later cycles): +3,940,250 gas and **5.41×** against (a); +3,771,969.3 and **4.55×** against (b). Without the pool deposit: 4.45× and 3.75×.
- **What these ratios do not include.** (1) The cash-out that turns the establishment's notes into money: one withdrawal is 1.10 to 1.16 million gas, and with the dApp's policy the privacy model spent 2.9 to 3.4 withdrawals and 3.3 to 3.7 million gas per order (denomination 10 USD, mean revenue 35.76 USD per order, 20 establishments, three seeds; measured before the pool refunds). (2) The fill level of the note tree: a later cycle is 4.85 million to 4.87 million with 1,000 to 1,000,000 notes and 4,972,865 at the worst leaves measured, so the ratio against (a) moves from 5.41× to 5.45× and 5.57×. Both sides stop at delivery; in both baselines the establishment then holds its money, in the privacy cycle it holds a note.
- **By mechanism** (switching one off at a time; against (b)): the payment pool 2,861,663.7 gas (75.9 % of the overhead; 68.8 % without the deposit), the encryption of the order's content 849,157.7 (22.5 %; 29.1 %), of which the late release is 83,801, the one-time address with its stipend 61,146.7 (1.6 %; 2.1 %). The three add up to the overhead to within 1 gas.
- **Endings.** With a payment commitment an ending that pays the establishment inserts a note: 856,300 to 865,388 gas more than the same ending without one, paid by whoever sends it. The lowest gas limit accepted is 1.038 to 1.055 times the gas used; the highest found is 1,075,979.

## How to read the figures

- **Measured** means `gasUsed` of a mined receipt in the runs of this evening (22:40 to 22:45 UTC). "First" is cycle 1 of a run: the first order of a deployment and the first delivery of the worker. "Later" is the mean of cycles 2 to 10.
- **Computed** means arithmetic on measured figures (the leaf-index rule, sums, bounds). Every computed row or figure says so.
- **Carried over** means measured earlier on 2026-10-12 on code that did not change since; each such figure says so and why it still holds.
- Two runs of the same cycle differ by a few gas, because secrets and proofs are random and a zero byte of calldata costs less than another byte. Differences below about 50 gas are not findings.
- Every variant of the comparison (both baselines, each mechanism variant) starts from the same snapshot of the network, taken before cycle 1. Its cycle 1 is therefore also a first cycle, and its notes use the same leaves as far as it inserts any.

## 1. Privacy cycle, gas per call

Measured, 10 cycles (`hardhat-summary-10it-2026-10-12T22-42-50-080Z.json`).

| Call | Sent by | First cycle | Later cycles, mean | Min–max |
|---|---|---:|---:|---:|
| `stealthAnnounce` | customer | 26,245 | 26,243.7 | 26,233–26,245 |
| `makeOrder` | customer | 1,230,393 | 1,213,290.3 | 1,213,269–1,213,293 |
| `poolDeposit` | establishment's wallet | 853,303 | 856,766.7 | 853,303–859,540 |
| `poolWithdraw` | one-time address | 1,136,231 | 1,122,658.7 | 1,119,107–1,140,401 |
| `prepareOrder` | one-time address | 137,392 | 137,388 | 137,380–137,392 |
| `confirmIntention` | worker | 230,245 | 230,245 | 230,245–230,245 |
| `addInformation` | customer | 60,130 | 60,130 | 60,130–60,130 |
| `pickupOrder` | one-time address | 68,770 | 68,775.7 | 68,770–68,787 |
| `deliveryOrder` | worker | 1,011,318 | 1,001,935.3 | 994,201–1,019,634 |
| `rateOrder_client` | customer | 57,957 | 57,957 | 57,957–57,957 |
| `rateOrder_restaurant` | one-time address | 57,932 | 57,932 | 57,932–57,932 |
| **Cycle, 11 transactions** |  | **4,869,916** | **4,833,322.3** | 4,820,671–4,854,451 |
| **Cycle without `poolDeposit`** |  | **4,016,613** | **3,976,555.7** | 3,967,368–3,994,911 |

- The first cycle pays first writes that later cycles do not: `Chain.lastOrder` in `makeOrder` (17,100), the worker's record at delivery (17,117), and tree levels whose slot is still empty.
- `poolDeposit`, `poolWithdraw` and `deliveryOrder` each insert one note; their gas depends on the leaf index (section 8). `deliveryOrder` costs 2,494 gas more than before the pool refunds: the order reads three values of the pool before it deposits.
- The same ten cycles run again from the same state give 4,869,940 and 4,833,339.7.
- Off-chain steps of the cycle (no gas): the derivation of the one-time address, the withdrawal proof, the sealing and the opening of the worker's details (section 12).

## 2. The cycle, with and without the pool deposit

|  | First cycle | Later cycles, mean | Min–max |
|---|---:|---:|---:|
| Privacy cycle | 4,869,916 | 4,833,322.3 | 4,820,671–4,854,451 |
| Privacy cycle without `poolDeposit` | 4,016,613 | 3,976,555.7 | 3,967,368–3,994,911 |
| Baseline (a) | 927,283 | 893,072.3 | 892,994–893,100 |
| Baseline (b) | 1,095,557 | 1,061,353 | 1,061,328–1,061,374 |

The pool deposit is given apart because an establishment need not deposit once per order: one deposit can fund the collateral of several orders. The benchmark deposits once per cycle and merges the deposit with the change note of the previous withdrawal.

## 3. The two baselines

### 3.1 What each is

- **(a) The no-privacy contracts** (`contracts/contracts_no_privacy`), as they are now: orders are minimal proxies of one implementation, as in the privacy contracts, and `deliveryOrder` pays the establishment and the worker by transfers. The cycle sends what a system without privacy must publish: the item list and the delivery address in the clear. **Where the address goes:** the baseline's `makeOrder` has one text field, `_items`; the benchmark sends `{"items": [...], "deliveryAddress": "..."}` in it (113 characters). The order stores the string and `getOrder` returns it to the order's worker, which the benchmark checks. `confirmIntention` is sent with a zero key (the baseline ignores the key and the storage address).
- **(b) The privacy contracts with every mechanism switched off**: no announcement, the establishment's own account as the establishment, no stipend, payment commitment zero and no pool call, the same plain string of 113 characters as the establishment's text and an empty customer's copy, a zero key at `confirmIntention`, no `addInformation`. Same contracts, same rules, same code path as the privacy cycle (`runChainCycle` of `benchmark-hardhat.cjs` with every switch off). The zone is kept: it is not a privacy mechanism.

### 3.2 Gas per call

| Call | (a) first | (a) later | (b) first | (b) later | (b) − (a), later |
|---|---:|---:|---:|---:|---:|
| `makeOrder` | 393,194 | 376,094 | 446,785 | 429,685 | +53,591 |
| `prepareOrder` | 109,991 | 109,989.7 | 117,108 | 117,108 | +7,118.3 |
| `confirmIntention` | 106,599 | 106,597.7 | 189,917 | 189,917 | +83,319.3 |
| `pickupOrder` | 68,434 | 68,437.6 | 68,770 | 68,775.7 | +338.1 |
| `deliveryOrder` | 98,947 | 98,938.1 | 157,088 | 139,978.3 | +41,040.2 |
| `rateOrder_client` | 92,152 | 75,050.7 | 57,957 | 57,957 | −17,093.7 |
| `rateOrder_restaurant` | 57,966 | 57,964.7 | 57,932 | 57,932 | −32.7 |
| **Cycle, 7 transactions** | **927,283** | **893,072.3** | **1,095,557** | **1,061,353** | **+168,280.7** |

### 3.3 Why (b) costs more than (a)

The difference is 168,280.7 gas per later cycle. Its parts per call are measured; the causes are read from the code, and only the zone was measured apart.

- `confirmIntention`, +83,319.3: `Chain` registers the worker's key in `Storage` (a call to another contract, a timestamp and two array entries: three new storage words even for a zero key), and checks the order's index and the storage address. This is bookkeeping of the encryption that arguments cannot switch off.
- `makeOrder`, +53,591: the order registry `isOrder` (one new word), the reputation contract's address in the order (one new word), the zone event (2,857, measured by a run without the zone), the customer's copy (empty), five more arguments.
- `deliveryOrder`, +41,040.2: the order reports the delivery to the reputation contract (a call, the worker's record, and the first write of the word that holds this order's ratings) and reads its payment commitment.
- `prepareOrder`, +7,118.3: three more words written (commitment and the two minimums, all zero).
- `rateOrder_client`, −17,093.7: in (a) the first rating writes the order's rating word for the first time; in the privacy contracts that word was written at delivery.
- `pickupOrder` +338.1, `rateOrder_restaurant` −32.7.

Storing the plain string a second time as the customer's copy would add 110,875 gas to (b) (measured; not part of (b)).

### 3.4 Baseline (a) against the earlier baseline figures

| Baseline cycle, later | Gas | What changed |
|---|---:|---|
| Deploying its code per order (morning) | 2,653,277.3 | carried over; not like for like |
| As proxy, no payout, items only (afternoon) | 820,317.3 | carried over; the 5.89× of the superseded file |
| As proxy, payout at delivery, items only, worker's key in the calldata | 848,318.3 | measured this evening; +30,424 in `deliveryOrder` (two transfers, two ledger writes), −2,370 in `confirmIntention` (no deposit) |
| **(a): the same with the delivery address and a zero key** | **893,072.3** | measured; `makeOrder` +45,522 (two more storage words for 61 more characters), `confirmIntention` −768 (calldata) |

## 4. Overhead of the privacy cycle against each baseline

|  | Privacy | Baseline (a) | Overhead against (a) | Baseline (b) | Overhead against (b) |
|---|---:|---:|---:|---:|---:|
| **Later cycles** | 4,833,322.3 | 893,072.3 | +3,940,250 (5.41×) | 1,061,353 | +3,771,969.3 (4.55×) |
| **Later cycles, without the pool deposit** | 3,976,555.7 | 893,072.3 | +3,083,483.3 (4.45×) | 1,061,353 | +2,915,202.7 (3.75×) |
| First cycle | 4,869,916 | 927,283 | +3,942,633 (5.25×) | 1,095,557 | +3,774,359 (4.45×) |
| First cycle, without the pool deposit | 4,016,613 | 927,283 | +3,089,330 (4.33×) | 1,095,557 | +2,921,056 (3.67×) |

Per call, later cycles:

| Call | Privacy | (a) | Privacy − (a) | (b) | Privacy − (b) |
|---|---:|---:|---:|---:|---:|
| `stealthAnnounce` | 26,243.7 | — | +26,243.7 | — | +26,243.7 |
| `makeOrder` | 1,213,290.3 | 376,094 | +837,196.3 | 429,685 | +783,605.3 |
| `poolDeposit` | 856,766.7 | — | +856,766.7 | — | +856,766.7 |
| `poolWithdraw` | 1,122,658.7 | — | +1,122,658.7 | — | +1,122,658.7 |
| `prepareOrder` | 137,388 | 109,989.7 | +27,398.3 | 117,108 | +20,280 |
| `confirmIntention` | 230,245 | 106,597.7 | +123,647.3 | 189,917 | +40,328 |
| `addInformation` | 60,130 | — | +60,130 | — | +60,130 |
| `pickupOrder` | 68,775.7 | 68,437.6 | +338.1 | 68,775.7 | +0 |
| `deliveryOrder` | 1,001,935.3 | 98,938.1 | +902,997.2 | 139,978.3 | +861,957 |
| `rateOrder_client` | 57,957 | 75,050.7 | −17,093.7 | 57,957 | +0 |
| `rateOrder_restaurant` | 57,932 | 57,964.7 | −32.7 | 57,932 | +0 |

**Next to every ratio of this section belongs what it leaves out:**

1. **The cash-out.** The cycle ends with the establishment's revenue as a note in the pool. Turning notes into money is a `mergeWithdraw` of 1.10 to 1.16 million gas each (section 9). With the dApp's cash-out policy the privacy model spent 2.93 to 3.38 withdrawals and 3,278,736 to 3,737,383 gas per order (means of three seeds for an establishment float of 45 USD and of 1,400 USD; 20 establishments, 500 orders, denomination 10 USD, mean revenue 35.76 USD per order; `privacy-eval-candidate-v2-2026-10-12.md`, table 4c; measured before the pool refunds, which add notes for returned collateral). The number of withdrawals grows with the revenue per order divided by the denomination. Added to the cycle (computed, not one measurement): 8.11 million to 8.57 million gas per order, 9.08× to 9.60× baseline (a) and 7.64× to 8.08× baseline (b).
2. **The fill level of the note tree.** The figures above are for a tree with 2 to 31 notes. With 1,000 to 1,000,000 notes a later cycle is 4,852,858.7 to 4,870,361.3 gas (5.43× to 5.45× against (a), 4.57× to 4.59× against (b)); the worst cycle measured is 4,972,865 (5.57× and 4.69×). The baselines do not use the tree. Section 8.
3. **The payload.** One item. More items raise the privacy cycle faster than the baselines: it stores two copies, and a ciphertext is several times as long as its plain text (here 612 and 508 characters against 113).

## 5. Overhead by mechanism

Measured by running the whole cycle ten times with one mechanism switched off, and ten times with one mechanism switched on from baseline (b). This replaces the earlier side measurements of single calls.

### 5.1 One mechanism switched off

| Switched off | First cycle | Later cycles | Against the privacy cycle | Transactions |
|---|---:|---:|---:|---:|
| the one-time address and its stipend | 4,808,720 | 4,772,175.7 | −61,146.7 | 10 |
| the encryption of the order's content (the late release goes with it) | 4,020,669 | 3,984,164.7 | −849,157.7 | 10 |
| the late release alone (the details encrypted for the worker's key at once) | 4,786,123 | 4,749,521.3 | −83,801 | 11 |
| the pool: its funding and the payment commitment | 2,026,832 | 1,992,658.7 | −2,840,663.7 | 10 |
| the pool's funding alone (deposit, proof, withdrawal) | 2,901,382 | 2,873,047.7 | −1,960,274.7 | 10 |
| the payment commitment alone (the revenue note) | 3,995,438 | 3,951,148 | −882,174.3 | 11 |

### 5.2 One mechanism switched on from baseline (b)

| Switched on | First cycle | Later cycles | Against baseline (b) | Transactions |
|---|---:|---:|---:|---:|
| the one-time address and its stipend | 1,177,705 | 1,143,493 | +82,140 | 9 |
| the encryption of the order's content, with the late release | 1,944,720 | 1,910,516 | +849,163 | 8 |
| the pool: funding and payment commitment | 3,959,617 | 3,923,011.3 | +2,861,658.3 | 9 |
| the payment commitment alone | 1,970,071 | 1,941,744.7 | +880,391.7 | 7 |

### 5.3 The overhead of each mechanism

| Mechanism | Gas per later cycle | Share of the overhead against (b) | Share without the pool deposit | Share against (a) | Share against (a) without the deposit |
|---|---:|---:|---:|---:|---:|
| Payment pool (deposit, proof and withdrawal, payment commitment, revenue note) | 2,861,663.7 | 75.9 % | 68.8 % | 72.6 % | 65.0 % |
| Encryption of the order's content (two ciphertexts, the worker's key, `addInformation`) | 849,157.7 | 22.5 % | 29.1 % | 21.6 % | 27.5 % |
| — of which the late release of the worker's details | 83,801 | 2.2 % | 2.9 % | 2.1 % | 2.7 % |
| One-time address (announcement, stipend) | 61,146.7 | 1.6 % | 2.1 % | 1.6 % | 2.0 % |
| The privacy contracts with every mechanism off, against (a) (section 3.3) | 168,280.7 | — | — | 4.3 % | 5.5 % |
| **Overhead** | **3,771,969.3** against (b); **3,940,250** against (a) | 100 % | 100 % | 100 % | 100 % |

Without the pool deposit the overhead is 2,915,202.7 against (b) and 3,083,483.3 against (a), and the pool's part is 2,004,897.

### 5.4 What interacts

- **The three mechanisms add up.** 61,146.7 + 849,157.7 + 2,861,663.7 = 3,771,968.0, against an overhead of 3,771,969.3 over (b): the difference is the calldata of the proofs. Switching a mechanism on from (b) gives the same figure as switching it off from the full cycle: 849,163 against 849,157.7 for the encryption, 2,861,658.3 against 2,861,663.7 for the pool, 61,140 against 61,146.7 for the one-time address.
- **The one-time address needs the pool's funding.** Without it the address would have to be funded by a plain transfer from the establishment's wallet, which names the address and so defeats it; no dApp does this. The benchmark sends that transfer where a variant keeps the address and drops the funding (21,000 gas, row `fundTransfer`), and the pool's figure above is given without it: 2,840,663.7 measured + 21,000. In the other direction, without the one-time address the funding withdrawal has no purpose: the benchmark then withdraws to the establishment's own account so that only the address and its stipend are removed.
- **The late release needs the encryption.** It cannot be switched on alone, and switching the encryption off removes it. Its 83,801 gas are inside the encryption's figure: 104 more characters in the establishment's ciphertext (the pickup secret) cost more than the shorter second string of `addInformation` saves.
- **The pool's two parts overlap by leaf indices only.** Funding alone 1,981,274.7 (with the transfer taken out) and payment commitment alone 882,174.3 sum to 2,863,449, 1,785.3 more than both together: with fewer notes per cycle the remaining notes land on other leaves (section 8).
- **Not a mechanism of its own:** the ratings are in the clear in every variant, and the reputation thresholds were not used (zero).

## 6. Every ending, with and without a payment commitment

Measured after the ten cycles, on fresh orders: each ending once without a payment commitment and 3 times with one. T is the food total less the stipend, F the fee, which is also the establishment's collateral. Every order has a one-time address with a stipend. "Lowest limit" is the lowest gas limit with which the transaction is accepted, found by bisection from the same state for the order without a commitment and for the first one with.

| Ending | Sent by | Establishment gets | Gas without a commitment | Gas with one (median) | Range | The note adds | Lowest limit without | Lowest limit with |
|---|---|---|---:|---:|---:|---:|---:|---:|
| ORDERED, customer cancels | customer | 0 | 101,959 | 101,959 | — | 0 | 111,150 | 111,150 |
| ORDERED, establishment refuses | one-time address | 0 | 104,780 | 104,780 | — | 0 | 114,062 | 114,062 |
| PREPARATION, customer cancels | customer | T+F | 95,138 | 958,032, note | 955,953–960,111 | +862,894 | 109,086 | 1,010,870 |
| PREPARATION, establishment cancels | one-time address | F | 95,452 | 960,834, note | 960,834–962,901 | +865,382 | 109,409 | 1,013,761 |
| PREPARATION timeout | customer | F | 95,076 | 960,037, note | 957,958–960,037 | +864,961 | 109,021 | 1,010,792 |
| reopened, customer cancels | customer | T+F | 97,377 | 960,256, note | 958,177–964,414 | +862,879 | 111,396 | 1,017,524 |
| reopened, establishment cancels | one-time address | F | 97,679 | 963,058, note | 963,058–965,137 | +865,379 | 111,708 | 1,016,056 |
| reopened, timeout | customer | F | 97,303 | 962,261, note | 962,261–964,340 | +864,958 | 111,320 | 1,015,267 |
| WAITING, customer cancels | customer | T+F | 103,094 | 968,052, note | 965,973–968,052 | +864,958 | 112,390 | 1,002,880 |
| WAITING, establishment cancels | one-time address | 0 | 103,319 | 103,319 | — | 0 | 112,622 | 112,622 |
| WAITING timeout | customer | F | 137,266 | 999,803, note | 997,724–999,803 | +862,537 | 152,562 | 1,054,045 |
| WAITING, second worker withdraws | worker | F | 143,532 | 1,006,069, note | 997,753–1,025,248 | +862,537 | 159,029 | 1,060,511 |
| DISPATCHED, worker cancels (leaves after pickup) | worker | F | 141,774 | 998,074, note | 998,074–1,000,153 | +856,300 | 157,214 | 1,052,159 |
| DISPATCHED timeout | customer | F | 137,750 | 996,129, note | 994,050–996,129 | +858,379 | 153,061 | 1,048,006 |
| DISPATCHED, customer cancels | customer | T+F | 103,317 | 966,196, note | 964,105–968,275 | +862,879 | 112,620 | 1,005,255 |
| DISPATCHED, establishment cancels | one-time address | 0 | 103,542 | 103,542 | — | 0 | 112,852 | 112,852 |
| contested, against the customer | one-time address | T+F | 92,783 | 958,171, note | 958,171–960,250 | +865,388 | 101,734 | 994,812 |
| contested, against the worker | one-time address | F | 131,907 | 994,886, note | 994,886–996,965 | +862,979 | 147,017 | 1,048,922 |
| delivered | worker | T+F | 139,971 | 998,359, note | 996,297–998,359 | +858,388 | 150,386 | 1,035,056 |
| WAITING timeout, worker without a record | customer | F | 154,366 | 1,014,812, note | 1,012,745–1,014,824 | +860,446 | 170,209 | 1,069,513 |
| WAITING, second worker withdraws, worker without a record | worker | F | 160,632 | 1,021,090, note | 1,019,011–1,023,169 | +860,458 | 176,675 | 1,075,979 |
| DISPATCHED, worker cancels, worker without a record | worker | F | 158,874 | 1,019,332, note | 1,019,332–1,021,411 | +860,458 | 174,861 | 1,074,165 |
| DISPATCHED timeout, worker without a record | customer | F | 154,850 | 1,017,387, note | 1,015,308–1,017,387 | +862,537 | 170,708 | 1,070,012 |
| contested, against the worker, worker without a record | one-time address | F | 149,019 | 1,009,907, note | 1,007,828–1,016,144 | +860,888 | 164,676 | 1,070,928 |
| delivered, worker without a record | worker | T+F | 157,088 | 1,015,476, note | 1,015,476–1,017,555 | +858,388 | 168,051 | 1,054,883 |

- With a commitment the establishment's amount is a note under that commitment, inserted by the transaction that ends the order; nothing goes to the one-time address. The benchmark checks, for each of the 63 orders that made a note: the leaf is poseidon(commitment, amount), `getOrder` field 5 gives the establishment that amount, the pool received exactly it, the order is empty afterwards. Without a commitment: a transfer, no note, field 5 zero.
- An order in `ORDERED` has no commitment yet; the two endings in which the establishment gets nothing insert no note.
- **Who pays the insertion:** the sender of the ending. The customer for their own cancellations and for every timeout they call; the worker for leaving after pickup, for a second worker's withdrawal and for a delivery; the one-time address for its own cancellation and for both contested decisions.
- **Gas limits.** With a note the lowest accepted limit is 1.038 to 1.055 times the gas used (each call level keeps 1/64 of the gas); the highest found is 1,075,979. A fixed limit needs room above that, and more on Sepolia.
- The rows "worker without a record" use a new account for every order: the first write of a worker's record costs 17,100 gas more.

### Agreement with the table of the pool-refunds folder

The table of the pool-refunds work (`gas-pool-refunds.md`, not published) measured the same endings in a scratch copy, with other orders (1 USD of food instead of 10, a fixed stipend, the earlier worker's strings). The two tables agree:

- **Without a commitment**: equal in 20 of the 24 common endings and 5 to 12 gas apart in 3 (address bytes in the calldata). The one real difference is "`WAITING`, second worker withdraws": 143,532 here against 160,632 there. There the second worker had no record when the order without a commitment ran, and that table's row is the same figure as its "worker without a record" row; here the second worker had delivered twice. The difference is 17,100 gas, the first write of a record.
- **With a commitment**: the medians differ by up to 4,158 gas, because the notes land on other leaves (leaves 38 to 100 here, 21 to 80 there). With the leaf index taken out by the rule of section 8 (2,079 gas per 1 bit after the first, 17,100 at a leaf 2^k − 1), every ending gives the same gas in both tables to within 17 gas.
- **Lowest limits** differ by up to 4,371 gas for the same reason; for the delivery, 1,035,056 here against 1,061,685 there, where the three orders used up to 1,021,696 gas.
- That table has no row for a delivery by a worker without a record.

## 7. Paths that are not in a normal cycle

Measured. Run 1: workers without a record; run 2: the same workers again. Both paths use a one-time address with a stipend and a payment commitment; the deployer funds the address directly instead of the pool withdrawal (not what the dApp does, not counted).

| Path | Call | Run 1 | Run 2 | Note at leaf |
|---|---|---:|---:|---|
| leaving | stealthAnnounce | 26,245 | 26,245 | — |
| leaving | makeOrder | 1,213,293 | 1,213,293 | — |
| leaving | prepareOrder | 137,392 | 137,392 | — |
| leaving | confirmIntention_first | 230,245 | 230,245 | — |
| leaving | addInformation_first | 60,130 | 60,130 | — |
| leaving | leave_beforePickup (first worker's cancelOrder in WAITING) | 111,877 | 94,777 | — |
| leaving | rateOrder_restaurant, worker who left before pickup | 58,487 | 58,487 | — |
| leaving | confirmIntention_second | 139,936 | 139,936 | — |
| leaving | addInformation_second | 60,141 | 60,141 | — |
| leaving | pickupOrder_second | 68,775 | 68,770 | — |
| leaving | deliveryOrder_second | 1,011,301 | 996,280 | 32, 34 |
| leaving | rateOrder_client, second worker | 57,957 | 57,957 | — |
| leaving | rateOrder_restaurant, second worker | 57,932 | 57,932 | — |
| replacement | stealthAnnounce | 26,245 | 26,233 | — |
| replacement | makeOrder | 1,213,293 | 1,213,293 | — |
| replacement | prepareOrder | 137,392 | 137,392 | — |
| replacement | confirmIntention_first | 230,245 | 230,245 | — |
| replacement | addInformation_first | 60,130 | 60,130 | — |
| replacement | replacement (callSecondDeliveryman) | 100,617 | 83,517 | — |
| replacement | rateOrder_restaurant, replaced worker | 58,487 | 58,487 | — |
| replacement | confirmIntention_second | 139,936 | 139,936 | — |
| replacement | addInformation_second | 60,141 | 60,141 | — |
| replacement | pickupOrder_second | 68,775 | 68,770 | — |
| replacement | leave_afterPickup (second worker's cancelOrder in DISPATCHED) | 1,017,654 | 1,002,633 | 33, 35 |
| replacement | rateOrder_client, worker who left after pickup | 58,512 | 58,512 | — |
| replacement | rateOrder_restaurant, worker who left after pickup | 58,487 | 58,487 | — |
| leaving | **Total of the path** | **3,233,711** | **3,201,585** |  |
| replacement | **Total of the path** | **3,229,914** | **3,197,776** |  |

- *leaving*: the first worker gives up before pickup, the order is offered again, a second worker concludes it.
- *replacement*: the establishment replaces the first worker; the second picks up and then gives up. That leaving ends the order: the customer is refunded and the establishment's collateral comes back as a note of the fee under the order's payment commitment. Before the pool refunds this call cost 159,386 and 142,286 gas and paid the one-time address. The benchmark now records that note as it records a delivery's (leaf, field 5, empty order).

## 8. Fill level of the note tree

**Re-measured this evening**, because `deliveryOrder` changed: seven runs of ten cycles with real withdrawal proofs, on trees whose first free leaf is the index given (a tree of that size installed in the contract's storage, not grown by that many insertions).

| Next leaf index at the start | Cycle 1 | Later cycles, mean (min–max) | Without the pool deposit | Against (a) | Against (b) |
|---|---:|---:|---:|---:|---:|
| tree as deployed (leaves 2 to 31) | 4,869,916 | 4,833,322.3 (4,820,671–4,854,451) | 3,976,555.7 (3,967,368–3,994,911) | 5.41× | 4.55× |
| 1,000 | 4,890,262 | 4,852,858.7 (4,824,848–4,868,956) | 3,987,782.7 (3,969,478–3,999,045) | 5.43× | 4.57× |
| 100,000 | 4,890,274 | 4,864,127 (4,858,105–4,870,591) | 3,995,347 (3,990,285–4,000,656) | 5.45× | 4.58× |
| 1,000,000 | 4,896,475 | 4,870,361.3 (4,864,342–4,876,864) | 3,999,505 (3,994,395–4,004,850) | 5.45× | 4.59× |
| 2^24 − 34 | 4,973,434 | 4,944,063.7 (4,937,160–4,949,617) | 4,048,489 (4,044,356–4,052,655) | 5.54× | 4.66× |
| 2^24 − 16 (five cycles below 2^24, five above) | 4,977,568 | 4,884,045 (4,820,719–4,972,865) | 4,009,259 (3,967,416–4,073,824) | 5.47× | 4.60× |
| 2^25 − 64 (almost full) | 4,971,331 | 4,945,213.3 (4,939,203–4,951,684) | 4,049,406.3 (4,044,315–4,054,722) | 5.54× | 4.66× |
| **Worst cycle measured: leaves 2^24 − 3 to 2^24 − 1** |  | **4,972,865** | **4,073,824** | 5.57× | 4.69× |
| Base: every note at a leaf with one 1 bit (computed) |  | 4,816,529.7 | 3,963,226.7 | 5.39× | 4.54× |

- **The range measured in the afternoon stays valid, shifted by the 2,494 gas of `deliveryOrder`.** The means of the six runs that have an afternoon counterpart are 2,495 to 2,508 gas above it (afternoon: 4,830,823; 4,850,362; 4,861,626; 4,867,866; 4,941,556; 4,942,715); the run at 2^24 − 16 mixes leaves below and above 2^24 and is given for its worst cycle. `depositPayment` and `mergeWithdraw` did not change (`contracts/Reputation.sol` is the afternoon's file).
- **The rule.** gas(i) = base + 2,079 × (number of 1 bits of the leaf index − 1) + 17,100 if i = 2^k − 1. Bases: `depositPayment` 853,303; `mergeWithdraw` with two notes 1,117,064; `deliveryOrder` **994,201** (991,707 before the pool refunds). Checked on the 210 insertions of the seven runs: largest difference 36 gas (the proofs' calldata). That the rule is exact with the same calldata at 84 chosen indices, and that the last leaf 2^25 − 1 costs 5,049 less, is carried over from the afternoon.
- **Figure to quote for a later cycle:** 4.83 million gas on an almost empty tree; 4.85 million to 4.87 million with 1,000 to 1,000,000 notes; the largest cycle measured is 4,972,865, with its three notes on the consecutive leaves 2^24 − 3 to 2^24 − 1 and a worker who had delivered before. Without the pool deposit: 3.98 million; 3.99 million to 4.00 million; 4,073,824.
- **Upper bound (computed from the rule):** at any fill level of the depth-25 tree a later cycle costs at most 4,977,081 gas when its three notes may be on any leaves (other establishments' notes in between) and the worker has delivered before, and at most 4,994,198 when it is also the worker's first delivery. That is base + 64,917 (the dearest leaf, 2^24 − 1) + 2 × 47,817 (a leaf with 24 one bits), + 17,117.

**Computed rows** (not measured). Convention: the base cycle plus three times the mean extra of a leaf over *all* leaves below n (two times without the pool deposit); "largest" is the base cycle plus the largest extra of *any* three consecutive leaves below n, whether or not one cycle would use exactly those three.

| Notes in the tree (n) | Mean cycle so far (computed) | Without the pool deposit (computed) | Largest cycle so far (computed) |
|---|---:|---:|---:|
| 1,000 | 4,841,547 | 3,979,905 | 4,879,368 |
| 100,000 | 4,861,134 | 3,992,963 | 4,923,027 |
| 1,000,000 | 4,871,946 | 4,000,171 | 4,941,738 |
| 16,777,216 | 4,885,137 | 4,008,965 | 4,972,923 |
| 33,554,432 | 4,888,255 | 4,011,044 | 4,972,923 |

## 9. Cash-out withdrawal

One `mergeWithdraw` of the denomination (10 USD) sent and received by the establishment's own wallet, after the cycles of each run. With one input the second is the dummy note. Measured this evening:

| Run (next leaf index at the start) | Inputs | Gas | Leaf of the change note | 1 bits |
|---|---|---:|---:|---:|
| tree as deployed | one note + dummy | 1,096,713 | 36 | 2 |
| tree as deployed | two notes | 1,121,210 | 37 | 3 |
| 1,000 | one note + dummy | 1,100,919 | 1,035 | 4 |
| 1,000 | two notes | 1,121,186 | 1,036 | 3 |
| 100,000 | one note + dummy | 1,109,211 | 100,035 | 8 |
| 100,000 | two notes | 1,129,514 | 100,036 | 7 |
| 1,000,000 | one note + dummy | 1,113,369 | 1,000,035 | 10 |
| 1,000,000 | two notes | 1,133,672 | 1,000,036 | 9 |
| 2^24 − 34 | one note + dummy | 1,096,761 | 16,777,217 | 2 |
| 2^24 − 34 | two notes | 1,119,119 | 16,777,218 | 2 |
| 2^24 − 16 | one note + dummy | 1,100,919 | 16,777,235 | 4 |
| 2^24 − 16 | two notes | 1,121,186 | 16,777,236 | 3 |
| 2^25 − 64 | one note + dummy | 1,138,329 | 33,554,403 | 22 |
| 2^25 − 64 | two notes | 1,158,584 | 33,554,404 | 21 |

- This evening: one note with the dummy note 1,096,713 to 1,138,329; two notes 1,119,119 to 1,158,584.
- **Carried over from the afternoon** (`mergeWithdraw` did not change): one note with the dummy note is 1,094,665 gas at a leaf with one 1 bit and 1,159,575 at leaf 2^24 − 1, the dearest leaf (measured then; this evening the paths add two notes, so no cash-out landed on that leaf). Two notes: 1,117,031 at a one-bit leaf; the maximum 1,181,948 is computed from the rule, not measured.
- **Figure to quote:** a cash-out withdrawal costs 1.10 to 1.16 million gas with one note and 1.12 to 1.18 million with two (the last value computed).
- **Per order**, from the privacy evaluation (not this benchmark): see point 1 of section 4.

## 10. Deployment

Measured this evening (same order and linking as `scripts/deploy_all.js` and `scripts/deploy_no_privacy.js`).

| Transaction | Gas |
|---|---:|
| Poseidon | 2,157,126 |
| MergeWithdrawVerifier | 450,071 |
| GlobalReputation | 3,721,625 |
| Util | 882,183 |
| Storage | 489,610 |
| Chain (with the Order implementation) | 4,049,292 |
| GlobalReputation.setChain | 44,156 |
| Storage.setChain | 44,088 |
| StealthAnnouncer | 151,293 |
| **Privacy contracts, 9 transactions** | **11,989,444** |
| baseline (a): No_Util | 882,183 |
| baseline (a): No_Chain | 3,660,265 |
| **Baseline (a), 2 transactions** | **4,542,448** |

Earlier baselines, carried over and labelled (they are not the baseline of this file):

| Baseline build | No_Util | No_Chain | Total |
|---|---:|---:|---:|
| As proxy, before the payout (afternoon of 2026-10-12) | 927,431 | 3,559,720 | 4,487,151 |
| Deploying its code for every order (morning of 2026-10-12) | 927,431 | 3,365,423 | 4,292,854 |

- `Chain` with the `Order` implementation was about 3,949,200 gas before the pool refunds (the privacy total 11,889,363, carried over): the `Order` code grew from 12,254 to 12,717 bytes.
- `No_Util` now holds the payout table of the privacy contracts' `Util`, copied unchanged; the two libraries deploy with the same gas.
- Baseline (b) needs no deployment of its own: it runs on the privacy contracts.

## 11. Note tree and withdrawal circuit by depth

**Carried over** from the gas study of the afternoon (`gas-study-candidate-v2-2026-10-12.md`): the tree code (`contracts/Reputation.sol`), the harness (`contracts/test/NoteTreeDepthHarness.sol`) and the circuit did not change since. Insertion gas is the mean of insertions 1,025 to 1,056 in a harness, called from a contract (3.5 one bits on average). Proving time is the mean of five proofs on circuits built in a scratch folder for depths 12, 16 and 20, on a shared host: indicative.

| Depth | Leaves | Insertion gas, warm, in-contract | Earlier code | Withdrawal constraints | Proving ms (mean of 5) |
|---|---:|---:|---:|---:|---:|
| 12 | 4,096 | 414,108 | 471,794 | 17,246 | 616 |
| 16 | 65,536 | 534,898 | 621,596 | 21,398 | 698 |
| 20 | 1,048,576 | 655,690 | 771,400 | 25,550 | 756 |
| 25 | 33,554,432 | 806,682 | 958,654 | 30,740 | 829 |

- 30,198 gas per level (37,451 with the earlier code); 1,038 constraints per level; `verifyProof` 222,177 gas in-contract at every depth.
- Share of the insertion (801,484 gas at a one-bit leaf) in each call: `depositPayment` 853,303, 93.9 %; `mergeWithdraw` with two notes 1,117,064, 71.8 %; with one note and the dummy note 1,094,665, 73.2 %; `deliveryOrder` **994,201, 80.6 %** (recomputed with this evening's base; 80.8 % before).

## 12. Off-chain times

**To quote: carried over from the afternoon**, when the host was less loaded (mean over cycles 2 to 10 of seven runs, 63 cycles; i5-12500H, 16 threads, Node 20; not browser times).

| Step (ms) | Mean | Min–max | First in a process |
|---|---:|---:|---:|
| One-time address (derive and recover) | 9.4 | 8.4–12.9 | 34.3 |
| Withdrawal proof, `fullProve` | 828 | 763–910 | 2067 |
| Sealing the worker's details | 2.1 | 1.8–2.6 | 11.4 |
| Opening them | 3.1 | 2.6–5.1 | 3.2 |

**This evening's runs** (measured, 63 cycles, with other tasks on the host: 1-minute load average 4 to 10) give 830 ms for `fullProve` (733 to 1227), 9.7 ms for the one-time address, 2.2 ms for the sealing and 3.3 ms for the opening. The off-chain code did not change. The figures to quote stay the afternoon's, taken on a less loaded host; a first set of runs this evening, under a load of 6 to 12, gave 1,004 ms for `fullProve`. The gas figures do not depend on the load.

## 13. Sepolia

Not measured here. The read-only preflight of 2026-10-12 (not published) simulated the contracts *before* the pool refunds on Sepolia's state: a later privacy cycle 11.50 million gas, a baseline cycle (items only, no payout) 2.83 million, 4.06× against 5.90× locally then. Those are not figures of the final contracts, and neither baseline of this file was simulated.

The scripts for the measurement were prepared and checked on a private local node (see the report of this task and `README.md`): `benchmark-privacy.js` (the privacy cycle, and baseline (b) with `--mechanisms-off`), `benchmark-no-privacy.js` (baseline (a)), `benchmark-concurrent-sepolia.js`, `generate-report.js`. They take the addresses from the deployment records, send every transaction with the node's estimate and a margin, and record the block range, the fork id, the gas prices and the cost per party.

## What is measured, computed, carried over

| Figure | Status |
|---|---|
| Sections 1 to 7, 10: per call, cycles, both baselines, overheads, mechanism variants, endings, paths, deployment | measured this evening |
| Shares, sums and ratios in sections 4 and 5 | computed from those |
| Section 8: the seven runs, the worst cycle, the rule on 210 insertions | measured this evening |
| Section 8: base cycle, upper bounds, the rows by number of notes | computed from the rule |
| Section 8: the rule exact at 84 indices; the last leaf | carried over (afternoon) |
| Section 9: the 14 cash-outs | measured this evening |
| Section 9: one-bit-leaf figures, the maximum at leaf 2^24 − 1 (measured then), the two-note maximum (computed) | carried over (afternoon) |
| Section 4, point 1: cash-out per order | carried over from the privacy evaluation (before the pool refunds) |
| Section 11: depth table, constraints, proving times by depth | carried over (afternoon) |
| Section 12: off-chain times to quote | carried over (afternoon); this evening's given apart |

## Corrections asked by the independent check of the superseded file

- Shares of the overhead are given with and without the pool deposit, against each baseline (section 5.3).
- The baseline has a delivery address (section 3.1) and a payout at delivery; the ratio is no longer quoted without what it leaves out (section 4).
- The deployment rows of earlier baselines are labelled (section 10).
- The upper bound of a cycle has its two conditions in the same sentence (section 8).
- The convention of the computed rows is stated (section 8).

## Not measured

- Anything on Sepolia or under its gas schedule.
- The cash-out per order on the final contracts (the privacy evaluation predates the pool refunds).
- Orders with more than one item; reputation thresholds other than zero.
- Note trees grown by real insertions to 1,000 notes or more (the states were installed in storage).
- A cycle whose three notes are not on consecutive leaves; a cash-out on leaf 2^24 − 1 this evening.
- Which instructions make up each cause of section 3.3 (read from the code; only the zone was measured apart).
- The manager dApp's return of unused gas money: after an order has ended, the one-time address can deposit what is left of its balance into the pool. It is one more `depositPayment` (section 1: 853,303 gas at a one-bit leaf) sent by the one-time address, offered by the dApp when it is worth it; it is not a step of the cycle and was not run here.
- Browser times.

## Files and commands

```bash
# the main run: cycles, paths, cash-outs, endings, both baselines, mechanism variants (about 3 minutes)
ITERATIONS=10 npx hardhat run --no-compile benchmarking/benchmark-hardhat.cjs
# the fill-level runs
for n in 1000 100000 1000000 16777182 16777200 33554368; do
  ITERATIONS=10 NOTE_START_INDEX=$n ENDINGS=0 VARIANTS=0 npx hardhat run --no-compile benchmarking/benchmark-hardhat.cjs
done
```

| Run | Files in this folder |
|---|---|
| tree as deployed | `hardhat-report-10it-2026-10-12T22-42-50-080Z.txt`, `hardhat-data-10it-2026-10-12T22-42-50-080Z.csv`, `hardhat-summary-10it-2026-10-12T22-42-50-080Z.json` |
| 1,000 | `hardhat-report-10it-start1000-2026-10-12T22-43-06-621Z.txt`, `hardhat-data-10it-start1000-2026-10-12T22-43-06-621Z.csv`, `hardhat-summary-10it-start1000-2026-10-12T22-43-06-621Z.json` |
| 100,000 | `hardhat-report-10it-start100000-2026-10-12T22-43-23-540Z.txt`, `hardhat-data-10it-start100000-2026-10-12T22-43-23-540Z.csv`, `hardhat-summary-10it-start100000-2026-10-12T22-43-23-540Z.json` |
| 1,000,000 | `hardhat-report-10it-start1000000-2026-10-12T22-43-40-338Z.txt`, `hardhat-data-10it-start1000000-2026-10-12T22-43-40-338Z.csv`, `hardhat-summary-10it-start1000000-2026-10-12T22-43-40-338Z.json` |
| 2^24 − 34 | `hardhat-report-10it-start16777182-2026-10-12T22-44-04-284Z.txt`, `hardhat-data-10it-start16777182-2026-10-12T22-44-04-284Z.csv`, `hardhat-summary-10it-start16777182-2026-10-12T22-44-04-284Z.json` |
| 2^24 − 16 | `hardhat-report-10it-start16777200-2026-10-12T22-44-28-269Z.txt`, `hardhat-data-10it-start16777200-2026-10-12T22-44-28-269Z.csv`, `hardhat-summary-10it-start16777200-2026-10-12T22-44-28-269Z.json` |
| 2^25 − 64 | `hardhat-report-10it-start33554368-2026-10-12T22-44-59-138Z.txt`, `hardhat-data-10it-start33554368-2026-10-12T22-44-59-138Z.csv`, `hardhat-summary-10it-start33554368-2026-10-12T22-44-59-138Z.json` |

The main run's report has the tables behind sections 1 to 7 (tables A to I; C2 and C3 are the comparison). The earlier files of 2026-10-12 (`hardhat-*-2026-10-12T16-*`, `T18-*`, `T19-*`) belong to the superseded file.

