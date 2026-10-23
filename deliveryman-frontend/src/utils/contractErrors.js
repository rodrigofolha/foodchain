// Known revert reason strings from the smart contracts
const KNOWN_REASONS = {
  'Deliveryman has no ratings yet': 'This order asks for a minimum score, and this account has no ratings yet.',
  'This caller is unauthorized': 'This account is not a party of this order. If you left the order or were replaced, reload the page.',
  'Function cannot be called at this step': 'The order is not at the step this action needs. Reload the page.',
  'Index does not match order': 'The order number does not match the order. Reload the page.',
  'Unknown storage contract': 'This app is not set up for the deployed contracts (storage address).',
  'Invalid delivery confirmation': "This delivery confirmation is not the customer's confirmation for this order and this worker. Ask the customer to show it again.",
  // a confirmation that is not a well-formed signature (the longer reasons come first)
  'Invalid signature length': 'This delivery confirmation is incomplete. Scan the customer\'s QR code again, or paste the whole text.',
  'Invalid signature v': 'This delivery confirmation is not a valid signature. Ask the customer to press Confirm delivery again and scan the new code.',
  'Invalid signature s': 'This delivery confirmation is not a valid signature. Ask the customer to press Confirm delivery again and scan the new code.',
  'Invalid signature': 'This delivery confirmation is not a valid signature. Ask the customer to press Confirm delivery again and scan the new code.',
  'Insuficient funds': 'Insufficient funds to complete this operation.',
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

// The message for an error this app can name: a reason of the contracts, a wallet
// or node error, a revert. Null for anything else.
function knownMessage(err) {
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

  return null;
}

/**
 * Parses a blockchain/contract error into a user-friendly message.
 */
export function parseContractError(err) {
  const known = knownMessage(err);
  if (known !== null) return known;
  // Fallback: the most specific message the error carries
  const raw = err?.message || err?.toString() || 'Unknown error';
  return 'Transaction failed: ' + fallbackText(err, raw).slice(0, 150);
}

/**
 * What goes to the console (or to an alert) for an error: a message, never the error
 * object. A format error (JSON.parse) can quote the text that was being read, which may
 * be an address or an item list, so it is only named.
 */
export function errorText(err) {
  if (err instanceof SyntaxError) return 'The content is not in a format this app can open.';
  return parseContractError(err);
}

// True for an error of the wallet or of a contract: one this app can name, or one
// that carries a provider error code (EIP-1193, JSON-RPC).
export function isWalletOrContractError(err) {
  return knownMessage(err) !== null || (!!err && Number.isInteger(err.code) && err.code !== 0);
}

export const DETAILS_NOT_OPENED = 'The details of this order could not be opened.';

/**
 * What is shown and printed when the details of an order (address, items) cannot be
 * opened. Only a wallet or contract error is described; any other error gets a fixed
 * text, because its message can quote what was being read.
 */
export function detailsErrorText(err) {
  if (err instanceof SyntaxError) return errorText(err);
  return isWalletOrContractError(err) ? parseContractError(err) : DETAILS_NOT_OPENED;
}
