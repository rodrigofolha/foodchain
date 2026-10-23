/**
 * Deploy all FoodChain contracts in the correct order:
 *   Poseidon hasher, MergeWithdrawVerifier, GlobalReputation, Util, Storage,
 *   Chain (which deploys the Order implementation every order is a proxy of), StealthAnnouncer.
 *
 * Prerequisites:
 *   1. Circuit verifier compiled: contracts/MergeWithdrawVerifier.sol
 *   2. A node for the chosen network (e.g. "npx hardhat node" on http://127.0.0.1:8545)
 *   3. PRIVATE_KEY and the network's RPC URL in the root .env (see README)
 *
 * Run with:
 *   npx hardhat run scripts/deploy_all.js --network localhost
 *
 * By default the script rewrites src/services/config.js in the three dApps (addresses, ABIs,
 * DEPLOY_BLOCK). Environment variables:
 *   CONFIG_OUT_DIR=<dir>   write the generated config files to
 *                          <dir>/<dapp>/src/services/config.js and the record of the deployment
 *                          to <dir>/deployment.json, and leave the dApps' own files untouched
 *   CONFIG_RPC_URL=<url>   also set SEPOLIA_RPC_URL (the dApps' read-only endpoint) in the
 *                          generated files, e.g. http://127.0.0.1:8545 for a local node
 *   SKIP_CONFIG=1          write no config file at all (the record is still written)
 *   CONFIG_ABIS_ONLY=1     deploy nothing: only refresh the ABIs in the config files from the
 *                          compiled artifacts (addresses and DEPLOY_BLOCK are kept)
 *   MAX_FEE_GWEI=<n>       fee settings for every transaction, both optional
 *   PRIORITY_FEE_GWEI=<n>  (see scripts/deploy_common.js). No gas limit is ever set: each
 *                          transaction goes out with the node's own estimate.
 * On the in-process network (no --network) nothing outlives the run, so the dApps' files are
 * never rewritten there: set CONFIG_OUT_DIR to get the generated files.
 *
 * The record of the deployment (network, chain id, deployer, prices at the start, every
 * transaction with its hash, block, gas used and effective gas price, every address, the deploy
 * block) is written to deployments/<network>.json, or to <CONFIG_OUT_DIR>/deployment.json.
 * scripts/verify_deployment.js checks a deployment from it without sending anything.
 */

const hre = require("hardhat");
const { poseidonContract } = require("circomlibjs");
const fs = require("fs");
const path = require("path");
const { startRecord, recordPath } = require("./deploy_common");

const CONFIG_FILES = [
  "customer-frontend/src/services/config.js",
  "manager-frontend/src/services/config.js",
  "deliveryman-frontend/src/services/config.js",
];

// Default denomination: 0.001 ETH (configurable via env)
const DENOMINATION = process.env.DENOMINATION || hre.ethers.parseEther("0.001").toString();

function loadABI(contractName, solFile) {
  const artifactPath = path.join(__dirname, `../artifacts/contracts/${solFile}/${contractName}.json`);
  return JSON.stringify(JSON.parse(fs.readFileSync(artifactPath, "utf8")).abi);
}

// Line kept in the dApps' config.js while its addresses are older than its ABIs
// (written by hand or by CONFIG_ABIS_ONLY; removed here when new addresses are written)
const STALE_ADDRESSES_NOTE = /^\/\/ NOTE: the addresses and DEPLOY_BLOCK[^\n]*\n/m;

// Reads the dApp's config.js at `filePath` and writes it to `outPath` with the given addresses
// and deploy block (both optional: without `addresses` only the ABIs are refreshed).
function updateConfig(filePath, addresses, deployBlock, outPath = filePath, rpcUrl) {
  let content = fs.readFileSync(filePath, "utf8");

  if (addresses) {
    content = content.replace(STALE_ADDRESSES_NOTE, "");

    // Update addresses
    content = content.replace(
      /export const CHAIN_ADDRESS\s*=\s*'[^']*'/,
      `export const CHAIN_ADDRESS = '${addresses.chain}'`
    );
    content = content.replace(
      /export const REPUTATION_ADDRESS\s*=\s*'[^']*'/,
      `export const REPUTATION_ADDRESS = '${addresses.reputation}'`
    );
    content = content.replace(
      /export const STORAGE_ADDRESS\s*=\s*'[^']*'/,
      `export const STORAGE_ADDRESS = '${addresses.storage}'`
    );

    // Stealth announcer address
    if (/export const STEALTH_ADDRESS\s*=/.test(content)) {
      content = content.replace(
        /export const STEALTH_ADDRESS\s*=\s*'[^']*'/,
        `export const STEALTH_ADDRESS = '${addresses.stealth}'`
      );
    } else {
      // Append new exports before the first newline after the last export
      content += `\nexport const STEALTH_ADDRESS = '${addresses.stealth}';\n`;
    }
  }

  if (rpcUrl) {
    content = content.replace(
      /export const SEPOLIA_RPC_URL\s*=\s*'[^']*'/,
      `export const SEPOLIA_RPC_URL = '${rpcUrl}'`
    );
  }

  if (deployBlock !== undefined) {
    if (/export const DEPLOY_BLOCK\s*=/.test(content)) {
      content = content.replace(
        /export const DEPLOY_BLOCK\s*=\s*\d+/,
        `export const DEPLOY_BLOCK = ${deployBlock}`
      );
    } else {
      content = `export const DEPLOY_BLOCK = ${deployBlock};\n` + content;
    }
  }

  // Update ABIs from freshly compiled artifacts using bracket-counting (regex is unsafe for nested arrays)
  const chainABI      = loadABI("Chain",              "Chain.sol");
  const repABI        = loadABI("GlobalReputation",    "Reputation.sol");
  const storageABI    = loadABI("Storage",             "Storage.sol");
  const stealthABI    = loadABI("StealthAnnouncer",    "StealthAnnouncer.sol");

  function replaceABI(src, exportName, newABI) {
    const marker = `export const ${exportName} =`;
    const idx = src.indexOf(marker);
    if (idx === -1) {
      // Append if not found
      return src + `\n${marker} ${newABI};\n`;
    }
    const arrayStart = src.indexOf('[', idx);
    let depth = 0, arrayEnd = -1;
    for (let i = arrayStart; i < src.length; i++) {
      if (src[i] === '[') depth++;
      if (src[i] === ']') { depth--; if (depth === 0) { arrayEnd = i; break; } }
    }
    // Replace from marker to end of array + optional semicolon
    let end = arrayEnd + 1;
    if (src[end] === ';') end++;
    return src.slice(0, idx) + `${marker} ${newABI};` + src.slice(end);
  }

  content = replaceABI(content, "CHAIN_ABI", chainABI);
  content = replaceABI(content, "REPUTATION_ABI", repABI);
  content = replaceABI(content, "STORAGE_ABI", storageABI);
  content = replaceABI(content, "STEALTH_ABI", stealthABI);

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, content, "utf8");
  console.log(`  ${outPath === filePath ? "Updated" : "Written"}: ${outPath}`);
}

// Writes the config files: into the dApps, or under CONFIG_OUT_DIR when it is set.
// Returns false when nothing was written.
function writeConfigs(addresses, deployBlock) {
  const outDir = process.env.CONFIG_OUT_DIR ? path.resolve(process.env.CONFIG_OUT_DIR) : null;
  if (process.env.SKIP_CONFIG === "1") {
    console.log("\nSKIP_CONFIG=1: no config.js written.");
    return false;
  }
  if (addresses && !outDir && hre.network.name === "hardhat") {
    console.log("\nIn-process network: the dApps' config.js files are left untouched (set CONFIG_OUT_DIR to get the generated files).");
    return false;
  }
  console.log(outDir ? `\nWriting config.js files to ${outDir} (the dApps' own files are not touched)...` : "\nUpdating config.js files...");
  for (const cfg of CONFIG_FILES) {
    const abs = path.join(__dirname, "..", cfg);
    if (fs.existsSync(abs)) {
      updateConfig(abs, addresses, deployBlock, outDir ? path.join(outDir, cfg) : abs, process.env.CONFIG_RPC_URL);
    } else {
      console.warn("  Not found (skipped):", cfg);
    }
  }
  return true;
}

async function main() {
  if (process.env.CONFIG_ABIS_ONLY === "1") {
    writeConfigs(null, undefined);
    console.log("ABIs refreshed; addresses and DEPLOY_BLOCK kept. Nothing was deployed.");
    return null;
  }

  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying with account:", deployer.address);
  console.log("Balance:", hre.ethers.formatEther(await hre.ethers.provider.getBalance(deployer.address)), "ETH\n");
  const rec = await startRecord(hre, "privacy", deployer, recordPath(hre, "deployment.json"));
  rec.data.denomination = DENOMINATION.toString();

  // ── 1. Poseidon hasher ─────────────────────────────────────────────────────
  console.log("1/7  Deploying Poseidon hasher...");
  const poseidonABI = poseidonContract.generateABI(2);
  const poseidonBytecode = poseidonContract.createCode(2);
  const PoseidonFactory = new hre.ethers.ContractFactory(poseidonABI, poseidonBytecode, deployer);
  const POSEIDON = (await rec.deploy("Poseidon", PoseidonFactory)).address;
  console.log("     Poseidon:", POSEIDON);

  // ── 2. MergeWithdrawVerifier ──────────────────────────────────────────────
  // (Ratings are given in the clear through the order: there is no rating verifier.)
  console.log("2/7  Deploying MergeWithdrawVerifier...");
  const MWVerifier = await hre.ethers.getContractFactory("MergeWithdrawVerifier");
  const MW_VERIFIER = (await rec.deploy("MergeWithdrawVerifier", MWVerifier)).address;
  console.log("     MergeWithdrawVerifier:", MW_VERIFIER);

  // ── 3. GlobalReputation ────────────────────────────────────────────────────
  // Its constructor checks its zero-hash table against the hasher and inserts the dummy note.
  console.log("3/7  Deploying GlobalReputation (denomination:", hre.ethers.formatEther(DENOMINATION), "ETH)...");
  const Reputation = await hre.ethers.getContractFactory("GlobalReputation");
  const { contract: reputation, address: REPUTATION } = await rec.deploy("GlobalReputation", Reputation, [POSEIDON, MW_VERIFIER, DENOMINATION]);
  console.log("     GlobalReputation:", REPUTATION);

  // ── 4. Util library ───────────────────────────────────────────────────────
  console.log("4/7  Deploying Util library...");
  const Util = await hre.ethers.getContractFactory("Util");
  const UTIL = (await rec.deploy("Util", Util)).address;
  console.log("     Util:", UTIL);

  // ── 5. Storage ─────────────────────────────────────────────────────────────
  console.log("5/7  Deploying Storage...");
  const Storage = await hre.ethers.getContractFactory("Storage");
  const { contract: storage, address: STORAGE } = await rec.deploy("Storage", Storage);
  console.log("     Storage:", STORAGE);

  // ── 6. Chain (linked with Util) ────────────────────────────────────────────
  // Chain keeps the reputation and storage addresses fixed. Its constructor deploys the
  // Order implementation (the code of every order), which is why Chain needs the Util link.
  console.log("6/7  Deploying Chain...");
  const Chain = await hre.ethers.getContractFactory("Chain", {
    libraries: { "contracts/Order.sol:Util": UTIL }
  });
  const { contract: chain, address: CHAIN } = await rec.deploy("Chain", Chain, [REPUTATION, STORAGE]);
  // A public endpoint may answer a call against a backend that has not yet applied the
  // deployment's block (seen on OP Sepolia on 2026-10-14: an empty result right after the
  // receipt). Read again a few times before giving up.
  let ORDER_IMPLEMENTATION = null;
  for (let attempt = 1; attempt <= 15; attempt++) {
    try { ORDER_IMPLEMENTATION = await chain.orderImplementation(); break; }
    catch (e) {
      if (attempt === 15 || !/could not decode result data|BAD_DATA/.test(String(e.message || e))) throw e;
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
  rec.data.contracts.OrderImplementation = ORDER_IMPLEMENTATION;
  console.log("     Chain:", CHAIN);
  console.log("     Order implementation:", ORDER_IMPLEMENTATION);

  // Link Reputation and Storage to Chain (one-time). Only orders created by
  // Chain can report to Reputation, and only Chain/customers can write Storage.
  await rec.call("GlobalReputation.setChain", (fees) => reputation.setChain(CHAIN, fees));
  await rec.call("Storage.setChain", (fees) => storage.setChain(CHAIN, fees));
  console.log("   Reputation and Storage linked to Chain");

  // ── 7. StealthAnnouncer ────────────────────────────────────────────────────
  console.log("7/7  Deploying StealthAnnouncer...");
  const StealthAnnouncer = await hre.ethers.getContractFactory("StealthAnnouncer");
  const STEALTH = (await rec.deploy("StealthAnnouncer", StealthAnnouncer)).address;
  console.log("     StealthAnnouncer:", STEALTH);

  // ── Summary ────────────────────────────────────────────────────────────────
  console.log("\n========== DEPLOYMENT COMPLETE ==========");
  console.log("Poseidon:              ", POSEIDON);
  console.log("MergeWithdrawVerifier: ", MW_VERIFIER);
  console.log("GlobalReputation:      ", REPUTATION);
  console.log("Util:                  ", UTIL);
  console.log("Storage:               ", STORAGE);
  console.log("Chain:                 ", CHAIN);
  console.log("Order implementation:  ", ORDER_IMPLEMENTATION);
  console.log("StealthAnnouncer:      ", STEALTH);
  console.log("Denomination:          ", hre.ethers.formatEther(DENOMINATION), "ETH");
  console.log("Gas used:              ", rec.data.totalGasUsed.toLocaleString("en-US"), `in ${rec.data.transactions.length} transactions`);
  console.log("Fees paid:             ", hre.ethers.formatEther(rec.data.totalFeeWei), "ETH");

  // ── Auto-update all three config.js files ─────────────────────────────────
  const deployBlock = await hre.ethers.provider.getBlockNumber();
  const addresses = { chain: CHAIN, reputation: REPUTATION, storage: STORAGE, stealth: STEALTH };
  // The record is complete before the config files are touched
  const deployment = rec.finish(deployBlock);
  if (rec.file) console.log(`\nRecord of the deployment written: ${rec.file}`);
  const written = writeConfigs(addresses, deployBlock);
  console.log("     Deploy block:", deployBlock);
  if (written && !process.env.CONFIG_OUT_DIR) {
    console.log("\nDone! Restart your frontend dev servers to pick up the new addresses.");
  } else {
    console.log("\nDone!");
  }
  return deployment;
}

// Run directly ("npx hardhat run scripts/deploy_all.js"), or required by another script
// (scripts/check_deployment.js) that calls main() itself.
if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { main };
