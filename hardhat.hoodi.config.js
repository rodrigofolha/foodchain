/**
 * Hardhat configuration for the Hoodi test network (chain id 560048), kept apart from
 * hardhat.config.js so that the main configuration stays as it is.
 *
 *   npx hardhat --config hardhat.hoodi.config.js run --no-compile scripts/deploy_all.js --network hoodi
 *
 * Compiler settings, paths and the in-process network are those of hardhat.config.js (solc 0.8.20,
 * optimizer 200 runs, evmVersion paris; hardfork osaka, block gas limit 60,000,000), so the
 * artifacts in artifacts/ are the ones this configuration would build. Run with --no-compile.
 *
 * Network "hoodi":
 *   account   PRIVATE_KEY, the variable the main configuration uses for its deployer, loaded from
 *             the repository's .env by dotenv (a value already set in the shell wins over .env)
 *   endpoint  HOODI_RPC_URL, default https://ethereum-hoodi-rpc.publicnode.com
 *   chain id  560048: Hardhat refuses to send when the endpoint reports another chain
 * No gas, gasPrice or gasMultiplier is set: every transaction goes out with the node's own
 * estimate (scripts/deploy_common.js takes the fees from MAX_FEE_GWEI and PRIORITY_FEE_GWEI).
 *
 * No secret is written in this file.
 */
require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config({ quiet: true });

const HOODI_CHAIN_ID = 560048;
const HOODI_RPC_URL = process.env.HOODI_RPC_URL || "https://ethereum-hoodi-rpc.publicnode.com";

// The deployer's key: never printed. Without it the network has no account and nothing can be sent.
const key = (process.env.PRIVATE_KEY || "").trim();
const accounts = key ? [key.startsWith("0x") ? key : `0x${key}`] : [];

module.exports = {
  solidity: {
    version: "0.8.20",
    settings: { optimizer: { enabled: true, runs: 200 }, evmVersion: "paris" },
  },
  networks: {
    hardhat: { hardfork: "osaka", blockGasLimit: 60000000 },
    hoodi: { url: HOODI_RPC_URL, chainId: HOODI_CHAIN_ID, accounts },
  },
  mocha: { timeout: 40000 },
};
