/**
 * Minimal L2 deployment for the concurrent throughput benchmark.
 *
 * Deploys the contract stack needed by benchmark-concurrent-l2.js
 * (Poseidon, MergeWithdrawVerifier, GlobalReputation, Util, Storage,
 * Chain with its Order implementation, StealthAnnouncer) on whichever network is passed via --network.
 *
 * Saves deployed addresses + deployment metadata (including deployBlock, the
 * GlobalReputation deployment block the benchmark rebuilds the note tree from) to:
 *   benchmarking/l2-deployments/<network>.json
 *
 * (or to $DEPLOY_OUT_DIR/<network>.json when DEPLOY_OUT_DIR is set)
 *
 * The file also holds the record that deploy_all.js writes (chain id, prices at the start, every
 * transaction with its hash, block, gas used and effective gas price), so that
 * scripts/verify_deployment.js can check it. Optional fee settings for every transaction:
 * MAX_FEE_GWEI, PRIORITY_FEE_GWEI (see scripts/deploy_common.js). No gas limit is ever set.
 *
 * Usage:
 *   npx hardhat run scripts/deploy_l2.js --network arbitrumSepolia
 *   npx hardhat run scripts/deploy_l2.js --network optimismSepolia
 */

const hre = require("hardhat");
const { poseidonContract } = require("circomlibjs");
const fs = require("fs");
const path = require("path");
const { startRecord } = require("./deploy_common");

async function main() {
  const network = hre.network.name;
  const [deployer] = await hre.ethers.getSigners();
  console.log(`\n── Deploying on ${network} ──`);
  console.log(`  Deployer: ${deployer.address}`);
  const bal = await hre.ethers.provider.getBalance(deployer.address);
  console.log(`  Balance:  ${hre.ethers.formatEther(bal)} ETH`);

  // The record is kept in memory and saved once, at the end, with the fields the benchmark reads
  const rec = await startRecord(hre, "privacy", deployer);
  const deployed = rec.data;
  deployed.gasUsed = {};

  async function deployAndRecord(name, factory, args = []) {
    process.stdout.write(`  ${name}... `);
    const { contract, address, receipt } = await rec.deploy(name, factory, args);
    deployed.gasUsed[name] = Number(receipt.gasUsed);
    console.log(`${address}  (gas ${receipt.gasUsed})`);
    return { contract, receipt };
  }

  // 1. Poseidon (from circomlibjs bytecode, deployed via raw factory)
  const poseidonABI = poseidonContract.generateABI(2);
  const poseidonBytecode = poseidonContract.createCode(2);
  await deployAndRecord("Poseidon", new hre.ethers.ContractFactory(poseidonABI, poseidonBytecode, deployer));

  // 2. MergeWithdrawVerifier (ratings are given in the clear: there is no rating verifier)
  await deployAndRecord("MergeWithdrawVerifier", await hre.ethers.getContractFactory("MergeWithdrawVerifier", deployer));

  // 3. GlobalReputation
  const { contract: reputation, receipt: rReceipt } = await deployAndRecord(
    "GlobalReputation", await hre.ethers.getContractFactory("GlobalReputation", deployer), [
      deployed.contracts.Poseidon,
      deployed.contracts.MergeWithdrawVerifier,
      1,  // denomination: kept for interface compatibility; pool withdrawals are not restricted to it
    ]);
  deployed.deployBlock = rReceipt.blockNumber; // the constructor inserts the dummy note here

  // 4. Util library
  await deployAndRecord("Util", await hre.ethers.getContractFactory("Util", deployer));

  // 5. Storage
  const { contract: storage } = await deployAndRecord("Storage", await hre.ethers.getContractFactory("Storage", deployer));

  // 6. Chain (linking Util). Its constructor takes the reputation and storage addresses and
  //    deploys the Order implementation, so the gas of Chain includes that deployment.
  const Chain = await hre.ethers.getContractFactory("Chain", {
    libraries: { "contracts/Order.sol:Util": deployed.contracts.Util },
    signer: deployer,
  });
  const { contract: chain } = await deployAndRecord("Chain", Chain, [deployed.contracts.GlobalReputation, deployed.contracts.Storage]);
  deployed.contracts.OrderImplementation = await chain.orderImplementation();
  console.log(`  Order implementation... ${deployed.contracts.OrderImplementation}  (deployed by Chain)`);

  // Link Reputation and Storage to Chain (one-time access-control setup)
  await rec.call("GlobalReputation.setChain", (fees) => reputation.setChain(deployed.contracts.Chain, fees));
  await rec.call("Storage.setChain", (fees) => storage.setChain(deployed.contracts.Chain, fees));
  console.log(`  Reputation and Storage linked to Chain`);

  // 7. StealthAnnouncer (the benchmark announces every stealth address)
  await deployAndRecord("StealthAnnouncer", await hre.ethers.getContractFactory("StealthAnnouncer", deployer));

  deployed.completedAt = new Date().toISOString();
  // The seven deployments, as before; totalGasUsed also counts the two setChain calls
  deployed.totalDeployGas = Object.values(deployed.gasUsed).reduce((a, b) => a + b, 0);

  // Save JSON
  // DEPLOY_OUT_DIR=<dir> saves the file elsewhere (e.g. for a local trial run)
  const outDir = process.env.DEPLOY_OUT_DIR
    ? path.resolve(process.env.DEPLOY_OUT_DIR)
    : path.join(__dirname, "..", "benchmarking", "l2-deployments");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, `${network}.json`);
  fs.writeFileSync(outPath, JSON.stringify(deployed, null, 2));
  console.log(`\n  Saved deployment to: ${outPath}`);
  console.log(`  Total deploy gas: ${deployed.totalDeployGas.toLocaleString()}`);

  const balAfter = await hre.ethers.provider.getBalance(deployer.address);
  const spent = bal - balAfter;
  console.log(`  ETH spent on deploy: ${hre.ethers.formatEther(spent)}`);
  console.log(`  Balance after:       ${hre.ethers.formatEther(balAfter)} ETH`);
}

main().catch((err) => { console.error(err); process.exit(1); });
