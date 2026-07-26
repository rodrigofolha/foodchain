# FoodChain

**A blockchain-based, privacy-preserving delivery system for time-sensitive products.**

FoodChain replaces the centralized delivery platform with a set of smart contracts and three dApps (one per actor: customer, delivery worker, and restaurant/manager). The privacy of every stakeholder is preserved end-to-end on a public blockchain by combining four cryptographic mechanisms with an anonymous reputation protocol.

## 🚀 Try the live deployment

The system is deployed on the **Ethereum Sepolia** testnet and can be exercised with a MetaMask-compatible browser:

| Actor | URL |
|---|---|
| **Customer** | <https://arthurcarvalho.info/apps/foodchain/customer/> |
| **Delivery worker** | <https://arthurcarvalho.info/apps/foodchain/delivery/> |
| **Restaurant / manager** | <https://arthurcarvalho.info/apps/foodchain/manager/> |

Steps to try it:

1. Install [MetaMask](https://metamask.io/) in your browser
2. Switch MetaMask to the **Sepolia** network
3. Get free Sepolia ETH from a faucet (e.g., <https://sepoliafaucet.com/>)
4. Open one of the URLs above

A short use-case walkthrough is available on YouTube: <https://youtu.be/4WHCuIu5T-o>

## 📄 Publications

- Folha, R.; Times, V.C.; Carvalho, A.; Araújo, A.; Viana, F.; Couto, H. **FoodChain: A food delivery platform based on blockchain for keeping data privacy** (2022). *International Conference on Database Systems for Advanced Applications (DASFAA) Proceedings*, pp. 500–504. [Springer link](https://link.springer.com/chapter/10.1007/978-3-031-00129-1_43)
- Folha, R.; Times, V.C.; Carvalho, A.; Araújo, A.; Viana, F.; Couto, H. **Towards a Novel Business Process Model for Food Delivery Services Using Blockchain Technology** (2022). *AMCIS 2022 Proceedings*, 5. [AISeL link](https://aisel.aisnet.org/amcis2022/sig_green/sig_green/5/)

## 🏗 Repository layout

```
├── contracts/               # Solidity smart contracts (Hardhat, Solidity 0.8.20)
│   ├── Chain.sol            # Orchestrator: entry points for the order lifecycle
│   ├── Order.sol            # Per-order state machine + escrow
│   ├── Reputation.sol       # Merkle tree + Groth16 verifier + ZK payment pool
│   ├── Storage.sol          # Encrypted address/items storage (Phase 2)
│   ├── StealthAnnouncer.sol # EIP-5564 stealth-address announcements
│   ├── Verifier.sol         # Auto-generated Groth16 verifier (rating)
│   ├── MergeWithdrawVerifier.sol  # Auto-generated Groth16 verifier (pool)
│   └── Hasher.sol           # Poseidon hash (Solidity port from circomlibjs)
├── circuits/                # Circom 2.0 ZK circuits (Groth16 via snarkjs 0.7.6)
├── customer-frontend/       # React dApp — port 3000
├── deliveryman-frontend/    # React dApp — port 3001
├── manager-frontend/        # React dApp — port 3002
├── api/                     # Express + Sequelize + PostgreSQL — port 3333
├── scripts/                 # Hardhat deployment scripts
└── benchmarking/            # Performance evaluation scripts (Sepolia + others)
```

## 🔐 Privacy mechanisms

FoodChain combines **four cryptographic layers** on a public blockchain, plus an anonymous reputation protocol on top. Each layer closes a specific on-chain leak:

| Layer | Mechanism | What it hides |
|---|---|---|
| 1 | **Stealth addresses** (EIP-5564, secp256k1 ECDH) | The identity of the order recipient — every order goes to a one-time address unlinkable to the establishment |
| 2 | **Zero-knowledge payment pool** (Groth16 over an incremental Merkle tree) | The wallet that funds the stealth address — the establishment can top-up gas without exposing its main wallet |
| 3 | **Authenticated encryption** (x25519-xsalsa20-poly1305) | The order content (item list, delivery address) — readable only by the actor who needs it |
| 4 | **Two-phase information revelation** | The establishment's identity toward the delivery worker until the worker commits to the job |
| 5 (on top) | **Anonymous reputation** (Groth16 ZK proofs, shared Merkle tree) | Which specific delivery a rating refers to |

## 🛠 Prerequisites

- **Node.js** ≥ 18 (recommended: [nvm](https://github.com/nvm-sh/nvm))
- **Yarn** (used by all three frontends and the API)
- **Docker** (used to run PostgreSQL locally)
- **MetaMask** browser extension
- **Circom** 2.0 (only if you plan to modify the ZK circuits — [installation guide](https://docs.circom.io/getting-started/installation/))

## 🚀 Local setup

### 1. Clone and install root dependencies

```sh
git clone https://github.com/rodrigofolha/foodchain.git
cd foodchain
npm install   # installs Hardhat, snarkjs, and dev tooling
```

### 2. Configure environment variables

Two `.env` files are required. Both are gitignored, so you must create them locally.

**Root `.env`** (used by Hardhat for deployment):

```env
SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/<your-infura-key>
PRIVATE_KEY=<your-hex-private-key-without-0x-prefix>
```

- Get a free Infura key at <https://infura.io/> (Web3 API → Sepolia endpoint)
- The `PRIVATE_KEY` is a **Sepolia-only** deploy account — never reuse a mainnet key

**`api/.env`** (used by the Express API):

```env
DB_USER=<your_pg_user>
DB_PASS=<your_pg_password>
DB_NAME=<your_pg_database>
DB_HOST=<host or localhost>
DB_DIALECT=postgres

SECRET_KEY=<any_random_string_for_JWT_signing>
```

### 3. Start PostgreSQL

Use docker-compose (recommended):

```sh
docker-compose up -d
```

Or manually:

```sh
docker run --name foodchain_db \
  -e POSTGRES_USER=<your_pg_user> \
  -e POSTGRES_PASSWORD=<your_pg_password> \
  -e POSTGRES_DB=<your_pg_database> \
  -p 5432:5432 -d postgres
```

### 4. Start the API

```sh
cd api
yarn install
yarn sequelize db:migrate
yarn dev            # starts Express on port 3333
```

### 5. Start the three dApps

Each dApp runs on a separate port so you can open all three in different browser windows and simulate a full order.

```sh
# Customer  (port 3000)
cd customer-frontend && yarn install && yarn start

# Delivery worker  (port 3001)
cd deliveryman-frontend && yarn install && yarn start

# Restaurant / manager  (port 3002)
cd manager-frontend && yarn install && yarn start
```

The dApps talk to the smart contracts already deployed on Sepolia. If you want to deploy your own copy, see the next section.

## 🔧 Deploying your own contracts

Only needed if you want to run against your own deployment (rather than the shared Sepolia one).

```sh
# 1. Compile the Solidity contracts
npx hardhat compile

# 2. Deploy to Sepolia (or another EVM network configured in hardhat.config.js)
npx hardhat run scripts/deploy_all.js --network sepolia
```

`deploy_all.js` deploys in order — Poseidon → Verifier → Reputation → Storage → Chain — then **automatically updates** `config.js` in all three frontends with the new contract addresses, ABIs, and `DEPLOY_BLOCK`.

## 🔬 Regenerating the ZK circuit

Only needed if you modify `circuits/feedback.circom` or `circuits/mergeWithdraw.circom`.

```sh
# Example for the feedback (rating) circuit
circom circuits/feedback.circom --r1cs --wasm --sym -o circuits/

# Groth16 phase-2 trusted setup
npx snarkjs groth16 setup circuits/feedback.r1cs circuits/pot14_final.ptau circuits/feedback_0000.zkey

# Contribute randomness to the ceremony
npx snarkjs zkey contribute circuits/feedback_0000.zkey circuits/feedback_0001.zkey \
  --name="FoodChain Phase 2" -e="$(head -c 64 /dev/urandom | xxd -p -c 128)"

# Export the Solidity verifier (regenerates contracts/Verifier.sol)
npx snarkjs zkey export solidityverifier circuits/feedback_0001.zkey contracts/Verifier.sol

# Copy circuit artifacts to the frontends that generate proofs
cp circuits/feedback_js/feedback.wasm     customer-frontend/public/circuits/
cp circuits/feedback_0001.zkey            customer-frontend/public/circuits/
cp circuits/feedback_js/feedback.wasm     manager-frontend/public/circuits/
cp circuits/feedback_0001.zkey            manager-frontend/public/circuits/
```

> **Note:** `Verifier.sol` and `MergeWithdrawVerifier.sol` are auto-generated by snarkjs — do NOT edit them manually. After regenerating, recompile with `npx hardhat compile`.

## 💡 Running the order lifecycle end-to-end

With the three dApps open and connected to Sepolia:

1. **Manager dApp** (port 3002): register a restaurant and add items to the catalog. This is the only role that requires authentication (the establishment's own wallet).
2. **Customer dApp** (port 3000): browse the catalog, pick a restaurant, choose items, and place the order. MetaMask will pop up to sign the transaction that creates the order and escrows the payment at a fresh stealth address.
3. **Delivery worker dApp** (port 3001): browse open orders (visible by zone and delivery fee only, without the restaurant identity), pick one, confirm intention. This publishes the worker's encryption public key on-chain.
4. Back on the **customer dApp**: the frontend automatically detects the worker's public key and encrypts the delivery address for them.
5. **Delivery worker**: goes to the restaurant, picks up the package, delivers to the customer.
6. **Customer**: hands the pickup code to the worker.
7. **Delivery worker**: submits the pickup code via `deliveryOrder` — the smart contract releases the fee to the worker and pushes the establishment's revenue into the ZK pool.
8. **Customer** (any time later): submits an anonymous rating for the worker with a Groth16 proof generated in the browser.

## 🐛 Troubleshooting

- **MetaMask connection popup on page load**: this is the browser calling `eth_requestAccounts` too early. If it hits you, refresh the page and connect using the "Connect Wallet" button.
- **`eth_getLogs` limit exceeded**: the frontend uses `DEPLOY_BLOCK` (set by `deploy_all.js`) as `fromBlock`. If you deployed manually and did not update this constant, event queries can hit MetaMask's ~10,000-block limit.
- **Proof generation fails silently in the browser**: check the console — usually the `.wasm` or `.zkey` file is not being served by the dApp (missing from `public/circuits/`).
- **Contract call reverts with "Root is not known"**: the Groth16 proof was generated against a Merkle root that has since aged out of the on-chain ring buffer (100 most recent roots). Regenerate the proof and resubmit.

## 📊 Benchmarking data

The `benchmarking/results/` folder contains raw and processed data from the empirical evaluation reported in the journal paper and PhD thesis. **Only the data is committed** — benchmark scripts and ephemeral test wallets are kept local so that private keys and one-off tooling do not leak into the public repository.

### File naming

Filenames follow the pattern:
```
<prefix>[-<network|mode>][-<blocktime>]-<YYYY-MM-DDTHH-mm-ss-SSSZ>[-<suffix>].<ext>
```

Examples:
- `concurrent-arbitrumSepolia-2026-06-04T20-12-24-614Z.csv` — concurrent-throughput test on Arbitrum Sepolia
- `concurrent-privacy-12000ms-2026-05-30T14-10-48-598Z-summary.json` — privacy-enabled throughput at 12 s block times, aggregated summary
- `comparison-report-2026-03-29T16-06-03-423Z.txt` — human-readable privacy-vs-no-privacy comparison

### File types

| Extension | Content |
|---|---|
| `.csv` | Per-transaction timing, gas, and success indicators (spreadsheet-ready) |
| `-raw.json` | Every individual transaction receipt (largest files, one entry per tx) |
| `-summary.json` | Aggregated metrics per experiment (means, medians, tail percentiles) |
| `.txt` | Console-friendly reports (includes formatted privacy-vs-baseline tables) |
| `.md` | Narrative analysis with methodology and interpretation |

### Which files support which claims

| Paper / thesis claim | Files |
|---|---|
| Gas per operation (privacy vs no-privacy) | `comparison-report-*.txt`, `comparison-data-*.csv` |
| Full-cycle gas budget (9,094,803 gas) | `comparison-report-*.txt` |
| Cross-network cost (Sepolia, Arbitrum, Optimism) | `concurrent-<network>-*` files |
| Throughput and saturation per network | `concurrent-<network>-*-summary.json` and `-raw.json` |
| Concurrent makeOrder analysis (Hardhat vs Sepolia) | `concurrent-makeOrder-analysis.md` (methodology + interpretation) |

The scripts that produced these files are not part of the repository. To reproduce the numbers, please contact the corresponding author or refer to the methodology sections of the thesis and paper.

## 📚 Citation

If you use FoodChain in academic work, please cite the AMCIS paper:

```bibtex
@inproceedings{folha2022towards,
  title={Towards a Novel Business Process Model for Food Delivery Services Using Blockchain Technology},
  author={Folha, Rodrigo and Times, Val{\'e}ria Cesario and Carvalho, Arthur and Ara{\'u}jo, Andr{\'e} and Viana, Flaviano and Couto, Henrique},
  booktitle={AMCIS 2022 Proceedings},
  series={Americas Conference on Information Systems (AMCIS)},
  number={5},
  year={2022},
  publisher={Association for Information Systems},
  url={https://aisel.aisnet.org/amcis2022/sig_green/sig_green/5}
}
```

## 📝 License

MIT License. See [LICENSE](LICENSE) for details.

---

*Original template kindly forked from [João Vitor Oliveira](https://github.com/joaovitorzv/UberEats).*
