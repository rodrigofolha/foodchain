/**
 * Minimal L2 deployment for the concurrent-makeOrder benchmark.
 *
 * Deploys the contract stack needed by benchmark-concurrent-l2.js
 * (Poseidon, FeedbackVerifier, MergeWithdrawVerifier, GlobalReputation,
 * Util, Chain) on whichever network is passed via --network.
 *
 * Saves deployed addresses + deployment metadata to:
 *   benchmarking/l2-deployments/<network>.json
 *
 * Usage:
 *   npx hardhat run scripts/deploy_l2.js --network arbitrumSepolia
 *   npx hardhat run scripts/deploy_l2.js --network optimismSepolia
 */

const hre = require("hardhat");
const { poseidonContract } = require("circomlibjs");
const fs = require("fs");
const path = require("path");

async function main() {
  const network = hre.network.name;
  const [deployer] = await hre.ethers.getSigners();
  console.log(`\n── Deploying on ${network} ──`);
  console.log(`  Deployer: ${deployer.address}`);
  const bal = await hre.ethers.provider.getBalance(deployer.address);
  console.log(`  Balance:  ${hre.ethers.formatEther(bal)} ETH`);

  const deployed = { network, deployer: deployer.address, startedAt: new Date().toISOString(), contracts: {}, gasUsed: {} };

  async function deployAndRecord(name, factory, label) {
    process.stdout.write(`  ${label}... `);
    const contract = await factory.deploy(...(arguments[3] || []));
    const tx = contract.deploymentTransaction();
    await contract.waitForDeployment();
    const receipt = await tx.wait();
    const addr = await contract.getAddress();
    deployed.contracts[name] = addr;
    deployed.gasUsed[name] = Number(receipt.gasUsed);
    console.log(`${addr}  (gas ${receipt.gasUsed})`);
    return contract;
  }

  // 1. Poseidon (from circomlibjs bytecode, deployed via raw factory)
  const poseidonABI = poseidonContract.generateABI(2);
  const poseidonBytecode = poseidonContract.createCode(2);
  const PoseidonFactory = new hre.ethers.ContractFactory(poseidonABI, poseidonBytecode, deployer);
  const poseidon = await PoseidonFactory.deploy();
  const pTx = poseidon.deploymentTransaction();
  await poseidon.waitForDeployment();
  const pReceipt = await pTx.wait();
  deployed.contracts.Poseidon = await poseidon.getAddress();
  deployed.gasUsed.Poseidon = Number(pReceipt.gasUsed);
  console.log(`  Poseidon... ${deployed.contracts.Poseidon}  (gas ${pReceipt.gasUsed})`);

  // 2. FeedbackVerifier
  const FeedbackV = await hre.ethers.getContractFactory("FeedbackVerifier", deployer);
  const feedbackV = await FeedbackV.deploy();
  await feedbackV.waitForDeployment();
  const fvReceipt = await feedbackV.deploymentTransaction().wait();
  deployed.contracts.FeedbackVerifier = await feedbackV.getAddress();
  deployed.gasUsed.FeedbackVerifier = Number(fvReceipt.gasUsed);
  console.log(`  FeedbackVerifier... ${deployed.contracts.FeedbackVerifier}  (gas ${fvReceipt.gasUsed})`);

  // 3. MergeWithdrawVerifier
  const MergeV = await hre.ethers.getContractFactory("MergeWithdrawVerifier", deployer);
  const mergeV = await MergeV.deploy();
  await mergeV.waitForDeployment();
  const mvReceipt = await mergeV.deploymentTransaction().wait();
  deployed.contracts.MergeWithdrawVerifier = await mergeV.getAddress();
  deployed.gasUsed.MergeWithdrawVerifier = Number(mvReceipt.gasUsed);
  console.log(`  MergeWithdrawVerifier... ${deployed.contracts.MergeWithdrawVerifier}  (gas ${mvReceipt.gasUsed})`);

  // 4. GlobalReputation
  const Reputation = await hre.ethers.getContractFactory("GlobalReputation", deployer);
  const reputation = await Reputation.deploy(
    deployed.contracts.Poseidon,
    deployed.contracts.FeedbackVerifier,
    deployed.contracts.MergeWithdrawVerifier,
    1  // denomination = 1 wei (we don't exercise the pool in this benchmark)
  );
  await reputation.waitForDeployment();
  const rReceipt = await reputation.deploymentTransaction().wait();
  deployed.contracts.GlobalReputation = await reputation.getAddress();
  deployed.gasUsed.GlobalReputation = Number(rReceipt.gasUsed);
  console.log(`  GlobalReputation... ${deployed.contracts.GlobalReputation}  (gas ${rReceipt.gasUsed})`);

  // 5. Util library
  const Util = await hre.ethers.getContractFactory("Util", deployer);
  const util = await Util.deploy();
  await util.waitForDeployment();
  const uReceipt = await util.deploymentTransaction().wait();
  deployed.contracts.Util = await util.getAddress();
  deployed.gasUsed.Util = Number(uReceipt.gasUsed);
  console.log(`  Util... ${deployed.contracts.Util}  (gas ${uReceipt.gasUsed})`);

  // 6. Storage
  const StorageF = await hre.ethers.getContractFactory("Storage", deployer);
  const storage = await StorageF.deploy();
  await storage.waitForDeployment();
  const sReceipt = await storage.deploymentTransaction().wait();
  deployed.contracts.Storage = await storage.getAddress();
  deployed.gasUsed.Storage = Number(sReceipt.gasUsed);
  console.log(`  Storage... ${deployed.contracts.Storage}  (gas ${sReceipt.gasUsed})`);

  // 7. Chain (linking Util)
  const Chain = await hre.ethers.getContractFactory("Chain", {
    libraries: { "contracts/Order.sol:Util": deployed.contracts.Util },
    signer: deployer,
  });
  const chain = await Chain.deploy();
  await chain.waitForDeployment();
  const cReceipt = await chain.deploymentTransaction().wait();
  deployed.contracts.Chain = await chain.getAddress();
  deployed.gasUsed.Chain = Number(cReceipt.gasUsed);
  console.log(`  Chain... ${deployed.contracts.Chain}  (gas ${cReceipt.gasUsed})`);

  deployed.completedAt = new Date().toISOString();
  deployed.totalDeployGas = Object.values(deployed.gasUsed).reduce((a, b) => a + b, 0);

  // Save JSON
  const outDir = path.join(__dirname, "..", "benchmarking", "l2-deployments");
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
