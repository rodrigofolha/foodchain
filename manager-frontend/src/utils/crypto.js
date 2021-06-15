
export function decrypt(account, encodedData) {
  return window.ethereum.request({method: 'eth_decrypt', params: [encodedData, account]});
}