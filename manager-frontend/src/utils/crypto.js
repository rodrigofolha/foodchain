
export async function getEncryptionPublicKey(account) {
  return await window.ethereum.request({
    method: 'eth_getEncryptionPublicKey',
    params: [account],
  });
}

export function decrypt(account, encodedData) {
  return window.ethereum.request({method: 'eth_decrypt', params: [encodedData, account]});
}
