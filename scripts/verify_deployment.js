/**
 * Checks a deployment from its JSON record, on any network, without sending any transaction.
 * It only reads: eth_call, eth_getCode, receipts. No account is used and nothing is signed.
 *
 *   DEPLOYMENT=deployments/sepolia.json npx hardhat run --no-compile scripts/verify_deployment.js --network sepolia
 *   DEPLOYMENT=<dir>/deployment.json,<dir>/deployment-no-privacy.json npx hardhat run --no-compile scripts/verify_deployment.js --network localhost
 *
 * DEPLOYMENT is one record or several, separated by commas: the records written by
 * scripts/deploy_all.js, scripts/deploy_no_privacy.js or scripts/deploy_l2.js.
 *
 * Checked, as far as the record names the contracts:
 *   - the network's chain id is the record's; code at every address; every recorded
 *     transaction (mined, successful, sent by the deployer, same block, gas and created address)
 *   - Chain: its reputation and storage contracts, its order implementation, that the
 *     implementation is not an order; the two setChain links; the pool's hasher and verifier
 *   - the pool: poseidon(0, 0), the first root recomputed from the hasher, the dummy nullifier
 *   - the announcer: its code is the compiled StealthAnnouncer
 *   - the baseline: No_Chain's order implementation, and that it is a blank order
 * Every check runs; the script exits with 1 if any of them failed.
 */

const hre = require("hardhat");
const fs = require("fs");
const path = require("path");
const { ethers } = hre;

const POSEIDON_ZERO = 14744269619966411208579211824598458697587494354926760081771325075741142829156n;

let failures = 0;
function check(condition, label, detail) {
  if (condition) console.log(`  ok    ${label}`);
  else { failures++; console.log(`  FAIL  ${label}${detail ? ` (${detail})` : ""}`); }
  return condition;
}
const note = (text) => console.log(`  --    ${text}`);
// A check whose read fails counts as failed, and the others still run
async function attempt(label, fn) {
  try { await fn(); } catch (e) { check(false, label, (e.shortMessage || e.message || String(e)).split("\n")[0]); }
}
const same = (a, b) => typeof a === "string" && typeof b === "string" && a.toLowerCase() === b.toLowerCase();
const proxyCode = (impl) => "0x363d3d373d3d3d363d73" + impl.slice(2).toLowerCase() + "5af43d82803e903d91602b57fd5bf3";

function artifact(solFile, name) {
  const file = path.join(__dirname, "..", "artifacts", "contracts", solFile, `${name}.json`);
  if (!fs.existsSync(file)) return null;
  const art = JSON.parse(fs.readFileSync(file, "utf8"));
  // Where the immutables are is in the build info, not in the artifact
  art.immutableReferences = {};
  try {
    const dbg = JSON.parse(fs.readFileSync(file.replace(/\.json$/, ".dbg.json"), "utf8"));
    const infoFile = path.resolve(path.dirname(file), dbg.buildInfo);
    buildInfos[infoFile] = buildInfos[infoFile] || JSON.parse(fs.readFileSync(infoFile, "utf8"));
    art.immutableReferences = buildInfos[infoFile].output.contracts[art.sourceName][art.contractName].evm.deployedBytecode.immutableReferences || {};
  } catch (e) { /* no build info: a contract with immutables then compares as different */ }
  return art;
}
const buildInfos = {};
// Runtime code without the places that differ between deployments of one build: immutables and
// library addresses (both given by the artifact) are zeroed
function masked(code, art) {
  let hex = code.slice(2).toLowerCase();
  const ranges = [];
  for (const list of Object.values(art.immutableReferences || {})) ranges.push(...list);
  for (const fileRefs of Object.values(art.deployedLinkReferences || {}))
    for (const list of Object.values(fileRefs)) ranges.push(...list);
  for (const { start, length } of ranges) hex = hex.slice(0, 2 * start) + "0".repeat(2 * length) + hex.slice(2 * (start + length));
  // library placeholders of an unlinked artifact
  hex = hex.replace(/__\$[0-9a-f]{34}\$__/g, "0".repeat(40));
  // a library starts with PUSH20 <its own address> (zero in the artifact), set when it is deployed
  if (/^73[0-9a-f]{40}30/.test(hex)) hex = "73" + "0".repeat(40) + hex.slice(42);
  return hex;
}
// Compares the code at `address` with the compiled artifact. A difference fails only when
// `strict`; otherwise it is reported (the artifacts may have been rebuilt since the deployment).
async function compareCode(label, address, solFile, name, strict) {
  const art = artifact(solFile, name);
  if (!art) return note(`${label}: no compiled artifact here, code not compared`);
  const code = await ethers.provider.getCode(address);
  const equal = masked(code, art) === masked(art.deployedBytecode, art);
  if (strict || equal) check(equal, `${label}: the code is the compiled ${name}`, equal ? "" : `${(code.length - 2) / 2} bytes deployed, ${(art.deployedBytecode.length - 2) / 2} compiled`);
  else note(`${label}: the code differs from the compiled ${name} in ./artifacts (${(code.length - 2) / 2} bytes deployed, ${(art.deployedBytecode.length - 2) / 2} compiled): rebuilt since the deployment?`);
}

async function verifyRecord(file) {
  const d = JSON.parse(fs.readFileSync(file, "utf8"));
  const c = d.contracts || {};
  console.log(`\n${file}`);

  console.log(" Record and network");
  check(Object.keys(c).length > 0, "the record names contracts");
  const chainId = Number((await ethers.provider.getNetwork()).chainId);
  if (d.chainId === undefined) note("the record has no chain id (an older record): not compared");
  else check(d.chainId === chainId, `the network's chain id is the record's (${d.chainId})`, `this network is ${chainId}`);
  check(ethers.isAddress(d.deployer || ""), "the record names its deployer");
  for (const [name, address] of Object.entries(c)) {
    await attempt(`${name} has code`, async () => {
      check(ethers.isAddress(address) && (await ethers.provider.getCode(address)).length > 2, `${name} has code at ${address}`);
    });
  }

  if (Array.isArray(d.transactions)) {
    console.log(" Recorded transactions");
    for (const t of d.transactions) {
      await attempt(`${t.name}: receipt`, async () => {
        const r = await ethers.provider.getTransactionReceipt(t.hash);
        if (!check(r !== null, `${t.name}: the transaction is mined`, t.hash)) return;
        const problems = [];
        if (r.status !== 1) problems.push("it failed");
        if (!same(r.from, d.deployer)) problems.push(`sent by ${r.from}`);
        if (r.blockNumber !== t.blockNumber) problems.push(`block ${r.blockNumber}, recorded ${t.blockNumber}`);
        if (Number(r.gasUsed) !== t.gasUsed) problems.push(`gas used ${r.gasUsed}, recorded ${t.gasUsed}`);
        if (r.gasPrice.toString() !== t.effectiveGasPrice) problems.push(`effective gas price ${r.gasPrice}, recorded ${t.effectiveGasPrice}`);
        if (t.contractAddress && !same(r.contractAddress || "", t.contractAddress)) problems.push(`created ${r.contractAddress}, recorded ${t.contractAddress}`);
        if (t.contractAddress && !same(c[t.name] || "", t.contractAddress)) problems.push(`the record's address of ${t.name} is ${c[t.name]}`);
        check(problems.length === 0, `${t.name}: successful, by the deployer, block ${t.blockNumber}, gas ${t.gasUsed}`, problems.join("; "));
      });
    }
    const created = d.transactions.filter((t) => t.contractAddress).map((t) => t.name);
    const missing = Object.keys(c).filter((n) => !created.includes(n) && n !== "OrderImplementation" && n !== "No_OrderImplementation");
    check(missing.length === 0, "every contract of the record has its deployment transaction", missing.join(", "));
  } else {
    note("the record lists no transactions (an older record): receipts not checked");
  }

  if (c.Chain) await verifyPrivacy(d, c);
  if (c.No_Chain) await verifyBaseline(d, c);
  if (!c.Chain && !c.No_Chain) check(false, "the record names Chain or No_Chain");
}

async function verifyPrivacy(d, c) {
  const view = (address, abi) => new ethers.Contract(address, abi, ethers.provider);
  const chain = view(c.Chain, [
    "function reputation() view returns (address)", "function storageContract() view returns (address)",
    "function orderImplementation() view returns (address)", "function isOrder(address) view returns (bool)",
    "function getIndex() view returns (uint256)", "function findAddress(uint256) view returns (address)"]);
  const reputation = view(c.GlobalReputation, [
    "function chain() view returns (address)", "function owner() view returns (address)",
    "function hasher() view returns (address)", "function mergeWithdrawVerifier() view returns (address)",
    "function NOTE_TREE_DEPTH() view returns (uint8)", "function noteRoot() view returns (uint256)",
    "function noteNextIndex() view returns (uint32)", "function isKnownNoteRoot(uint256) view returns (bool)",
    "function dummyNoteNullifierHash() view returns (uint256)"]);
  const storage = view(c.Storage, ["function chain() view returns (address)", "function owner() view returns (address)"]);
  const hasher = view(c.Poseidon, ["function poseidon(uint256[2]) pure returns (uint256)"]);
  const eq = async (label, read, expected) => attempt(label, async () => {
    const got = await read();
    check(same(got, expected), label, `it is ${got}, the record says ${expected}`);
  });

  console.log(" Fixed addresses and links");
  await eq("Chain.reputation() is the recorded GlobalReputation", () => chain.reputation(), c.GlobalReputation);
  await eq("Chain.storageContract() is the recorded Storage", () => chain.storageContract(), c.Storage);
  await eq("Chain.orderImplementation() is the recorded implementation", () => chain.orderImplementation(), c.OrderImplementation);
  await attempt("the implementation is not an order", async () => {
    check((await chain.isOrder(c.OrderImplementation)) === false, "the implementation is not an order (Chain.isOrder)");
    check((await ethers.provider.getCode(c.OrderImplementation)).length - 2 > 2 * 45, "the implementation holds the Order code, not a proxy");
  });
  await eq("GlobalReputation.chain() is Chain (setChain)", () => reputation.chain(), c.Chain);
  await eq("Storage.chain() is Chain (setChain)", () => storage.chain(), c.Chain);
  await eq("GlobalReputation.hasher() is the recorded Poseidon hasher", () => reputation.hasher(), c.Poseidon);
  await eq("GlobalReputation.mergeWithdrawVerifier() is the recorded verifier", () => reputation.mergeWithdrawVerifier(), c.MergeWithdrawVerifier);
  await eq("GlobalReputation.owner() is the deployer", () => reputation.owner(), d.deployer);
  await eq("Storage.owner() is the deployer", () => storage.owner(), d.deployer);
  await attempt("the first order", async () => {
    const index = await chain.getIndex();
    if (index === 0n) return note("no order yet: the proxy code of an order is not checked");
    const first = await chain.findAddress(1);
    check((await chain.isOrder(first)) && (await ethers.provider.getCode(first)) === proxyCode(c.OrderImplementation),
      `order 1 of ${index} is a 45-byte proxy of the implementation`);
  });

  console.log(" Payment pool");
  await attempt("the pool's first root", async () => {
    const zero = await hasher.poseidon([0n, 0n]);
    check(zero === POSEIDON_ZERO, "poseidon(0, 0) of the hasher is the circomlibjs value");
    check((await reputation.dummyNoteNullifierHash()) === zero, "dummyNoteNullifierHash() is poseidon(0, 0)");
    // Root of the tree whose only leaf is the dummy note poseidon(poseidon(0, 0), 0)
    const depth = Number(await reputation.NOTE_TREE_DEPTH());
    let node = await hasher.poseidon([zero, 0n]);
    let empty = 0n;
    for (let level = 0; level < depth; level++) {
      node = await hasher.poseidon([node, empty]);
      empty = await hasher.poseidon([empty, empty]);
    }
    const index = await reputation.noteNextIndex();
    const root = await reputation.noteRoot();
    check(await reputation.isKnownNoteRoot(root), "noteRoot() is a known root");
    if (index === 1n) {
      check(root === node, `noteRoot() is the root of the depth-${depth} tree with the dummy note alone, recomputed from the hasher`);
    } else {
      // Notes were added since: read the root as it was in the block that deployed the pool
      const t = (d.transactions || []).find((x) => x.name === "GlobalReputation");
      let first = null;
      if (t) { try { first = await reputation.noteRoot({ blockTag: t.blockNumber }); } catch (e) { /* the node keeps no such state */ } }
      if (first === null) note(`the pool holds ${index} notes and its state at the deployment block cannot be read here: the first root is not checked`);
      else check(first === node, `the pool's first root (block ${t.blockNumber}; ${index} notes now) is the one recomputed from the hasher`);
    }
  });

  console.log(" Code against the compiled artifacts");
  const strict = process.env.STRICT_CODE === "1";
  await attempt("the announcer", () => compareCode("StealthAnnouncer", c.StealthAnnouncer, "StealthAnnouncer.sol", "StealthAnnouncer", true));
  for (const [name, solFile, artName] of [["Chain", "Chain.sol", "Chain"], ["OrderImplementation", "Order.sol", "Order"], ["Util", "Order.sol", "Util"],
    ["GlobalReputation", "Reputation.sol", "GlobalReputation"], ["Storage", "Storage.sol", "Storage"], ["MergeWithdrawVerifier", "MergeWithdrawVerifier.sol", "MergeWithdrawVerifier"]]) {
    if (c[name]) await attempt(`${name}: code`, () => compareCode(name, c[name], solFile, artName, strict));
  }
}

async function verifyBaseline(d, c) {
  const noChain = new ethers.Contract(c.No_Chain, [
    "function orderImplementation() view returns (address)", "function getIndex() view returns (uint256)",
    "function findAddress(uint256) view returns (address)",
    "function getOrder(address) view returns (uint256, string, uint256, string, address, uint256, uint256, uint256, address)"], ethers.provider);
  const impl = c.No_OrderImplementation;

  console.log(" Baseline (no privacy)");
  await attempt("No_Chain.orderImplementation()", async () => {
    const got = await noChain.orderImplementation();
    check(same(got, impl), "No_Chain.orderImplementation() is the recorded implementation", `it is ${got}, the record says ${impl}`);
    check(same(impl, ethers.getCreateAddress({ from: c.No_Chain, nonce: 1 })), "the implementation is the first contract No_Chain created");
    check((await ethers.provider.getCode(impl)).length - 2 > 2 * 45, "the implementation holds the Order code, not a proxy");
    const blank = await noChain.getOrder(impl);
    check(blank[0] === 0n && blank[3] === "" && blank[6] === 0n, "the implementation is a blank order: never initialized");
    const index = await noChain.getIndex();
    if (index === 0n) return note("no order yet: the proxy code of an order is not checked");
    const first = await noChain.findAddress(1);
    check(!same(first, impl) && (await ethers.provider.getCode(first)) === proxyCode(impl), `order 1 of ${index} is a 45-byte proxy of the implementation`);
  });
  const strict = process.env.STRICT_CODE === "1";
  for (const [name, artName] of [["No_Chain", "No_Chain"], ["No_OrderImplementation", "Order"], ["No_Util", "No_Util"]]) {
    const solFile = path.join("contracts_no_privacy", artName === "No_Chain" ? "No_Chain.sol" : "No_Order.sol");
    if (c[name]) await attempt(`${name}: code`, () => compareCode(name, c[name], solFile, artName, strict));
  }
}

async function main() {
  if (!process.env.DEPLOYMENT) throw new Error("set DEPLOYMENT=<record.json>[,<record.json>...]");
  console.log(`Network: ${hre.network.name}. Read-only: no transaction is sent.`);
  for (const file of process.env.DEPLOYMENT.split(",").map((f) => f.trim()).filter(Boolean)) await verifyRecord(file);
  if (failures > 0) {
    console.log(`\n${failures} check(s) FAILED.`);
    process.exitCode = 1;
  } else {
    console.log("\nAll checks passed.");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
