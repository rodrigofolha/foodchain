/**
 * Checks a deployment of the FoodChain contracts by calling them. Local networks only.
 *
 *   npx hardhat run scripts/check_deployment.js
 *       deploys with scripts/deploy_all.js on the in-process network, then checks
 *   DEPLOYMENT=<dir>/deployment.json npx hardhat run scripts/check_deployment.js --network localhost
 *       checks the deployment that deploy_all.js wrote with CONFIG_OUT_DIR=<dir>
 *
 * It sends transactions (one order, taken to its end with both ratings), so it refuses any
 * network other than the in-process one and localhost.
 */

const hre = require("hardhat");
const fs = require("fs");
const { ethers } = hre;

function check(condition, label) {
  if (!condition) throw new Error(`FAILED: ${label}`);
  console.log(`  ok  ${label}`);
}

async function main() {
  if (!["hardhat", "localhost"].includes(hre.network.name)) {
    throw new Error(`check_deployment.js sends transactions: local networks only, not "${hre.network.name}"`);
  }
  const deployment = process.env.DEPLOYMENT
    ? JSON.parse(fs.readFileSync(process.env.DEPLOYMENT, "utf8"))
    : await require("./deploy_all.js").main();
  if (!deployment) throw new Error("no deployment to check (unset CONFIG_ABIS_ONLY)");
  const c = deployment.contracts;

  const [, customer, establishment, worker] = await ethers.getSigners();
  const chain = await ethers.getContractAt("Chain", c.Chain);
  const reputation = await ethers.getContractAt("GlobalReputation", c.GlobalReputation);
  const storage = await ethers.getContractAt("Storage", c.Storage);
  const hasher = new ethers.Contract(c.Poseidon, ["function poseidon(uint256[2]) pure returns (uint256)"], ethers.provider);

  console.log("\nFixed addresses and links");
  check((await chain.reputation()) === c.GlobalReputation, "Chain.reputation() is the deployed GlobalReputation");
  check((await chain.storageContract()) === c.Storage, "Chain.storageContract() is the deployed Storage");
  check((await chain.orderImplementation()) === c.OrderImplementation, "Chain.orderImplementation() is the recorded implementation");
  check((await ethers.provider.getCode(c.OrderImplementation)).length > 2, "the Order implementation has code");
  check((await reputation.chain()) === c.Chain, "GlobalReputation.chain() is Chain");
  check((await storage.chain()) === c.Chain, "Storage.chain() is Chain");
  check((await reputation.hasher()) === c.Poseidon, "GlobalReputation.hasher() is the Poseidon hasher");
  check((await reputation.mergeWithdrawVerifier()) === c.MergeWithdrawVerifier, "GlobalReputation.mergeWithdrawVerifier() is the verifier");
  check(!(await chain.isOrder(c.OrderImplementation)), "the implementation is not an order");

  console.log("\nPayment pool");
  const zero = await hasher.poseidon([0n, 0n]);
  check(zero === 14744269619966411208579211824598458697587494354926760081771325075741142829156n, "poseidon(0, 0) is the circomlibjs value");
  // Root of a depth-25 tree whose only leaf is the dummy note poseidon(poseidon(0, 0), 0)
  let node = await hasher.poseidon([zero, 0n]);
  let empty = 0n;
  for (let level = 0; level < 25; level++) {
    node = await hasher.poseidon([node, empty]);
    empty = await hasher.poseidon([empty, empty]);
  }
  const firstIndex = await reputation.noteNextIndex();
  const rootBefore = await reputation.noteRoot();
  if (firstIndex === 1n) check(rootBefore === node, "noteRoot() is the root of the tree with the dummy note alone");
  else console.log(`  --  the pool already holds ${firstIndex} notes: the first root is not recomputed`);
  check(await reputation.isKnownNoteRoot(rootBefore), "noteRoot() is a known root");
  check((await reputation.dummyNoteNullifierHash()) === zero, "dummyNoteNullifierHash() is poseidon(0, 0)");

  console.log("\nOne order through Chain");
  const total = ethers.parseEther("0.01"), fee = ethers.parseEther("0.001");
  await (await chain.connect(customer).makeOrder(
    establishment.address, fee, total, "items", "items for the customer",
    c.GlobalReputation, ethers.ZeroAddress, 0, "zone", { value: total + fee })).wait();
  const index = await chain.getIndex();
  const order = await chain.findAddress(index);
  check(await chain.isOrder(order), "Chain.isOrder(order) is true");
  const code = await ethers.provider.getCode(order);
  check(code === "0x363d3d373d3d3d363d73" + c.OrderImplementation.slice(2).toLowerCase() + "5af43d82803e903d91602b57fd5bf3",
    "the order is a 45-byte proxy of the implementation");
  const step = async () => (await chain.connect(customer).getOrder(order))[3];
  check((await step()) === "ORDERED", "getOrder: ORDERED");
  await expectRevert(chain.connect(customer).makeOrder.staticCall(
    establishment.address, fee, total, "", "", c.Storage, ethers.ZeroAddress, 0, "", { value: total + fee }),
    "Unknown reputation contract", "makeOrder with another reputation address is refused");

  const before = await reputation.workers(worker.address);
  const paymentCommitment = 12345n; // any non-zero value: the revenue goes into the pool as a note
  await (await chain.connect(establishment).prepareOrder(order, paymentCommitment, 0, 0, { value: fee })).wait();
  await expectRevert(chain.connect(worker).confirmIntention.staticCall(order, index, c.GlobalReputation, ethers.ZeroHash, ethers.ZeroHash),
    "Unknown storage contract", "confirmIntention with another storage address is refused");
  const key = [ethers.encodeBytes32String("first half"), ethers.encodeBytes32String("second half")];
  const committed = await (await chain.connect(worker).confirmIntention(order, index, c.Storage, key[0], key[1])).wait();
  check((await storage.getDeliveryman(index))[0] === key[0], "Storage.getDeliveryman returns the worker's key");

  const posted = await (await storage.connect(customer).addInformation(index, "ciphertext A", "ciphertext B")).wait();
  const logs = await storage.queryFilter(storage.filters.Information(index, 1), committed.blockNumber);
  check(logs.length === 1 && logs[0].blockNumber === posted.blockNumber && logs[0].args.encryptedAddress === "ciphertext A" && logs[0].args.encryptedItems === "ciphertext B",
    "Storage emits Information(index, 1, ...) with the two strings");

  const pickup = await worker.signMessage(ethers.getBytes(await chain.handoverDigest(order, 1, worker.address)));
  await (await chain.connect(establishment).pickupOrder(order, pickup)).wait();
  const delivery = await customer.signMessage(ethers.getBytes(await chain.handoverDigest(order, 2, worker.address)));
  await (await chain.connect(worker).deliveryOrder(order, delivery)).wait();
  check((await step()) === "CONCLUDED", "getOrder: CONCLUDED after pickup and delivery");

  check((await reputation.noteNextIndex()) === firstIndex + 1n, "the revenue note was inserted into the pool");
  const rootAfter = await reputation.noteRoot();
  check(rootAfter !== rootBefore && (await reputation.isKnownNoteRoot(rootAfter)) && (await reputation.isKnownNoteRoot(rootBefore)),
    "noteRoot() changed; the old and the new root are known");
  check((await ethers.provider.getBalance(c.GlobalReputation)) >= total + fee, "the pool holds the establishment's revenue");

  await (await chain.connect(customer).rateOrder(order, worker.address, 5)).wait();
  await (await chain.connect(establishment).rateOrder(order, worker.address, 4)).wait();
  const given = await reputation.orderRatings(order, worker.address);
  check(given[0] === 3n && given[1] === 5n && given[2] === 4n, "orderRatings(order, worker) = (delivered, 5, 4)");
  const after = await reputation.workers(worker.address);
  check(after.totalScore === before.totalScore + 9n && after.totalRatings === before.totalRatings + 2n && after.completedOrders === before.completedOrders + 1n,
    "workers(worker): two ratings and one delivery more");
  await expectRevert(chain.connect(customer).rateOrder.staticCall(order, worker.address, 5), "Already rated", "a second rating by the customer is refused");

  console.log("\nAll checks passed.");
}

async function expectRevert(promise, reason, label) {
  let message = null;
  try { await promise; } catch (e) { message = e.message; }
  check(message !== null && message.includes(reason), label);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
