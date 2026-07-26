// Known revert reason strings from the smart contracts
const KNOWN_REASONS = {
  'You have already rated this worker': 'You have already rated this delivery worker.',
  'Score must be between 1 and 5': 'Invalid rating score. Please choose between 1 and 5 stars.',
  'Invalid Zero Knowledge Proof': 'The anonymous proof could not be verified on-chain.',
  'Tree is full': 'The rating system tree is full. Contact support.',
  'Insuficient funds': 'Insufficient funds to complete this operation.',
  'Invalid code': 'The code you entered is incorrect. Please check and try again.',
  'Deliveryman reputation below minimum': 'This delivery worker does not meet the minimum reputation requirement.',
  'Deliveryman does not have enough completed orders': 'This delivery worker does not have enough completed deliveries.',
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

/**
 * Parses a blockchain/contract error into a user-friendly message.
 */
export function parseContractError(err) {
  const raw = err?.message || err?.toString() || 'Unknown error';

  // 1. Check for known revert reasons from our contracts
  for (const [pattern, friendly] of Object.entries(KNOWN_REASONS)) {
    if (raw.includes(pattern)) return friendly;
  }

  // 2. Check for generic blockchain errors
  for (const [pattern, friendly] of Object.entries(GENERIC_ERRORS)) {
    if (raw.toLowerCase().includes(pattern.toLowerCase())) return friendly;
  }

  // 3. Try to extract a revert reason from the error data
  if (err?.data) {
    try {
      // ABI-encoded Error(string) starts with 0x08c379a0
      const data = typeof err.data === 'string' ? err.data : err.data?.data;
      if (data && data.startsWith('0x08c379a0')) {
        const hex = data.slice(138); // skip selector + offset + length padding
        const reason = Buffer.from(hex, 'hex').toString('utf8').replace(/\0/g, '');
        if (reason) return reason;
      }
    } catch (_) { /* ignore decode errors */ }
  }

  // 4. Transaction reverted without reason — generic message
  if (raw.includes('reverted') || raw.includes('status: false') || raw.includes('status":false')) {
    return 'Transaction failed. This may happen if the operation is not allowed in the current order state, or if you already performed this action.';
  }

  // 5. Rate limiting
  if (raw.includes('Too Many Requests')) {
    return 'The network is busy. Please wait a moment and try again.';
  }

  // 6. Fallback
  return 'Transaction failed: ' + raw.slice(0, 150);
}
