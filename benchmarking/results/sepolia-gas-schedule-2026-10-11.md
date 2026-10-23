# Sepolia changed its gas schedule four days after the measurements

Checked on 2026-10-11 with read-only JSON-RPC calls to public endpoints (`ethereum-sepolia-rpc.publicnode.com`, `ethereum-rpc.publicnode.com`, `ethereum-hoodi-rpc.publicnode.com`). No key was used and no transaction was sent. Scripts: `benchmarking/fork-check/` (not part of the repository, like the other benchmark scripts).

## What changed

The gas measurements of the paper were taken on Sepolia on 2026-10-02 between 12:14 and 12:35 UTC (blocks 11,828,921 to 11,829,022, block gas limit 60,000,000). On 2026-10-06 at 13:53:36 UTC Sepolia activated a new fork (`eth_config`: activation time 1791294816, fork id `0x6c1d9423`; the Glamsterdam upgrade). After it:

| | Sepolia on 2026-10-02 | Sepolia on 2026-10-11 | Mainnet on 2026-10-11 | Hoodi on 2026-10-11 |
|---|---|---|---|---|
| Block gas limit | 60,000,000 | about 200,000,000 | 60,000,000 | 60,000,000 |
| Intrinsic gas of a call (`eth_call` to the ECADD precompile needs base + 150) | 21,000 | 15,000 | 21,000 | 21,000 |
| Block header carries `blockAccessListHash` | no | yes | no | no |
| Fork in force since | | 2026-10-06 | 2026-01-07 | 2025-11-12 |

So the numbers of the paper correspond to the schedule that the Ethereum main network still uses on 2026-10-11, and Sepolia no longer reproduces them.

## The same transactions under the new schedule

Calldata and value of transactions recorded in `privacy-2026-10-02T12-35-17-096Z.json`, replayed with `eth_estimateGas` at the latest Sepolia block from an unused sender (balance set with a state override):

| Transaction | gasUsed on 2026-10-02 | `eth_estimateGas` on 2026-10-11 | Ratio |
|---|---:|---:|---:|
| `StealthAnnouncer.announce` | 26,245 | 29,941 | 1.14 |
| `Chain.makeOrder` (creates the order contract, stores two ciphertexts) | 3,406,135 | 22,554,816 | 6.6 |
| `GlobalReputation.depositPayment` (one insertion into the note tree) | 1,009,057 to 1,014,108 | 1,279,208 | 1.26 |

`eth_estimateGas` returns the gas limit a transaction needs, which is somewhat above what it finally uses (the 63/64 rule for nested calls and the endpoint's margin), so the ratios are upper estimates of a few percent. The other steps of a cycle cannot be replayed this way: they need an order in the right state and signatures of the parties.

The increase is in the creation of state. Under the new schedule a new contract and every new storage slot cost several times more than before, and `makeOrder` creates a contract and writes two ciphertext strings to storage.

## Consequence

- The paper has to say when its gas figures were measured and under which schedule.
- A new measurement on Sepolia, for example after redeploying, will not be comparable with the table of the paper. To measure under the main network's schedule again, use a local Hardhat node (same EVM rules) or Hoodi.
- The steps that create state (the order contract of `makeOrder`, the ciphertexts written by `makeOrder` and `addInformation`, the new root and nullifier slots of every insertion and withdrawal) are the ones the new schedule makes expensive.
