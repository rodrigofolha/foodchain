/**
 * Deploy No-Privacy contracts (No_Chain + No_Util), the baseline of the gas comparison.
 *
 * Usage:
 *   npx hardhat run scripts/deploy_no_privacy.js --network sepolia
 *
 * Environment variables:
 *   CONFIG_OUT_DIR=<dir>   write the record of the deployment to <dir>/deployment-no-privacy.json
 *                          (default: deployments/<network>-no-privacy.json; nothing is written on
 *                          the in-process network without CONFIG_OUT_DIR)
 *   MAX_FEE_GWEI=<n>       fee settings for every transaction, both optional
 *   PRIORITY_FEE_GWEI=<n>  (see scripts/deploy_common.js). No gas limit is ever set: each
 *                          transaction goes out with the node's own estimate.
 * The script touches no dApp file. The record has the same fields as the one of deploy_all.js
 * and is checked by scripts/verify_deployment.js.
 */

const hre = require("hardhat");
const { startRecord, recordPath } = require("./deploy_common");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying with account:", deployer.address);
  console.log("Balance:", hre.ethers.formatEther(await hre.ethers.provider.getBalance(deployer.address)), "ETH\n");
  const rec = await startRecord(hre, "no-privacy", deployer, recordPath(hre, "deployment-no-privacy.json", "-no-privacy"));

  // 1. No_Util library
  console.log("1/2  Deploying No_Util library...");
  const NoUtil = await hre.ethers.getContractFactory("No_Util");
  const NO_UTIL = (await rec.deploy("No_Util", NoUtil)).address;
  console.log("     No_Util:", NO_UTIL);

  // 2. No_Chain (linked with No_Util). Its constructor also deploys the Order code once (the
  //    implementation); every order is then a minimal proxy of it, as in the privacy contracts.
  console.log("2/2  Deploying No_Chain...");
  const NoChain = await hre.ethers.getContractFactory("No_Chain", {
    libraries: { "contracts/contracts_no_privacy/No_Order.sol:No_Util": NO_UTIL },
  });
  const { contract: noChain, address: NO_CHAIN, receipt } = await rec.deploy("No_Chain", NoChain);
  console.log("     No_Chain:", NO_CHAIN);
  // A public endpoint may answer a call against a backend that has not yet applied the
  // deployment's block (seen on OP Sepolia on 2026-10-14). Read again a few times.
  let ORDER_IMPLEMENTATION = null;
  for (let attempt = 1; attempt <= 15; attempt++) {
    try { ORDER_IMPLEMENTATION = await noChain.orderImplementation(); break; }
    catch (e) {
      if (attempt === 15 || !/could not decode result data|BAD_DATA/.test(String(e.message || e))) throw e;
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
  rec.data.contracts.No_OrderImplementation = ORDER_IMPLEMENTATION;
  console.log("     Order implementation (deployed by No_Chain):", ORDER_IMPLEMENTATION);

  console.log("\n========== NO-PRIVACY DEPLOYMENT COMPLETE ==========");
  console.log("No_Util:  ", NO_UTIL);
  console.log("No_Chain: ", NO_CHAIN);
  console.log("Order implementation: ", ORDER_IMPLEMENTATION);
  console.log("Gas used: ", rec.data.totalGasUsed.toLocaleString("en-US"), `in ${rec.data.transactions.length} transactions`);
  console.log("Fees paid:", hre.ethers.formatEther(rec.data.totalFeeWei), "ETH");

  // The deploy block of the baseline is the block of No_Chain
  const deployment = rec.finish(receipt.blockNumber);
  if (rec.file) console.log(`\nRecord of the deployment written: ${rec.file}`);
  console.log("\nUpdate benchmarking/.env with:");
  console.log(`NO_PRIVACY_CONTRACT_ADDRESS=${NO_CHAIN}`);
  return deployment;
}

// Run directly ("npx hardhat run scripts/deploy_no_privacy.js"), or required by another script
// that calls main() itself.
if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { main };
