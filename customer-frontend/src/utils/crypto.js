const ethUtil = require('ethereumjs-util');
const sigUtil = require('eth-sig-util');

export function encrypt(encryptPublicKey, data)  {
  console.log(JSON.stringify(data))
  let encoded = ethUtil.bufferToHex(
    Buffer.from(JSON.stringify(
      sigUtil.encrypt(
        encryptPublicKey,
        { data: JSON.stringify(data)},
        'x25519-xsalsa20-poly1305'
      )
    ), 'utf8')
  );

  return encoded;
}


export async function decrypt(account, encodedData) {
  let data = await window.ethereum.request({method: 'eth_decrypt', params: [encodedData, account]});
  return data;
}