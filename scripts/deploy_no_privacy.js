/**
 * Deploy No-Privacy contracts (No_Chain + No_Util) to Sepolia.
 *
 * Usage:
 *   npx hardhat run scripts/deploy_no_privacy.js --network sepolia
 */

const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying with account:", deployer.address);
  console.log("Balance:", hre.ethers.formatEther(await hre.ethers.provider.getBalance(deployer.address)), "ETH\n");

  // 1. No_Util library
  console.log("1/2  Deploying No_Util library...");
  const NoUtil = await hre.ethers.getContractFactory("No_Util");
  const noUtil = await NoUtil.deploy();
  await noUtil.waitForDeployment();
  const NO_UTIL = await noUtil.getAddress();
  console.log("     No_Util:", NO_UTIL);

  // 2. No_Chain (linked with No_Util)
  console.log("2/2  Deploying No_Chain...");
  const NoChain = await hre.ethers.getContractFactory("No_Chain", {
    libraries: { "contracts/contracts_no_privacy/No_Order.sol:No_Util": NO_UTIL },
  });
  const noChain = await NoChain.deploy();
  await noChain.waitForDeployment();
  const NO_CHAIN = await noChain.getAddress();
  console.log("     No_Chain:", NO_CHAIN);

  console.log("\n========== NO-PRIVACY DEPLOYMENT COMPLETE ==========");
  console.log("No_Util:  ", NO_UTIL);
  console.log("No_Chain: ", NO_CHAIN);
  console.log("\nUpdate benchmarking/.env with:");
  console.log(`NO_PRIVACY_CONTRACT_ADDRESS=${NO_CHAIN}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
