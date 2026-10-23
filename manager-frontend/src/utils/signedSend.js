/**
 * Sends a contract call from a local wallet (ethers v5: an order's one-time key) in a way that
 * lets the caller record the transaction before it leaves the browser: it is signed first, so
 * its hash and nonce are known, and only then broadcast.
 */

// Answers of a node that mean it did not take the transaction
const REFUSED_CODES = ['INSUFFICIENT_FUNDS', 'NONCE_EXPIRED', 'REPLACEMENT_UNDERPRICED', 'UNSUPPORTED_OPERATION'];

/**
 * True when the error of a broadcast shows that the node refused the transaction, so it was
 * not sent. An error of the connection (no answer, timeout, server error) says nothing: the
 * transaction may have arrived. "already known" means the node has it.
 */
export function wasRefusedByNode(err) {
  if (!err) return false;
  var message = String(err.message || '') + ' ' + String((err.error && err.error.message) || '');
  if (/already known|known transaction/i.test(message)) return false;
  return typeof err.code === 'number' || REFUSED_CODES.indexOf(err.code) >= 0;
}

/**
 * @param {Object} ethers - the ethers v5 module
 * @param {Object} wallet - ethers Wallet connected to a provider
 * @param {Object} contract - ethers Contract connected to `wallet`
 * @param {string} method
 * @param {Array} args
 * @param {Object} overrides - { gasLimit, gasPrice, value }
 * @param {Function} onSigned - called with { txHash, nonce, from, rawTx } before the broadcast
 *   (rawTx: the signed transaction, which can be broadcast again as it is); the transaction is
 *   not sent if it throws
 * @returns {Promise<Object>} the ethers transaction response (wait() gives the receipt)
 * @throws the node's or the connection's error, with `notSent: true` when the node refused it
 */
export async function sendRecorded(ethers, wallet, contract, method, args, overrides, onSigned) {
  var unsigned = await contract.populateTransaction[method].apply(null, args.concat([overrides || {}]));
  var populated = await wallet.populateTransaction(unsigned);
  var signed = await wallet.signTransaction(populated);
  await onSigned({ txHash: ethers.utils.keccak256(signed), nonce: Number(populated.nonce), from: wallet.address, rawTx: signed });
  try {
    return await wallet.provider.sendTransaction(signed);
  } catch (err) {
    if (err && typeof err === 'object') err.notSent = wasRefusedByNode(err);
    throw err;
  }
}
