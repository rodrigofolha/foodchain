const ethUtil = require('ethereumjs-util');
const sigUtil = require('eth-sig-util');

export async function getEncryptionPublicKey(account) {
  return await window.ethereum.request({
    method: 'eth_getEncryptionPublicKey',
    params: [account],
  });
}

export function encrypt(encryptPublicKey, data) {
  let encoded = ethUtil.bufferToHex(
    Buffer.from(JSON.stringify(
      sigUtil.encrypt(
        encryptPublicKey,
        { data: JSON.stringify(data) },
        'x25519-xsalsa20-poly1305'
      )
    ), 'utf8')
  );
  return encoded;
}

export function decrypt(account, encodedData) {
  return window.ethereum.request({method: 'eth_decrypt', params: [encodedData, account]});
}
