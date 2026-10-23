# Throughput of the final contracts on a local node (2026-10-13)

Local in-process Hardhat network only (Hardhat 2.28.6 with EDR, chain id 31337, block gas limit 60,000,000, the gas schedule of the main network; a fresh deployment of the compiled artifacts per run, `--no-compile`). No public network was used and nothing was sent to Sepolia by this study. The contracts are the final ones, the same artifacts as deployed to Sepolia on 2026-10-13 (`deployments/sepolia-2026-10-12/`). Host: 12th Gen Intel Core i5-12500H (16 threads), 15.8 GB of memory, WSL2, Node v20.20.2, snarkjs 0.7.6. Measured 2026-10-13 02:31 to 03:31 UTC, one experiment at a time; the 1-minute load average was read before each one (section 2).

The configurations are those of 2026-10-02 (`README.md`, rows "throughput"), with more clients where the rate was still rising. A cycle now has eleven transactions and **one** proof (the withdrawal from the pool; the two rating proofs no longer exist). A unit of the ordering step is the announcement of the one-time address plus `makeOrder` (two transactions; one for the baseline, which has no announcement).

Section 11, added later on 2026-10-13, measures the ordering step and the baseline at 12 s blocks; the figures of sections 1 to 10 are as first written.

## 1. Results in short

| Configuration | Clients at the highest rate | Rate | Block use, mean | Gas ceiling | What limits it |
|---|---:|---:|---:|---:|---|
| Privacy, ordering step, 250 ms blocks | 64 to 128 | 50.0 and 49.4 orders/s (repeat: 50.2 and 51.0); 46.2 with 256 | 28 % | 193.6 orders/s | the benchmark process (its main thread, 83 to 93 % busy) |
| Privacy, full cycle, real proofs from one host, 250 ms | 64 | 1.02 cycles/s (0.92 to 1.01 with 8 to 32; repeat 0.92 to 1.04) | 2 % | 49.6 cycles/s | proof generation on the one host |
| Privacy, full cycle, one prover per participant (emulated), 250 ms | 64 / 128 | 6.27 / 6.49 cycles/s (repeat: 6.27 / 6.13) | 14 % / 15 % | 49.6 cycles/s | the benchmark process that runs the node (about 1.3 of 16 processor threads busy) |
| Privacy, full cycle, one prover per participant (emulated), 12 s | 256 | 0.76 cycles/s (0.67 with 128) | 74 % (65 %) | 1.03 cycles/s | the block gas limit: 19 of 28 blocks at least 90 % full (18 of them 97 to 99 %) |
| Baseline without privacy, ordering step, 250 ms | 64 to 256 | 154 to 191 orders/s | 25 to 35 % | 638 orders/s | the benchmark process |
| Baseline without privacy, full cycle, 250 ms | 64 / 128 | 22.1 / 21.4 cycles/s (repeat: 21.4 / 21.9) | 9 % | 267.5 cycles/s | the benchmark process |

- No cycle and no order failed at 250 ms blocks (14,060 orders and 2,406 cycles in the eleven 250 ms runs) or at 12 s blocks with up to 256 clients (488 cycles). No proof had to be regenerated for a stale root in any run (0 retries); the oldest root a withdrawal used was 809 insertions behind the tree.
- With 512 clients at 12 s blocks, 211 of 512 cycles failed, all at the withdrawal step and for one cause: the gas price had risen above what the gas money of the one-time address covers (section 5).
- The gas-equivalent verifier was calibrated again: +176 gas (0.079 %) against the real verifier, the same as on 2026-10-02. The proving time used by the emulation is the median of 10 real proofs on this host with nothing else running: **756 ms** (725 to 797 ms); it was 694 ms on 2026-10-02, measured while another benchmark ran.

## 2. What ran

Each row is one process: `cd <repository> && <environment> RESULTS_DIR=<scratch> npx hardhat run benchmarking/benchmark-concurrent.cjs --no-compile`. Clients are closed loops (the next transaction after the previous receipt) and start together; one unrecorded warm-up unit precedes each sweep; client wallets are reused across the levels of a run. The scripts were not edited. A wrapper waited until the 1-minute load average was below 0.6, wrote it down, and sampled the benchmark process once a second (processor time per thread from `/proc`, resident memory).

| Run | UTC | Load average before (1 / 5 / 15 min) | Waited (s) | Peak memory of the process (MB) | Environment | Result files (`benchmarking/results/`, `.txt`, `.csv`, `-summary.json`, `-raw.json`) |
|---|---|---|---:|---:|---|---|
| A | 02:33:42–02:34:58 | 0.57 / 0.55 / 0.65 | 100 | 9,190 | `VARIANT=privacy WORKLOAD=makeOrder CONCURRENCY=1,2,4,8,16,32,64,128,256 ORDERS_PER_CLIENT=5 BLOCK_TIME_MS=250 RESULTS_LABEL=final` | `concurrent-hardhat-privacy-final-250ms-2026-10-13T02-34-58-128Z` |
| B | 02:35:40–02:40:20 | 0.53 / 0.58 / 0.65 | 20 | 9,145 | `VARIANT=privacy WORKLOAD=cycle CONCURRENCY=1,2,4,8,16,32,64 CYCLES_PER_CLIENT=2 BLOCK_TIME_MS=250 RESULTS_LABEL=final` | `concurrent-hardhat-privacy-final-250ms-2026-10-13T02-40-20-204Z` |
| C | 02:43:20–02:43:53 | 0.54 / 3.20 / 2.34 | 170 | 5,101 | `VARIANT=no-privacy WORKLOAD=makeOrder CONCURRENCY=1,2,4,8,16,32,64,128,256 ORDERS_PER_CLIENT=5 BLOCK_TIME_MS=250 RESULTS_LABEL=final` | `concurrent-hardhat-no-privacy-final-250ms-2026-10-13T02-43-53-214Z` |
| D | 02:44:03–02:44:57 | 0.59 / 2.85 / 2.25 | 10 | 3,004 | `VARIANT=no-privacy WORKLOAD=cycle CONCURRENCY=1,2,4,8,16,32,64,128 CYCLES_PER_CLIENT=2 BLOCK_TIME_MS=250 RESULTS_LABEL=final` | `concurrent-hardhat-no-privacy-final-250ms-2026-10-13T02-44-57-334Z` |
| E | 02:46:01–02:48:06 | 0.57 / 2.14 / 2.07 | 50 | 2,663 | `MIMALLOC_PURGE_DELAY=0 PROVERS=distributed WORKLOAD=cycle CONCURRENCY=1,2,4,8,16,32,64,128 CYCLES_PER_CLIENT=2 BLOCK_TIME_MS=250 RESULTS_LABEL=final` | `concurrent-hardhat-privacy-distributed-final-250ms-2026-10-13T02-48-06-711Z` |
| F | 02:48:39–03:08:35 | 0.54 / 1.56 / 1.85 | 20 | 9,976 | `MIMALLOC_PURGE_DELAY=0 PROVERS=distributed DEVICE_WITNESS_CHECK=1 WORKLOAD=cycle CONCURRENCY=8,32,64,128,256 CYCLES_PER_CLIENT=1 BLOCK_TIME_MS=12000 TX_TIMEOUT_MS=600000 RESULTS_LABEL=final` | `concurrent-hardhat-privacy-distributed-final-12000ms-2026-10-13T03-08-35-661Z` |
| F2 | 03:08:51–03:20:06 | 0.12 / 0.36 / 0.71 | 0 | 10,239 | `MIMALLOC_PURGE_DELAY=0 PROVERS=distributed DEVICE_WITNESS_CHECK=1 WORKLOAD=cycle CONCURRENCY=512 CYCLES_PER_CLIENT=1 BLOCK_TIME_MS=12000 TX_TIMEOUT_MS=600000 RESULTS_LABEL=final-k512` | `concurrent-hardhat-privacy-distributed-final-k512-12000ms-2026-10-13T03-20-06-290Z` |
| C3 | 03:21:04–03:21:50 | 0.05 / 0.25 / 0.46 | 0 | 12,745 | `VARIANT=no-privacy WORKLOAD=makeOrder CONCURRENCY=256,512 ORDERS_PER_CLIENT=5 BLOCK_TIME_MS=250 RESULTS_LABEL=final-k512` | `concurrent-hardhat-no-privacy-final-k512-250ms-2026-10-13T03-21-50-053Z` |
| A2 | 03:22:10–03:23:26 | 0.54 / 0.39 / 0.50 | 20 | 9,502 | `VARIANT=privacy WORKLOAD=makeOrder CONCURRENCY=1,2,4,8,16,32,64,128,256 ORDERS_PER_CLIENT=5 BLOCK_TIME_MS=250 RESULTS_LABEL=final-rep2` | `concurrent-hardhat-privacy-final-rep2-250ms-2026-10-13T03-23-26-483Z` |
| D2 | 03:24:16–03:25:10 | 0.59 / 0.54 / 0.54 | 50 | 2,992 | `VARIANT=no-privacy WORKLOAD=cycle CONCURRENCY=1,2,4,8,16,32,64,128 CYCLES_PER_CLIENT=2 BLOCK_TIME_MS=250 RESULTS_LABEL=final-rep2` | `concurrent-hardhat-no-privacy-final-rep2-250ms-2026-10-13T03-25-10-370Z` |
| E2 | 03:25:40–03:27:48 | 0.52 / 0.54 / 0.54 | 30 | 3,858 | `MIMALLOC_PURGE_DELAY=0 PROVERS=distributed WORKLOAD=cycle CONCURRENCY=1,2,4,8,16,32,64,128 CYCLES_PER_CLIENT=2 BLOCK_TIME_MS=250 RESULTS_LABEL=final-rep2` | `concurrent-hardhat-privacy-distributed-final-rep2-250ms-2026-10-13T03-27-48-775Z` |
| C2 | 03:28:38–03:29:12 | 0.57 / 0.62 / 0.58 | 50 | 5,651 | `VARIANT=no-privacy WORKLOAD=makeOrder CONCURRENCY=1,2,4,8,16,32,64,128,256 ORDERS_PER_CLIENT=5 BLOCK_TIME_MS=250 RESULTS_LABEL=final-rep2` | `concurrent-hardhat-no-privacy-final-rep2-250ms-2026-10-13T03-29-12-515Z` |
| B2 | 03:29:12–03:31:14 | 0.49 / 0.59 / 0.57 | 0 | 6,634 | `VARIANT=privacy WORKLOAD=cycle CONCURRENCY=8,16,32 CYCLES_PER_CLIENT=2 BLOCK_TIME_MS=250 RESULTS_LABEL=final-rep2` | `concurrent-hardhat-privacy-final-rep2-250ms-2026-10-13T03-31-14-141Z` |

- Calibration: `PROVE_RUNS=10 npx hardhat run benchmarking/calibrate-gas-equivalent-verifier.cjs --no-compile` at 02:31:42 UTC, load average before 0.03 / 0.06 / 0.50; file `gas-equivalent-verifier-calibration-2026-10-13T02-31-54-926Z.json`.
- The 5-minute and 15-minute averages above 1 before runs C, D and E are the remains of run B (real proofs on all cores); the 1-minute average was below 0.6 and no other process was working.
- Runs A2 to E2 and B2 repeat A to E with the same commands (B2 with 8, 16 and 32 clients only). C3 adds 512 clients to the baseline's ordering step, F2 adds 512 clients at 12 s blocks.
- Runs F and F2 used `TX_TIMEOUT_MS=600000` instead of the default 120,000: with the default, a client gives up on a receipt after 120 s, and at 12 s blocks a transaction can wait longer than that for a full chain to include it. In run F with 256 clients, 41 transactions (all withdrawals) waited more than 120 s (the longest 215 s) and were then included; with the default they would have been counted as failed cycles. With up to 128 clients no transaction waited that long.
- Runs E, E2, F and F2 used `MIMALLOC_PURGE_DELAY=0`, the fixed 1,600,000 gas limit of the withdrawal and the `latest` block tag, as on 2026-10-02 (`distributed-provers-2026-10-02T08-40-08Z.md` gives the reasons); F and F2 also check every emulated proof input against the circuit's constraints (`DEVICE_WITNESS_CHECK=1`), and all passed.

## 3. Results by configuration

Columns: completed and failed units; units per second over the window from the level's start to its last receipt; mined transactions per second; mean gas of a completed unit; gas used over the gas limit of the blocks the level spans (mean and maximum); number of those blocks and how many are at least 90 % full; window divided by blocks; latency of one unit; gas ceiling = 60,000,000 / gas per unit / block time, with the announcement counted in the ordering step.

### 3.1 Privacy, ordering step, 250 ms blocks (run A; 5 orders per client)

| Clients | Completed / failed | orders/s | tx/s | Gas per order | Block use, mean / max | Blocks (≥ 90 % full) | Mean block interval (ms) | Latency of one order, p50 / p95 (s) | Gas ceiling (orders/s) | Share of the ceiling |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 1 | 5 / 0 | 1.99 | 4.0 | 1,239,548 | 1.0 % / 2.0 % | 10 (0) | 252 | 0.51 / 0.52 | 193.62 | 1.0 % |
| 2 | 10 / 0 | 3.98 | 8.0 | 1,239,545 | 2.1 % / 4.0 % | 10 (0) | 252 | 0.50 / 0.51 | 193.62 | 2.1 % |
| 4 | 20 / 0 | 7.94 | 15.9 | 1,239,546 | 4.1 % / 8.1 % | 10 (0) | 252 | 0.50 / 0.52 | 193.62 | 4.1 % |
| 8 | 40 / 0 | 16.00 | 32.0 | 1,239,545 | 8.3 % / 16.2 % | 10 (0) | 250 | 0.49 / 0.52 | 193.62 | 8.3 % |
| 16 | 80 / 0 | 31.68 | 63.4 | 1,239,545 | 16.5 % / 32.4 % | 10 (0) | 252 | 0.50 / 0.56 | 193.62 | 16.4 % |
| 32 | 160 / 0 | 48.84 | 97.7 | 1,239,545 | 25.4 % / 44.7 % | 13 (0) | 252 | 0.62 / 0.74 | 193.62 | 25.2 % |
| 64 | 320 / 0 | 50.02 | 100.1 | 1,239,546 | 27.5 % / 48.9 % | 24 (0) | 267 | 1.31 / 1.49 | 193.62 | 25.8 % |
| 128 | 640 / 0 | 49.44 | 98.9 | 1,239,546 | 28.1 % / 54.6 % | 47 (0) | 275 | 2.64 / 3.19 | 193.62 | 25.5 % |
| 256 | 1280 / 0 | 46.23 | 92.5 | 1,239,546 | 28.4 % / 94.9 % | 93 (4) | 298 | 5.51 / 7.61 | 193.62 | 23.9 % |

Repeat (run A2):

| Clients | Completed / failed | orders/s | tx/s | Gas per order | Block use, mean / max | Blocks (≥ 90 % full) | Mean block interval (ms) | Latency of one order, p50 / p95 (s) | Gas ceiling (orders/s) | Share of the ceiling |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 1 | 5 / 0 | 1.99 | 4.0 | 1,239,550 | 1.0 % / 2.0 % | 10 (0) | 251 | 0.51 / 0.52 | 193.62 | 1.0 % |
| 2 | 10 / 0 | 3.96 | 7.9 | 1,239,550 | 2.1 % / 4.0 % | 10 (0) | 252 | 0.50 / 0.51 | 193.62 | 2.0 % |
| 4 | 20 / 0 | 7.94 | 15.9 | 1,239,538 | 4.1 % / 8.1 % | 10 (0) | 252 | 0.50 / 0.51 | 193.62 | 4.1 % |
| 8 | 40 / 0 | 15.90 | 31.8 | 1,239,546 | 8.3 % / 16.2 % | 10 (0) | 252 | 0.50 / 0.51 | 193.62 | 8.2 % |
| 16 | 80 / 0 | 31.95 | 63.9 | 1,239,544 | 16.5 % / 32.4 % | 10 (0) | 250 | 0.50 / 0.53 | 193.62 | 16.5 % |
| 32 | 160 / 0 | 48.42 | 96.8 | 1,239,546 | 25.4 % / 50.7 % | 13 (0) | 254 | 0.63 / 0.77 | 193.62 | 25.0 % |
| 64 | 320 / 0 | 50.24 | 100.5 | 1,239,546 | 27.5 % / 64.8 % | 24 (0) | 265 | 1.27 / 1.82 | 193.62 | 25.9 % |
| 128 | 640 / 0 | 51.05 | 102.1 | 1,239,546 | 28.7 % / 93.0 % | 46 (1) | 273 | 2.55 / 3.06 | 193.62 | 26.4 % |
| 256 | 1280 / 0 | 46.48 | 93.0 | 1,239,546 | 29.1 % / 94.8 % | 91 (4) | 303 | 5.39 / 7.97 | 193.62 | 24.0 % |

The rate follows the closed loop (a client needs two blocks per order: clients / 0.5 s) up to 16 clients, and stops at about 50 orders/s (100 transactions per second) from 32 clients on. The script's own ceiling, with the rule Hardhat applies (a transaction enters a block only when its gas limit, 5,000,000 for `makeOrder`, still fits), is 46 orders per block, 184 orders/s.

### 3.2 Privacy, full cycle, real proofs generated by one host, 250 ms blocks (run B; 2 cycles per client)

| Clients | Completed / failed | cycles/s | tx/s | Gas per cycle | Block use, mean / max | Blocks (≥ 90 % full) | Mean block interval (ms) | Latency of one cycle, p50 / p95 (s) | Proving per cycle (ms) | Wait for the prover per cycle (ms) | Retries for a stale root | Oldest root used (insertions) | Gas ceiling (cycles/s) | Share of the ceiling |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 1 | 2 / 0 | 0.285 | 3.1 | 4,830,261 | 0.6 % / 2.0 % | 28 (0) | 251 | 3.50 / 3.53 | 760 | 0 | 0 | 0 | 49.69 | 0.6 % |
| 2 | 4 / 0 | 0.492 | 5.4 | 4,828,854 | 1.0 % / 4.0 % | 32 (0) | 254 | 3.52 / 4.60 | 787 | 203 | 0 | 1 | 49.70 | 1.0 % |
| 4 | 8 / 0 | 0.783 | 8.6 | 4,830,374 | 1.6 % / 8.1 % | 40 (0) | 255 | 3.91 / 6.47 | 816 | 653 | 0 | 3 | 49.69 | 1.6 % |
| 8 | 16 / 0 | 0.921 | 10.1 | 4,832,667 | 1.9 % / 16.2 % | 67 (0) | 259 | 7.32 / 10.15 | 821 | 3,205 | 0 | 4 | 49.66 | 1.9 % |
| 16 | 32 / 0 | 0.981 | 10.8 | 4,835,384 | 2.1 % / 32.4 % | 125 (0) | 261 | 14.61 / 16.72 | 839 | 8,702 | 0 | 8 | 49.63 | 2.0 % |
| 32 | 64 / 0 | 1.01 | 11.1 | 4,838,297 | 2.1 % / 52.6 % | 244 (0) | 261 | 29.81 / 30.95 | 846 | 19,846 | 0 | 26 | 49.60 | 2.0 % |
| 64 | 128 / 0 | 1.02 | 11.2 | 4,841,316 | 2.2 % / 37.8 % | 475 (0) | 264 | 59.16 / 61.32 | 854 | 41,938 | 0 | 29 | 49.57 | 2.1 % |

Repeat with 8, 16 and 32 clients (run B2):

| Clients | Completed / failed | cycles/s | tx/s | Gas per cycle | Block use, mean / max | Blocks (≥ 90 % full) | Mean block interval (ms) | Latency of one cycle, p50 / p95 (s) | Proving per cycle (ms) | Wait for the prover per cycle (ms) | Retries for a stale root | Oldest root used (insertions) | Gas ceiling (cycles/s) | Share of the ceiling |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 8 | 16 / 0 | 0.917 | 10.1 | 4,828,870 | 1.9 % / 16.2 % | 67 (0) | 260 | 7.13 / 10.51 | 829 | 3,216 | 0 | 4 | 49.70 | 1.8 % |
| 16 | 32 / 0 | 0.996 | 11.0 | 4,833,968 | 2.1 % / 32.4 % | 123 (0) | 261 | 14.33 / 17.01 | 822 | 8,610 | 0 | 8 | 49.65 | 2.0 % |
| 32 | 64 / 0 | 1.04 | 11.4 | 4,836,935 | 2.2 % / 50.6 % | 232 (0) | 266 | 28.94 / 29.84 | 838 | 19,065 | 0 | 24 | 49.62 | 2.1 % |

One proof at a time (`PROVER_CONCURRENCY=1`, as before). With 64 clients a cycle took 59.2 s, of which 41.9 s were spent waiting for the prover and 0.85 s proving.

### 3.3 Baseline without privacy, ordering step, 250 ms blocks (run C; 5 orders per client)

| Clients | Completed / failed | orders/s | tx/s | Gas per order | Block use, mean / max | Blocks (≥ 90 % full) | Mean block interval (ms) | Latency of one order, p50 / p95 (s) | Gas ceiling (orders/s) | Share of the ceiling |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 1 | 5 / 0 | 4.02 | 4.0 | 376,118 | 0.6 % / 0.6 % | 5 (0) | 249 | 0.24 / 0.27 | 638.10 | 0.6 % |
| 2 | 10 / 0 | 8.00 | 8.0 | 376,118 | 1.3 % / 1.3 % | 5 (0) | 250 | 0.24 / 0.27 | 638.10 | 1.3 % |
| 4 | 20 / 0 | 15.74 | 15.7 | 376,118 | 2.5 % / 2.5 % | 5 (0) | 254 | 0.24 / 0.28 | 638.10 | 2.5 % |
| 8 | 40 / 0 | 31.60 | 31.6 | 376,118 | 5.0 % / 5.0 % | 5 (0) | 253 | 0.25 / 0.27 | 638.10 | 5.0 % |
| 16 | 80 / 0 | 64.02 | 64.0 | 376,118 | 10.0 % / 10.0 % | 5 (0) | 250 | 0.25 / 0.26 | 638.10 | 10.0 % |
| 32 | 160 / 0 | 126.25 | 126.3 | 376,118 | 20.1 % / 20.1 % | 5 (0) | 253 | 0.25 / 0.34 | 638.10 | 19.8 % |
| 64 | 320 / 0 | 153.72 | 153.7 | 376,118 | 25.1 % / 40.1 % | 8 (0) | 260 | 0.40 / 0.52 | 638.10 | 24.1 % |
| 128 | 640 / 0 | 158.52 | 158.5 | 376,118 | 26.7 % / 73.3 % | 15 (0) | 269 | 0.87 / 1.19 | 638.10 | 24.8 % |
| 256 | 1280 / 0 | 190.62 | 190.6 | 376,118 | 34.9 % / 92.1 % | 23 (3) | 292 | 0.91 / 2.48 | 638.10 | 29.9 % |

Repeat (run C2):

| Clients | Completed / failed | orders/s | tx/s | Gas per order | Block use, mean / max | Blocks (≥ 90 % full) | Mean block interval (ms) | Latency of one order, p50 / p95 (s) | Gas ceiling (orders/s) | Share of the ceiling |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 1 | 5 / 0 | 3.96 | 4.0 | 376,118 | 0.6 % / 0.6 % | 5 (0) | 252 | 0.26 / 0.26 | 638.10 | 0.6 % |
| 2 | 10 / 0 | 7.99 | 8.0 | 376,118 | 1.3 % / 1.3 % | 5 (0) | 250 | 0.24 / 0.27 | 638.10 | 1.3 % |
| 4 | 20 / 0 | 16.04 | 16.0 | 376,118 | 2.5 % / 2.5 % | 5 (0) | 249 | 0.24 / 0.27 | 638.10 | 2.5 % |
| 8 | 40 / 0 | 31.85 | 31.8 | 376,118 | 5.0 % / 5.0 % | 5 (0) | 251 | 0.25 / 0.27 | 638.10 | 5.0 % |
| 16 | 80 / 0 | 63.56 | 63.6 | 376,118 | 10.0 % / 10.0 % | 5 (0) | 252 | 0.25 / 0.29 | 638.10 | 10.0 % |
| 32 | 160 / 0 | 125.93 | 125.9 | 376,118 | 20.1 % / 20.1 % | 5 (0) | 254 | 0.25 / 0.34 | 638.10 | 19.7 % |
| 64 | 320 / 0 | 152.81 | 152.8 | 376,118 | 25.1 % / 40.1 % | 8 (0) | 262 | 0.41 / 0.51 | 638.10 | 23.9 % |
| 128 | 640 / 0 | 157.85 | 157.9 | 376,118 | 26.7 % / 74.6 % | 15 (0) | 270 | 0.86 / 1.18 | 638.10 | 24.7 % |
| 256 | 1280 / 0 | 166.07 | 166.1 | 376,118 | 30.9 % / 92.1 % | 26 (2) | 296 | 1.70 / 2.63 | 638.10 | 26.0 % |

With 256 and 512 clients in a new process (run C3):

| Clients | Completed / failed | orders/s | tx/s | Gas per order | Block use, mean / max | Blocks (≥ 90 % full) | Mean block interval (ms) | Latency of one order, p50 / p95 (s) | Gas ceiling (orders/s) | Share of the ceiling |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 256 | 1280 / 0 | 166.82 | 166.8 | 376,118 | 32.1 % / 92.1 % | 25 (2) | 307 | 1.30 / 2.92 | 638.10 | 26.1 % |
| 512 | 2560 / 0 | 81.01 | 81.0 | 376,118 | 36.5 % / 92.1 % | 44 (7) | 718 | 4.05 / 17.91 | 638.10 | 12.7 % |

With 512 clients the process reached 12.7 GB of resident memory on a host of 15.8 GB, its blocks came every 718 ms instead of 250, and the rate fell to 81 orders/s: this level measures the host running out of memory, not the contracts. The rate with 256 clients was 190.6, 166.1 and 166.8 orders/s in the three runs.

### 3.4 Baseline without privacy, full cycle, 250 ms blocks (run D; 2 cycles per client, 7 transactions per cycle)

| Clients | Completed / failed | cycles/s | tx/s | Gas per cycle | Block use, mean / max | Blocks (≥ 90 % full) | Mean block interval (ms) | Latency of one cycle, p50 / p95 (s) | Gas ceiling (cycles/s) | Share of the ceiling |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 1 | 2 / 0 | 0.569 | 4.0 | 893,101 | 0.2 % / 0.6 % | 14 (0) | 251 | 1.75 / 1.77 | 268.73 | 0.2 % |
| 2 | 4 / 0 | 1.13 | 7.9 | 897,360 | 0.4 % / 1.3 % | 14 (0) | 252 | 1.76 / 1.77 | 267.45 | 0.4 % |
| 4 | 8 / 0 | 2.29 | 16.0 | 897,370 | 0.9 % / 2.5 % | 14 (0) | 250 | 1.74 / 1.76 | 267.45 | 0.9 % |
| 8 | 16 / 0 | 4.55 | 31.9 | 897,371 | 1.7 % / 5.0 % | 14 (0) | 251 | 1.74 / 1.79 | 267.45 | 1.7 % |
| 16 | 32 / 0 | 9.11 | 63.8 | 897,379 | 3.4 % / 10.0 % | 14 (0) | 251 | 1.75 / 1.79 | 267.45 | 3.4 % |
| 32 | 64 / 0 | 16.96 | 118.7 | 897,368 | 6.4 % / 20.1 % | 15 (0) | 252 | 1.76 / 1.88 | 267.45 | 6.3 % |
| 64 | 128 / 0 | 22.12 | 154.9 | 897,367 | 8.7 % / 40.1 % | 22 (0) | 263 | 2.86 / 3.21 | 267.45 | 8.3 % |
| 128 | 256 / 0 | 21.43 | 150.0 | 897,379 | 8.5 % / 64.6 % | 45 (0) | 265 | 5.79 / 6.64 | 267.45 | 8.0 % |

Repeat (run D2):

| Clients | Completed / failed | cycles/s | tx/s | Gas per cycle | Block use, mean / max | Blocks (≥ 90 % full) | Mean block interval (ms) | Latency of one cycle, p50 / p95 (s) | Gas ceiling (cycles/s) | Share of the ceiling |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 1 | 2 / 0 | 0.567 | 4.0 | 893,101 | 0.2 % / 0.6 % | 14 (0) | 252 | 1.76 / 1.76 | 268.73 | 0.2 % |
| 2 | 4 / 0 | 1.14 | 8.0 | 897,356 | 0.4 % / 1.3 % | 14 (0) | 250 | 1.74 / 1.76 | 267.45 | 0.4 % |
| 4 | 8 / 0 | 2.26 | 15.8 | 897,375 | 0.9 % / 2.5 % | 14 (0) | 253 | 1.76 / 1.78 | 267.45 | 0.8 % |
| 8 | 16 / 0 | 4.55 | 31.8 | 897,372 | 1.7 % / 5.0 % | 14 (0) | 251 | 1.76 / 1.77 | 267.45 | 1.7 % |
| 16 | 32 / 0 | 9.13 | 63.9 | 897,369 | 3.4 % / 10.0 % | 14 (0) | 250 | 1.75 / 1.80 | 267.45 | 3.4 % |
| 32 | 64 / 0 | 18.14 | 127.0 | 897,372 | 6.8 % / 20.1 % | 14 (0) | 252 | 1.76 / 1.86 | 267.45 | 6.8 % |
| 64 | 128 / 0 | 21.37 | 149.6 | 897,367 | 8.3 % / 40.1 % | 23 (0) | 260 | 2.87 / 3.17 | 267.45 | 8.0 % |
| 128 | 256 / 0 | 21.91 | 153.4 | 897,380 | 8.7 % / 78.4 % | 44 (0) | 266 | 5.54 / 6.88 | 267.45 | 8.2 % |

### 3.5 Privacy, full cycle, one prover per participant emulated, 250 ms blocks (run E; 2 cycles per client)

Each client builds the proof input as for a real proof, waits 756 ms on a timer and submits the placeholder proof to the gas-equivalent verifier, with the public signals computed from its input.

| Clients | Completed / failed | cycles/s | tx/s | Gas per cycle | Block use, mean / max | Blocks (≥ 90 % full) | Mean block interval (ms) | Latency of one cycle, p50 / p95 (s) | Proving per cycle (ms) | Retries for a stale root | Oldest root used (insertions) | Gas ceiling (cycles/s) | Share of the ceiling |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 1 | 2 / 0 | 0.284 | 3.1 | 4,830,440 | 0.6 % / 2.0 % | 28 (0) | 252 | 3.52 / 3.54 | 756 | 0 | 0 | 49.68 | 0.6 % |
| 2 | 4 / 0 | 0.570 | 6.3 | 4,829,007 | 1.1 % / 4.0 % | 28 (0) | 251 | 3.50 / 3.51 | 757 | 0 | 1 | 49.70 | 1.1 % |
| 4 | 8 / 0 | 1.14 | 12.5 | 4,830,488 | 2.3 % / 8.1 % | 28 (0) | 251 | 3.51 / 3.53 | 756 | 0 | 3 | 49.68 | 2.3 % |
| 8 | 16 / 0 | 2.12 | 23.4 | 4,832,804 | 4.3 % / 16.2 % | 30 (0) | 251 | 3.76 / 3.79 | 756 | 0 | 7 | 49.66 | 4.3 % |
| 16 | 32 / 0 | 3.67 | 40.4 | 4,835,531 | 7.6 % / 32.4 % | 34 (0) | 256 | 3.93 / 4.75 | 756 | 0 | 15 | 49.63 | 7.4 % |
| 32 | 64 / 0 | 5.67 | 62.3 | 4,838,443 | 12.0 % / 51.8 % | 43 (0) | 263 | 5.27 / 6.43 | 757 | 0 | 32 | 49.60 | 11.4 % |
| 64 | 128 / 0 | 6.26 | 68.9 | 4,841,456 | 14.3 % / 61.5 % | 72 (0) | 284 | 9.23 / 12.01 | 758 | 0 | 63 | 49.57 | 12.6 % |
| 128 | 256 / 0 | 6.49 | 71.4 | 4,844,547 | 14.9 % / 93.3 % | 139 (4) | 284 | 18.04 / 24.98 | 773 | 0 | 93 | 49.54 | 13.1 % |

Repeat (run E2):

| Clients | Completed / failed | cycles/s | tx/s | Gas per cycle | Block use, mean / max | Blocks (≥ 90 % full) | Mean block interval (ms) | Latency of one cycle, p50 / p95 (s) | Proving per cycle (ms) | Retries for a stale root | Oldest root used (insertions) | Gas ceiling (cycles/s) | Share of the ceiling |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 1 | 2 / 0 | 0.284 | 3.1 | 4,830,445 | 0.6 % / 2.0 % | 28 (0) | 252 | 3.52 / 3.54 | 756 | 0 | 0 | 49.68 | 0.6 % |
| 2 | 4 / 0 | 0.570 | 6.3 | 4,828,997 | 1.1 % / 4.0 % | 28 (0) | 251 | 3.51 / 3.52 | 756 | 0 | 1 | 49.70 | 1.1 % |
| 4 | 8 / 0 | 1.14 | 12.5 | 4,830,497 | 2.3 % / 8.1 % | 28 (0) | 251 | 3.51 / 3.52 | 758 | 0 | 3 | 49.68 | 2.3 % |
| 8 | 16 / 0 | 2.13 | 23.4 | 4,832,798 | 4.3 % / 16.2 % | 30 (0) | 251 | 3.75 / 3.77 | 756 | 0 | 7 | 49.66 | 4.3 % |
| 16 | 32 / 0 | 3.39 | 37.3 | 4,835,524 | 7.2 % / 32.4 % | 36 (0) | 262 | 4.68 / 4.85 | 756 | 0 | 15 | 49.63 | 6.8 % |
| 32 | 64 / 0 | 5.64 | 62.1 | 4,838,444 | 11.7 % / 54.1 % | 44 (0) | 258 | 5.34 / 5.98 | 756 | 0 | 31 | 49.60 | 11.4 % |
| 64 | 128 / 0 | 6.27 | 69.0 | 4,841,456 | 14.0 % / 93.0 % | 74 (1) | 276 | 9.36 / 11.40 | 758 | 0 | 63 | 49.57 | 12.7 % |
| 128 | 256 / 0 | 6.12 | 67.4 | 4,844,545 | 14.3 % / 97.1 % | 145 (2) | 288 | 18.80 / 26.64 | 758 | 0 | 102 | 49.54 | 12.4 % |

### 3.6 Privacy, full cycle, one prover per participant emulated, 12 s blocks (run F; 1 cycle per client)

| Clients | Completed / failed | cycles/s | tx/s | Gas per cycle | Block use, mean / max | Blocks (≥ 90 % full) | Mean block interval (ms) | Latency of one cycle, p50 / p95 (s) | Proving per cycle (ms) | Retries for a stale root | Oldest root used (insertions) | Gas ceiling (cycles/s) | Share of the ceiling |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 8 | 8 / 0 | 0.061 | 0.7 | 4,825,723 | 5.8 % / 16.2 % | 11 (0) | 12002 | 131.99 / 132.02 | 756 | 0 | 7 | 1.04 | 5.8 % |
| 32 | 32 / 0 | 0.242 | 2.7 | 4,830,947 | 23.4 % / 64.7 % | 11 (0) | 12001 | 131.88 / 131.99 | 757 | 0 | 31 | 1.03 | 23.4 % |
| 64 | 64 / 0 | 0.444 | 4.9 | 4,835,379 | 43.0 % / 98.9 % | 12 (3) | 12001 | 131.98 / 143.87 | 756 | 0 | 84 | 1.03 | 43.0 % |
| 128 | 128 / 0 | 0.667 | 7.3 | 4,839,069 | 64.5 % / 99.2 % | 16 (8) | 12001 | 168.23 / 191.91 | 757 | 0 | 253 | 1.03 | 64.5 % |
| 256 | 256 / 0 | 0.762 | 8.4 | 4,842,685 | 73.8 % / 99.2 % | 28 (19) | 12001 | 262.96 / 312.13 | 756 | 0 | 711 | 1.03 | 73.8 % |

With 512 clients in a new process (run F2):

| Clients | Completed / failed | cycles/s | tx/s | Gas per cycle | Block use, mean / max | Blocks (≥ 90 % full) | Mean block interval (ms) | Latency of one cycle, p50 / p95 (s) | Proving per cycle (ms) | Retries for a stale root | Oldest root used (insertions) | Gas ceiling (cycles/s) | Share of the ceiling |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 512 | 301 / 211 | 0.597 | 7.8 | 4,835,951 | 75.4 % / 99.2 % | 42 (30) | 12001 | 466.66 / 477.66 | 756 per proof | 0 | 809 | 1.03 | 57.8 % |

- Up to 32 clients every cycle takes exactly 11 blocks (132 s) and the rate is clients / 132 s. From 64 clients on, the steps that the clients reach together no longer fit in one block.
- With 256 clients, blocks 2 to 20 of the 28 were 93 to 99 % full (18 of the 19 at 97 to 99 %); the other nine are the first block (256 announcements, 11 %) and the last eight, where the clients finish (one cycle per client, so every window has a start and an end that are not full). Over the whole window the transactions used 3.69 of the 5.0 million gas per second that the chain can include.
- Run F2 is described in section 5.

## 4. What limits each configuration, and how this is known

Processor time of the benchmark process during the levels named, from the samples taken once a second (100 % is one processor thread; the host has 16). "Main thread" is the Node thread that runs the clients' JavaScript and Hardhat's request handling; "EDR threads" are the threads of Hardhat's EVM; "other threads" include the snarkjs workers. The level windows were placed on the samples by counting back from the end of the run, so the figures of short levels (a few samples) are approximate.

| Run | Clients | Samples | Process | Main thread | EDR threads | Other threads | Peak memory (MB) |
|---|---:|---:|---:|---:|---:|---:|---:|
| A | 16 | 2 | 59 % | 43 % | 11 % | 5 % | 726 |
| A | 32 | 2 | 133 % | 93 % | 34 % | 6 % | 1,234 |
| A | 64 | 6 | 126 % | 88 % | 34 % | 4 % | 2,419 |
| A | 128 | 12 | 137 % | 90 % | 43 % | 3 % | 4,606 |
| A | 256 | 27 | 134 % | 84 % | 47 % | 3 % | 9,190 |
| B | 8 | 17 | 736 % | 48 % | 20 % | 668 % | 2,856 |
| B | 32 | 62 | 833 % | 55 % | 25 % | 754 % | 5,924 |
| B | 64 | 125 | 828 % | 55 % | 26 % | 746 % | 9,145 |
| C | 64 | 1 | 130 % | 55 % | 70 % | 5 % | 1,707 |
| C | 128 | 3 | 117 % | 48 % | 65 % | 4 % | 3,302 |
| C | 256 | 6 | 113 % | 51 % | 60 % | 2 % | 5,101 |
| C3 | 512 | 31 | 113 % | 27 % | 85 % | 1 % | 12,745 |
| D | 16 | 3 | 42 % | 24 % | 15 % | 3 % | 641 |
| D | 32 | 2 | 99 % | 46 % | 48 % | 5 % | 1,047 |
| D | 64 | 4 | 133 % | 54 % | 76 % | 3 % | 1,834 |
| D | 128 | 11 | 132 % | 51 % | 79 % | 2 % | 3,004 |
| E | 16 | 8 | 72 % | 31 % | 31 % | 10 % | 815 |
| E | 32 | 10 | 112 % | 48 % | 50 % | 13 % | 1,385 |
| E | 64 | 19 | 129 % | 52 % | 62 % | 14 % | 1,643 |
| E | 128 | 39 | 130 % | 54 % | 60 % | 16 % | 2,663 |
| E2 | 64 | 20 | 129 % | 53 % | 60 % | 16 % | 2,239 |
| E2 | 128 | 41 | 128 % | 51 % | 62 % | 15 % | 3,858 |
| F | 128 | 191 | 23 % | 8 % | 9 % | 6 % | 5,021 |
| F | 256 | 335 | 30 % | 9 % | 14 % | 6 % | 9,976 |
| F2 | 512 | 503 | 35 % | 10 % | 17 % | 7 % | 10,239 |

- **Up to 16 clients at 250 ms (all configurations): the closed loop.** A client sends one transaction per block, so the rate is clients / (transactions per unit × 0.25 s + proving time): 0.284 cycles/s measured with one client against 1 / (11 × 0.25 + 0.756) = 0.285; the blocks are at most 32 % full and the process uses less than one thread.
- **Ordering step with privacy (A): the main thread of the benchmark process.** From 32 clients on the rate stays at 46 to 51 orders/s while the main thread is 83 to 93 % busy, the blocks are 25 to 29 % full on average, and the mean block interval grows from 252 to 298 ms. The process runs the node and all clients; a client derives the one-time address and encrypts the order's content before each order. The limit is that process, not the block: the ceiling by gas is 193.6 orders/s.
- **Full cycle with real proofs from one host (B): proof generation.** The rate stays at 0.92 to 1.04 cycles/s from 8 clients on, with one proof per cycle, proofs made one at a time, and the wait for the prover growing with the clients (3.2 s per cycle with 8 clients, 41.9 s with 64). The blocks are 2 % full and the snarkjs workers use about 7.5 threads.
- **Full cycle with one prover per participant, 250 ms (E), and both baseline configurations (C, D): the process that runs the node.** From 64 clients on the rate does not rise (E: 6.27 and 6.49 cycles/s, about 70 transactions per second; D: 22 cycles/s, about 150 transactions per second; C: 154 to 191 orders/s), the process stays at 1.1 to 1.4 threads of the 16 (main thread about 50 %, EDR threads 60 to 80 %) with a 1-minute load average below 1.2, the blocks are 9 to 35 % full on average, the mean block interval grows from 250 to 265–300 ms, and transactions wait longer for inclusion although the blocks have room (E with 128 clients: 849 ms median, against 233 ms with one client). The node handles requests and mines in one process that cannot use the other threads; the proofs do not load it (they are timers), and the block gas limit is not reached on average. This is the same limit as on 2026-10-02, at a different rate: the node then included 57 transactions per second and 51 million gas per second with 64 clients, and now 69 and 30 million.
- **Full cycle with one prover per participant, 12 s (F): the block gas limit.** The process uses a third of one thread; with 128 clients 8 of 16 blocks and with 256 clients 19 of 28 blocks are at least 90 % full, and the latency of a cycle grows from 132 s to 263 s (p50). The rate (0.76 cycles/s) is below the ceiling (1.03) because each client runs one cycle, so the window includes the blocks where the clients start and finish.

What could not be separated: in runs C, D and E the share of the limit that is Hardhat's request handling in JavaScript and the share that is EVM execution in EDR; the samples give threads by name, not by request. A separate node process was not used (the task was limited to the in-process network).

## 5. Failures and retries

- **Stale roots.** None. The contracts accept every past root of the note tree, and no client had to regenerate a proof: 0 retries in all thirteen runs. The withdrawals that waited longest were checked against roots 253 (128 clients), 711 (256 clients) and 809 (512 clients) insertions behind the tree and were accepted.
- **Run F2, 512 clients at 12 s blocks: 211 of 512 cycles failed, 301 completed** (0.60 cycles/s; blocks 75 % full on average, 30 of 42 at least 90 % full). All 211 failed at the same step and with the same message of the script before sending: `poolWithdraw: stealth balance 2546694105600000 does not cover 0 + 1600000 gas x <price>`. The cause, from the run's own data:
  - The customer funds the one-time address with gas money of 1,600,000 gas × the gas price at the time of the order × 1.5 (the customer dApp's rule, `estimateGasStipend`, which the script copies). In this level the price at the time of the orders was 1.061 gwei.
  - The level kept 25 blocks in a row 93 to 99 % full. The base fee rises by 12.5 % after each full block: it went from 0.061 to 1.27 gwei during the level, and the node's gas price (base fee plus a tip of 1 gwei) from 1.061 to 1.74–2.04 gwei when these clients reached the withdrawal, 1.64 to 1.92 times the price at the order (59 clients at 1.739 gwei, 66 at 1.829, 67 at 1.928, 19 at 2.042).
  - The one-time address sends the withdrawal with a legacy gas price and must hold gas limit × price beforehand. Its balance covers a rise of the price by a factor of 1.5 with the script's fixed limit of 1,600,000 gas. With the manager dApp's limit (the node's estimate × 1.2; the script sent up to 1,353,434 gas in run B) the balance would cover a price of 1.88 gwei, a factor of 1.77: by this computation, not by a measurement, 125 of the 211 would have passed the check and 86 would not.
  - The failed clients had already sent the announcement, `makeOrder` and the pool deposit (633 transactions, 443 million gas): their orders stay open. What the manager dApp does in this state was not examined.
  - In the same level 615 transactions waited more than 120 s for inclusion (485 pool deposits, 60 `confirmIntention`, 58 `makeOrder`, 12 withdrawals). The script fixes the fees of the type-2 transactions once per level (a cap of twice the base fee at the level's start plus the 1 gwei tip, 1.12 gwei here). As the base fee rose, these transactions offered a smaller tip than the legacy transactions of the one-time addresses, and once the base fee passed the cap (its maximum was 1.27 gwei) they could not be included until it fell. This explanation is read from the fee values of the run; the waits were not traced transaction by transaction.
  - How far this transfers to a network: the growth of the base fee under full blocks and the factor 1.5 are properties of the protocol and of the dApps. The level at which it bites here depends on the local node's starting base fee, which is small against the 1 gwei tip (in run F, with 256 clients, the base fee rose ninefold, from 0.003 to 0.029 gwei, and nothing failed), and on 512 clients that keep sending whatever the price.
- **Timeouts.** None was counted, because runs F and F2 gave a client 600 s per receipt (section 2). With the default 120 s, the 41 slow withdrawals of run F (256 clients) would have been failed cycles.
- **Run C3, 512 clients.** No failed order; the process came close to the host's memory (section 3.3).

## 6. The paper's table, earlier and new figures

Layout of Table "throughput". Earlier: the paper's figures (contracts of 2026-10-02). New: this study for Hardhat; for Sepolia, the rows of `sepolia-final-2026-10-13.md` (section 8 of that file), measured by another task and not repeated here.

| Network | Proofs | Clients | Cycles/s, earlier | Cycles/s, new | Block use, earlier | Block use, new | Gas ceiling (cycles/s), earlier | Gas ceiling, new |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| Sepolia (12 s) | real, one host | 1 / 8 | 0.007 / 0.038 | 0.0076 / 0.0325 | — | 38 % / 37 % (all users' transactions) | 0.50 | 1.46 (Sepolia's block limit is now 200,000,000 gas; 11,417,670 gas per cycle under its schedule) |
| Hardhat (250 ms) | real, one host | 8–32 | 0.61 | 0.92–1.01 (1.02 with 64) | 3 % | 2 % | 24.3 | 49.6 |
| Hardhat (250 ms) | per device | 64 | 5.21 | 6.27 (repeat 6.27; with 128: 6.49 and 6.13) | 25 % | 14 % | 24.3 | 49.6 |
| Hardhat (12 s) | per device | 128 | 0.40 | 0.67 (with 256: 0.76) | 81 % | 65 % (with 256: 74 %) | 0.50 | 1.03 |

The Hardhat ceilings use the gas measured in the level named: 4,841,456 gas per cycle with 64 clients at 250 ms (49.57 cycles/s) and 4,842,685 with 256 clients at 12 s (1.03 cycles/s). They are for a block limit of 60,000,000 gas and the main network's gas schedule. Under Sepolia's schedule a cycle costs 11,417,670 gas (the Sepolia file): 5.25 cycles per 60,000,000 gas, 17.5 per block of 200,000,000.

Ordering step and baseline, which the paper's table does not have:

| Configuration | Clients | Earlier (2026-10-02) | New | Block use, earlier → new | Gas ceiling, earlier → new |
|---|---:|---:|---:|---:|---:|
| Privacy, ordering step, 250 ms | 32 to 128 | 48.3, 46.4, 44.7 orders/s | 48.8, 50.0, 49.4 orders/s (repeat 48.4, 50.2, 51.0) | 70 % → 25 to 28 % | 69.9 → 193.6 orders/s by gas (script's rule with the 5,000,000 limit: 68 → 184) |
| Baseline, ordering step, 250 ms | 64 / 128 | 98.3 / 99.8 orders/s | 153.7 / 158.5 orders/s (with 256: 166 to 191) | 88 % / 91 % → 25 % / 27 % | 112.5 → 638 orders/s by gas (script's rule: 104 → 588) |
| Baseline, full cycle, 250 ms | 32 | 23.2 cycles/s (5 transactions per cycle) | 17.0 and 18.1 (with 64: 22.1 and 21.4; 7 transactions per cycle) | 24 % → 6 % | 96.8 → 267.5 cycles/s |
| Sepolia, ordering step (cited) | 8 | 0.22 orders/s | 0.268 orders/s | 59 % → 38 % (all users) | — |

## 7. The statements of the paper

1. *"A single machine that generated the proofs of all parties reached at most 0.61 cycles/s, while its blocks were only 3 % full; limited by proof generation."* New: at most **1.02 cycles/s** (64 clients; 0.92 to 1.01 with 8 to 32, 0.92 to 1.04 in the repeat), blocks **2 %** full. Still limited by proof generation; a cycle has one proof instead of three (median 0.84 s per proof inside the run, 0.76 s alone).
2. *"With this emulation, the throughput reached 5.2 cycles/s with 64 clients … blocks 25 % full on average … gas ceiling 24 cycles/s."* New: **6.27 cycles/s with 64 clients** (6.27 in the repeat) and 6.49 and 6.13 with 128; blocks **14 %** full on average (15 % with 128); gas ceiling **49.6 cycles/s**. Still limited by the machine that runs the node. The emulated proving time is 756 ms (694 ms before), and the test verifier uses the same gas as the real one within 0.08 % (+176 gas, 0.079 %), measured again.
3. *"With a block time of twelve seconds, the same emulation reached 0.40 cycles/s with 128 clients and blocks 81 % full on average, close to the ceiling of 0.50 cycles/s."* New: **0.67 cycles/s with 128 clients, blocks 65 % full; 0.76 cycles/s with 256 clients, blocks 74 % full; ceiling 1.03 cycles/s.** With 128 clients the chain is no longer saturated (a cycle uses half the gas), so the comparable point is 256 clients. With 512 clients the rate did not rise: 0.60 cycles/s completed and 211 cycles failed (section 5).
4. *"The ordering step alone saturated at about 48 orders/s … where the blocks were filled with `makeOrder` transactions."* New: **about 50 orders/s** (46 to 51 from 32 to 256 clients), and the second half of the sentence no longer applies: the blocks are **28 %** full on average and the gas ceiling is 193.6 orders/s. What stops the rate is the benchmark process (main thread 83 to 93 % busy). The rate in transactions is the same as on 2026-10-02 (97 to 100 per second) although `makeOrder` now uses 1,213,303 gas instead of 3,405,331; this suggests that the earlier figure too was set by the process and not by the blocks, which the earlier files (blocks 70 % full on average) do not contradict. That is an inference, not a measurement.
5. *"A block of 60 million gas holds six full cycles, which corresponds to about 0.5 cycles/s."* New, main network's schedule: **12.4 cycles** (60,000,000 / 4,835,000 to 4,845,000 gas), about 1.03 cycles/s at 12 s blocks. On Sepolia since 2026-10-06 (from the Sepolia file, not measured here): 11,417,670 gas per cycle, 17.5 cycles per block of 200,000,000 gas, 1.46 cycles/s; in 60,000,000 gas, 5.25 cycles.
6. *Failures under load.* None with 64, 128 and 256 clients and 0 retries, with roots up to 711 insertions old accepted. With 512 clients, 211 of 512 cycles could not send the withdrawal because the gas price had risen by more than the factor 1.5 that the one-time address's gas money covers (section 5).

## 8. Gas in these runs

Per call, run E (510 of each, all levels):

| Call | n | Mean gas | Range | Gas limit sent |
|---|---:|---:|---:|---:|
| stealthAnnounce | 510 | 26,243 | 26,209–26,245 | 200,000 |
| makeOrder | 510 | 1,213,303 | 1,213,257–1,213,305 | 5,000,000 |
| poolDeposit | 510 | 861,455 | 853,303–874,561 | 2,000,000 |
| poolWithdraw | 510 | 1,121,112 | 1,098,992–1,133,848 | 1,600,000 |
| prepareOrder | 510 | 137,390 | 137,356–137,392 | 400,000 |
| confirmIntention | 510 | 230,250 | 230,221–230,257 | 4,000,000 |
| addInformation | 510 | 60,136 | 60,130–60,142 | 4,000,000 |
| pickupOrder | 510 | 68,774 | 68,734–68,787 | 400,000 |
| deliveryOrder | 510 | 1,007,125 | 994,201–1,034,655 | 4,000,000 |
| rateOrder_client | 510 | 57,955 | 57,921–57,957 | 4,000,000 |
| rateOrder_restaurant | 510 | 57,930 | 57,896–57,932 | 400,000 |

Baseline, run D (510 of each):

| Call | n | Mean gas | Range | Gas limit sent |
|---|---:|---:|---:|---:|
| makeOrder | 510 | 376,118 | 376,106–376,118 | 5,000,000 |
| prepareOrder | 510 | 109,990 | 109,979–109,991 | 400,000 |
| confirmIntention | 510 | 106,604 | 106,587–106,611 | 4,000,000 |
| pickupOrder | 510 | 68,438 | 68,398–68,451 | 400,000 |
| deliveryOrder | 510 | 98,935 | 98,894–98,947 | 4,000,000 |
| rateOrder_client | 510 | 79,308 | 75,028–92,152 | 4,000,000 |
| rateOrder_restaurant | 510 | 57,964 | 57,942–57,966 | 400,000 |

- A cycle: 4,830,440 gas with one client to 4,844,547 with 128 (the note tree grows during a run); the sequential measurement gives 4,833,322 for a later cycle (`local-gas-final-2026-10-12.md`). With real proofs (run B) the same levels give 4,830,261 to 4,841,316: the emulation is within 0.01 %.
- Baseline cycle: 897,356 to 897,380 gas (893,101 with one client; 893,072 sequentially). The difference between levels is in the customer's rating (75,028 to 92,152 gas); its cause was not examined.
- Ordering step: 1,213,303 + 26,243 = 1,239,546 gas with privacy, 376,118 without.
- Calibration of the test verifier (11 real proofs): in-contract 222,177 (real) against 222,353 (test), +176 gas, 0.079 %; called from a contract 226,886 against 227,062; the real verifier accepts the real proof and rejects the placeholder, the test verifier the reverse.

## 9. Limits of this study

- One host runs the node and every client in one process. The figures at 250 ms are figures of that process; only the 12 s configuration reaches the chain's gas limit.
- Clients start together and run one, two or five units each: every window contains a start and an end, and the steps of the clients arrive in bursts. This lowers the rate against a steady state, most visibly at 12 s.
- The saturated levels vary between runs: 6.49 and 6.13 cycles/s for run E with 128 clients, 190.6, 166.1 and 166.8 orders/s for the baseline with 256 clients. Each 250 ms sweep was run twice (run B's repeat covers 8 to 32 clients); the 12 s sweep and the levels with 512 clients were run once.
- The emulated proving time is one fixed value per proof. The emulated mode sends the withdrawal with a fixed gas limit and reads the `latest` block, unlike the dApps (section 2); the gas used is not affected.
- The local block limit is 60,000,000 gas and the schedule is the main network's. Sepolia has another schedule and a block limit of 200,000,000 gas; its rows are cited from the Sepolia file.
- The processor attribution by level is approximate for short levels, and it does not split node and client work inside the main thread.
- In the summaries of runs E, E2, F and F2 the field `deviceProving.source` names the calibration file by its path in the scratch folder where the runs wrote their results; the file is the one copied here.
- Not examined: the manager dApp's behaviour when the one-time address cannot pay for the withdrawal; a node in a separate process; block times other than 250 ms and 12 s.

## 10. Files

- This report and `throughput-final-2026-10-13.json` (every row of the tables, the processor samples by level, the load averages, the calibration, the comparison table).
- Raw files of the thirteen runs: the stems of section 2, each with `.txt` (the script's report), `.csv` (every transaction), `-summary.json`, `-raw.json`.
- `gas-equivalent-verifier-calibration-2026-10-13T02-31-54-926Z.json`.
- `throughput-final-2026-10-13-process-samples.jsonl.gz`: the one-second samples of the benchmark process for every run (run name, time, load average, memory, processor time by thread name).
- Nothing in these files is a key: the 64-hex-digit values are transaction hashes of the local chain; the wallets were created in memory and funded with `hardhat_setBalance`.

## 11. 12-second blocks: the ordering step and the baseline (added 2026-10-13)

Sections 1 to 10 measured the ordering step, and the whole baseline, only with 250 ms blocks, where the in-process node limits the rate and the blocks stay a quarter to a third full. This section measures them with 12 s blocks, the block time of the main network and of Sepolia, where the block gas limit of 60,000,000 is what limits the ordering step and begins to limit the full cycles. Same host, contracts, script and wrapper as the other rows; local in-process Hardhat network only. Measured 2026-10-13 06:28 to 07:42 UTC, one experiment at a time. No figure of sections 1 to 10 was changed.

Corrected later on 2026-10-13 after an independent check of this section (not published): the wording of 11.1, 11.7, 11.8, 11.10 and 11.11 (the full-cycle ceilings, what limits the full cycles, the base fee, the admission rule, two small figures), and one run added, D1 (section 11.3.1: the ordering step with the gas limit the customer's dApp sends, 08:06 to 08:13 UTC). Every figure measured by runs P1, B1, C1, B2 and P2 is as first written.

### 11.1 In short

| Configuration, 12 s blocks | Clients | Rate | Block use, mean | Blocks at least 90 % full | Ceiling by gas (computed) | What limits it |
|---|---:|---:|---:|---:|---:|---|
| Privacy, ordering step | 256 | 3.68 orders/s | 91 % | 27 of 29 | 4.03 orders/s | the block gas limit: 46 `makeOrder` per block |
| Privacy, ordering step | 512 | 3.71 orders/s (3.66 per 12 s of blocks, section 11.3) | 91 % | 33 of 35 | 4.03 orders/s | the same |
| Privacy, ordering step, `makeOrder` sent with the dApp's gas limit of 1,528,479 (run D1, section 11.3.1) | 256 | 3.76 orders/s | 93 % | 15 of 17 | 4.03 orders/s | the block gas limit: 46 to 49 `makeOrder` per block (48.5 on average, 4.04 orders/s in the full blocks), blocks 99.1 to 99.7 % full |
| Privacy, full cycle, one prover per participant (run F, section 3.6) | 256 | 0.762 cycles/s | 74 % | 19 of 28 | 1.03 cycles/s | the block gas limit in part (19 of 28 blocks full; 74 % of the ceiling), and the gas price: with 512 clients 211 cycles failed on gas money (section 5) |
| Baseline without privacy, ordering step | 256 | 11.85 orders/s | 89 % | 17 of 18 | 13.29 orders/s | the block gas limit: 147 `makeOrder` per block |
| Baseline without privacy, ordering step | 512 | 12.19 orders/s | 92 % | 20 of 21 | 13.29 orders/s | the same |
| Baseline without privacy, full cycle | 256 | 2.84 cycles/s | 51 % | 4 of 15 | 5.57 cycles/s | the closed loop (seven blocks per cycle); the `makeOrder` step already fills two blocks |
| Baseline without privacy, full cycle | 512 | 4.49 cycles/s | 81 % | 8 of 19 | 5.57 cycles/s | blocks begin to fill: the block gas limit in the `makeOrder` step (8 of 19 blocks full); 81 % of the ceiling, not a plateau |

- The rates of the full cycles are measured rates below their ceilings; neither ceiling was reached (section 11.8). The ceilings are computed upper bounds.
- Nothing failed: 12,000 orders and 2,000 baseline cycles completed in the five runs (30,000 transactions), 0 failed (run D1, added later: 792 more orders, 0 failed). No client was unable to pay and no transaction was left out of a block for its price.
- 184 transactions waited more than 120 s for inclusion, all of them `makeOrder` of the level with 512 privacy clients (the longest wait was 140 s: 512 orders queue for a block that takes 46). They were included; with the script's default patience of 120 s per receipt they would have been counted as failed orders, which is why these runs gave a client 600 s. In every other level the longest wait was 70 s.
- The benchmark process was never the limit: at most 30 % of one processor thread on average in any level and at most 1,135 MB of memory.

### 11.2 What ran

`cd <repository> && <environment> RESULTS_DIR=<scratch> npx hardhat run benchmarking/benchmark-concurrent.cjs --no-compile`, through the same wrapper as section 2 (it waits for a 1-minute load average below 0.6, writes it down, and samples the benchmark process once a second). Clients are closed loops and start together; one unrecorded warm-up unit precedes each sweep.

| Run | UTC | Load average before (1 / 5 / 15 min) | Waited (s) | Peak memory of the process (MB) | Environment | Result files (`benchmarking/results/`, `.txt`, `.csv`, `-summary.json`, `-raw.json`) |
|---|---|---|---:|---:|---|---|
| P1 | 06:28:42–06:46:21 | 0.44 / 0.38 / 0.16 | 0 | 649 | `EDR_GUARD=1 MIMALLOC_PURGE_DELAY=0 BLOCK_TIME_MS=12000 TX_TIMEOUT_MS=600000 VARIANT=privacy WORKLOAD=makeOrder CONCURRENCY=8,32,64,128,256 ORDERS_PER_CLIENT=5 RESULTS_LABEL=final-12s` | `concurrent-hardhat-privacy-final-12s-12000ms-2026-10-13T06-46-21-485Z` |
| B1 | 06:46:21–07:00:12 | 0.29 / 0.16 / 0.12 | 0 | 657 | `EDR_GUARD=1 MIMALLOC_PURGE_DELAY=0 BLOCK_TIME_MS=12000 TX_TIMEOUT_MS=600000 VARIANT=no-privacy WORKLOAD=makeOrder CONCURRENCY=8,32,64,128,256 ORDERS_PER_CLIENT=10 RESULTS_LABEL=final-12s` | `concurrent-hardhat-no-privacy-final-12s-12000ms-2026-10-13T07-00-12-610Z` |
| C1 | 07:00:12–07:22:16 | 0.10 / 0.20 / 0.14 | 0 | 1,135 | `EDR_GUARD=1 MIMALLOC_PURGE_DELAY=0 BLOCK_TIME_MS=12000 TX_TIMEOUT_MS=600000 VARIANT=no-privacy WORKLOAD=cycle CONCURRENCY=8,32,64,128,256,512 CYCLES_PER_CLIENT=2 RESULTS_LABEL=final-12s` | `concurrent-hardhat-no-privacy-final-12s-12000ms-2026-10-13T07-22-16-008Z` |
| B2 | 07:22:16–07:28:44 | 0.30 / 0.35 / 0.25 | 0 | 628 | `EDR_GUARD=1 MIMALLOC_PURGE_DELAY=0 BLOCK_TIME_MS=12000 TX_TIMEOUT_MS=600000 VARIANT=no-privacy WORKLOAD=makeOrder CONCURRENCY=8,512 ORDERS_PER_CLIENT=6 RESULTS_LABEL=final-12s-k512` | `concurrent-hardhat-no-privacy-final-12s-k512-12000ms-2026-10-13T07-28-44-530Z` |
| P2 | 07:28:44–07:42:18 | 0.24 / 0.28 / 0.26 | 0 | 645 | `EDR_GUARD=1 MIMALLOC_PURGE_DELAY=0 BLOCK_TIME_MS=12000 TX_TIMEOUT_MS=600000 VARIANT=privacy WORKLOAD=makeOrder CONCURRENCY=8,512 ORDERS_PER_CLIENT=3 LEVEL_PAUSE_MS=150000 RESULTS_LABEL=final-12s-k512` | `concurrent-hardhat-privacy-final-12s-k512-12000ms-2026-10-13T07-42-18-892Z` |
| D1 (added after the check) | 08:06:49–08:13:52 | 0.20 / 0.18 / 0.18 | 0 (not waited for a quiet host) | 585 | `EDR_GUARD=1 MIMALLOC_PURGE_DELAY=0 BLOCK_TIME_MS=12000 TX_TIMEOUT_MS=600000 VARIANT=privacy WORKLOAD=makeOrder CONCURRENCY=8,256 ORDERS_PER_CLIENT=3 LEVEL_PAUSE_MS=60000 MAKEORDER_GAS_LIMIT=1528479 RESULTS_LABEL=final-12s-dapplimit` | `concurrent-hardhat-privacy-final-12s-dapplimit-12000ms-2026-10-13T08-13-52-363Z` |

- **One change to the script, and why.** `benchmark-concurrent.cjs` has a new switch, `EDR_GUARD=1`, that installs outside the emulated-prover mode the guard that mode already had (section 2, runs E and F): nonce queries are answered from the `latest` block instead of the `pending` one, and a garbage collection runs every second. A pilot without it (128 clients, 2 orders each, 12 s blocks) completed its 256 orders with the same blocks as with it (46, 46, 45, 45, 46 and 28 `makeOrder`), but the process grew to 8,255 MB: with a mempool of several blocks, every `pending` nonce query makes Hardhat execute a block of the mempool and keep its traces. With the switch the same pilot peaked at 472 MB. Each sender has one transaction in flight, so the two block tags give the same nonce. The switch changes nothing unless set; the runs of sections 1 to 10 did not use it. `MIMALLOC_PURGE_DELAY=0` is set as in runs E and F.
- **Orders per client.** Five for the privacy ordering step (two blocks per order) and ten for the baseline's (one block per order), so that a level below saturation spans ten blocks; two cycles per client for the baseline cycle (14 blocks). The two levels with 512 clients of the ordering step ran in processes of their own with fewer orders per client (3 and 6) after a level with 8 clients, and run P2 paused 150 s before its 512 clients (`LEVEL_PAUSE_MS`). The reason is the base fee, not the memory (section 11.8).
- **A second switch, for run D1.** `MAKEORDER_GAS_LIMIT=<gas>` sends `makeOrder` with that gas limit instead of the script's fixed 5,000,000. It is a fixed number for the run (no estimate is asked per order); the result's metadata, its notes and the gas-bound ceiling the script prints follow it. It changes nothing unless set; no other run used it. Run D1 was not held back for a quiet host, because another task was preparing a measurement on the machine and a 12 s run is bound by the block time: the 1-minute load average was 0.20 before, 0.09 after, and between 0.09 and 0.50 in the sampler's one-second readings.
- **Receipt timeout.** 600 s instead of the default 120 s, as in run F; what waited longer than 120 s is counted in the tables.
- During the 64-client level of run C1 the sampler read a 1-minute load average of up to 1.81 (and 1.01 during the 128-client level) from something other than the benchmark process, which used 12 to 16 % of one thread; the level's rate is exactly that of the closed loop.

### 11.3 Privacy, ordering step, 12 s blocks (runs P1 and P2)

A unit is the announcement of the one-time address and `makeOrder`: two transactions, one after the other's receipt, so a client needs two blocks per order.

| Clients | Orders per client | Completed / failed | orders/s | Closed loop, clients / (2 × 12 s) | Gas per order (announcement + `makeOrder`) | Block use, mean / max | Blocks (≥ 90 % full) | Transactions per block, mean / max | Orders per block, mean / max | Gas ceiling (orders/s, computed) | Share of the ceiling |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 8 | 5 | 40 / 0 | 0.333 | 0.333 | 1,239,542 (26,242 + 1,213,300) | 8.3 % / 16.2 % | 10 (0) | 8.0 / 8 | 4.0 / 8 | 4.03 | 8.3 % |
| 32 | 5 | 160 / 0 | 1.33 | 1.33 | 1,239,546 (26,243 + 1,213,303) | 33.1 % / 64.7 % | 10 (0) | 32.0 / 32 | 16.0 / 32 | 4.03 | 33.0 % |
| 64 | 5 | 320 / 0 | 2.42 | 2.67 | 1,239,546 (26,243 + 1,213,303) | 60.1 % / 93.0 % | 11 (5) | 58.2 / 64 | 29.1 / 46 | 4.03 | 60.1 % |
| 128 | 5 | 640 / 0 | 3.33 | 5.33 | 1,239,547 (26,243 + 1,213,304) | 82.6 % / 95.0 % | 16 (14) | 80.0 / 128 | 40.0 / 46 | 4.03 | 82.6 % |
| 256 | 5 | 1280 / 0 | 3.68 | 10.67 | 1,239,539 (26,242 + 1,213,296) | 91.2 % / 95.0 % | 29 (27) | 88.3 / 256 | 44.1 / 46 | 4.03 | 91.2 % |

| Clients | Latency of one order, p50 / p95 (s) | Wait of a transaction for inclusion, p50 / p95 / max (s) | Transactions that waited more than one block (of all) | … more than 120 s | Gas price paid, first → last block (gwei) | Base fee, lowest / highest (gwei) | Clients that could not pay | Processor of the benchmark process, mean (% of one thread) | Its memory, peak (MB) |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 8 | 24.0 / 24.0 | 11.9 / 12.0 / 12.0 | 0 of 80 (0 %) | 0 | 1.2144 → 1.0776 | 0.0776 / 0.2144 | 0 | 8 | 339 |
| 32 | 24.0 / 24.1 | 11.8 / 12.0 / 12.0 | 0 of 320 (0 %) | 0 | 1.0544 → 1.0329 | 0.0329 / 0.0544 | 0 | 11 | 450 |
| 64 | 24.0 / 35.8 | 11.7 / 11.9 / 23.6 | 19 of 640 (3 %) | 0 | 1.0261 → 1.0343 | 0.0230 / 0.0343 | 0 | 13 | 469 |
| 128 | 35.9 / 47.8 | 11.9 / 23.6 / 35.3 | 504 of 1,280 (39 %) | 0 | 1.0255 → 1.0582 | 0.0227 / 0.0951 | 0 | 16 | 499 |
| 256 | 70.8 / 71.8 | 12.1 / 59.4 / 70.1 | 1,234 of 2,560 (48 %) | 0 | 1.0659 → 1.1507 | 0.0595 / 1.0385 | 0 | 18 | 649 |

With 512 clients, in a new process (run P2; 3 orders per client):

| Clients | Orders per client | Completed / failed | orders/s | Closed loop, clients / (2 × 12 s) | Gas per order (announcement + `makeOrder`) | Block use, mean / max | Blocks (≥ 90 % full) | Transactions per block, mean / max | Orders per block, mean / max | Gas ceiling (orders/s, computed) | Share of the ceiling |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 8 | 3 | 24 / 0 | 0.333 | 0.333 | 1,239,547 (26,244 + 1,213,303) | 8.3 % / 16.2 % | 6 (0) | 8.0 / 8 | 4.0 / 8 | 4.03 | 8.3 % |
| 512 | 3 | 1536 / 0 | 3.71 | 21.33 | 1,239,545 (26,243 + 1,213,302) | 90.7 % / 95.0 % | 35 (33) | 87.8 / 512 | 43.9 / 46 | 4.03 | 92.0 % |

| Clients | Latency of one order, p50 / p95 (s) | Wait of a transaction for inclusion, p50 / p95 / max (s) | Transactions that waited more than one block (of all) | … more than 120 s | Gas price paid, first → last block (gwei) | Base fee, lowest / highest (gwei) | Clients that could not pay | Processor of the benchmark process, mean (% of one thread) | Its memory, peak (MB) |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 8 | 24.0 / 24.1 | 11.9 / 12.0 / 12.0 | 0 of 48 (0 %) | 0 | 1.2144 → 1.1208 | 0.1208 / 0.2144 | 0 | 8 | 340 |
| 512 | 131.9 / 143.6 | 12.0 / 128.0 / 139.7 | 1,490 of 3,072 (48 %) | 184 | 1.0223 → 1.0509 | 0.0207 / 0.6674 | 0 | 19 | 645 |

- "Waited more than one block": the receipt was seen more than 12.5 s after the transaction was sent. All of these are `makeOrder` transactions; the announcements (26,243 gas, sent with a limit of 200,000) entered the next block in every level.
- With 8 and 32 clients the rate is exactly the closed loop's, clients / 24 s.
- With 64 clients the 64 `makeOrder` of a round arrive together and a block takes 45 or 46 of them: every second block is at the limit (5 of 11 blocks at 92 to 93 %) while the blocks between hold the announcements and the left-over orders, and the mean use is 60 %.
- From 128 clients on every block of the plateau holds 45 or 46 `makeOrder` and is 93 to 95 % full: 14 of 16 blocks with 128 clients, 27 of 29 with 256, 33 of 35 with 512. The rate of the full blocks alone is 3.83 orders/s with 256 clients and 3.83 with 512; the rate over the whole window (3.68 and 3.71) is lower because the window includes the first block, which holds only announcements, and the last, which is not full.
- The 3.71 orders/s with 512 clients is not a higher rate than the 3.68 with 256. After the 150 s pause the 512-client level started about 6 s before a block, so its window is 414.07 s for 35 blocks instead of 35 × 12 s = 420 s; this is also why its share of the ceiling (92.0 %) differs from its mean block use (90.7 %). Counted per 12 s of blocks the level carried 1,536 orders / 420 s = 3.66 orders/s, slightly below the 256-client level. The figure to quote for both is about 3.7 orders/s over a level and 3.83 in the full blocks.

#### 11.3.1 The same step with the gas limit the customer's dApp sends (run D1, added after the check)

The customer's dApp does not send `makeOrder` with 5,000,000 gas: since 2026-10-12 it sends the node's estimate × 1.25 (`customer-frontend/src/utils/txGas.js`). The local node's estimate is 1,222,783 (read again before this run, the same in five of six orders; 1,240,017 for the first order after a deployment), so the limit is 1,528,479. Run D1 repeats the 256-client level with that limit, set through the switch `MAKEORDER_GAS_LIMIT` (section 11.2). The independent check had made this run once in a scratch folder (after a 128-client level); this one, after an 8-client level, has the same count of `makeOrder` in every block.

| Clients | Orders per client | Completed / failed | orders/s | Closed loop, clients / (2 × 12 s) | Gas per order (announcement + `makeOrder`) | Block use, mean / max | Blocks (≥ 90 % full) | Transactions per block, mean / max | Orders per block, mean / max | Gas ceiling (orders/s, computed) | Share of the ceiling |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 8 | 3 | 24 / 0 | 0.333 | 0.333 | 1,239,544 (26,244 + 1,213,300) | 8.3 % / 16.2 % | 6 (0) | 8.0 / 8 | 4.0 / 8 | 4.03 | 8.3 % |
| 256 | 3 | 768 / 0 | 3.76 | 10.67 | 1,239,545 (26,242 + 1,213,303) | 93.3 % / 99.7 % | 17 (15) | 90.4 / 256 | 45.2 / 49 | 4.03 | 93.3 % |

| Clients | Latency of one order, p50 / p95 (s) | Wait of a transaction for inclusion, p50 / p95 / max (s) | Transactions that waited more than one block (of all) | … more than 120 s | Gas price paid, first → last block (gwei) | Base fee, lowest / highest (gwei) | Clients that could not pay | Processor of the benchmark process, mean (% of one thread) | Its memory, peak (MB) |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 8 | 24.0 / 24.0 | 11.9 / 12.0 / 12.0 | 0 of 48 (0 %) | 0 | 1.2144 → 1.1208 | 0.1208 / 0.2144 | 0 | 8 | 332 |
| 256 | 60.2 / 71.9 | 23.9 / 47.7 / 70.0 | 1,115 of 1,536 (73 %) | 0 | 1.0567 → 1.1296 | 0.0512 / 0.2947 | 0 | 17 | 585 |

`makeOrder` and announcements per block, 256 clients (17 blocks):

| Block of the level | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| `makeOrder` | 0 | 49 | 49 | 49 | 49 | 49 | 46 | 48 | 49 | 49 | 49 | 47 | 47 | 49 | 49 | 49 | 41 |
| Announcements | 256 | 0 | 14 | 14 | 14 | 14 | 152 | 60 | 14 | 14 | 14 | 106 | 96 | 0 | 0 | 0 | 0 |
| Block use (%) | 11.2 | 99.1 | 99.7 | 99.7 | 99.7 | 99.7 | 99.7 | 99.7 | 99.7 | 99.7 | 99.7 | 99.7 | 99.2 | 99.1 | 99.1 | 99.1 | 82.9 |

- All 768 orders completed, none failed; every `makeOrder` was sent with a limit of 1,528,479 and used 1,213,257 to 1,213,305 gas.
- 15 of the 17 blocks are 99.1 to 99.7 % full and hold 46 to 49 `makeOrder`, 48.47 on average, which is 4.04 orders/s in the full blocks: the ceiling by gas (48.4 per block, 4.03 orders/s), against 46 per block and 3.83 orders/s with the script's limit. Over the whole level, with its first block of announcements and its last block, the rate is 3.76 orders/s (window 204.06 s for 17 blocks). The 256-client level of run P1 (3.68 orders/s) had five orders per client and 29 blocks, so the two rates over a level are not a like-for-like comparison; the counts per full block are.
- The plateau count is a little above 48.4 because the first 256 announcements were mined in the block before the plateau: over a longer run a block has to carry as many announcements as orders, and the count is the 48.4 of the gas.
- **What happens to the announcements in full blocks.** A block that has taken 49 `makeOrder` has 548,153 gas left. An announcement uses 26,242 gas but is sent with a limit of 200,000 and needs that much free, so 14 announcements enter and the rest wait: seven of the fifteen full blocks hold exactly 49 `makeOrder` and 14 announcements, four hold 49 and none (the first, and the last three, when no announcement was left to send), and the other four hold 46 to 48 `makeOrder` and 60 to 152 announcements. 437 of the 768 announcements waited more than one block (241 more than two, 78 more than three; the longest 47.9 s), and 678 of the 768 `makeOrder`. With the script's limit of 5,000,000 no announcement waited more than one block in any level (section 11.3), where the 46th `makeOrder` leaves 4.19 million gas free that no further `makeOrder` can take and that is room for about 150 announcements. With the dApp's limit the order and its announcement therefore compete for the same full block, and a customer waits for both.
- Limits of this run: one run of one level; the limit is the dApp's rule applied to the script's transactions as a fixed number, the dApp itself was not run in a browser and no estimate was asked per order; the announcement's limit of 200,000 is the script's.

### 11.4 Baseline without privacy, ordering step, 12 s blocks (runs B1 and B2)

A unit is one `makeOrder` of the baseline (no announcement): one block per order.

| Clients | Orders per client | Completed / failed | orders/s | Closed loop, clients / (1 × 12 s) | Gas per order | Block use, mean / max | Blocks (≥ 90 % full) | Transactions per block, mean / max | Orders per block, mean / max | Gas ceiling (orders/s, computed) | Share of the ceiling |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 8 | 10 | 80 / 0 | 0.667 | 0.667 | 376,118 | 5.0 % / 5.0 % | 10 (0) | 8.0 / 8 | 8.0 / 8 | 13.29 | 5.0 % |
| 32 | 10 | 320 / 0 | 2.67 | 2.67 | 376,118 | 20.1 % / 20.1 % | 10 (0) | 32.0 / 32 | 32.0 / 32 | 13.29 | 20.1 % |
| 64 | 10 | 640 / 0 | 5.33 | 5.33 | 376,118 | 40.1 % / 40.1 % | 10 (0) | 64.0 / 64 | 64.0 / 64 | 13.29 | 40.1 % |
| 128 | 10 | 1280 / 0 | 10.66 | 10.67 | 376,118 | 80.2 % / 80.2 % | 10 (0) | 128.0 / 128 | 128.0 / 128 | 13.29 | 80.2 % |
| 256 | 10 | 2560 / 0 | 11.85 | 21.33 | 376,118 | 89.2 % / 92.1 % | 18 (17) | 142.2 / 147 | 142.2 / 147 | 13.29 | 89.2 % |

| Clients | Latency of one order, p50 / p95 (s) | Wait of a transaction for inclusion, p50 / p95 / max (s) | Transactions that waited more than one block (of all) | … more than 120 s | Gas price paid, first → last block (gwei) | Base fee, lowest / highest (gwei) | Clients that could not pay | Processor of the benchmark process, mean (% of one thread) | Its memory, peak (MB) |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 8 | 12.0 / 12.0 | 12.0 / 12.0 / 12.0 | 0 of 80 (0 %) | 0 | 1.1909 → 1.0652 | 0.0652 / 0.1909 | 0 | 7 | 323 |
| 32 | 12.0 / 12.0 | 11.9 / 12.0 / 12.0 | 0 of 320 (0 %) | 0 | 1.0443 → 1.0220 | 0.0220 / 0.0443 | 0 | 9 | 423 |
| 64 | 12.0 / 12.1 | 11.9 / 12.0 / 12.0 | 0 of 640 (0 %) | 0 | 1.0156 → 1.0124 | 0.0124 / 0.0156 | 0 | 10 | 416 |
| 128 | 12.0 / 12.3 | 11.8 / 12.0 / 12.3 | 0 of 1,280 (0 %) | 0 | 1.0093 → 1.0179 | 0.0093 / 0.0179 | 0 | 13 | 492 |
| 256 | 23.9 / 23.9 | 23.6 / 23.8 / 24.4 | 1,805 of 2,560 (70 %) | 0 | 1.0147 → 1.0337 | 0.0147 / 0.0810 | 0 | 15 | 657 |

With 512 clients, in a new process (run B2; 6 orders per client):

| Clients | Orders per client | Completed / failed | orders/s | Closed loop, clients / (1 × 12 s) | Gas per order | Block use, mean / max | Blocks (≥ 90 % full) | Transactions per block, mean / max | Orders per block, mean / max | Gas ceiling (orders/s, computed) | Share of the ceiling |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 8 | 6 | 48 / 0 | 0.667 | 0.667 | 376,118 | 5.0 % / 5.0 % | 6 (0) | 8.0 / 8 | 8.0 / 8 | 13.29 | 5.0 % |
| 512 | 6 | 3072 / 0 | 12.19 | 42.67 | 376,118 | 91.7 % / 92.1 % | 21 (20) | 146.3 / 147 | 146.3 / 147 | 13.29 | 91.7 % |

| Clients | Latency of one order, p50 / p95 (s) | Wait of a transaction for inclusion, p50 / p95 / max (s) | Transactions that waited more than one block (of all) | … more than 120 s | Gas price paid, first → last block (gwei) | Base fee, lowest / highest (gwei) | Clients that could not pay | Processor of the benchmark process, mean (% of one thread) | Its memory, peak (MB) |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 8 | 12.0 / 12.0 | 12.0 / 12.0 / 12.0 | 0 of 48 (0 %) | 0 | 1.1909 → 1.1051 | 0.1051 / 0.1909 | 0 | 7 | 327 |
| 512 | 36.3 / 47.8 | 36.0 / 47.7 / 47.8 | 2,925 of 3,072 (95 %) | 0 | 1.0714 → 1.1633 | 0.0714 / 0.5299 | 0 | 17 | 619 |

- Up to 128 clients the rate is the closed loop's, clients / 12 s, and every block holds one `makeOrder` per client (80.2 % of the block with 128).
- With 256 and 512 clients a block holds 147 `makeOrder` and is 92.1 % full: 17 of 18 and 20 of 21 blocks; the block that is not full is the last one. The rate of the full blocks is 12.25 orders/s.

### 11.5 Baseline without privacy, full cycle, 12 s blocks (run C1; 2 cycles per client, 7 transactions per cycle)

| Clients | Cycles per client | Completed / failed | cycles/s | Closed loop, clients / (7 × 12 s) | Gas per cycle | Block use, mean / max | Blocks (≥ 90 % full) | Transactions per block, mean / max | `makeOrder` per block, max | Gas ceiling (cycles/s, computed) | Share of the ceiling |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 8 | 2 | 16 / 0 | 0.095 | 0.095 | 900,577 | 1.7 % / 5.0 % | 14 (0) | 8.0 / 8 | 8 | 5.55 | 1.7 % |
| 32 | 2 | 64 / 0 | 0.381 | 0.381 | 899,509 | 6.9 % / 20.1 % | 14 (0) | 32.0 / 32 | 32 | 5.56 | 6.9 % |
| 64 | 2 | 128 / 0 | 0.762 | 0.762 | 897,367 | 13.7 % / 40.1 % | 14 (0) | 64.0 / 64 | 64 | 5.57 | 13.7 % |
| 128 | 2 | 256 / 0 | 1.52 | 1.52 | 897,377 | 27.3 % / 80.2 % | 14 (0) | 128.0 / 128 | 128 | 5.57 | 27.3 % |
| 256 | 2 | 512 / 0 | 2.84 | 3.05 | 897,379 | 51.1 % / 99.5 % | 15 (4) | 238.9 / 256 | 147 | 5.57 | 51.0 % |
| 512 | 2 | 1024 / 0 | 4.49 | 6.09 | 897,379 | 80.6 % / 99.5 % | 19 (8) | 377.3 / 512 | 147 | 5.57 | 80.6 % |

| Clients | Latency of one cycle, p50 / p95 (s) | Wait of a transaction for inclusion, p50 / p95 / max (s) | Transactions that waited more than one block (of all) | … more than 120 s | Gas price paid, first → last block (gwei) | Base fee, lowest / highest (gwei) | Clients that could not pay | Processor of the benchmark process, mean (% of one thread) | Its memory, peak (MB) |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 8 | 84.0 / 84.0 | 12.0 / 12.0 / 12.0 | 0 of 112 (0 %) | 0 | 1.0859 → 1.0162 | 0.0162 / 0.0859 | 0 | 9 | 370 |
| 32 | 84.0 / 84.1 | 11.9 / 12.0 / 12.0 | 0 of 448 (0 %) | 0 | 1.0109 → 1.0025 | 0.0025 / 0.0109 | 0 | 10 | 508 |
| 64 | 84.0 / 84.2 | 11.9 / 12.0 / 12.0 | 0 of 896 (0 %) | 0 | 1.0017 → 1.0005 | 0.0005 / 0.0017 | 0 | 12 | 561 |
| 128 | 84.0 / 84.4 | 11.8 / 12.0 / 12.2 | 0 of 1,792 (0 %) | 0 | 1.0003 → 1.0002 | 0.0002 / 0.0004 | 0 | 16 | 655 |
| 256 | 84.4 / 96.3 | 11.6 / 12.2 / 23.4 | 144 of 3,584 (4 %) | 0 | 1.0001 → 1.0001 | 0.0001 / 0.0001 | 0 | 21 | 880 |
| 512 | 107.7 / 120.6 | 11.4 / 34.6 / 46.5 | 1,566 of 7,168 (22 %) | 0 | 1.0001 → 1.0002 | 0.0001 / 0.0004 | 0 | 30 | 1,135 |

| Call | n | Mean gas | Range | Gas limit sent |
|---|---:|---:|---:|---:|
| makeOrder | 2,000 | 376,117 | 376,106–376,118 | 5,000,000 |
| prepareOrder | 2,000 | 109,990 | 109,967–109,991 | 400,000 |
| confirmIntention | 2,000 | 106,608 | 106,587–106,611 | 4,000,000 |
| pickupOrder | 2,000 | 68,439 | 68,398–68,451 | 400,000 |
| deliveryOrder | 2,000 | 98,934 | 98,894–98,947 | 4,000,000 |
| rateOrder_client | 2,000 | 79,419 | 75,028–92,152 | 4,000,000 |
| rateOrder_restaurant | 2,000 | 57,964 | 57,942–57,966 | 400,000 |

- Up to 128 clients every cycle takes exactly seven blocks (84 s) and the rate is clients / 84 s.
- With 256 clients the `makeOrder` step no longer fits in one block (147, then 109) and 4 of 15 blocks are at least 90 % full; the other steps use 29 to 46 % of a block. The rate is 93 % of the closed loop's.
- With 512 clients the `makeOrder` step takes four blocks (147, 147, 147, 71) and 8 of 19 blocks are at least 90 % full, 7 of them at 99 % or more; the blocks in which all 512 clients send one of the lighter calls are 67 to 89 % full. The rate, 4.49 cycles/s, is 81 % of the ceiling by gas and 74 % of the closed loop's (512 / 84 s = 6.09 cycles/s, more than the ceiling). The blocks are not all full because each client runs two cycles: the window has a first and a last cycle, and the lighter steps of 512 clients do not fill a block.
- More clients were not run. The level with 512 clients is where the blocks begin to fill; it is not a plateau of full blocks like those of the ordering step.

### 11.6 Privacy, full cycle, 12 s blocks: the earlier rows (runs F and F2, section 3.6, unchanged)

| Clients | Completed / failed | cycles/s | Gas per cycle | Block use, mean / max | Blocks (≥ 90 % full) | Latency of one cycle, p50 / p95 (s) | Transactions that waited more than 120 s | Gas ceiling (cycles/s) | Share of the ceiling |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 8 | 8 / 0 | 0.061 | 4,825,723 | 5.8 % / 16.2 % | 11 (0) | 132.0 / 132.0 | 0 | 1.04 | 5.8 % |
| 32 | 32 / 0 | 0.242 | 4,830,947 | 23.4 % / 64.7 % | 11 (0) | 131.9 / 132.0 | 0 | 1.03 | 23.4 % |
| 64 | 64 / 0 | 0.444 | 4,835,379 | 43.0 % / 98.9 % | 12 (3) | 132.0 / 143.9 | 0 | 1.03 | 43.0 % |
| 128 | 128 / 0 | 0.667 | 4,839,069 | 64.5 % / 99.2 % | 16 (8) | 168.2 / 191.9 | 0 | 1.03 | 64.5 % |
| 256 | 256 / 0 | 0.762 | 4,842,685 | 73.8 % / 99.2 % | 28 (19) | 263.0 / 312.1 | 41 | 1.03 | 73.8 % |
| 512 | 301 / 211 | 0.597 | 4,835,951 | 75.4 % / 99.2 % | 42 (30) | 466.7 / 477.7 | 615 | 1.03 | 57.8 % |

One prover per participant, emulated (756 ms per proof); 11 transactions and one cycle per client. The 211 failures with 512 clients are those of section 5 (the one-time address could not pay for the withdrawal after the gas price rose).

### 11.7 The ceilings (computed, not measured)

Two computations, both with the gas measured in these runs, a block of 60,000,000 gas and a block every 12 s.

**By gas alone**: block gas limit / gas per unit / 12 s.

| Unit | Gas per unit (measured) | Units per block | Units per second |
|---|---:|---:|---:|
| Order with privacy (announcement 26,243 + `makeOrder` 1,213,300) | 1,239,543 | 48.40 | 4.03 |
| Order of the baseline (`makeOrder`) | 376,118 | 159.52 | 13.29 |
| Full cycle with privacy (run F, 256 clients) | 4,842,685 | 12.39 | 1.03 |
| Full cycle of the baseline (run C1, 512 clients) | 897,379 | 66.86 | 5.57 |

**By the gas limit of the transaction.** A transaction enters a block only while the gas still free in the block covers the transaction's gas *limit*, whatever it then uses. This is a rule of the protocol, not of the test node: the executable specification of the execution layer rejects a block in which a transaction's gas limit exceeds the block gas limit minus the gas used by the transactions before it (`check_transaction` in `src/ethereum/forks/osaka/fork.py` of `ethereum/execution-specs`, branch `mainnet`, read 2026-10-13 at commit `7b8124a`: `gas_available = block_env.block_gas_limit - block_output.block_gas_used`, then `if tx.gas > gas_available: raise GasUsedExceedsLimitError`; the same two lines are in the London and Prague files of that branch, whose latest forks are Osaka and its two blob-parameter forks), and a block producer skips such a transaction for the same reason (go-ethereum, `miner/worker.go`, read the same day at commit `32fea34`: "If we don't have enough space for the next transaction, skip the account"; `core/error.go`: `ErrGasLimitReached` "is returned by the gas pool if the amount of gas required by a transaction is higher than what's left in the block"). The two sources were read, not run: no other client was run here. What is particular to these runs is the limit the script sends, not the rule. The number of orders a block holds therefore depends on the limit that `makeOrder` is sent with:

| Unit | Gas limit of `makeOrder` | Where the limit comes from | Orders per block | Orders per second |
|---|---:|---|---:|---:|
| Order with privacy | 5,000,000 | this script on the local network and under the main network's schedule (`GAS_LIMITS_MAIN` in `run-record.cjs`) | 45 to 46 | 3.75 to 3.83 |
| Order with privacy | 1,528,479 | the customer dApp since 2026-10-12 (`customer-frontend/src/utils/txGas.js`): the node's estimate × 1.25; the local node's estimate is 1,222,783 | 48 computed; measured in run D1: 46 to 49, 48.5 on average | 4.00 computed; 4.04 measured in the full blocks |
| Order of the baseline | 5,000,000 | this script | 147 | 12.25 |
| Order of the baseline | 481,167 | the same rule applied to the baseline (it has no dApp); estimate 384,933 | 159 | 13.25 |

- With the script's limit a block takes 46 `makeOrder` when they are placed before the block's announcements and 45 when the announcements come first (45 × 1,213,300 = 54.6 million gas used, 5.4 million free, so a 46th still enters; after it 4.19 million are free and a 47th does not).
- With the dApp's limit the number is that of the gas itself, 48 orders with their announcements (59.5 million gas); a 49th `makeOrder` enters only in a block that then has no room for its share of announcements. Run D1 (section 11.3.1) measured this: most full blocks hold 49 `makeOrder` and only 14 announcements, and the announcements queue.
- The two estimates were read from the local node by a separate short script (6 orders each; the first order after a deployment is estimated at 1,240,017 and 402,434), and read again with the same values before run D1. What the dApp sends was read in its code and not run in a browser. The baseline's row with 481,167 remains computed.
- For a full cycle the limits differ by call (table in 11.5; section 8 for the privacy cycle) and no single number follows; the full blocks measured were 92 to 99.5 % full.

**Measured against both.**

| Configuration | Measured in the full blocks | Rule of the script's limit | By gas alone | Measured rate over the whole level, best | Share of the ceiling by gas |
|---|---:|---:|---:|---:|---:|
| Privacy, ordering step | 45 or 46 orders per block with 128 clients, 46 in every full block with 256 and with 512; 93 to 95 % of the block | 45 to 46 | 48.4 | 3.71 orders/s | 92 % |
| Baseline, ordering step | 147 orders per block, 92.1 % of the block | 147 | 159.5 | 12.19 orders/s | 92 % |
| Baseline, full cycle | 8 of 19 blocks at 92 to 99.5 % | — | 66.9 cycles per block | 4.49 cycles/s | 81 % |
| Privacy, full cycle (run F) | 19 of 28 blocks at 93 to 99 % | — | 12.4 cycles per block | 0.762 cycles/s | 74 % |

The saturation of the ordering step is exactly the one the script's gas limit predicts (46 and 147 per block), which is 95 % and 92 % of what the gas alone would allow. With the dApp's limit the blocks hold 46 to 49 orders with privacy, 48.5 on average (measured in run D1, section 11.3.1; 48 was the computed figure).

### 11.8 What limits each configuration, and how this is known

- **Below saturation: the closed loop.** A client sends its next transaction after the receipt of the previous one, one per block. The measured rate equals clients / (transactions per unit × 12 s) to three digits: privacy orders with 8 and 32 clients (0.333 and 1.33 orders/s), baseline orders with 8 to 128 clients (0.667 to 10.66), baseline cycles with 8 to 128 clients (0.095 to 1.52 cycles/s). No transaction waited more than one block in these levels.
- **At saturation of the ordering step: the block gas limit.** Privacy orders from 128 clients on and baseline orders from 256 on: every block but the first or last holds the number of `makeOrder` that the limit rule allows (45 or 46; 147) and is 92 to 95 % full; adding clients adds waiting, not orders (1,234 of the 1,280 `makeOrder` waited more than one block with 256 privacy clients and an order took 71 s against 24 s; with 512 baseline clients 2,925 of 3,072 waited and an order took 36 s against 12 s). For this step the statement holds without a second cause: the process was mostly idle and nobody was priced out.
- **The two full cycles: the block gas limit only in part.** Neither cycle was taken to a plateau of full blocks, and neither reached its ceiling.
  - Baseline cycles with 512 clients: the eight full blocks are blocks of the `makeOrder` step (four for each of the two cycles), and the rate, 4.49 cycles/s, is 81 % of the ceiling. This is the level where blocks begin to fill. The rate is also held down by the two cycles per client (the window has a first and a last cycle) and by the lighter steps, which do not fill a block even with 512 clients (67 to 89 %).
  - Privacy cycles (run F, section 3.6): with 256 clients 19 of 28 blocks are at least 90 % full and the rate, 0.762 cycles/s, is 74 % of the ceiling; 41 transactions waited more than 120 s. With 512 clients the rate fell to 0.597 cycles/s and 211 cycles failed because the one-time address could not pay for the withdrawal after the gas price rose (section 5). For this cycle the price is therefore a second limit, reached before the ceiling by gas.
- **Not the process, not the memory.** The benchmark process used 7 to 30 % of one processor thread on average over a level (it is busy for a second or two after each block and waits for the next), blocks came every 12.0 s in every level, and a transaction was prepared and handed to the node in at most 1.7 s. Memory stayed below 1,135 MB with the guard of section 11.2; 512 clients were no problem for it.
- **The gas price: it rose, and nobody was priced out in these runs.** Full blocks raise the base fee by about 11 % per block (the protocol's rule: 12.5 % for a block twice the target). In the level with 256 privacy clients it went from 0.059 to 1.04 gwei in 29 blocks (× 17.5), with 512 privacy clients from 0.021 to 0.67 gwei in 35 blocks (× 32.2), with 512 baseline clients from 0.071 to 0.53 gwei in 21 blocks (× 7.4). The customers' wallets hold 10 ETH and all could pay; the price they paid rose only from 1.07 to 1.15 gwei (256 privacy clients) because the local base fee is small against the 1 gwei tip.
  - The script fixes the fee cap of these transactions once per level, at twice the base fee plus the tip (ethers' default); from the eleventh block of the 256-client level the customers paid exactly that cap, 1.1507 gwei, and the base fee ended at 1.04 gwei, 90 % of it. A base fee above the cap would have kept the transactions out of the blocks until it fell; section 5 gives this as the explanation of the 615 slow transactions of run F2.
  - This is why the levels with 512 clients ran in their own processes with fewer orders per client and, for P2, after a pause in which the base fee fell: with the base fee left by the 256-client level and 2,560 more orders, the base fee would have passed the cap (computed from the growth above; not run).
  - The ordering step has no one-time address that lives on fixed gas money, so the failure of run F2 (211 withdrawals that the one-time address could not pay) cannot occur in it.
  - **The plateau of full blocks lasted only because the local base fee is negligible.** The saturated privacy levels held 27 and 33 full blocks in a row while the base fee rose 17 and 32 times (the baseline's, 20 full blocks and 7 times). That was possible because the fee cap is twice the base fee plus a tip of 1 gwei, and the local base fee starts at 0.02 to 0.07 gwei, far below the tip. On a network where the base fee is most of the price, the same cap (about twice the starting base fee) would be passed after about six or seven full blocks (computed: 11 to 12.5 % per block, doubling in 5.9 to 6.6 blocks; not run), and the transactions would wait until the base fee fell. The plateau rates are therefore rates for demand that pays whatever the base fee becomes.
  - The gas prices paid and the growth of the base fee in these runs are not results to quote: they depend on the state the local node is in when a level starts. The independent check re-ran the 128-client level and got the same blocks one by one at 1.209 → 1.478 gwei, against 1.0255 → 1.0582 gwei in run P1.

### 11.9 The 12 s configurations in the layout of the paper's table

| Network | Configuration | Proofs | Clients | Rate | Block use, mean | Gas ceiling (computed) |
|---|---|---|---:|---:|---:|---:|
| Hardhat (12 s) | Privacy, ordering step | none in this step | 128 / 256 / 512 | 3.33 / 3.68 / 3.71 orders/s | 83 % / 91 % / 91 % | 4.03 orders/s |
| Hardhat (12 s) | Privacy, ordering step, `makeOrder` with the dApp's gas limit (run D1) | none in this step | 256 | 3.76 orders/s (4.04 in the full blocks) | 93 % | 4.03 orders/s |
| Hardhat (12 s) | Privacy, full cycle (run F, section 3.6) | per device (emulated) | 128 / 256 | 0.667 / 0.762 cycles/s | 65 % / 74 % | 1.03 cycles/s |
| Hardhat (12 s) | Baseline, ordering step | none | 128 / 256 / 512 | 10.66 / 11.85 / 12.19 orders/s | 80 % / 89 % / 92 % | 13.29 orders/s |
| Hardhat (12 s) | Baseline, full cycle | none | 128 / 256 / 512 | 1.52 / 2.84 / 4.49 cycles/s | 27 % / 51 % / 81 % | 5.57 cycles/s |

The row of the privacy cycle is the one already in section 6. Block use is the mean over all blocks of the level, including its first and last; in the ordering step the blocks of the plateau are 93 to 95 % (privacy) and 92.1 % (baseline) full, and 99.1 to 99.7 % with the dApp's gas limit (run D1). The 3.71 orders/s with 512 privacy clients is 3.66 per 12 s of blocks (section 11.3) and is not a higher rate than the 3.68 with 256. The rates of the two full cycles are below their ceilings and are not plateaus.

### 11.10 In plain words

All figures of this paragraph are for a chain with the block time of production networks (12 s) and a block of 60 million gas that this application has to itself. For the ordering step the limit was reached and measured: about 3.7 orders per second over a level with the privacy mechanisms (46 orders in a full block, 3.83 per second) and about 12 without them (11.85 to 12.19 over a level; 147 in a full block, 12.25 per second). The ceilings that the gas alone allows are 4.03 and 13.29 orders per second (computed); with the gas limit that the customer's dApp sends, a full block held 48.5 orders with the privacy mechanisms on average, 4.04 per second, which is that ceiling (measured once, run D1). For the full cycle, from the order to the two ratings, no run reached the ceiling: the measured rates are 0.76 cycles per second with the privacy mechanisms (256 clients that each ran one cycle; computed ceiling 1.03) and 4.5 without them (512 clients; computed ceiling 5.57), and with 512 clients the privacy cycle fell to 0.60 cycles per second with 211 failed cycles. The privacy mechanisms divide the capacity by about 3.3 for orders and by about 5.4 for full cycles; both are ratios of the gas per unit, and only the 3.3 is also seen in measured rates (12.19 / 3.71 = 3.3 over a level; 147 / 46 = 3.2 per full block).

For the ordering step, what stops the rate is the block gas limit and nothing else: the machine was idle most of the time, no transaction failed, and nobody was unable to pay. The measured rates of this step stay 8 to 11 % under the ceilings for two reasons that are not properties of the contracts: a transaction enters a block only if its whole gas limit still fits in the gas left, a rule of the protocol (section 11.7), and the script sends `makeOrder` with a limit of 5 million gas, which costs 2 of 48 orders per block with the privacy mechanisms and 12 of 159 without (with the dApp's limit the blocks were 99 % full, but the announcements then queue behind the orders, section 11.3.1); and the clients of a level start and finish together, so its first and last blocks are not full. For the two full cycles the block gas limit is only part of the explanation: some blocks were full (8 of 19 for the baseline with 512 clients, all of them blocks of the `makeOrder` step; 19 of 28 for the privacy cycle with 256) and the rate was 81 % (baseline) and 74 % (privacy) of the ceiling, the baseline had not reached a plateau of full blocks, and the privacy cycle met the gas price before the ceiling (41 transactions waited more than 120 s with 256 clients, and the 512-client level failed on gas money).

Two reservations apply to every rate above. They are rates with full blocks, and a chain whose blocks stay full raises its base fee by about 11 % per block, as these runs show. The plateaus of up to 33 full blocks lasted only because the local base fee is negligible against the 1 gwei tip; where the base fee is most of the price, a fee cap of twice the base fee is passed after about six or seven full blocks (computed), so the plateau rates are rates for demand that pays whatever the base fee becomes, and the gas prices paid in these runs are not results. The rate that the protocol's fee rule aims at in the long run is half a block, that is about 2.0 orders or 0.5 cycles per second with the privacy mechanisms and 6.6 orders or 2.8 cycles per second without (computed, not measured). And every rate assumes that the whole block belongs to the platform: on a network shared with other traffic only a part of the block is available to it, and these runs do not say how large a part.

### 11.11 Limits of this section

- Each level was run once. Below saturation and on the plateau the figures are fixed by the block time and the gas (the same counts per block in every block), so a repeat would give the same blocks; the levels in between (64 privacy clients, 256 and 512 baseline cycles) depend on how the clients' steps fall together.
- The ceilings are computed upper bounds; the two full-cycle ceilings (1.03 and 5.57 cycles/s) were not reached by any run. The dApp's limit for the privacy order was exercised once (run D1, one level, a fixed number through the script's switch; the dApp itself was not run); the baseline's row with the estimate × 1.25 is computed. The half-block rates of 11.10 are a computation from the protocol's fee rule.
- The local base fee starts far below the 1 gwei tip, so a price rise that would matter on a network barely moved the price paid here, and the long plateaus of full blocks exist only for that reason (section 11.8). The gas prices paid depend on the state the node starts a level from and are not results. The effect of a rising base fee on demand was not measured; that the fee cap would be passed after six or seven full blocks where the base fee dominates is computed, not run.
- The baseline cycle was not taken to a plateau of full blocks (512 clients, two cycles each, was the largest level).
- The clients start together and repeat in step, so transactions arrive in bursts of one per client; arrivals spread over time were not measured.
- Every rate assumes that the whole block of 60,000,000 gas belongs to the platform: the runs are on a local node with no other traffic. That the main network's block gas limit is 60,000,000 is the configuration of the test node, taken from the earlier sections.
- The rule that a transaction needs its whole gas limit free in the block is a rule of the protocol (the specification and one client's source are cited in section 11.7). It was read, not tested: no execution client other than Hardhat's was run here.
- The processor figures per level were placed on the one-second samples by counting back from the end of each run and are approximate by a second or two.

### 11.12 Files of this section

- Raw files of the five runs: the stems of section 11.2, each with `.txt`, `.csv`, `-summary.json`, `-raw.json`.
- The two pilots (128 clients, 2 orders each, without and with the switch): `concurrent-hardhat-privacy-pilot-12000ms-2026-10-13T06-24-30-263Z` and `concurrent-hardhat-privacy-pilot-12000ms-2026-10-13T06-27-30-750Z`, `.txt` and `-summary.json`.
- `throughput-final-2026-10-13-12s-process-samples.jsonl.gz`: the one-second samples of the benchmark process for the pilots and the five runs.
- `throughput-final-2026-10-13.json`, key `twelveSecondBlocks`: every row above with the per-block series (orders, transactions, block use and gas price of every block), the ceilings, the node's estimates, the load averages. The other keys of the file are as first written.
- The copies of the report, the JSON and the script as they were before this section are kept locally and are not published.
- Run D1 (added after the check): `concurrent-hardhat-privacy-final-12s-dapplimit-12000ms-2026-10-13T08-13-52-363Z` with `.txt`, `.csv`, `-summary.json`, `-raw.json`; `throughput-final-2026-10-13-12s-dapplimit-process-samples.jsonl.gz` (the wrapper's load averages and the one-second samples of the process); JSON keys `twelveSecondBlocks.dappGasLimitRun` and `twelveSecondBlocks.correctionsAfterCheck`. The copies of the report, the JSON, the script and the README as they were before the corrections are kept locally and are not published.
