// An order names the reputation contract that keeps its workers' ratings and, at
// conclusion, receives the establishment's revenue. An order is taken only if that
// contract is the deployed one.
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
