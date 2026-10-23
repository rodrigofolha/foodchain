import { parseContractError, errorText, isWalletOrContractError, detailsErrorText, DETAILS_NOT_OPENED } from './contractErrors';

describe('parseContractError', () => {
  const revert = reason => new Error("VM Exception while processing transaction: reverted with reason string '" + reason + "'");

  it('explains the refusals of a rating', () => {
    expect(parseContractError(revert('Already rated'))).toMatch(/already rated/);
    expect(parseContractError(revert('Score must be between 1 and 5'))).toMatch(/between 1 and 5/);
    expect(parseContractError(revert('Only the establishment rates a worker who left before pickup')))
      .toMatch(/Only the establishment can rate/);
    expect(parseContractError(revert('This worker cannot be rated on this order'))).toMatch(/cannot be rated/);
    expect(parseContractError(revert('This caller is unauthorized'))).toMatch(/not allowed/);
  });

  it('explains the refusals of an order and of the delivery details', () => {
    expect(parseContractError(revert('Unknown reputation contract'))).toMatch(/order was not placed/);
    expect(parseContractError(revert('Gas stipend exceeds total'))).toMatch(/too small/);
    expect(parseContractError(revert('Gas stipend transfer failed'))).toMatch(/stipend could not be paid/);
    expect(parseContractError(revert('Clone failed'))).toMatch(/could not be created/);
    expect(parseContractError(revert("Only the order's customer"))).toMatch(/Only the customer/);
    expect(parseContractError(revert('Function cannot be called at this step'))).toMatch(/Reload the page/);
  });

  it('keeps the wallet and fallback messages', () => {
    expect(parseContractError(new Error('MetaMask Tx Signature: User denied transaction signature.'))).toMatch(/rejected in MetaMask/);
    expect(parseContractError(new Error('Transaction has been reverted by the EVM'))).toMatch(/^Transaction failed\./);
    expect(parseContractError(new Error('something else'))).toBe('Transaction failed: something else');
  });
});

describe('errorText', () => {
  it('names a format error without quoting what was read', () => {
    let err;
    try { JSON.parse('Rua das Flores 12, apto 3'); } catch (e) { err = e; }
    expect(err).toBeInstanceOf(SyntaxError);
    expect(errorText(err)).toBe('The content is not in a format this app can open.');
    expect(errorText(err)).not.toMatch(/Rua|Flores/);
  });

  it('is the message for the person otherwise, as a string', () => {
    const err = Object.assign(new Error('MetaMask Tx Signature: User denied transaction signature.'), { data: { secret: 'x' } });
    expect(errorText(err)).toBe(parseContractError(err));
    expect(typeof errorText({ code: -32603 })).toBe('string');
  });
});

describe('detailsErrorText', () => {
  const revert = reason => new Error("VM Exception while processing transaction: reverted with reason string '" + reason + "'");

  it('describes an error of the wallet or of a contract', () => {
    const denied = Object.assign(new Error('MetaMask Decryption: User denied message decryption.'), { code: 4001 });
    expect(isWalletOrContractError(denied)).toBe(true);
    expect(detailsErrorText(denied)).toBe('Transaction was rejected in MetaMask.');
    expect(isWalletOrContractError(revert('This caller is unauthorized'))).toBe(true);
    expect(detailsErrorText(revert('This caller is unauthorized'))).toBe(parseContractError(revert('This caller is unauthorized')));
    expect(detailsErrorText(new Error('Too Many Requests'))).toMatch(/network is busy/);
    // a provider error this app has no text for: its code says where it comes from
    const internal = Object.assign(new Error('Internal JSON-RPC error.'), { code: -32603 });
    expect(isWalletOrContractError(internal)).toBe(true);
    expect(detailsErrorText(internal)).toBe('Transaction failed: Internal JSON-RPC error.');
  });

  it('gives a fixed text for any other error, whatever its message quotes', () => {
    const other = [
      new Error('bad payload: Rua das Flores 123, ap 45'),
      new TypeError("Cannot read property 'deliveryAddress' of undefined"),
      new Error('Unexpected order format'),
      Object.assign(new Error('Network Error'), { code: 'ECONNABORTED' }),
      Object.assign(new Error('x'), { code: 0 }),
      'Rua das Flores 123',
      { message: 'Rua das Flores 123' },
      undefined,
      null,
    ];
    other.forEach((err) => {
      expect(isWalletOrContractError(err)).toBe(false);
      expect(detailsErrorText(err)).toBe(DETAILS_NOT_OPENED);
    });
    expect(DETAILS_NOT_OPENED).toBe('The details of this order could not be opened.');
  });

  it('names a format error without quoting what was read', () => {
    let err;
    try { JSON.parse('Rua das Flores 12, apto 3'); } catch (e) { err = e; }
    expect(detailsErrorText(err)).toBe('The content is not in a format this app can open.');
  });

  it('leaves the messages of the other paths as they were', () => {
    expect(parseContractError(new Error('something else'))).toBe('Transaction failed: something else');
    expect(errorText(new Error('something else'))).toBe('Transaction failed: something else');
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
