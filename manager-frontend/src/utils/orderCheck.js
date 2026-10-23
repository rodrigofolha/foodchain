// An order names the reputation contract that keeps its workers' ratings and whose payment
// pool receives, when the order ends, what the order pays the establishment (the payment
// plus the collateral, or the collateral alone). An order is taken only if that contract is
// the deployed one.
const ORDER_REPUTATION_ABI = [{
  inputs: [],
  name: 'reputationContract',
  outputs: [{ internalType: 'address', name: '', type: 'address' }],
  stateMutability: 'view',
  type: 'function',
}];

export function sameAddress(a, b) {
  return typeof a === 'string' && typeof b === 'string' &&
    /^0x[0-9a-fA-F]{40}$/.test(a) && a.toLowerCase() === b.toLowerCase();
}

export async function usesReputationContract(web3, orderAddress, reputationAddress) {
  const order = new web3.eth.Contract(ORDER_REPUTATION_ABI, orderAddress);
  const used = await order.methods.reputationContract().call();
  return sameAddress(used, reputationAddress);
}

// An OrderActors log can be emitted by any contract. An address taken from such a log is
// kept only if Chain says it is one of its orders; an address Chain could not be asked
// about is not kept.
export async function keepChainOrders(chain, addresses) {
  const answers = await Promise.all(addresses.map(function (address) {
    return chain.methods.isOrder(address).call().then(
      function (answer) { return answer === true; },
      function () { return false; });
  }));
  return addresses.filter(function (_, i) { return answers[i]; });
}
