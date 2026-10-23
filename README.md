# FoodChain

**A blockchain-based, privacy-preserving delivery system for time-sensitive products.**

FoodChain replaces the centralized delivery platform with a set of smart contracts and three dApps (one per actor: customer, delivery worker, and restaurant/manager). On a public blockchain, the privacy of the actors rests on four mechanisms: stealth addresses, a zero-knowledge payment pool, authenticated encryption and a two-phase information revelation. The ratings of the delivery workers are public.

## 🚀 Try the live deployment

The contracts are deployed on the **Ethereum Hoodi** test network (chain ID 560048); the three dApps run locally and connect to them through MetaMask.

Steps to try it:

1. Install [MetaMask](https://metamask.io/) in your browser
2. Switch MetaMask to the **Hoodi** network (if it is not listed, add it with network name `Hoodi`, chain ID `560048`, RPC URL `https://ethereum-hoodi-rpc.publicnode.com` and currency `ETH`)
3. Get free Hoodi ETH from a faucet (e.g., <https://hoodi-faucet.pk910.de/>)
4. Start the API and the three dApps as described in *Local setup* below, and open them at <http://localhost:3000> (customer), <http://localhost:3001> (delivery worker) and <http://localhost:3002> (restaurant / manager)

A walkthrough of the 2022 version is on YouTube: <https://youtu.be/4WHCuIu5T-o>

### Contracts on Hoodi (deployed 2026-10-17, deploy block 3835137)

| Contract | Address |
|---|---|
| Chain (entry point of the order lifecycle) | `0x21F713C3388f4b3A395c1cAB2d8ffa2D5011DEC2` |
| GlobalReputation (ZK payment pool, public ratings) | `0xa41Ed474Aad9Bc16e21b73b69BDF7e9f1e02E919` |
| Storage (workers' keys; encrypted delivery data as events) | `0x9E4f155f0D2aD5F532c0F1E60DB60B85ceF40e03` |
| StealthAnnouncer (stealth-address announcements) | `0xA96bB7125A6E345b11F9044652C974acb1F075D3` |
| Poseidon (hash of the note tree) | `0x524d8412063C4821bAE70559d7eeD74cb68c3349` |
| MergeWithdrawVerifier (pool withdrawals) | `0x9746bD16266810aDfb9238999B2a11e22E51c73f` |
| Util (library: cancellations and payouts) | `0x5530C36a037BE7cBf123d5b9C031A87C77215f38` |
| Order implementation (code of every order) | `0xCf50DF00Dd5696E583D81f89a4Ee78192D5aD0f9` |

The dApps use these contracts. The folder [`deployments/`](deployments/) keeps the records of the deployments, with their transactions; `hoodi-2026-10-13/` is the Hoodi deployment of the paper's measurements.

## 📄 Publications

- Folha, R.; Times, V.C.; Carvalho, A.; Araújo, A.; Couto, H.; Viana, F. **FoodChain: A food delivery platform based on blockchain for keeping data privacy** (2022). *International Conference on Database Systems for Advanced Applications (DASFAA) Proceedings*, pp. 500–504. [Springer link](https://link.springer.com/chapter/10.1007/978-3-031-00129-1_43)
- Folha, R.; Times, V.C.; Carvalho, A.; Araújo, A.; Viana, F.; Couto, H. **Towards a Novel Business Process Model for Food Delivery Services Using Blockchain Technology** (2022). *AMCIS 2022 Proceedings*, 5. [AISeL link](https://aisel.aisnet.org/amcis2022/sig_green/sig_green/5/)

## 🏗 Repository layout

```
├── contracts/               # Solidity smart contracts (Hardhat, solc 0.8.20)
│   ├── Chain.sol            # Orchestrator: entry points for the order lifecycle
│   ├── Order.sol            # Per-order state machine + escrow (orders are EIP-1167 proxies)
│   ├── Reputation.sol       # GlobalReputation: note tree of the ZK payment pool + public ratings
│   ├── Storage.sol          # Workers' encryption keys + encrypted delivery data (as events)
│   ├── StealthAnnouncer.sol # Stealth-address announcements
│   ├── MergeWithdrawVerifier.sol  # Auto-generated Groth16 verifier (pool)
│   └── contracts_no_privacy/      # No-privacy baseline of the benchmarks
│                            # (the Poseidon hasher is deployed from circomlibjs bytecode)
├── circuits/                # Circom 2.0 circuit of the pool withdrawals (Groth16 via snarkjs 0.7.6)
├── customer-frontend/       # React dApp, port 3000
├── deliveryman-frontend/    # React dApp, port 3001
├── manager-frontend/        # React dApp, port 3002
├── api/                     # Express + Sequelize + PostgreSQL, port 3333
├── scripts/                 # Hardhat deployment scripts and checks
├── deployments/             # Records of the deployments
├── data/                    # Systematic-mapping classification
└── benchmarking/results/    # Measurement data
```

## 🔐 Privacy mechanisms

FoodChain combines **four cryptographic layers** on a public blockchain. Each layer closes a specific on-chain leak.

| Layer | Mechanism | What it hides |
|---|---|---|
| 1 | **Stealth addresses** (EIP-5564 style, secp256k1 ECDH) | The identity of the order recipient: every order goes to a one-time address unlinkable to the establishment |
| 2 | **Zero-knowledge payment pool** (Groth16 over one incremental Merkle tree of depth 25, shared by all establishments) | The establishment's main wallet: the pool funds each one-time address and takes in the establishment's payouts as notes, which the manager dApp pays out to the main wallet in fixed amounts |
| 3 | **Authenticated encryption** (x25519-xsalsa20-poly1305 and xsalsa20-poly1305) | The order content (item list, delivery address): readable only by the actor who needs it |
| 4 | **Two-phase information revelation** | The pickup address until the delivery worker commits to the order, and the delivery details until the pickup is recorded on-chain |

The ratings of the delivery workers are public: the customer and the establishment give them in the clear, and each rating names the order it refers to.

## 🛠 Prerequisites

- **Node.js** 20, 22 or 24 (recommended: [nvm](https://github.com/nvm-sh/nvm))
- **Yarn** (used by all three frontends and the API)
- **Docker** (used to run PostgreSQL locally)
- **MetaMask** browser extension
- **Circom** 2 (only if you plan to modify the ZK circuit; the repository's circuit files were built with 2.2.3; [installation guide](https://docs.circom.io/getting-started/installation/))

## 🚀 Local setup

### 1. Clone and install root dependencies

```sh
git clone https://github.com/rodrigofolha/foodchain.git
cd foodchain
npm install   # installs Hardhat, snarkjs, circomlib, and dev tooling
```

### 2. Configure environment variables

Both `.env` files are gitignored, so you must create them locally. The root `.env` is needed only to deploy contracts to a public network.

**Root `.env`** (read by `hardhat.hoodi.config.js`):

```env
HOODI_RPC_URL=<URL of a Hoodi RPC endpoint>
PRIVATE_KEY=<private key of a test-only deploy account>
```

For the testnets, `hardhat.config.js` reads the RPC URL from a variable named after the network (`SEPOLIA_RPC_URL`, `ARBITRUM_SEPOLIA_RPC_URL`, `OPTIMISM_SEPOLIA_RPC_URL`), with the same `PRIVATE_KEY`. Never reuse a mainnet key.

**`api/.env`** (read by the API and by the PostgreSQL container of `docker-compose.yml`):

```env
DB_USER=<postgres user>
DB_PASS=<postgres password>
DB_NAME=<postgres database>
DB_HOST=localhost
DB_DIALECT=postgres
SECRET_KEY=<random string that signs the manager's session tokens>
```

For the docker-compose container, also set `POSTGRES_USER`, `POSTGRES_PASSWORD` and `POSTGRES_DB` to the values of `DB_USER`, `DB_PASS` and `DB_NAME`.

### 3. Start PostgreSQL

Use docker-compose (recommended):

```sh
docker network create chain   # once: docker-compose.yml uses this external network
docker-compose up -d          # postgres:latest as container chain_db, data in /mnt/volumes/chain_db/postgres
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
cd deliveryman-frontend && yarn install && PORT=3001 yarn start

# Restaurant / manager  (port 3002)
cd manager-frontend && yarn install && PORT=3002 yarn start
```

The start scripts use POSIX shell syntax (on Windows, use WSL). The dApps use the contracts deployed on Hoodi. Their `src/` folders give the API address as `https://api.arthurcarvalho.info/food`; to use the API started in step 4, replace it with `http://localhost:3333` in all three. If you want to deploy your own copy, see the next section.

## 🔧 Deploying your own contracts

Only needed if you want to run against your own deployment (rather than the shared Hoodi one).

```sh
# 1. Compile the Solidity contracts
npx hardhat compile

# 2. Deploy to Hoodi (the network is defined in hardhat.hoodi.config.js)
npx hardhat --config hardhat.hoodi.config.js run scripts/deploy_all.js --network hoodi

# 3. Optional: check the deployment against its record (read-only)
DEPLOYMENT=deployments/hoodi.json npx hardhat --config hardhat.hoodi.config.js run scripts/verify_deployment.js --network hoodi
```

`deploy_all.js` deploys in order Poseidon → MergeWithdrawVerifier → GlobalReputation → Util → Storage → Chain (whose constructor deploys the Order implementation). It links GlobalReputation and Storage to Chain, deploys StealthAnnouncer, then **automatically updates** `config.js` in all three frontends with the new addresses, ABIs, and `DEPLOY_BLOCK`. It writes the record of the deployment, with every transaction, to `deployments/<network>.json`; with `CONFIG_OUT_DIR=<folder>`, the record and the config files go to that folder and the dApps are left untouched. For another network, also set `CONFIG_RPC_URL=<keyless read endpoint>` (otherwise the dApps keep the Hoodi endpoint), since the URL is written into the committed `config.js` files. Also add the network's chain ID to the three `src/services/getWeb3.js`, which accept only Hoodi and local chain IDs.

## 🔬 Regenerating the ZK circuit

Only needed if you modify `circuits/mergeWithdraw.circom`, the circuit of the pool withdrawals. It includes circomlib from `node_modules/`, so run `npm install` first.

```sh
circom circuits/mergeWithdraw.circom --r1cs --wasm --sym -o circuits/

# Groth16 phase-2 trusted setup (30,790 constraints: needs the 2^15 powers of tau)
npx snarkjs groth16 setup circuits/mergeWithdraw.r1cs circuits/pot15_final.ptau circuits/mergeWithdraw_0000.zkey

# Contribute randomness to the ceremony
npx snarkjs zkey contribute circuits/mergeWithdraw_0000.zkey circuits/mergeWithdraw_0001.zkey \
  --name="FoodChain Phase 2" -e="$(head -c 64 /dev/urandom | xxd -p -c 128)"

# Export the Solidity verifier (snarkjs names the contract Groth16Verifier,
# rename it to MergeWithdrawVerifier in the generated file)
npx snarkjs zkey export solidityverifier circuits/mergeWithdraw_0001.zkey contracts/MergeWithdrawVerifier.sol

# Copy the circuit artifacts to the manager dApp, the only one that generates proofs
cp circuits/mergeWithdraw_js/mergeWithdraw.wasm  manager-frontend/public/circuits/
cp circuits/mergeWithdraw_0001.zkey              manager-frontend/public/circuits/
```

> **Note:** `MergeWithdrawVerifier.sol` is auto-generated by snarkjs: do NOT edit it manually, apart from the contract name. After regenerating, run `npx hardhat compile` and deploy all contracts again, since GlobalReputation receives the verifier's address in its constructor.

## 💡 Running the order lifecycle end-to-end

With the three dApps open and connected to Hoodi, each with its own MetaMask account:

1. **Manager dApp** (port 3002): sign up with e-mail and password, log in, set up the menu and its items, and deposit Hoodi ETH into the privacy pool. At sign-up, "Connect MetaMask" registers the account's encryption public key and the spending and viewing public keys that the browser generates for stealth addresses, not the account's address. This is the only role that requires authentication.
2. **Customer dApp** (port 3000): choose a restaurant and items and press "Place order". MetaMask asks for the encryption public key, then for two transactions: the stealth-address announcement and `makeOrder`, which holds the payment in escrow and names a fresh stealth address as the establishment.
3. **Manager dApp**: "Accept order" (optionally with a minimum rating and number of deliveries) withdraws the collateral and the gas from the pool to the order's stealth address, with a proof generated in the browser; that address then sends `prepareOrder`.
4. **Delivery worker dApp** (port 3001): connect MetaMask and browse the accepted orders (zone, delivery fee, order value and required reputation, without the restaurant identity). "Accept delivery" sends `confirmIntention`, which publishes the worker's encryption public key on-chain.
5. **Customer**: sends the delivery address ("Send my address") from the browser that placed the order. The worker can read only the restaurant's identity; the address and the items are sealed with the pickup key.
6. **Delivery worker**: goes to the restaurant and shows the signed pickup confirmation as a QR code. The **establishment** scans it, submits it via `pickupOrder` and shows the pickup key, which the worker scans to open the delivery address and the items.
7. **Customer**: on arrival, shows the signed delivery confirmation as a QR code.
8. **Delivery worker**: scans it and submits it via `deliveryOrder`. The smart contract pays the fee to the worker and puts the establishment's revenue, with its collateral, into the ZK pool as one note.
9. **Customer and establishment**: each rates the worker once, from 1 to 5, via `rateOrder`. The ratings are public.
10. **Manager dApp**: once five revenue notes have arrived, "Cash out" sends the revenue to the main wallet in withdrawals of exactly 10 USD (0.01 ETH), each with a proof generated in the browser. The remainder stays in the pool.

Each dApp also offers its actor's cancellations; the establishment can also call a second delivery worker once and contest a dispatched order.

## 🐛 Troubleshooting

- **"Wrong network" alert**: the dApps accept only Hoodi (560048) and local chains (1337, 5777, 31337). Switch MetaMask to Hoodi and reload the page.
- **Event queries fail**: the dApps read events from `DEPLOY_BLOCK` (set by `deploy_all.js`) through the Hoodi endpoint in `src/services/config.js` (exported as `SEPOLIA_RPC_URL`). If that endpoint limits `eth_getLogs`, set a keyless endpoint there (the file is committed and ships in the bundle); after a manual deployment, update `DEPLOY_BLOCK`.
- **Proof generation fails in the manager dApp**: it fetches `circuits/mergeWithdraw.wasm` and `circuits/mergeWithdraw_0001.zkey` from the folder it is served from (in a build, its own `circuits/` folder). Check that both files are served there.
- **"The rebuilt note tree does not match the contract"** (or a revert with "Root is not known"): MetaMask's node and the read endpoint were out of step when the dApp rebuilt the note tree. Wait a moment and try again.
- **Orders or pool balance missing in the manager dApp**: the establishment's stealth keys and note secrets live only in the local storage of the browser and origin that created them; the dApps offer no export.

## 📊 Benchmarking data

The [`benchmarking/results/`](benchmarking/results/README.md) folder contains raw and processed data from the empirical evaluation reported in the journal paper and PhD thesis. **Only the data is committed**: benchmark scripts and ephemeral test wallets are kept local.

The classification of the 53 systematic-mapping studies is in [`data/systematic-mapping/`](data/systematic-mapping/README.md).

### File naming

Run outputs carry a UTC time stamp; reports and folders of runs carry a date.

```
<kind>[-<variant>]-<YYYY-MM-DDTHH-mm-ss-SSSZ>[-<suffix>].<ext>   # run outputs
<topic>-<YYYY-MM-DD>.md (+ .json)                               # reports
<network|experiment>-<YYYY-MM-DD>/                              # folders of runs
```

Examples:
- `hardhat-report-10it-2026-10-12T22-42-50-080Z.txt`: gas of ten order cycles on a local Hardhat node, privacy vs no-privacy
- `hoodi-2026-10-13/comparison-report-2026-10-13T10-35-42-017Z.txt`: the same comparison on Hoodi

### File types

| Extension | Content |
|---|---|
| `.csv` | Per-transaction timing, gas, and success indicators (spreadsheet-ready) |
| `-raw.json` | Every individual transaction (largest files, one entry per tx) |
| `-summary.json` | Aggregated metrics per experiment (means, medians, tail percentiles) |
| `.json`, `.json.gz`, `.jsonl.gz` | Run and deployment records, machine-readable copies of the reports, compressed data |
| `.txt` | Console-friendly reports (includes formatted privacy-vs-baseline tables) |
| `.md` | Narrative analysis with methodology and interpretation |
| `.log` | Console output of the runs on public test networks |

### Which files support which claims

| Paper / thesis claim | Files |
|---|---|
| Gas per call and per order cycle, privacy vs no-privacy (local Hardhat node, main network's gas schedule) | `local-gas-final-2026-10-12.{md,json}`, `hardhat-*-10it-*2026-10-12T22-4*` |
| Full-cycle gas (4,833,322 gas, 5.4 times the no-privacy contracts) | `local-gas-final-2026-10-12.md` |
| Insertion gas and proving time by depth of the note tree; constraints and proving time of the withdrawal circuit | `gas-study-candidate-v2-2026-10-12.{md,json}`, `circuit-2026-10-14.md` |
| Off-chain times (proofs, encryption, stealth derivation) | `local-gas-final-2026-10-12.md` (section 12), `hardhat-*-10it-*2026-10-12T19-4*`, `circuit-2026-10-14.md` |
| Gas and pool cash-out on Hoodi | `hoodi-final-2026-10-13.{md,json}`, `hoodi-2026-10-13/`, `deployment-hoodi-*2026-10-13.json` |
| Cost across networks (Arbitrum Sepolia, OP Sepolia, Avalanche Fuji) | `cost-networks-2026-10-14.{md,json}`, `{arbitrumSepolia,optimismSepolia,fuji}-2026-10-14/` |
| Throughput and saturation | `throughput-final-2026-10-13.{md,json}`, `concurrent-hardhat-*-final*-2026-10-13T0*`, `throughput-512-2026-10-19/`, `hoodi-2026-10-13/concurrent-hoodi-*` |
| Privacy against an observer, by mechanism and cash-out policy | `privacy-eval-final-2026-10-12{.md,.json,-decisions.json.gz}` |
| Cash-out with larger denominations | `denominations-scaled-2026-10-17.{md,json}`, `denominations-scaled-2026-10-17/`, `denominations-2026-10-17.{md,json}`, `denominations-2026-10-17/` |
| Order total against public menus | `menu-fingerprint-2026-10-11.*`, `menu-integer-prices-2026-10-12.*` (menus: Kilic and Taşkaya Temizel, Zenodo, [10.5281/zenodo.10554680](https://doi.org/10.5281/zenodo.10554680), CC BY 4.0) |

The other files are earlier runs or side studies. The scripts that produced these files are not part of the repository; each final report states how its runs were made. To reproduce the numbers, please contact the corresponding author or refer to the methodology sections of the thesis and paper.

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
