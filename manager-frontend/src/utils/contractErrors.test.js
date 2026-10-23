import { parseContractError } from './contractErrors';

describe('parseContractError', () => {
  it('explains the revert reasons of the rating and of the replacement', () => {
    expect(parseContractError(new Error('execution reverted: Already rated'))).toMatch(/already rated/);
    expect(parseContractError(new Error('execution reverted: This worker cannot be rated on this order'))).toMatch(/cannot be rated on this order/);
    expect(parseContractError(new Error('execution reverted: Second worker already called'))).toMatch(/cannot be offered again/);
    expect(parseContractError(new Error('execution reverted: This caller is unauthorized'))).toMatch(/not allowed/);
    expect(parseContractError(new Error('execution reverted: Score must be between 1 and 5'))).toMatch(/between 1 and 5/);
  });

  it('explains the signature errors of a handover, each with its own text', () => {
    const texts = ['Invalid signature length', 'Invalid signature v', 'Invalid signature s', 'Invalid signature']
      .map((reason) => parseContractError(new Error('execution reverted: ' + reason)));
    expect(texts[0]).toMatch(/not complete/);
    expect(texts[1]).toMatch(/last byte/);
    expect(texts[2]).toMatch(/altered after signing/);
    expect(texts[3]).toBe('This confirmation is not a valid signature. Ask for it to be shown again.');
    expect(new Set(texts).size).toBe(4);
    expect(parseContractError(new Error('execution reverted: Invalid pickup confirmation'))).toMatch(/pickup confirmation was not signed/);
    expect(parseContractError(new Error('execution reverted: Invalid delivery confirmation'))).toMatch(/delivery confirmation was not signed/);
  });

  // The revert reasons of contracts/*.sol that a call of this dApp can meet (acceptance,
  // dispatch, replacement, contestation, cancellation, rating, deposit, pool withdrawal)
  it('has a message of its own for every revert reason the establishment can meet', () => {
    const reasons = [
      'Function cannot be called at this step', 'This caller is unauthorized', 'Insuficient funds to complete a order.',
      'Second worker already called', 'Invalid signature length', 'Invalid signature v', 'Invalid signature s',
      'Invalid signature', 'Invalid pickup confirmation', 'Client payment failed', 'Restaurant payment failed',
      'Deliveryman 1 payment failed', 'Deliveryman 2 payment failed', 'Score must be between 1 and 5',
      'This worker cannot be rated on this order', 'Only the establishment rates a worker who left before pickup',
      'Already rated', 'Must deposit non-zero amount', 'Amount too large', 'Cannot use same note twice',
      'Note 1 already spent', 'Note 2 already spent', 'Root is not known', 'Invalid ZK proof', 'ETH transfer failed',
      'Note tree is full', 'Unknown reputation contract',
    ];
    reasons.forEach((reason) => {
      const text = parseContractError(new Error('execution reverted: ' + reason));
      expect(text).not.toMatch(/^Transaction failed/);
      expect(text).not.toContain(reason === 'Invalid signature' ? 'execution reverted' : 'reverted');
    });
  });

  it('keeps the wallet messages', () => {
    expect(parseContractError(new Error('MetaMask Tx Signature: User denied transaction signature.'))).toBe('Transaction was rejected in MetaMask.');
    expect(parseContractError(new Error('insufficient funds for gas * price + value'))).toMatch(/does not have enough funds/);
  });

  it('falls back to the start of an unknown message', () => {
    expect(parseContractError(new Error('something else'))).toBe('Transaction failed: something else');
  });
});

// The shapes are stand-ins: a wallet that wraps the node's answer, and ethers over a node
describe('a refusal whose reason is inside the error', () => {
  const selector = '0x08c379a0' + '20'.padStart(64, '0');
  const encoded = (reason) => selector + reason.length.toString(16).padStart(64, '0') + Buffer.from(reason).toString('hex').padEnd(64, '0');

  it('reads the reason a wallet puts in data.message', () => {
    const err = Object.assign(new Error('Returned error: Internal JSON-RPC error.'), {
      code: -32603, data: { code: 3, message: 'execution reverted: Function cannot be called at this step', data: '0x08c379a0' },
    });
    expect(parseContractError(err)).toBe(parseContractError(new Error('execution reverted: Function cannot be called at this step')));
    expect(parseContractError(err)).not.toMatch(/Internal JSON-RPC/);
  });

  it('reads the reason ethers keeps under error', () => {
    const err = Object.assign(new Error('cannot estimate gas; transaction may fail or may require manual gas limit'), {
      code: 'UNPREDICTABLE_GAS_LIMIT', error: { code: -32603, message: 'Internal JSON-RPC error.', data: { message: 'execution reverted: This caller is unauthorized' } },
    });
    expect(parseContractError(err)).toBe(parseContractError(new Error('execution reverted: This caller is unauthorized')));
  });

  it('decodes revert data that is nested', () => {
    const err = Object.assign(new Error('Internal JSON-RPC error.'), { code: -32603, error: { data: { data: encoded('A reason of another contract') } } });
    expect(parseContractError(err)).toBe('A reason of another contract');
  });

  it('shows the inner message in place of "Internal JSON-RPC error" when it names nothing known', () => {
    const err = Object.assign(new Error('Internal JSON-RPC error.'), { code: -32603, data: { message: 'header not found' } });
    expect(parseContractError(err)).toBe('Transaction failed: header not found');
  });

  it('leaves an error without an inner message as it was', () => {
    expect(parseContractError(Object.assign(new Error('Internal JSON-RPC error.'), { code: -32603 }))).toBe('Transaction failed: Internal JSON-RPC error.');
    expect(parseContractError('plain text')).toBe('Transaction failed: plain text');
    expect(parseContractError(null)).toBe('Transaction failed: Unknown error');
  });
});
