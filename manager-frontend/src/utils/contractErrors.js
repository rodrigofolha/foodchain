// Known revert reason strings from the smart contracts
const KNOWN_REASONS = {
  'Already rated': 'You have already rated this delivery worker on this order.',
  'Score must be between 1 and 5': 'Invalid rating score. Please choose between 1 and 5 stars.',
  'This worker cannot be rated on this order': 'This delivery worker cannot be rated on this order: they did not deliver it and did not leave it.',
  'Only the establishment rates a worker who left before pickup': 'Only the establishment can rate a worker who left before pickup.',
  'Second worker already called': 'This order already had a second delivery worker: it cannot be offered again.',
  'This caller is unauthorized': 'This account is not allowed to do this on this order.',
  'Function cannot be called at this step': 'This is not possible in the current state of the order. Reload the page to see its state.',
  'Invalid pickup confirmation': 'The pickup confirmation was not signed for this order by the worker committed to it.',
  'Invalid delivery confirmation': 'The delivery confirmation was not signed for this order by its customer.',
  // the three specific reasons come before the general one, which is part of their text
  'Invalid signature length': 'This confirmation is not complete: a signature has 65 bytes (0x followed by 130 hex characters). Scan it again.',
  'Invalid signature v': 'This confirmation is not a valid signature (its last byte is wrong). Ask for it to be shown again.',
  'Invalid signature s': 'This confirmation is not in the form the contract accepts (it was altered after signing). Ask for it to be shown again.',
  'Invalid signature': 'This confirmation is not a valid signature. Ask for it to be shown again.',
  'Index does not match order': 'The order number and the order address do not match. Reload the page and try again.',
  'Only the order\'s customer': 'Only the customer of this order can send its delivery details.',
  'Unknown reputation contract': 'This order names another reputation contract.',
  'Unknown storage contract': 'This order names another storage contract.',
  'Deliveryman has no ratings yet': 'This delivery worker has no ratings yet.',
  'Insuficient funds': 'Insufficient funds to complete this operation.',
  'Deliveryman reputation below minimum': 'This delivery worker does not meet the minimum reputation requirement.',
  'Deliveryman does not have enough completed orders': 'This delivery worker does not have enough completed deliveries.',
  'Root is not known': 'The note tree changed while the proof was made. Please try again.',
  'Note 1 already spent': 'A note of this withdrawal was already spent. Reload the page and try again.',
  'Note 2 already spent': 'A note of this withdrawal was already spent. Reload the page and try again.',
  'Invalid ZK proof': 'The withdrawal proof could not be verified on-chain.',
  'Cannot use same note twice': 'A withdrawal cannot use the same note twice. Reload the page and try again.',
  'Amount too large': 'This amount is larger than the privacy pool accepts.',
  'Must deposit non-zero amount': 'The deposit must be more than zero.',
  'Note tree is full': 'The privacy pool cannot take more notes.',
  'ETH transfer failed': 'The pool could not pay the withdrawal to the receiving address.',
  'Client payment failed': 'Payment to the customer failed.',
  'Restaurant payment failed': 'Payment to the restaurant failed.',
  'Deliveryman 1 payment failed': 'Payment to the first delivery worker failed.',
  'Deliveryman 2 payment failed': 'Payment to the second delivery worker failed.',
};

// Generic messages for common EVM errors
const GENERIC_ERRORS = {
  'insufficient funds': 'Your wallet does not have enough funds for this transaction.',
  'gas required exceeds': 'This transaction would fail. The operation is not allowed in the current state.',
  'User denied': 'Transaction was rejected in MetaMask.',
  'user rejected': 'Transaction was rejected in MetaMask.',
  'nonce too low': 'Transaction conflict. Please wait a moment and try again.',
  'already known': 'This transaction was already submitted. Please wait for it to be processed.',
};

// Every message an error carries. A wallet can put the node's reason inside the error it
// throws ("Internal JSON-RPC error." with the reason in data.message), and ethers keeps the
// node's error under `error`.
function errorMessages(err) {
  const found = [];
  const add = (text) => { if (typeof text === 'string' && text && found.indexOf(text) < 0) found.push(text); };
  if (err && typeof err === 'object') {
    add(err.message);
    add(err.reason);
    [err.data, err.error, err.error && err.error.data, err.data && err.data.originalError].forEach((inner) => {
      if (inner && typeof inner === 'object') add(inner.message);
    });
  }
  return found;
}

// A wallet's "Internal JSON-RPC error" says nothing: the message inside it, when there is one
function fallbackText(err, raw) {
  const messages = errorMessages(err);
  const inner = messages.slice(1).find((text) => !/internal json-rpc error/i.test(text));
  return (inner && /internal json-rpc error/i.test(messages[0])) ? inner : (err?.message || raw);
}

// ABI-encoded Error(string) of a revert, wherever the error carries it
function revertData(err) {
  const places = [err && err.data, err && err.data && err.data.data, err && err.error && err.error.data,
    err && err.error && err.error.data && err.error.data.data, err && err.data && err.data.originalError && err.data.originalError.data];
  return places.find((data) => typeof data === 'string' && data.startsWith('0x08c379a0')) || null;
}

/**
 * Parses a blockchain/contract error into a user-friendly message.
 */
export function parseContractError(err) {
  const raw = errorMessages(err).join(' | ') || err?.toString() || 'Unknown error';

  // 1. Check for known revert reasons from our contracts
  for (const [pattern, friendly] of Object.entries(KNOWN_REASONS)) {
    if (raw.includes(pattern)) return friendly;
  }

  // 2. Check for generic blockchain errors
  for (const [pattern, friendly] of Object.entries(GENERIC_ERRORS)) {
    if (raw.toLowerCase().includes(pattern.toLowerCase())) return friendly;
  }

  // 3. Try to extract a revert reason from the error data
  try {
    // ABI-encoded Error(string) starts with 0x08c379a0
    const data = revertData(err);
    if (data) {
      const hex = data.slice(138); // skip selector + offset + length padding
      const reason = Buffer.from(hex, 'hex').toString('utf8').replace(/\0/g, '');
      if (reason) return reason;
    }
  } catch (_) { /* ignore decode errors */ }

  // 4. Transaction reverted without reason — generic message
  if (raw.includes('reverted') || raw.includes('status: false') || raw.includes('status":false')) {
    return 'Transaction failed. This may happen if the operation is not allowed in the current order state, or if you already performed this action.';
  }

  // 5. Rate limiting
  if (raw.includes('Too Many Requests')) {
    return 'The network is busy. Please wait a moment and try again.';
  }

  // 6. Fallback: the most specific message the error carries
  return 'Transaction failed: ' + fallbackText(err, raw).slice(0, 150);
}
