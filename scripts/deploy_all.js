/**
 * Deploy all FoodChain contracts in the correct order.
 *
 * Prerequisites:
 *   1. Circuit verifiers compiled: contracts/FeedbackVerifier.sol + contracts/MergeWithdrawVerifier.sol
 *   2. Ganache running on http://127.0.0.1:7545  (or update hardhat.config.js)
 *   3. Private key set in hardhat.config.js
 *
 * Run with:
 *   npx hardhat run scripts/deploy_all.js --network ganache
 */

const hre = require("hardhat");
const { poseidonContract } = require("circomlibjs");
const fs = require("fs");
const path = require("path");

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

function updateConfig(filePath, addresses, deployBlock) {
  let content = fs.readFileSync(filePath, "utf8");

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

  fs.writeFileSync(filePath, content, "utf8");
  console.log(`  Updated: ${filePath}`);
}

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying with account:", deployer.address);
  console.log("Balance:", hre.ethers.formatEther(await hre.ethers.provider.getBalance(deployer.address)), "ETH\n");

  // ── 1. Poseidon hasher ─────────────────────────────────────────────────────
  console.log("1/8  Deploying Poseidon hasher...");
  const poseidonABI = poseidonContract.generateABI(2);
  const poseidonBytecode = poseidonContract.createCode(2);
  const PoseidonFactory = new hre.ethers.ContractFactory(poseidonABI, poseidonBytecode, deployer);
  const poseidon = await PoseidonFactory.deploy();
  await poseidon.waitForDeployment();
  const POSEIDON = await poseidon.getAddress();
  console.log("     Poseidon:", POSEIDON);

  // ── 2. FeedbackVerifier ──────────────────────────────────────────────────
  console.log("2/8  Deploying FeedbackVerifier...");
  const FeedbackVerifier = await hre.ethers.getContractFactory("FeedbackVerifier");
  const feedbackVerifier = await FeedbackVerifier.deploy();
  await feedbackVerifier.waitForDeployment();
  const FEEDBACK_VERIFIER = await feedbackVerifier.getAddress();
  console.log("     FeedbackVerifier:", FEEDBACK_VERIFIER);

  // ── 3. MergeWithdrawVerifier ──────────────────────────────────────────────
  console.log("3/8  Deploying MergeWithdrawVerifier...");
  const MWVerifier = await hre.ethers.getContractFactory("MergeWithdrawVerifier");
  const mwVerifier = await MWVerifier.deploy();
  await mwVerifier.waitForDeployment();
  const MW_VERIFIER = await mwVerifier.getAddress();
  console.log("     MergeWithdrawVerifier:", MW_VERIFIER);

  // ── 4. GlobalReputation ────────────────────────────────────────────────────
  console.log("4/8  Deploying GlobalReputation (denomination:", hre.ethers.formatEther(DENOMINATION), "ETH)...");
  const Reputation = await hre.ethers.getContractFactory("GlobalReputation");
  const reputation = await Reputation.deploy(POSEIDON, FEEDBACK_VERIFIER, MW_VERIFIER, DENOMINATION);
  await reputation.waitForDeployment();
  const REPUTATION = await reputation.getAddress();
  console.log("     GlobalReputation:", REPUTATION);

  // ── 5. Util library ───────────────────────────────────────────────────────
  console.log("5/8  Deploying Util library...");
  const Util = await hre.ethers.getContractFactory("Util");
  const util = await Util.deploy();
  await util.waitForDeployment();
  const UTIL = await util.getAddress();
  console.log("     Util:", UTIL);

  // ── 6. Storage ─────────────────────────────────────────────────────────────
  console.log("6/8  Deploying Storage...");
  const Storage = await hre.ethers.getContractFactory("Storage");
  const storage = await Storage.deploy();
  await storage.waitForDeployment();
  const STORAGE = await storage.getAddress();
  console.log("     Storage:", STORAGE);

  // ── 7. Chain (linked with Util) ────────────────────────────────────────────
  console.log("7/8  Deploying Chain...");
  const Chain = await hre.ethers.getContractFactory("Chain", {
    libraries: { "contracts/Order.sol:Util": UTIL }
  });
  const chain = await Chain.deploy();
  await chain.waitForDeployment();
  const CHAIN = await chain.getAddress();
  console.log("     Chain:", CHAIN);

  // ── 8. StealthAnnouncer ────────────────────────────────────────────────────
  console.log("8/8  Deploying StealthAnnouncer...");
  const StealthAnnouncer = await hre.ethers.getContractFactory("StealthAnnouncer");
  const stealth = await StealthAnnouncer.deploy();
  await stealth.waitForDeployment();
  const STEALTH = await stealth.getAddress();
  console.log("     StealthAnnouncer:", STEALTH);

  // ── Summary ────────────────────────────────────────────────────────────────
  console.log("\n========== DEPLOYMENT COMPLETE ==========");
  console.log("Poseidon:              ", POSEIDON);
  console.log("FeedbackVerifier:      ", FEEDBACK_VERIFIER);
  console.log("MergeWithdrawVerifier: ", MW_VERIFIER);
  console.log("GlobalReputation:      ", REPUTATION);
  console.log("Util:                  ", UTIL);
  console.log("Storage:               ", STORAGE);
  console.log("Chain:                 ", CHAIN);
  console.log("StealthAnnouncer:      ", STEALTH);
  console.log("Denomination:          ", hre.ethers.formatEther(DENOMINATION), "ETH");

  // ── Auto-update all three config.js files ─────────────────────────────────
  console.log("\nUpdating config.js files...");
  const deployBlock = await hre.ethers.provider.getBlockNumber();
  const addresses = { chain: CHAIN, reputation: REPUTATION, storage: STORAGE, stealth: STEALTH };
  for (const cfg of CONFIG_FILES) {
    const abs = path.join(__dirname, "..", cfg);
    if (fs.existsSync(abs)) {
      updateConfig(abs, addresses, deployBlock);
    } else {
      console.warn("  Not found (skipped):", cfg);
    }
  }
  console.log("     Deploy block:", deployBlock);
  console.log("\nDone! Restart your frontend dev servers to pick up the new addresses.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
