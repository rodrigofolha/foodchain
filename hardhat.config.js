require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: { enabled: true, runs: 200 }
    }
  },
  networks: {
    sepolia: {
      url: process.env.SEPOLIA_RPC_URL || "",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : []
    },
    arbitrumSepolia: {
      url: process.env.ARBITRUM_SEPOLIA_RPC_URL || "https://sepolia-rollup.arbitrum.io/rpc",
      chainId: 421614,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : []
    },
    optimismSepolia: {
      url: process.env.OPTIMISM_SEPOLIA_RPC_URL || "https://sepolia.optimism.io",
      chainId: 11155420,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : []
    },
    ganache: {
      url: "http://127.0.0.1:7545",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : []
    },
    arbitrumLocal: {
      // Local Arbitrum Nitro testnode (sequencer). Run `./test-node.bash` in
      // ~/local-l2/nitro-testnode to bring it up.
      url: "http://127.0.0.1:8547",
      chainId: 412346,
      // Dev funder pre-loaded with ~99,927 ETH by nitro-testnode init.
      accounts: ["0xb6b15c8cb491557369f3c7d2c287b053eb229daa9c22138887752191c9520659"],
    },
    optimismLocal: {
      // Local OP Stack devnet (sequencer). Run `make devnet-up` in the
      // optimism repo to bring it up.
      url: process.env.OPTIMISM_LOCAL_RPC_URL || "http://127.0.0.1:9545",
      chainId: 901,
      accounts: process.env.OPTIMISM_LOCAL_PRIVATE_KEY ? [process.env.OPTIMISM_LOCAL_PRIVATE_KEY] : []
    }
  },
  paths: {
    sources: "./contracts"
  }
};
