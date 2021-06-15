export async function decrypt(account, encodedData) {
  let data = await window.ethereum.request({method: 'eth_decrypt', params: [encodedData, account]});
  return data;
}