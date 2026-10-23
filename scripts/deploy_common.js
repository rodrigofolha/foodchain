/**
 * Shared by the deploy scripts (deploy_all.js, deploy_no_privacy.js, deploy_l2.js):
 * optional fee settings from the environment, and the JSON record of a deployment.
 *
 * Fee settings (both optional, in gwei, decimals allowed), applied to every transaction:
 *   MAX_FEE_GWEI=<n>        maxFeePerGas
 *   PRIORITY_FEE_GWEI=<n>   maxPriorityFeePerGas (0 is allowed)
 * With only one of them the other is computed once, at the start: the maximum fee as twice the
 * latest base fee plus the priority fee; the priority fee as the node's suggestion, capped by the
 * maximum fee. With neither, Hardhat chooses the fees.
 * The account must hold gas limit x maximum fee for each transaction before it is sent, and the
 * node's estimate is bounded by the same product: a high MAX_FEE_GWEI can make a large deployment
 * fail with "gas required exceeds allowance" although the fee finally paid would be small.
 *
 * No gas limit and no gas multiplier are set here or anywhere in the deploy scripts: every
 * transaction goes out with the node's own estimate. On a network where new state is charged
 * apart from computation (Sepolia since 2026-10-06) a deployment needs more than 2^24 gas, and
 * Hardhat caps the limit at 2^24 - 1 as soon as a multiplier is set.
 */

const fs = require("fs");
const path = require("path");

function gweiFromEnv(ethers, name) {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === "") return null;
  let value;
  try {
    value = ethers.parseUnits(raw.trim(), "gwei");
  } catch (e) {
    throw new Error(`${name}="${raw}" is not an amount in gwei`);
  }
  if (value < 0n) throw new Error(`${name}="${raw}" is negative`);
  return value;
}

// The overrides to pass to every transaction ({} when no fee setting is given)
async function feeOverrides(hre) {
  const { ethers } = hre;
  let maxFee = gweiFromEnv(ethers, "MAX_FEE_GWEI");
  let priority = gweiFromEnv(ethers, "PRIORITY_FEE_GWEI");
  if (maxFee === null && priority === null) return {};
  if (maxFee !== null && maxFee === 0n) throw new Error("MAX_FEE_GWEI must be greater than 0");

  const block = await ethers.provider.getBlock("latest");
  if (block.baseFeePerGas === null || block.baseFeePerGas === undefined) {
    throw new Error("MAX_FEE_GWEI / PRIORITY_FEE_GWEI need a network with EIP-1559 fees (the latest block has no base fee)");
  }
  if (maxFee === null) {
    maxFee = 2n * block.baseFeePerGas + priority;
  } else if (priority === null) {
    let suggested = 1n;
    try { suggested = BigInt(await ethers.provider.send("eth_maxPriorityFeePerGas", [])); } catch (e) { /* not offered: 1 wei */ }
    priority = suggested < maxFee ? suggested : maxFee;
  }
  if (priority > maxFee) throw new Error("PRIORITY_FEE_GWEI is greater than MAX_FEE_GWEI");
  if (maxFee < block.baseFeePerGas) {
    console.warn(`WARNING: the maximum fee (${ethers.formatUnits(maxFee, "gwei")} gwei) is below the latest base fee ` +
      `(${ethers.formatUnits(block.baseFeePerGas, "gwei")} gwei): the transactions may wait.`);
  }
  return { maxFeePerGas: maxFee, maxPriorityFeePerGas: priority };
}

/**
 * Starts the record of a deployment: reads the network, the deployer and the prices at the
 * start. `file` (optional) is where the record is written, after every transaction, so that a
 * deployment that stops half way leaves what was mined.
 */
async function startRecord(hre, kind, deployer, file) {
  const { ethers } = hre;
  const overrides = await feeOverrides(hre);
  const block = await ethers.provider.getBlock("latest");
  let gasPrice = null, suggestedPriority = null;
  try { gasPrice = BigInt(await ethers.provider.send("eth_gasPrice", [])).toString(); } catch (e) { /* left null */ }
  try { suggestedPriority = BigInt(await ethers.provider.send("eth_maxPriorityFeePerGas", [])).toString(); } catch (e) { /* left null */ }

  const data = {
    kind,
    network: hre.network.name,
    chainId: Number((await ethers.provider.getNetwork()).chainId),
    deployer: deployer.address,
    startedAt: new Date().toISOString(),
    completedAt: null,
    // Prices in wei, as the node gave them before the first transaction
    atStart: {
      block: block.number,
      gasPrice,
      baseFeePerGas: block.baseFeePerGas === null || block.baseFeePerGas === undefined ? null : block.baseFeePerGas.toString(),
      maxPriorityFeePerGas: suggestedPriority,
    },
    // The fee settings sent with every transaction (null: Hardhat chose the fees)
    feeSettings: overrides.maxFeePerGas === undefined ? null : {
      maxFeePerGas: overrides.maxFeePerGas.toString(),
      maxPriorityFeePerGas: overrides.maxPriorityFeePerGas.toString(),
    },
    deployBlock: null,
    contracts: {},
    transactions: [],
    totalGasUsed: 0,
    totalFeeWei: "0",
  };

  const rec = {
    data,
    overrides,
    file: file || null,
    save() {
      if (!rec.file) return;
      fs.mkdirSync(path.dirname(rec.file), { recursive: true });
      fs.writeFileSync(rec.file, JSON.stringify(data, null, 2) + "\n", "utf8");
    },
    // Adds a mined transaction; `created` is the address of the contract it deployed, if any
    add(name, receipt, created) {
      if (receipt.status !== 1) throw new Error(`${name}: the transaction ${receipt.hash} failed`);
      data.transactions.push({
        name,
        hash: receipt.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: Number(receipt.gasUsed),
        effectiveGasPrice: receipt.gasPrice.toString(),
        contractAddress: created || null,
      });
      data.totalGasUsed += Number(receipt.gasUsed);
      data.totalFeeWei = (BigInt(data.totalFeeWei) + receipt.gasUsed * receipt.gasPrice).toString();
      rec.save();
      return receipt;
    },
    // Deploys with the fee settings, waits, and records the transaction under `name`
    async deploy(name, factory, args = []) {
      const contract = await factory.deploy(...args, overrides);
      const receipt = await contract.deploymentTransaction().wait();
      const address = await contract.getAddress();
      data.contracts[name] = address;
      rec.add(name, receipt, address);
      return { contract, address, receipt };
    },
    // Sends a call with the fee settings (`send` receives the overrides), waits, and records it
    async call(name, send) {
      return rec.add(name, await (await send(overrides)).wait());
    },
    finish(deployBlock) {
      if (deployBlock !== undefined) data.deployBlock = deployBlock;
      data.completedAt = new Date().toISOString();
      rec.save();
      return data;
    },
  };
  if (data.feeSettings) {
    console.log(`Fee settings: max fee ${ethers.formatUnits(overrides.maxFeePerGas, "gwei")} gwei, ` +
      `priority fee ${ethers.formatUnits(overrides.maxPriorityFeePerGas, "gwei")} gwei`);
  }
  return rec;
}

/**
 * Where a script writes its record: <CONFIG_OUT_DIR>/<nameInOutDir> when CONFIG_OUT_DIR is set,
 * deployments/<network><suffix>.json in the repository otherwise. null on the in-process network
 * without CONFIG_OUT_DIR, where nothing outlives the run.
 */
function recordPath(hre, nameInOutDir, suffix = "") {
  if (process.env.CONFIG_OUT_DIR) return path.join(path.resolve(process.env.CONFIG_OUT_DIR), nameInOutDir);
  if (hre.network.name === "hardhat") return null;
  return path.join(__dirname, "..", "deployments", `${hre.network.name}${suffix}.json`);
}

module.exports = { feeOverrides, startRecord, recordPath };
