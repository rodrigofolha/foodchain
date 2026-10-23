# Cost of a full order cycle across networks (measured 2026-10-14, table computed 2026-10-15)

Machine-readable copy with every number in full precision: `cost-networks-2026-10-14.json` (written by a script that reads only recorded files; the scripts of this table are not published). Paths are relative to the root of the repository.

**What this file is.** The present contracts (the privacy contracts as rebuilt on 2026-10-14 and the no-privacy contracts, both as deployed on Hoodi and on the local node of `local-gas-final-2026-10-12.md`) were deployed on three public test networks and run for ten full order cycles each, privacy and baseline, on 2026-10-14 between 23:30 and 00:04 UTC. The gas of every transaction was read from its receipt (measured). The cost table of the article (Table `tab:crossnet-cost`) multiplies that gas by a price per unit of gas and an exchange rate of the **production** network of each test network, both read at one time after the three measurements, 00:08 UTC on 2026-10-15 (computed). A test network's own fees are recorded in section 4 and are not the table's figures.

**Measured** means `gasUsed` of a mined receipt, read back from the chain by `readback-fees.cjs`. **Computed** means arithmetic on measured figures and on recorded prices; every computed figure says so and shows its inputs. Rounding is for the presentation only (two significant digits in USD below 1 USD, two decimals above); the JSON keeps full precision.

## Summary

- **Gas per later cycle** (mean of cycles 2 to 10, measured): privacy 4,830,503 on Arbitrum Sepolia, 4,830,506 on OP Sepolia, 4,835,271 on Avalanche Fuji (local 4,833,322; Hoodi 4,830,506); baseline (a), the no-privacy contracts, 893,077, 893,066 and 897,892 (local 893,072; Hoodi 893,045). Sixty cycles of sixty completed; 540 transactions, all with status 1.
- **Where the gas differs**: only `deliveryOrder` on Fuji, by 4,803 gas per later cycle in the privacy contracts (1,004,603 against 999,800) and 4,806 in the baseline (103,738 against 98,932). The gas schedule of that network differs for some operations of that call; every other call used the same gas on the three networks (within the few tens of gas that depend on the data of each call). On Arbitrum Sepolia the receipts' `gasUsedForL1` was 0 for every transaction, so the measured `gasUsed` is the execution gas.
- **The table** (computed, prices and rates of 2026-10-15 00:08 UTC; section 3): a privacy cycle costs **1.61 USD on Ethereum**, **0.23 USD on Arbitrum One**, **0.00011 USD on OP Mainnet** and **0.31 USD on the Avalanche C-Chain**; the baseline 0.30, 0.043, 0.000029 and 0.058 USD. Of an order of 25 USD: 6.5 %, 0.94 %, 0.00045 % and 1.3 %. With the dApp's cash-out (3.74 million gas per order, a model's figure): 2.86, 0.42, 0.00013 and 0.56 USD, or 11.5 %, 1.7 %, 0.00054 % and 2.2 %.
- **The day's range** (section 5): Ethereum's base fee was read nine times between 18:36 and 00:08 UTC at 0.060 to 0.221 gwei (the 1,024-block medians 0.118 to 0.321 gwei), which puts the Ethereum cycle between 0.94 and 2.82 USD at the table's tip and rate. The other three production networks moved the cycle by at most 15 % (OP Mainnet: 0.00011 to 0.00013 USD; Arbitrum One 0.23 to 0.24; Avalanche 0.31 to 0.32).
- **Fees actually paid on the test networks** (recorded, not the table's figures; section 4): a later privacy cycle cost 0.0000970 ETH on Arbitrum Sepolia (about 0.0201 gwei per gas), 0.00000483 ETH on OP Sepolia (0.00100025 gwei) and 0.000000774 AVAX on Fuji (160 wei per gas); Hoodi's, for reference, 0.005728 ETH at about 1.2 gwei (`hoodi-final-2026-10-13.md`).

## 1. What was measured

### 1.1 Networks, endpoints, deployments

| Test network (chain id) | Endpoint of the runs | Production network of the table (chain id) | Deployment: privacy set (9 transactions) | Baseline set (2 transactions) | Verification |
|---|---|---|---|---|---|
| Arbitrum Sepolia (421614) | sepolia-rollup.arbitrum.io | Arbitrum One (42161) | 11,989,876 gas, 0.000240 ETH, blocks up to 319238543, 23:30:21 to 23:30:47 UTC | 4,542,448 gas, 0.0000912 ETH, deploy block 319238570 | `verify_deployment.js`, strict code: "All checks passed" |
| OP Sepolia (11155420) | sepolia.optimism.io (privacy run); optimism-sepolia-rpc.publicnode.com (baseline run, attempt 2) | OP Mainnet (10) | 11,989,804 gas, 0.0000120 ETH, deploy block 50109169, 23:34:27 to 23:34:48 UTC (attempt 2) | 4,542,448 gas, 0.00000454 ETH, deploy block 50109207 (attempt 2) | "All checks passed" |
| Avalanche Fuji (43113) | api.avax-test.network | Avalanche C-Chain (43114) | 11,989,876 gas, 0.00000192 AVAX, deploy block 59472434, 23:33:55 to 23:34:22 UTC | 4,542,448 gas, 0.000000727 AVAX, deploy block 59472441 | "All checks passed" |

Records: `deployments/<net>-2026-10-14/deployment.json`, `deployment-no-privacy.json`, `deploy_all.log`, `deploy_no_privacy.log`, `verify.log`. The deployment gas equals the local and Hoodi figures (11,989,864 and 4,542,448 locally; the 12 and 72 gas of difference are zero bytes of the constructor arguments). The 9 contracts are Poseidon, MergeWithdrawVerifier, GlobalReputation, Util, Storage, Chain (with the Order implementation), StealthAnnouncer and two configuration calls.

**OP Sepolia, attempt 1 of the deployments** (`deployments/optimismSepolia-2026-10-14/NOTE-attempt1.md`): at 23:32 and 23:34 UTC, both deploy scripts stopped at the read of `orderImplementation()` right after the receipt, because the official endpoint answered empty data from a backend that had not yet applied the block. The contracts of attempt 1 exist on OP Sepolia and are unused (`*.attempt1.*`). The scripts then retried that read up to 15 times, and attempt 2 deployed the two sets that were used.

### 1.2 Runs

| Run | Started (UTC) | Ended (UTC) | Blocks | Cycles | Transactions | Failed or skipped steps | Fee settings of the run |
|---|---|---|---|---|---|---|---|
| Arbitrum Sepolia, privacy | 2026-10-14 23:31:58 | 23:47:40 | 319238823 to 319242218 | 10 of 10 | 110 | 0 | tip 0, max fee 0.1 gwei |
| Arbitrum Sepolia, baseline (a) | 23:47:43 | 23:54:59 | 319242265 to 319243828 | 10 of 10 | 70 | 0 | tip 0, max fee 0.1 gwei |
| OP Sepolia, privacy | 23:36:55 | 23:51:06 | 50109237 to 50109655 | 10 of 10 | 110 | 0 | tip 0.001 gwei, max fee 0.01 gwei |
| OP Sepolia, baseline (a), attempt 1 | 23:51:16 | 23:51:19 | 50109663 | stopped in cycle 1 | 1 (`makeOrder`, 393,206 gas) | 1 | the same, official endpoint |
| OP Sepolia, baseline (a), attempt 2 | 23:52:13 | 23:59:56 | 50109694 to 50109921 | 10 of 10 | 70 | 0 | the same, publicnode endpoint |
| Fuji, privacy | 23:35:26 | 23:56:07 | 59472480 to 59473265 | 10 of 10 | 110 | 0 | tip 0.00000015 gwei, max fee 0.001 gwei |
| Fuji, baseline (a) | 23:56:09 | 2026-10-15 00:03:44 | 59473275 to 59473582 | 10 of 10 | 70 | 0 | tip 0.00000015 gwei, max fee 0.001 gwei |

Every run: `ITERATIONS=10`, `ORDER_TOTAL_WEI=1000000000000000` (order total 0.001 ETH, delivery fee 0.001 ETH), gas limits `eth_estimateGas` × 1.25 (customer, worker) and × 1.2 (establishment), receipt timeout 300 s, stop at the first failed step. Baseline (b), the privacy contracts with every mechanism off, was not run. Run files: `benchmarking/results/<net>-2026-10-14/privacy-<time>.json`, `no-privacy-<time>.json`, with `run1-privacy.log`, `run3-no-privacy.log`, `report.log`, `comparison-report-*.txt`, `preflight-before.log`, `preflight-after.log`.

**OP Sepolia, baseline attempt 1** (`benchmarking/results/optimismSepolia-2026-10-14/NOTE-no-privacy-attempt1.md`, `run3-no-privacy.attempt1.log`, `no-privacy-2026-10-14T23-51-16-880Z.json`): stopped in cycle 1 at the gas estimate of `prepareOrder` ("missing revert data"), right after `makeOrder` was mined: the official endpoint answered from a backend that had not yet applied the block, the same lag as at the deployments. One baseline order of cycle 1 is open in state ORDERED with 0.002 ETH of the customer. Attempt 2 ran through the publicnode endpoint and completed. Because attempt 1 had made the first order of that deployment, cycle 1 of attempt 2 is not a first cycle of the deployment: its `makeOrder` costs 376,106 gas (393,206 on the other two networks, +17,100 for the first order of `Chain`), so the mean of all ten baseline cycles is 894,779 on OP Sepolia against 896,499 on Arbitrum Sepolia and 901,311 on Fuji. The later-cycle means are not affected.

### 1.3 Read-backs

Every transaction was read back from the chain twice with `readback-fees.cjs --prod` (receipt and transaction; `gasUsedForL1` on Arbitrum; `l1Fee` on OP; the production network's L1 data component of the same transaction through the production oracle): once right after each run (`cost-networks-2026-10-14/readback-<net>-2026-10-14-{privacy,no-privacy}.json`, 23:56 to 00:05 UTC) and once right after the table's reading (`cost-networks-2026-10-14/readback-<net>-2026-10-14-{privacy,no-privacy}-table.json`, 00:08:23 to 00:13:16 UTC). The gas and the fees of the two read-backs are identical (same receipts); the table uses the second, whose oracle values belong to the table's time. 540 transactions, 0 with an error, 0 with a status other than 1.

## 2. Gas per call (measured; later cycles, mean of cycles 2 to 10)

### 2.1 Privacy cycle, 11 transactions

| Call | Local (`local-gas-final-2026-10-12.md`) | Arbitrum Sepolia | OP Sepolia | Fuji | Fuji − OP Sepolia |
|---|---:|---:|---:|---:|---:|
| `stealthAnnounce` | 26,243.7 | 26,242.3 | 26,242.3 | 26,242.3 | 0 |
| `makeOrder` | 1,213,290.3 | 1,213,289.0 | 1,213,293.0 | 1,213,266.3 | −26.7 (zero bytes of the ciphertexts) |
| `poolDeposit` | 856,766.7 | 858,206.0 | 858,203.3 | 858,206.0 | +2.7 |
| `poolWithdraw` | 1,122,658.7 | 1,120,525.0 | 1,120,529.0 | 1,120,517.0 | −12 |
| `prepareOrder` | 137,388 | 137,392.0 | 137,388.0 | 137,388.0 | 0 |
| `confirmIntention` | 230,245 | 230,257.0 | 230,255.7 | 230,255.7 | 0 |
| `addInformation` | 60,130 | 60,130 | 60,130 | 60,130 | 0 |
| `pickupOrder` | 68,775.7 | 68,773.6 | 68,778.1 | 68,776.0 | −2.1 |
| `deliveryOrder` | 1,001,935.3 | 999,799.2 | 999,800.0 | **1,004,603.0** | **+4,803.0** |
| `rateOrder_client` | 57,957 | 57,957.0 | 57,955.7 | 57,955.7 | 0 |
| `rateOrder_restaurant` | 57,932 | 57,932.0 | 57,930.7 | 57,930.7 | 0 |
| **Cycle** | **4,833,322.3** | **4,830,503.1** (4,820,683 to 4,848,214) | **4,830,505.8** (4,820,712 to 4,848,149) | **4,835,270.7** (4,825,459 to 4,852,947) | +4,764.9 |
| First cycle (cycle 1) | 4,869,916 | 4,864,687 | 4,864,634 | 4,869,446 | +4,812 |
| Ten cycles in all | — | 48,339,215 | 48,339,186 | 48,386,882 | |

- Arbitrum Sepolia and OP Sepolia agree with Hoodi (4,830,506.3) to within 3 gas per cycle; the 2,816 gas below the local figure are the leaf indices of the notes (leaves 1 to 30 against 2 to 31 locally), as `hoodi-final-2026-10-13.md` section 5.2 explains.
- The first cycle of each deployment: `makeOrder` 1,230,393 (first order of `Chain`, +17,100), `poolDeposit` 870,391 to 870,403, `poolWithdraw` 1,094,670 to 1,094,706 (first input is the zero-value note), `deliveryOrder` 1,030,480 to 1,030,497 (1,035,297 on Fuji), as on Hoodi.
- The calldata of a cycle is 4,044 bytes on the three networks (the same as on Hoodi).
- `deliveryOrder` on Fuji: 4,803 gas more in the later mean, 4,817 in the first cycle, and the range (1,001,080 to 1,022,355) is the OP Sepolia range (996,280 to 1,017,526) shifted by about 4,800. The baseline's `deliveryOrder` differs by the same amount (2.2), so the difference is not in the note insertion. We say no more about the cause than that the gas schedule of that network differs for some operations of that call.

### 2.2 Baseline (a), the no-privacy contracts, 7 transactions

| Call | Arbitrum Sepolia | OP Sepolia | Fuji | Fuji − OP Sepolia |
|---|---:|---:|---:|---:|
| `makeOrder` | 376,106 (first 393,206) | 376,106 (first 376,106, see 1.2) | 376,106 (first 393,206) | 0 |
| `prepareOrder` | 109,988.3 | 109,988.3 | 109,991.0 | +2.7 |
| `confirmIntention` | 106,596.3 | 106,596.3 | 106,599.0 | +2.7 |
| `pickupOrder` | 68,440.0 | 68,431.1 | 68,440.0 | +8.9 |
| `deliveryOrder` | 98,934.1 | 98,931.7 | **103,738.1** | **+4,806.4** |
| `rateOrder_client` | 75,049.3 (first 92,152) | 75,049.3 (first 92,152) | 75,052.0 (first 92,152) | +2.7 |
| `rateOrder_restaurant` | 57,963.3 | 57,963.3 | 57,966.0 | +2.7 |
| **Cycle** | **893,077.4** (893,040 to 893,112) | **893,066.1** (893,023 to 893,095) | **897,892.1** (897,866 to 897,912) | +4,826 |
| First cycle | 927,295 | 910,195 (not a first cycle of the deployment) | 932,078 | |
| Ten cycles in all | 8,964,992 | 8,947,790 | 9,013,107 | |

Local later mean 893,072.3; Hoodi 893,044.9. The differences of a few gas between the networks are zero bytes of the calldata and the signature byte.

## 3. The cost table (computed)

### 3.1 Method

- **Gas**: the later-cycle means of section 2, one per network; for the Ethereum row the local later cycle (4,833,322.3 privacy; 893,072.3 baseline), which Hoodi confirmed call by call (`hoodi-final-2026-10-13.md`). The Ethereum gas was not measured on the main network.
- **Price per unit of gas**: the production network's **median base fee of the last 1,024 blocks plus its median tip (50th reward percentile) of the same blocks**, read at the table's reading (`cost-networks-2026-10-14/prices-table-2026-10-15.json`, `read-prices.cjs`, 2026-10-15 00:07:46 to 00:08:04 UTC, keyless public endpoints). Arbitrum One pays no tip. The instantaneous base fee and the node's suggested tip at the same reading are given next to it.
- **L1 data component of the rollups**: from the `-table` read-backs, made right after the reading. Arbitrum One: `NodeInterface.gasEstimateL1Component(to, false, calldata)` of each measured transaction, in L2 gas units, later-cycle mean, times the table's price. OP Mainnet: `GasPriceOracle.getL1Fee(unsigned RLP of the transaction)` of each measured transaction, in wei, later-cycle mean. The oracle values at those reads: Arbitrum One L2 base fee 0.020006 gwei and L1 base-fee estimate 0.001369 gwei (00:08:24 and 00:09:14 UTC); OP Mainnet `l1BaseFee` 0.0795 gwei, `blobBaseFee` 0.00508 gwei, scalars 5,227 and 1,014,213 (00:10:12 UTC; at 00:11:36 for the baseline: 0.0774 and 0.00437 gwei).
- **Exchange rates**: Coinbase spot `api.coinbase.com/v2/prices/<pair>/spot`: ETH-USD 2,421.375 at 00:08:03.990 UTC; AVAX-USD 10.0145 at 00:08:04.244 UTC.
- **Cost of a cycle** = (gas × price + L1 component) × rate. Share of a 25 USD order (the median order of the privacy evaluation's workload) = cost / 25. Ratio to Ethereum = cost / cost of the Ethereum row.
- **With the cash-out**: (gas + 3,740,000) × price + the cycle's L1 component, × rate. The 3.74 million gas per order are a model's figure (3.38 withdrawals per order under the manager dApp's policy, `privacy-eval-final-2026-10-12.md`); the L1 data component of the cash-out's transactions is **not** included (not measured on the rollups).

### 3.2 Inputs of each row (the table's reading, 2026-10-15)

| Production network | Endpoint, block, time (UTC) | Median base fee, 1,024 blocks (wei) | Median tip (wei) | Price applied (wei) | Instantaneous base fee (wei) | Suggested tip (wei) | `eth_gasPrice` (wei) | Rate |
|---|---|---:|---:|---:|---:|---:|---:|---|
| Ethereum | ethereum-rpc.publicnode.com, block 26194226, 00:07:46 (blocks 26193203 to 26194226) | 117,972,780 | 20,000,000 | 137,972,780 | 95,811,917 | 0 | 95,811,917 | 2,421.375 USD/ETH |
| Arbitrum One | arb1.arbitrum.io, block 514895536, 00:07:50 | 20,016,000 | 0 (no tip) | 20,016,000 | 20,066,000 | 0 | 20,014,000 | 2,421.375 USD/ETH |
| OP Mainnet | mainnet.optimism.io, block 158212043, 00:07:53 | 987 | 1,500 | 2,487 | 1,074 | 1,000,000 | 1,001,074 | 2,421.375 USD/ETH |
| Avalanche C-Chain | api.avax.network, block 97570126, 00:07:58 | 5,000,000,000 | 1,500,000,000 | 6,500,000,000 | 5,000,000,000 | 150 | 5,000,000,150 | 10.0145 USD/AVAX |

### 3.3 The table

| Network (measured on) | Gas per cycle, privacy / baseline (measured) | Price (gwei), median base fee + median tip | L1 data per cycle, privacy (computed) | Cost per cycle, privacy / baseline (USD, computed) | Share of 25 USD, privacy | Ratio to Ethereum, privacy | With cash-out (USD; share) |
|---|---:|---|---:|---:|---:|---:|---:|
| Ethereum (local gas, confirmed on Hoodi) | 4,833,322 / 893,072 | 0.1380 = 0.1180 + 0.0200 | — | **1.61** / 0.30 | 6.5 % | 1.00 | 2.86; 11.5 % |
| Arbitrum One (Arbitrum Sepolia) | 4,830,503 / 893,077 | 0.0200 = 0.0200 + 0 | 5,483 L2 gas units = 0.00027 USD (0.11 % of the cycle) | **0.23** / 0.043 | 0.94 % | 0.15 | 0.42; 1.7 % |
| OP Mainnet (OP Sepolia) | 4,830,506 / 893,066 | 0.0000025 = 0.00000099 + 0.0000015 | 34.1 gwei = 0.000083 USD (74 % of the cycle) | **0.00011** / 0.000029 | 0.00045 % | 0.00007 | 0.00013; 0.00054 % |
| Avalanche C-Chain (Fuji) | 4,835,271 / 897,892 | 6.5 = 5.0 + 1.5 | — | **0.31** / 0.058 | 1.3 % | 0.19 | 0.56; 2.2 % |

The arithmetic of each row (full precision in the JSON, `rows[]`):

- Ethereum: 4,833,322.3 × 137,972,780 wei = 666,866,914,366,994 wei = 0.000666867 ETH × 2,421.375 = **1.6147 USD**. Baseline: 893,072.3 × 137,972,780 wei = 0.000123219 ETH = **0.2984 USD**. With the cash-out: (4,833,322.3 + 3,740,000) × 137,972,780 wei = 0.001182885 ETH = **2.8642 USD** (11.46 % of 25 USD).
- Arbitrum One: 4,830,503.1 × 20,016,000 wei = 96,687,350,272,000 wei; L1 5,483.3 units × 20,016,000 wei = 109,754,400,000 wei; total 0.0000967971 ETH × 2,421.375 = **0.23438 USD** (L1 0.000266 USD, 0.11 %). Baseline: 893,077.4 × 20,016,000 + 2,452.2 × 20,016,000 = 0.0000179250 ETH = **0.04340 USD**. With the cash-out: 8,570,503.1 × 20,016,000 + 109,754,400,000 wei = 0.000171655 ETH = **0.41565 USD** (1.66 %).
- OP Mainnet: 4,830,505.8 × 2,487 wei = 12,013,467,869 wei; L1 34,114,079,198 wei; total 46,127,547,067 wei = 0.0000000461 ETH × 2,421.375 = **0.00011169 USD** (L1 0.0000826 USD, 74.0 %). Baseline: 893,066.1 × 2,487 + 9,570,494,112 wei = 0.0000000118 ETH = **0.00002855 USD**. With the cash-out: 8,570,505.8 × 2,487 + 34,114,079,198 wei = 0.0000000554 ETH = **0.00013421 USD** (0.00054 %).
- Avalanche C-Chain: 4,835,270.7 × 6,500,000,000 wei = 0.0314293 AVAX × 10.0145 = **0.31475 USD**. Baseline: 897,892.1 × 6.5 gwei = 0.00583630 AVAX = **0.05845 USD**. With the cash-out: 8,575,270.7 × 6.5 gwei = 0.0557393 AVAX = **0.55820 USD** (2.23 %).
- Ratios: Arbitrum One / Ethereum 0.1452; OP Mainnet / Ethereum 0.0000692; Avalanche / Ethereum 0.1949. Factor between the dearest (Ethereum) and the cheapest (OP Mainnet): 14,457; Ethereum / Arbitrum One 6.89; Ethereum / Avalanche 5.13. The gas ratio privacy / baseline is 5.41 on every network (5.39 on Fuji), so the baseline's ratios to Ethereum are the same as the privacy row's except on OP Mainnet (0.000096), where the L1 component weighs more in the baseline.

### 3.4 Sensitivity (computed, not the table's figures)

| Network | At the instantaneous base fee + suggested tip of the same reading | At the lowest and the highest instantaneous base fee of the day (tip and rate of the table) |
|---|---:|---:|
| Ethereum | 0.0958 + 0 gwei: 1.12 USD | 0.0604 gwei: 0.94 USD; 0.2207 gwei: 2.82 USD |
| Arbitrum One | 0.0201 gwei: 0.23 USD | 0.0200 to 0.0201 gwei: 0.234 to 0.236 USD |
| OP Mainnet | 0.0000011 + 0.001 gwei (the suggested tip is 667 times the median tip): **0.012 USD** | base fee 974 to 2,415 wei: 0.00011 to 0.00013 USD |
| Avalanche C-Chain | 5.0 + 0.00000015 gwei: 0.24 USD | 5.000 to 5.063 gwei: 0.315 to 0.318 USD |

On OP Mainnet the choice of the tip decides the row: the dApps' wallet would send the node's suggested tip (0.001 gwei, which ethers and the scripts use), at which the cycle costs 0.012 USD; the median tip actually paid in the last 1,024 blocks was 1,500 wei. The table uses the median tip, and the text gives the figure at the suggested tip.

## 4. Fees actually paid on the test networks (recorded; a test network's price is not a price)

| Test network | Privacy, later cycle (mean of cycles 2 to 10) | Privacy, ten cycles | Baseline (a), later cycle | Baseline, ten cycles | Deployments (privacy + baseline) | Effective price |
|---|---:|---:|---:|---:|---:|---|
| Arbitrum Sepolia | 0.0000970371 ETH | 0.000970960 ETH | 0.0000179284 ETH | 0.000179949 ETH | 0.000240321 + 0.0000912288 ETH | 0.0200 to 0.0209 gwei (base fee; tip 0); `gasUsedForL1` 0 in every receipt |
| OP Sepolia | 0.0000048317 ETH | 0.0000483513 ETH | 0.00000089329 ETH | 0.0000089500 ETH | 0.0000119928 + 0.00000454358 ETH | 0.00100025 gwei (base fee 250 wei + tip 0.001 gwei); `l1Fee` 81,624 wei in the ten privacy cycles and 25,000 wei in the ten baseline cycles (OP Sepolia's `l1BaseFee` is 15 wei) |
| Avalanche Fuji | 0.000000773643 AVAX | 0.00000774190 AVAX | 0.000000143663 AVAX | 0.00000144210 AVAX | 0.00000191838 + 0.000000726792 AVAX | 160 wei (base fee 10 wei + tip 150 wei) |
| Hoodi (2026-10-13, for reference) | 0.005727900 ETH = 14.37 USD at 2,509.195 USD/ETH | 0.057402 ETH | 0.001059361 ETH | 0.010631 ETH | | base fee 0.841 to 1.120 gwei + 0.2 gwei tip (`hoodi-final-2026-10-13.md`) |

The balance differences of the three accounts over each run (first block − 1 to last block) are in the read-back JSONs (`balances`), where the endpoint served those blocks (OP Sepolia and Fuji, and Arbitrum Sepolia in the first read-back); on Arbitrum Sepolia the table-time read-back got "historical state" errors from the endpoint for those blocks, so it carries no balances.

## 5. The day's range of the production networks (2026-10-14, nine readings)

Readings: `prices-readings-2026-10-14.json` (18:36 UTC), `prices-readings-2026-10-14-2315utc.json` (23:17), `prices-before-{arbitrumSepolia,optimismSepolia,fuji}-2026-10-14.json` (23:29, 23:32, 23:32), `prices-after-{…}-2026-10-14.json` (23:55, 00:00, 00:03) and `prices-table-2026-10-15.json` (00:07). All in `cost-networks-2026-10-14/`.

| Production network | Instantaneous base fee, min to max | 1,024-block median base fee, min to max of the readings | Median tip, min to max | Lowest and highest block base fee seen in any 1,024-block window | Rates seen |
|---|---|---|---|---|---|
| Ethereum | 0.0604 to 0.2207 gwei | 0.1180 to 0.3208 gwei | 0.020 to 0.150 gwei | 0.0546 to 1.7955 gwei (the 18:36 window) | 2,413.47 to 2,424.08 USD/ETH |
| Arbitrum One | 0.02000 to 0.02012 gwei | 0.02001 to 0.02002 gwei | 0 | 0.02000 to 0.02096 gwei | |
| OP Mainnet | 974 to 2,415 wei | 987 to 2,607 wei | 710 to 3,000 wei | 965 to 3,040 wei | |
| Avalanche C-Chain | 5.000 to 5.063 gwei | 5.000 gwei | 1.3 to 2.0 gwei | 4.999 to 5.302 gwei | 9.853 to 10.0355 USD/AVAX |

The cost of the privacy cycle at the lowest and the highest instantaneous base fee of the day, with the table's tip and rate (computed): Ethereum 0.94 to 2.82 USD; Arbitrum One 0.234 to 0.236 USD; OP Mainnet 0.000112 to 0.000128 USD; Avalanche 0.315 to 0.318 USD. The Ethereum row is the one that moves: its base fee varied by a factor of 3.7 within the day, and the 18:36 window held blocks at 1.80 gwei (13 times the table's base fee).

## 6. What is measured and what is computed

- **Measured**: the gas of every transaction (receipts), the fees paid on the test networks (receipts and balances), the calldata sizes, the deployment gas, the attempts and their outcomes.
- **Computed**: the per-cycle means and ranges; the price applied (medians of `eth_feeHistory` over 1,024 blocks); the L1 data components (the production oracles' answers for the measured transactions' calldata, at one time); the costs in USD; the shares, ratios and factors; the cost with the cash-out (which adds a model's gas figure); the sensitivity and the day's range.
- **Carried over**: the Ethereum row's gas (local, 2026-10-12; Hoodi, 2026-10-13); the cash-out's 3.74 million gas per order (privacy evaluation, 2026-10-12); the 25 USD order (the privacy evaluation's median).

## 7. Not verified

- The production networks' prices move, within the day by a factor of 3.7 on Ethereum (section 5); the table is one reading at one stated time, and the figures hold for that reading.
- The L1 data component depends on the oracle values at one time (`l1BaseFee` and `blobBaseFee` of OP Mainnet, the L1 base-fee estimate of Arbitrum One), which also move; it was computed with the oracles of 00:08 to 00:13 UTC, 1 to 5 minutes after the price reading. On OP Mainnet it is 74 % of the cycle.
- The test networks' EVMs are assumed to be those of their production networks (same gas schedule and same fee rules), except where the gas differs, which is measured (Fuji's `deliveryOrder`). The Arbitrum Sepolia receipts charged no L1 gas (`gasUsedForL1` = 0), whereas Arbitrum One charges it; the table takes the production oracle's estimate for that reason.
- The Ethereum row's gas is the local measurement confirmed on Hoodi; nothing was sent to the main network. The tip of the Ethereum row is the 1,024-block median (0.020 gwei), while the node's suggested tip was 0 at the reading and the Hoodi runs paid 0.2 gwei; at 0.2 gwei the Ethereum cycle would cost 3.72 USD (computed).
- The cash-out's cost per order is a model's figure at the table's price; its L1 data component on the rollups is not included; the number of withdrawals grows with the revenue per order divided by the denomination.
- The cost of a cycle with more items, a fuller note tree or other order amounts was not measured on the test networks (the local file gives the rules).
- The 25 USD order is the privacy evaluation's median; a different order value changes the shares in proportion.

## 8. Commands as run

From the root of the repository. The configuration `$CFG`, the scripts in `$CN` and those in `benchmarking/` are not published; the readings and read-backs they wrote to `$CN` are in `cost-networks-2026-10-14/`. `<net>` = arbitrumSepolia | optimismSepolia | fuji, `<bench>` = arbitrum-sepolia | optimism-sepolia | fuji, `<d>` = 2026-10-14. The readings and the read-backs are keyless and read-only.

```bash
CFG=<Hardhat configuration of the three networks>
CN=<folder of the cost scripts>
# readings before each network
node $CN/read-prices.cjs --out $CN/prices-before-<net>-<d>.json
# read-only checks
npx hardhat --config $CFG run --no-compile $CN/check-config.js --network <net>
(cd benchmarking && BENCH_NETWORK=<bench> BENCH_RPC_URL=<url> BENCH_CHAIN_ID=<id> ORDER_TOTAL_WEI=1000000000000000 PRICE_STOP_FACTOR=10 node hoodi-preflight.cjs | tee results/<net>-<d>/preflight-before.log)
# deployments (fee settings: Arbitrum PRIORITY_FEE_GWEI=0 MAX_FEE_GWEI=0.1; OP PRIORITY_FEE_GWEI=0.001 MAX_FEE_GWEI=0.01; Fuji PRIORITY_FEE_GWEI=0.00000015 MAX_FEE_GWEI=0.001)
CONFIG_OUT_DIR=deployments/<net>-<d> <fee settings> npx hardhat --config $CFG run --no-compile scripts/deploy_all.js --network <net> 2>&1 | tee deployments/<net>-<d>/deploy_all.log
CONFIG_OUT_DIR=deployments/<net>-<d> <fee settings> npx hardhat --config $CFG run --no-compile scripts/deploy_no_privacy.js --network <net> 2>&1 | tee deployments/<net>-<d>/deploy_no_privacy.log
DEPLOYMENT=deployments/<net>-<d>/deployment.json,deployments/<net>-<d>/deployment-no-privacy.json STRICT_CODE=1 npx hardhat --config $CFG run --no-compile scripts/verify_deployment.js --network <net> 2>&1 | tee deployments/<net>-<d>/verify.log
# the runs (in benchmarking/; BENCH_* as above; DEPLOYMENT_RECORD and NO_PRIVACY_DEPLOYMENT_RECORD point to the records; ETH_USD* from the reading before; the same fee settings)
ITERATIONS=10 node benchmark-privacy.js 2>&1 | tee results/<net>-<d>/run1-privacy.log
ITERATIONS=10 node benchmark-no-privacy.js 2>&1 | tee results/<net>-<d>/run3-no-privacy.log      # OP Sepolia attempt 2 with BENCH_RPC_URL=https://optimism-sepolia-rpc.publicnode.com
node generate-report.js 2>&1 | tee results/<net>-<d>/report.log
node hoodi-preflight.cjs 2>&1 | tee results/<net>-<d>/preflight-after.log
# readings after, and the read-backs right after each run
node $CN/read-prices.cjs --out $CN/prices-after-<net>-<d>.json
node $CN/readback-fees.cjs benchmarking/results/<net>-<d>/privacy-<time>.json --prod --out $CN/readback-<net>-<d>-privacy.json
node $CN/readback-fees.cjs benchmarking/results/<net>-<d>/no-privacy-<time>.json --prod --out $CN/readback-<net>-<d>-no-privacy.json
# the table's reading (2026-10-15 00:07:46 UTC) and the read-backs at the table's time (00:08:23 to 00:13:16 UTC)
node $CN/read-prices.cjs --out $CN/prices-table-2026-10-15.json
node $CN/readback-fees.cjs benchmarking/results/<net>-<d>/<run>.json --prod --out $CN/readback-<net>-<d>-<variant>-table.json   # six run files
# the table
node $CN/cost-table.cjs --out benchmarking/results/cost-networks-2026-10-14.json
```

Run files: Arbitrum Sepolia `privacy-2026-10-14T23-47-41-283Z.json`, `no-privacy-2026-10-14T23-54-59-595Z.json`; OP Sepolia `privacy-2026-10-14T23-51-06-898Z.json`, `no-privacy-2026-10-14T23-59-56-086Z.json` (attempt 1: `no-privacy-2026-10-14T23-51-16-880Z.json`); Fuji `privacy-2026-10-14T23-56-07-721Z.json`, `no-privacy-2026-10-15T00-03-44-811Z.json`. Recovery of the one-time addresses and cash-out of the notes: dry runs only at the time of this file (`recovery-dry.log`, `cashout-dry.log` in the results folders).
