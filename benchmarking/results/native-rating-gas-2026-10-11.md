# Native rating schemes: measured gas of two prototypes

Generated 2026-10-11T12:06:10.443Z by `scripts/build-report.js` from the raw files in this directory. Prototypes for cost measurement only: no access control, not reviewed for security. Machine-readable copy: `native-rating-gas.json`.

## 1. What to read first

1. **Sepolia changed fork five days before this measurement.** Since 2026-10-06 13:53:36 UTC Sepolia runs Glamsterdam, not Osaka. Confirmed on Sepolia: precompile prices are unchanged from Osaka, the transaction base is 15,000 instead of 21,000, and the calldata floor is 64 gas per byte. From EIP-8037 and EIP-8038, not checked on-chain: a new storage slot costs 110,020 gas instead of 22,100 and a changed slot 12,100 instead of 5,000. The Hardhat in the repository (2.28.6) cannot execute that fork.
2. **Measured numbers are Osaka numbers** (Hardhat's default hardfork), with Prague next to them as the pre-Fusaka reference. They are comparable with the baseline figures of the task as long as those were measured before the fork, which their size suggests (section 9). Per EIP-7773 mainnet has no Glamsterdam date yet.
3. **Glamsterdam columns are estimates**, obtained by re-pricing the measured Osaka traces. The precompile, base and calldata prices behind them were confirmed on Sepolia; the storage prices were not (they come from the EIPs and the reference spec).

### Per rating

| scheme | Osaka, later rating | Osaka, first rating of a worker | Glamsterdam estimate, later | Glamsterdam estimate, first |
|---|---:|---:|---:|---:|
| current: submitRating with Groth16 proof (given) | 291,251 / 284,408 |  | not re-priced, see 7.3 |  |
| RSA blind signature, option (c) | 106,327 | 140,527 | 203,247 | 399,087 |
| LSAG ring signature, ring of 2 (one slot per ticket) | 121,889 | 156,065 | 218,309 | 414,125 |
| LSAG ring signature, ring of 4 (one slot per ticket) | 180,521 | 214,709 | 276,941 | 472,769 |
| LSAG ring signature, ring of 8 (one slot per ticket) | 297,786 | 332,010 | 394,206 | 590,070 |
| LSAG ring signature, ring of 16 (one slot per ticket) | 532,341 | 566,529 | 628,761 | 824,589 |
| LSAG ring signature, ring of 32 (one slot per ticket) | 1,001,333 | 1,035,545 | 1,097,753 | 1,293,605 |
| blind BLS (optional part) | 193,620 | 222,828 | 290,040 | 480,888 |

### Per delivery (two tokens or tickets)

| scheme | Osaka: gas seen by the calling contract | Osaka: execution only | Osaka: as direct transaction(s) | Glamsterdam estimate: direct transaction(s) |
|---|---:|---:|---:|---:|
| current: 2 x addRatingTicket (given, inside the contract) | 1,243,194 |  |  | not re-priced, see 7.3 |
| RSA option (c): issue2, one call checking two blind signatures | 80,692 | 77,992 | 115,784 | 117,484 |
| LSAG, one slot per ticket: 2 x registerTicket | 52,728 | 49,828 | 94,740 | 258,780 |
| LSAG, both coordinates: 2 x registerTicket | 99,202 | 101,102 | 146,014 | 500,094 |

"Seen by the calling contract" is read from the trace of `OrderHarness`: the CALL (with everything the callee spends) plus the cold account access. For LSAG it covers both registerTicket calls in one transaction, where the second call finds the contract and, with both coordinates, the array-length slot already warm; that is why it can be lower than twice the stand-alone execution. For RSA the calling transaction must also carry the four 256-byte values in its calldata: 16,792 gas for the whole issue2 calldata, included in the direct-transaction figure and not in the other two.

## 2. How the numbers were obtained

- Mini Hardhat project in this directory; `node_modules` is a symlink to the main repository. Hardhat 2.28.6, EDR 0.12.0-next.23, solc 0.8.20 (optimizer on, runs 200, EVM target paris, which is what Hardhat picks for this solc when none is configured, as in the main repository), ethers 6.16.0, Node v20.20.2.
- In-process Hardhat network only. Every figure is `gasUsed` of the receipt of a mined transaction.
- Breakdown from `debug_traceTransaction`: the cost of a step is the gas before it minus the gas before the next step of the same frame. For every transaction the script checks that 21,000 + calldata + traced execution equals `gasUsed` (or that the EIP-7623 floor applies) and stops otherwise.
- Columns: **base** 21,000; **calldata** 4 gas per zero byte and 16 per non-zero byte; **precompile** the price of the precompiles themselves; **storage** SLOAD + SSTORE; **rest** everything else (100 gas per precompile call, account access, CREATE, logs, keccak, opcodes, memory).
- All randomness comes from a seeded generator and the two RSA test keys are stored in `fixtures/`, so a rerun reproduces the same transactions. Calldata gas still depends on the bytes: 12 gas per byte that happens to be zero. In repeated ratings the execution gas was identical and only calldata moved (spread shown where measured).
- **first / later.** A first write to a zero slot costs 22,100 under Osaka and a later change 5,000. "First" rows are the first issue or the first rating of a worker (counters go from zero); "later" rows have non-zero counters. Every rating writes one new slot in all schemes (spent token or key image).

## 3. Hardforks and precompile pricing

### 3.1 Hardfork of the local network

| run | hardfork in effect | CLZ opcode (new in Osaka) |
|---|---:|---:|
| hardfork not set | osaka | works |
| hardfork: "osaka" | osaka | works |
| hardfork: "prague" | prague | invalid opcode |

Hardhat 2.28.6 already defaults to **osaka**. The run without a hardfork setting and the run with `hardfork: "osaka"` give identical results (4,033 recorded values compared, 0 differ). Prague was run as the pre-Fusaka reference.

### 3.2 Modexp price for RSA-2048, e = 65537

Base and modulus 256 bytes, exponent 65537 (17 bits).

- **EIP-2565** (Berlin to Prague): `max(200, floor(words^2 * iteration_count / 3)), words = ceil(max(base_len, mod_len) / 8), iteration_count = bit_length(e) - 1 for an exponent of at most 32 bytes`. words = ceil(256/8) = 32; 32^2 = 1024; iteration_count = 17 - 1 = 16; floor(1024 * 16 / 3) = 5461 gas.
- **EIP-7883** (Osaka): `max(500, multiplication_complexity * iteration_count), multiplication_complexity = 2 * words^2 when max(base_len, mod_len) > 32 bytes (16 otherwise); no division by 3`. words = 32; 2 * 32^2 = 2048; iteration_count = 16; 2048 * 16 = 32768 gas.
- Ratio 6.0. The mod-N reduction of the FDH (exponent 1, one iteration) costs 341 / 2,048 gas, a square root in the alt_bn128 field (32-byte operands, 252-bit exponent) 1,338 / 4,016.

Price charged by the local EVM, from transactions sent straight to the precompile (price = gasUsed - 21,000 - calldata when the calldata floor does not bind):

| probe | expected before Osaka | expected from Osaka | measured, prague | measured, osaka |
|---|---:|---:|---:|---:|
| modexp_rsa2048_e65537 | 5,461 | 32,768 | hidden by floor | 32,768 |
| modexp_rsa2048_e65537_explen32 | 5,461 | 32,768 | hidden by floor | 32,768 |
| modexp_rsa2048_e65537_sparse | 5,461 | 32,768 | 5,461 | 32,768 |
| modexp_2048_one_iteration | 341 | 2,048 | hidden by floor | 2,048 |
| modexp_fp_sqrt | 1,338 | 4,016 | hidden by floor | 4,016 |
| ecadd | 150 | 150 | 150 | 150 |
| ecadd_G_plus_G | 150 | 150 | hidden by floor | hidden by floor |
| ecmul | 6,000 | 6,000 | 6,000 | 6,000 |
| ecrecover | 3,000 | 3,000 | 3,000 | 3,000 |
| ecrecover_empty | 3,000 | 3,000 | 3,000 | 3,000 |
| ecpairing_2 | 113,000 | 113,000 | 113,000 | 113,000 |

Inside the contracts the same prices appear in the traces (`modexp @ 32768`, `@ 2048`, `@ 4016` under Osaka; `@ 5461`, `@ 341`, `@ 1338` under Prague).

### 3.3 Cross-check on Sepolia (read-only)

Endpoint `https://ethereum-sepolia-rpc.publicnode.com`, chain id 11155111, block 11,891,498 (2026-10-11T11:44:24.000Z). No key, no transaction. Requests: 51 in total over two runs (eth_chainId, eth_getBlockByNumber, eth_config, eth_estimateGas, eth_call), all aimed at precompile addresses.

The first run compared `eth_estimateGas` with Osaka totals and nothing matched (for example 57,211 for the RSA modexp call where Osaka needs 62,404, and 15,150 for an empty ECADD call, below the 21,000 base). `eth_config` reports a fork active since 2026-10-06T13:53:36.000Z (activation time 1791294816, fork id 0x6c1d9423), which is the Glamsterdam activation EIP-7773 lists for Sepolia; the latest header carries `blockAccessListHash` and `slotNumber`.

`eth_estimateGas` on this endpoint returns up to 1.5% more than the true requirement, so the second run pinned each value with `eth_call`: the call succeeds with exactly the predicted gas and fails with one unit less.

| probe | calldata | eth_estimateGas | needs exactly | exact: ok / one less: fails | read as |
|---|---:|---:|---:|---:|---:|
| modexp_rsa2048_e65537 | 611 B | 57,211 | 56,404 | yes / yes | 15,000 + 8,636 + 32,768 |
| modexp_rsa2048_e65537_explen32 | 640 B | 57,327 | 56,520 | yes / yes | 15,000 + 8,752 + 32,768 |
| modexp_rsa2048_e65537_sparse | 611 B | 54,902 | 54,104 | yes / yes | 15,000 + 64 x 611 (floor) |
| modexp_2048_one_iteration | 96 B | 21,310 | 21,144 | yes / yes | 15,000 + 64 x 96 (floor) |
| modexp_fp_sqrt | 192 B | 27,633 | 27,288 | yes / yes | 15,000 + 64 x 192 (floor) |
| ecadd | 0 B | 15,150 | 15,150 | yes / yes | 15,000 + 0 + 150 |
| ecadd_G_plus_G | 128 B | 23,529 | 23,192 | yes / yes | 15,000 + 64 x 128 (floor) |
| ecmul | 96 B | 21,958 | 21,792 | yes / yes | 15,000 + 792 + 6,000 |
| ecrecover | 128 B | 23,529 | 23,192 | yes / yes | 15,000 + 64 x 128 (floor) |
| ecrecover_empty | 0 B | 18,000 | 18,000 | yes / yes | 15,000 + 0 + 3,000 |
| ecpairing_2 | 384 B | 134,091 | 132,980 | yes / yes | 15,000 + 4,980 + 113,000 |

Confirmed live: modexp for RSA-2048 with e = 65537 costs **32,768** (EIP-7883); ECADD 150, ECMUL 6,000, ecrecover 3,000, pairing with two pairs 113,000; the base of a zero-value call is 15,000; the calldata floor is 64 gas per byte. Storage and state-creation prices (STORAGE_WRITE 10,000, 97,920 state gas per new slot, 1,530 per deployed byte, EXTCODE* +100) were NOT checked on Sepolia: only calls to precompile addresses were made. They come from EIP-8037 / EIP-8038 (status Last Call) and the Amsterdam fork of ethereum/execution-specs, which agree with each other.

### 3.4 The three gas schedules

| item | Prague | Osaka | Glamsterdam (Sepolia since 2026-10-06) | checked on Sepolia |
|---|---:|---:|---:|---:|
| intrinsic base, zero-value call | 21,000 | 21,000 | 12,000 + 3,000 = 15,000 (EIP-2780, EIP-8038) | yes |
| calldata, standard | 4 / 16 per zero / non-zero byte | same | same | yes |
| calldata floor | base + 10 / 40 per byte (EIP-7623) | same | base + 64 per byte (EIP-7976) | yes |
| modexp, RSA-2048, e = 65537 | 5,461 | 32,768 | 32,768 | yes |
| ECADD / ECMUL / pairing / ecrecover | 150 / 6,000 / 45,000 + 34,000 per pair / 3,000 | same | same (EIP-7904 changes nothing) | yes |
| SSTORE, new slot (cold) | 22,100 | 22,100 | 2,100 + 10,000 + 97,920 state gas = 110,020 (EIP-8038, EIP-8037) | no |
| SSTORE, change of a non-zero slot (cold) | 5,000 | 5,000 | 2,100 + 10,000 = 12,100 | no |
| SLOAD cold / warm | 2,100 / 100 | same | same | no |
| cold account access (CALL, EXT*) | 2,600 | 2,600 | 3,000; EXTCODESIZE / EXTCODECOPY +100 | only as part of the 15,000 base |
| CREATE + code deposit | 32,000 + 200 per byte | same | 12,000 + 183,600 state gas + 1,530 state gas per byte (+ 6 per 32 bytes) | no |

EIP-7773 lists no Glamsterdam activation time for mainnet (or Hoodi) yet, so mainnet should still be on Osaka. This was read from the EIP, not checked on-chain.

Sources: EIP-7773 (Glamsterdam meta, activation table), EIP-2780, EIP-7976, EIP-8037, EIP-8038, EIP-7904, EIP-7778 from github.com/ethereum/EIPs (master), fetched for this report; ethereum/execution-specs master, src/ethereum/forks/amsterdam (vm/gas.py, vm/instructions/storage.py, transactions.py).

## 4. RSA-2048 blind-signature tokens

Contracts: `contracts/RsaRating.sol` (`RsaRatingStorage`, `RsaRatingCalldata`, `RsaRatingCode`).

- FDH(token) = (B_0 || ... || B_7) mod N, B_i = keccak256(FDH_TAG (32 bytes) || token (20 bytes) || uint8(i)), big-endian, FDH_TAG = keccak256('DeliveryChain/RSA-FDH/v1'). Counter-mode keccak256 expansion and reduction mod N; NOT the PSS encoding of RFC 9474. The reduction is a second modexp call with exponent 1.
- Encodings: 2048-bit values as bytes32[8] (static, no ABI offset/length words); tokenSig as EIP-2098 compact (r, yParityAndS); exponent passed to the precompile as a 32-byte word.
- The one-time key signs keccak256(abi.encode(keccak256('DeliveryChain/RSA-rate/v1'), chainid, contract, worker, score)), signed raw.
- `issue` and `rate` also check that the signature is below N.
- `issue` checks the signature against the blinded message it is given. It does not tie that message to a rater; the order contract would have to do that (not prototyped).

### 4.1 The three ways to hold N (gasUsed)

**Osaka (measured)**

| function | (a) N in storage | (b) hash in storage, N in calldata | (c) N as bytecode |
|---|---:|---:|---:|
| registerKey | 203,304 | 48,040 | 131,682 |
| issue, 1 token, first | 103,693 | 92,693 | 91,056 |
| issue, 1 token, later | 86,569 | 75,569 | 73,932 |
| issue, 2 tokens, first | 145,497 | 134,448 | 132,860 |
| issue, 2 tokens, later | 128,421 | 117,372 | 115,784 |
| rate, first rating of a worker | 153,164 | 142,225 | 140,527 |
| rate, later | 118,964 | 108,025 | 106,327 |

**Prague (measured, pre-Fusaka reference)**. "(floor)" marks transactions that pay the EIP-7623 calldata floor instead of 21,000 + calldata + execution.

| function | (a) N in storage | (b) hash in storage, N in calldata | (c) N as bytecode |
|---|---:|---:|---:|
| registerKey | 203,304 | 48,040 | 131,682 |
| issue, 1 token, first | 76,386 | 65,386 | 63,749 |
| issue, 1 token, later | 59,262 | 52,710 (floor) | 46,625 |
| issue, 2 tokens, first | 90,883 | 79,834 | 78,246 |
| issue, 2 tokens, later | 73,807 | 73,190 (floor) | 62,980 (floor) |
| rate, first rating of a worker | 124,150 | 113,211 | 111,513 |
| rate, later | 89,950 | 79,011 | 77,313 |

**Glamsterdam (estimate)**

| function | (a) N in storage | (b) hash in storage, N in calldata | (c) N as bytecode |
|---|---:|---:|---:|
| registerKey | 900,764 | 130,060 | 719,166 |
| issue, 1 token, first | 185,713 | 174,713 | 173,576 |
| issue, 1 token, later | 87,769 | 76,769 | 75,632 |
| issue, 2 tokens, first | 227,517 | 216,468 | 215,380 |
| issue, 2 tokens, later | 129,621 | 118,572 | 117,484 |
| rate, first rating of a worker | 411,224 | 400,285 | 399,087 |
| rate, later | 215,384 | 204,445 | 203,247 |

Under Osaka option (c) is the cheapest per call and is used for the comparison: a rating costs 1,698 gas less than with (b), and registration 83,642 more. Under the Glamsterdam estimate (c) keeps a 1,198 gas lead per rating but registration costs 719,166 against 130,060 for (b), because deployed bytes are charged 1,530 gas each.

### 4.2 Breakdown, option (c), Osaka

| function | gasUsed | base | calldata | precompile | storage | rest |
|---|---:|---:|---:|---:|---:|---:|
| registerKey | 131,682 | 21,000 | 4,148 (260 B) | 0 | 22,200 | 84,334 |
| issue, 1 token, first | 91,056 | 21,000 | 8,624 (548 B) | 32,768 | 24,200 | 4,464 |
| issue, 1 token, later | 73,932 | 21,000 | 8,600 (548 B) | 32,768 | 7,100 | 4,464 |
| issue, 2 tokens, first | 132,860 | 21,000 | 16,768 (1060 B) | 65,536 | 24,200 | 5,356 |
| issue, 2 tokens, later | 115,784 | 21,000 | 16,792 (1060 B) | 65,536 | 7,100 | 5,356 |
| rate, first rating of a worker | 140,527 | 21,000 | 6,048 (420 B) | 37,816 | 68,500 | 7,163 |
| rate, later | 106,327 | 21,000 | 6,048 (420 B) | 37,816 | 34,300 | 7,163 |

Precompile calls: issue with 1 token 1 x modexp @ 32768; with 2 tokens 2 x modexp @ 32768; rate 1 x ecrecover @ 3000, 1 x modexp @ 2048, 1 x modexp @ 32768. In registerKey the rest is the CREATE of the 257-byte data contract (83,488 gas). Reading N costs one SLOAD (2,100) and one cold EXTCODECOPY (2,624).

Five later ratings, option (c): gasUsed 106,303 to 106,339 (median 106,327); execution gas 79,279 in all five.

### 4.3 Breakdown, option (c), Prague

| function | gasUsed | base | calldata | precompile | storage | rest |
|---|---:|---:|---:|---:|---:|---:|
| registerKey | 131,682 | 21,000 | 4,148 (260 B) | 0 | 22,200 | 84,334 |
| issue, 1 token, first | 63,749 | 21,000 | 8,624 (548 B) | 5,461 | 24,200 | 4,464 |
| issue, 1 token, later | 46,625 | 21,000 | 8,600 (548 B) | 5,461 | 7,100 | 4,464 |
| issue, 2 tokens, first | 78,246 | 21,000 | 16,768 (1060 B) | 10,922 | 24,200 | 5,356 |
| issue, 2 tokens, later | 62,980 | 21,000 | 16,792 (1060 B) | 10,922 | 7,100 | floor |
| rate, first rating of a worker | 111,513 | 21,000 | 6,048 (420 B) | 8,802 | 68,500 | 7,163 |
| rate, later | 77,313 | 21,000 | 6,048 (420 B) | 8,802 | 34,300 | 7,163 |

A row with "floor" in the last column pays the EIP-7623 calldata floor: its gasUsed is larger than base + calldata + execution, so the columns do not add up to it.

### 4.4 issue2 as an internal call

`OrderHarness.concludeRsa` forwards to `issue2` (option (c), counter already non-zero). Osaka: the CALL with everything the callee spends costs 78,092 gas and the cold account access 2,600, 80,692 in total; the harness transaction used 120,121. Prague: 26,078 and 65,507. Glamsterdam estimate: 88,892 and 122,321.

## 5. Linkable ring signature (LSAG style) on alt_bn128

Contracts: `contracts/LsagRating.sol` (`LsagRatingXY`, `LsagRatingHash`).

- per ring member: L = s*G + c*P, R = s*H + c*I, c' = keccak256(prefix || L || R) mod Q (4 ECMUL + 2 ECADD); accepted iff the chain closes on c_0.
- prefix = keccak256(abi.encode(keccak256('DeliveryChain/LSAG-rate/v1'), chainid, contract, worker, score, keccak256(ring points), I.x, I.y)).
- **Both coordinates** (`LsagRatingXY`): `tickets[worker]` is an array of points, 2 slots per ticket plus the array length; a ring is a list of ticket indices and the contract loads the points.
- **One slot per ticket** (`LsagRatingHash`): `isTicket[worker][keccak256(x, y)] = true` plus an event so that tickets can be found; a ring is a list of points in calldata and the contract checks each one is registered.
- `registerTicket` checks the point is on the curve. Ring members are not required to be distinct.

### 5.1 registerTicket and initWorker (gasUsed)

| function | both coordinates: Osaka | both coordinates: Glamsterdam estimate | one slot: Osaka | one slot: Glamsterdam estimate |
|---|---:|---:|---:|---:|
| registerTicket, first ticket of a worker | 90,107 | 347,967 | 47,370 | 129,390 |
| registerTicket, later | 73,007 | 250,047 | 47,370 | 129,390 |
| initWorker, once per worker, 1 hash-to-curve try | 71,143 | 241,083 | 71,121 | 241,061 |
| initWorker, once per worker, 2 hash-to-curve tries | 76,135 | 246,075 | 76,113 | 246,053 |
| initWorker, once per worker, 4 hash-to-curve tries | 86,116 | 256,056 | 86,094 | 256,034 |

registerTicket and the ring signature use no modexp, so Prague gives the same gas as Osaka; only initWorker differs (square root 1,338 instead of 4,016 gas per try).

| function | gasUsed | base | calldata | precompile | storage | rest |
|---|---:|---:|---:|---:|---:|---:|
| both coordinates: registerTicket, first | 90,107 | 21,000 | 1,456 (100 B) | 0 | 66,300 | 1,351 |
| both coordinates: registerTicket, later | 73,007 | 21,000 | 1,456 (100 B) | 0 | 49,200 | 1,351 |
| one slot: registerTicket, first | 47,370 | 21,000 | 1,456 (100 B) | 0 | 22,100 | 2,814 |
| one slot: registerTicket, later | 47,370 | 21,000 | 1,456 (100 B) | 0 | 22,100 | 2,814 |

67 later registrations per layout: gasUsed 72,983 to 73,007 (both coordinates) and 47,346 to 47,370 (one slot); execution gas constant. The one-slot figure includes 1,637 gas for the event.

Two tickets registered by `OrderHarness.concludeLsag` (two calls in one transaction), Osaka, gas seen by the caller: one slot 52,728; both coordinates 99,202 (116,302 for a worker's first two tickets). Harness transaction: 77,581 and 124,055; Glamsterdam estimate 248,221 and 477,535.

### 5.2 rate by ring size (gasUsed)

| ring size | both coordinates: Osaka first | both coordinates: Osaka later | one slot: Osaka first | one slot: Osaka later | one slot: Glamsterdam estimate, later |
|---|---:|---:|---:|---:|---:|
| 2 | 160,617 | 126,429 | 156,065 | 121,889 | 218,309 |
| 4 | 221,643 | 187,443 | 214,709 | 180,521 | 276,941 |
| 8 | 343,672 | 309,472 | 332,010 | 297,786 | 394,206 |
| 16 | 587,767 | 553,579 | 566,529 | 532,341 | 628,761 |
| 32 | 1,075,959 | 1,041,759 | 1,035,545 | 1,001,333 | 1,097,753 |

Each ring member adds about 29,315 gas (one slot) or 30,511 (both coordinates): 4 ECMUL and 2 ECADD are 24,300, their six calls 600, plus the membership read and calldata. "Later" is the median of two ratings; their execution gas was identical.

### 5.3 Breakdown, one slot per ticket, later rating, Osaka

| function | gasUsed | base | calldata | precompile | storage | rest |
|---|---:|---:|---:|---:|---:|---:|
| rate, ring of 2 | 121,889 | 21,000 | 5,752 (484 B) | 48,600 | 40,600 | 5,937 |
| rate, ring of 4 | 180,521 | 21,000 | 8,812 (676 B) | 97,200 | 44,800 | 8,709 |
| rate, ring of 8 | 297,786 | 21,000 | 14,932 (1060 B) | 194,400 | 53,200 | 14,254 |
| rate, ring of 16 | 532,341 | 21,000 | 27,196 (1828 B) | 388,800 | 70,000 | 25,345 |
| rate, ring of 32 | 1,001,333 | 21,000 | 51,604 (3364 B) | 777,600 | 103,600 | 47,529 |

### 5.4 Breakdown, both coordinates, later rating, Osaka

| function | gasUsed | base | calldata | precompile | storage | rest |
|---|---:|---:|---:|---:|---:|---:|
| rate, ring of 2 | 126,429 | 21,000 | 3,984 (420 B) | 48,600 | 46,900 | 5,945 |
| rate, ring of 4 | 187,443 | 21,000 | 5,276 (548 B) | 97,200 | 55,300 | 8,667 |
| rate, ring of 8 | 309,472 | 21,000 | 7,860 (804 B) | 194,400 | 72,100 | 14,112 |
| rate, ring of 16 | 553,579 | 21,000 | 13,076 (1316 B) | 388,800 | 105,700 | 25,003 |
| rate, ring of 32 | 1,041,759 | 21,000 | 23,472 (2340 B) | 777,600 | 172,900 | 46,787 |

## 6. Blind BLS on alt_bn128 (optional part)

Contract: `contracts/BlsRating.sol`. Signature in G1, key in G2 kept in 4 storage slots, one pairing call with two pairs per check (113,000 gas), token hashed to G1 by try-and-increment. JS side uses @noble/curves 1.9.1 (nested copy under node_modules/viem) because the top-level @noble/curves 1.2.0 has no G2.

| function | Osaka | Prague | Glamsterdam estimate |
|---|---:|---:|---:|
| registerKey | 112,525 | 112,525 | 458,605 |
| issue, 1 token, first | 168,653 | 168,653 | 250,673 |
| issue, 1 token, later | 151,553 | 151,553 | 152,753 |
| rate, first rating (1 hash-to-curve try) | 222,828 | 220,150 | 480,888 |
| rate, later (2 tries) | 193,620 | 188,264 | 290,040 |

| function | gasUsed | base | calldata | precompile | storage | rest |
|---|---:|---:|---:|---:|---:|---:|
| issue, 1 token, later | 151,553 | 21,000 | 2,480 (164 B) | 113,000 | 13,400 | 1,673 |
| rate, first | 222,828 | 21,000 | 2,988 (228 B) | 120,016 | 74,800 | 4,024 |
| rate, later | 193,620 | 21,000 | 2,988 (228 B) | 124,032 | 40,600 | 5,000 |

The gas of a rating depends on how many tries the hash-to-curve needs. Osaka: first rating, 1 try: 222,828 (1 sample); later rating, 3 tries: 198,609 (2 samples); later rating, 2 tries: 193,596 to 193,620 (3 samples).

## 7. Next to the current numbers

### 7.1 Osaka (measured) against the given baseline

|  | current (given) | RSA option (c) | LSAG one slot, ring of 4 | LSAG one slot, ring of 8 | LSAG one slot, ring of 16 |
|---|---:|---:|---:|---:|---:|
| issuing per delivery, gas seen by the calling contract | 1,243,194 | 80,692 | 52,728 | same | same |
| rating, later | 291,251 / 284,408 | 106,327 | 180,521 | 297,786 | 532,341 |
| rating, first of a worker |  | 140,527 | 214,709 | 332,010 | 566,529 |
| one-time per worker |  | registerKey 131,682 | initWorker 71,121 (1 try) | same | same |

The RSA issuing figure excludes the calldata of the four 256-byte values (16,792 gas with selector and worker), which the delivery transaction would carry. The prototypes have no access check; the `onlyOrder` check of the current contract is part of the 621,597 figure and is not in the prototype figures.

### 7.2 Glamsterdam (estimates)

|  | RSA option (c) | RSA option (b) | LSAG one slot, ring of 4 | LSAG one slot, ring of 8 | LSAG one slot, ring of 16 |
|---|---:|---:|---:|---:|---:|
| issuing per delivery, direct transaction(s) | 117,484 | 118,572 | 258,780 | same | same |
| rating, later | 203,247 | 204,445 | 276,941 | 394,206 | 628,761 |
| rating, first of a worker | 399,087 | 400,285 | 472,769 | 590,070 | 824,589 |
| one-time per worker | registerKey 719,166 | registerKey 130,060 | initWorker 241,061 | same | same |

Each new storage slot adds 87,920 gas over Osaka and each changed slot about 7,100. A rating writes one new slot in every scheme and two more on a worker's first rating; RSA issuing writes none once the counter is non-zero, while each LSAG ticket is a new slot (two with both coordinates).

### 7.3 The baseline under Glamsterdam (rough, not measured)

The baseline figures were not re-priced or re-measured. Reading `contracts/Reputation.sol` and applying the same price changes gives an order of magnitude only:

- submitRating: writes one new slot (nullifier, SLOAD then SSTORE: +88,020), changes two counters (+7,200 each), makes one cold call to the verifier (+400), base -6,000: about +96,800, i.e. roughly 381,000 to 388,000.
- addRatingTicket: writes one new slot (known root: +87,920), changes root and nextIndex (+7,100 and +7,200) and one filledSubtrees slot per zero bit of the leaf index (+7,100 each; 8 on average over a full depth-16 tree, 12 or more for a worker with fewer than 16 tickets), completedOrders on every second ticket (+7,200), one cold call to the hasher (+400): roughly +160,000 to +210,000 per insertion.

## 8. Functional tests

`node scripts/run.js test`: 77 of 77 passing with the default hardfork, 77 of 77 with `HF=osaka`, 77 of 77 with `HF=prague` (mocha reports in `tests-default.json`, `tests-osaka.json`, `tests-prague.json`).

- **Environment**: the network runs the hardfork it was configured with (CLZ opcode works only under osaka) and charges 32,768 gas for the RSA-2048 modexp under osaka, 5,461 under prague.
- **RSA** (each of the three options): a valid rating is accepted and updates the counters; rejected are a wrong RSA signature (altered, for another token, made with another key, still blinded), a signature shifted by N, a replayed token (same transaction, or the same token with a newly signed score), a changed score, a score outside 1..5, a token signature by another key or for another worker or contract instance, a blind signature that does not match the blinded message (also in the two-token call), and calls for a worker without a key. Tokens whose 2048-bit expansion is above N and below N are both accepted. One test records that `issue` accepts the pair (blinded message 1, signature 1) for any key.
- **LSAG** (each layout): valid signatures for ring sizes 1, 2, 4, 8 at different signer positions; rejected are a signature made with a non-member key, a ring containing an unregistered point or an out-of-range index, a ticket registered for another worker, a reused key image (same ticket in another ring with another score), a changed score, altered responses, challenge, ring order or key image, a key image off the curve or at infinity, mismatched lengths, a signature made for another contract instance, and an uninitialised worker. The stored H equals the JS hash-to-curve. One test records that a ring repeating the same ticket is accepted.
- **Randomized agreement**: 60 RSA cases and 80 LSAG cases per contract, with random alterations; the contract accepts exactly the cases an independent JS check accepts.
- **Blind BLS**: valid rating accepted; wrong, negated, still-blinded and infinity signatures, a replayed token, a changed score and a mismatched blind signature rejected.
- Check of the tests themselves (manual, during development): with the final comparison removed from the RSA and LSAG verifiers, 18 of the 65 RSA and LSAG tests that existed then failed; the contracts were restored afterwards.

## 9. What to distrust

- **Glamsterdam figures are estimates.** They assume the gas schedule of the EIPs as fetched today (EIP-2780, 7976, 8037, 8038 are in Last Call) and of the reference spec. On Sepolia only the precompile prices, the 15,000 base and the 64 gas per byte floor were confirmed; the storage and state-creation prices were not.
- **The baseline figures are taken to be pre-fork (Osaka) measurements.** With the Glamsterdam storage prices a submitRating that writes a new nullifier slot would cost roughly 381,000 to 388,000 (section 7.3), not 291,251. If they were measured after 2026-10-06 after all, the comparison in 7.1 is not like for like.
- **Mainnet** was not queried. That it is still on Osaka is read from EIP-7773.
- **EDR is a pre-release build** (0.12.0-next.23). Its Osaka prices agree with the formulas and with the live precompile prices.
- **No access control, no integration.** No `onlyOrder`, and no order contract that holds the rater's blinded message or ticket between order creation and conclusion. `issue` does not bind the blinded message to a rater.
- **RSA issuing emits no event.** The blind signatures are in the calldata of the concluding transaction. Emitting 256 bytes in an event would add about 2,800 gas per token (estimate: 375 + 375 per topic + 8 per byte).
- **Encodings are the cheap ones**: static `bytes32[8]`, compact one-time signature. `bytes` arguments would cost a few hundred gas more each.
- **FDH and hashing are prototype choices**: counter-mode keccak256 and a modexp reduction, not RFC 9474 PSS; hash-to-scalar by `mod Q`; try-and-increment hash-to-curve.
- **Deployment costs are not in any per-call figure.** Under Glamsterdam deployed bytes cost 1,530 gas each.
- **Calldata gas moves by 12 gas per zero byte**, so a rerun with other keys or addresses shifts totals by a few dozen gas.
- **LSAG anonymity set is the ring**, chosen by the rater; the gas table is per ring size.
- **Blind BLS** keeps the key in storage and was not tuned; its rating gas depends on hash-to-curve tries.

## 10. Network access made

- Sepolia, `https://ethereum-sepolia-rpc.publicnode.com`: 51 read-only JSON-RPC requests in two runs (15 + 36); this run: 1 x eth_chainId, 1 x eth_getBlockByNumber, 1 x eth_config, 11 x eth_estimateGas, 22 x eth_call. Every eth_estimateGas and eth_call targets a precompile address (0x01, 0x05, 0x06, 0x07, 0x08). No transaction, no key, no contract code executed.
- Public documentation: EIP-7883 and EIP-2565 (eips.ethereum.org); EIP-7773, 2780, 7976, 7981, 8037, 8038, 7778, 7904, 7954, 7708, 8261 (raw files of github.com/ethereum/EIPs); the Amsterdam fork files of github.com/ethereum/execution-specs. Copies are in `docs-cache/`.
- Mainnet was not contacted. Nothing was installed. The scripts load Hardhat as a library instead of going through its CLI, which is what sends telemetry and checks for new versions.

## 11. Files

```
contracts/RsaRating.sol      RsaRatingStorage (a), RsaRatingCalldata (b), RsaRatingCode (c)
contracts/LsagRating.sol     LsagRatingXY (both coordinates), LsagRatingHash (one slot per ticket)
contracts/BlsRating.sol      BlsBlindRating (optional part)
contracts/OrderHarness.sol   forwards to issue2 / registerTicket, to measure the internal-call cost
lib/rsa.js  lib/lsag.js  lib/bls.js   signers (node:crypto key generation, BigInt blinding, noble curves)
lib/gas.js                   intrinsic gas, modexp formulas, trace breakdown, Glamsterdam re-pricing
lib/probes.js                precompile probe inputs and expected totals per gas schedule
lib/prng.js                  seeded generator (reproducible transactions; test use only)
test/rsa.test.js  test/lsag.test.js  test/bls.test.js
scripts/run.js               compile / test without the Hardhat CLI
scripts/measure.js           -> results/raw-default.json, raw-osaka.json, raw-prague.json
scripts/measure-bls.js       BLS part of measure.js
scripts/sepolia-crosscheck.js-> results/sepolia-crosscheck.json (read-only)
scripts/build-report.js      -> results/native-rating-gas.json, results/native-rating-gas.md
results/tests-*.json         mocha JSON reports per hardfork setting
results/sepolia-crosscheck-run1-osaka-assumption.json   first Sepolia run, kept for the record
fixtures/rsa-test-keys.json  two throwaway RSA-2048 test keys
docs-cache/                  EIP texts and reference-spec files the Glamsterdam prices were read from
```

Reproduce, from this directory:

```
node scripts/run.js test                 # add HF=prague or HF=osaka; TEST_JSON=<file> writes a JSON report
node scripts/measure.js && HF=osaka node scripts/measure.js && HF=prague node scripts/measure.js
node scripts/sepolia-crosscheck.js      # read-only requests to a public Sepolia endpoint
node scripts/build-report.js
```
