# Measurement data

These files support the evaluation of FoodChain reported in the paper. The final contracts are those of 2026-10-12, with the withdrawal circuit rebuilt on 2026-10-14. The local measurements use an in-process Hardhat node with the gas schedule of the main network. The public measurements were made on Hoodi (the deployment of 2026-10-13, `deployments/hoodi-2026-10-13/`) and, for the cost table, on three test networks (2026-10-14).

| Paper item | Files |
|---|---|
| Table 3: gas per call with and without privacy, overhead per mechanism, fill levels of the note tree, endings of an order | `local-gas-final-2026-10-12.{md,json}`; the 21 files `hardhat-{data,report,summary}-10it-*2026-10-12T22-4*` (the main run and six fill levels); `hardhat-*-10it-2026-10-14T18-30-21-546Z.*` (a check with the circuit of 2026-10-14) |
| Table 4: cost by depth of the note tree | `gas-study-candidate-v2-2026-10-12.{md,json}` (insertion gas, proving time); `circuit-2026-10-14.md` (constraints of the final circuit) |
| Table 5: cost on four networks | `cost-networks-2026-10-14.{md,json}`; `{arbitrumSepolia,optimismSepolia,fuji}-2026-10-14/`; `cost-networks-2026-10-14/` (price readings and read-backs); the deployment records in `deployments/` |
| Table 6: off-chain times | section 12 of `local-gas-final-2026-10-12.md`; the 21 files `hardhat-*-10it-*2026-10-12T19-4*` (63 cycles); `circuit-2026-10-14.md` (withdrawal proof) |
| Table 7 and the paragraph on throughput | `throughput-final-2026-10-13.{md,json}`; `concurrent-hardhat-*-final*-2026-10-13T0*`; `concurrent-hardhat-privacy-pilot-12000ms-2026-10-13T06-*`; `throughput-final-2026-10-13*-process-samples.jsonl.gz`; `gas-equivalent-verifier-calibration-2026-10-13T02-31-54-926Z.json`; `throughput-512-2026-10-19/`; `hoodi-2026-10-13/concurrent-hoodi-*` |
| Hoodi: the same gas as on the local node, call by call; the 37 withdrawals from the pool follow the local gas rule, and a merge without a payment costs 8,940 gas less | `hoodi-final-2026-10-13.{md,json}`; `hoodi-2026-10-13/`; `deployment-hoodi-2026-10-13.json`; `deployment-hoodi-no-privacy-2026-10-13.json`; `sepolia-gas-schedule-2026-10-11.md` (gas schedules of Hoodi and of the main network) |
| Tables 8 and 9: the observer; withdrawal policies | `privacy-eval-final-2026-10-12{.md,.json,-decisions.json.gz}` |
| Figure 4: larger denominations | `denominations-scaled-2026-10-17.{md,json}`; `denominations-scaled-2026-10-17/`; `denominations-2026-10-17.{md,json}`; `denominations-2026-10-17/` |
| Order total against public menus (end of Section 7.6) | `menu-fingerprint-2026-10-11.{md,json.gz}`; `menu-integer-prices-2026-10-12.{md,json}`. The menus come from the dataset of Kilic and Taşkaya Temizel (Zenodo, 10.5281/zenodo.10554680, CC BY 4.0). |
| Section 5.3: the earlier design, with anonymous ratings | `privacy-eval-2026-10-02T11-06-40-463Z{.md,.json,-decisions.json.gz}`; `privacy-eval-validation-2026-10-02T11-12-46-000Z.txt`; `comparison-{report,data}-2026-10-02T12-43-32-267Z.*`; `privacy-2026-10-02T12-35-17-096Z.json`; `no-privacy-2026-10-02T12-43-14-182Z.json`; `native-rating-gas-2026-10-11.{md,json}`; `period-ratings-privacy-2026-10-11.{md,json}`; `relayer-delay-sweep-2026-10-11.{md,json}` |

The files from March to June 2026, and `concurrent-makeOrder-analysis.md`, which analyses runs of 2026-05-30, come from earlier contracts and support no figure of the paper.

Notes:

- The file names follow the pattern described in the README at the root of the repository.
- The `file` fields of `denominations-scaled-2026-10-17.json` give the names under which the runs were written. Here the runs are in the two `denominations-*` folders, compressed.
- The scripts that produced these files are not published.
- Some reports also cite earlier runs, an earlier Sepolia deployment and check notes that are not part of this folder.
- No file here holds a private key or an API key. The 64-hex values are transaction or block hashes, event topics and, in the files of the two menu reports, SHA-256 digests of scripts and data files. The wallets each run created are not part of this folder.
