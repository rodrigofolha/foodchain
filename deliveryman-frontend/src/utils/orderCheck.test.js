import { sameAddress, usesReputationContract } from './orderCheck';

const REPUTATION = '0xC2fEe08df38ba9e6D44f09a25f209bB375126F24';
const OTHER = '0x00000000000000000000000000000000000000Aa';

// Minimal stand-in for web3: the order contract answers reputationContract() with `answer`
function fakeWeb3(answer) {
  return {
    eth: {
      Contract: function (abi, address) {
        this.methods = {
          reputationContract: () => ({ call: async () => answer }),
        };
      },
    },
  };
}

describe('sameAddress', () => {
  it('ignores the checksum case', () => {
    expect(sameAddress(REPUTATION, REPUTATION.toLowerCase())).toBe(true);
  });
  it('rejects a different address, an empty value and a non-address', () => {
    expect(sameAddress(REPUTATION, OTHER)).toBe(false);
    expect(sameAddress(undefined, REPUTATION)).toBe(false);
    expect(sameAddress('', '')).toBe(false);
    expect(sameAddress('0x1234', '0x1234')).toBe(false);
  });
});

describe('usesReputationContract', () => {
  it('accepts an order that names the deployed reputation contract', async () => {
    await expect(usesReputationContract(fakeWeb3(REPUTATION.toLowerCase()), OTHER, REPUTATION)).resolves.toBe(true);
  });
  it('rejects an order that names another contract', async () => {
    await expect(usesReputationContract(fakeWeb3(OTHER), OTHER, REPUTATION)).resolves.toBe(false);
  });
  it('rejects an order that names no contract', async () => {
    await expect(usesReputationContract(fakeWeb3('0x0000000000000000000000000000000000000000'), OTHER, REPUTATION)).resolves.toBe(false);
  });
});
