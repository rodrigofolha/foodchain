/* global BigInt */
/**
 * Price scaling utilities.
 * On-chain prices are stored as: 1 U$ = 10^15 wei (0.001 ETH).
 */

var WEI_PER_DOLLAR = '1000000000000000'; // 10^15

/**
 * Convert a U$ amount to wei for on-chain transactions.
 * @param {number} dollars - Amount in U$
 * @returns {string} Amount in wei as string
 */
function dollarsToWei(dollars) {
  // Multiply by 10^15, handling decimals by using integer math
  var cents = Math.round(dollars * 100);
  // cents * 10^15 / 100 = cents * 10^13
  var wei = BigInt(cents) * BigInt('10000000000000'); // 10^13
  return wei.toString();
}

/**
 * Convert a wei amount from on-chain to U$ for display.
 * @param {string|number} wei - Amount in wei
 * @returns {string} Amount in U$ formatted with 2 decimals
 */
function weiToDollars(wei) {
  var weiStr = String(wei);
  if (weiStr === '0') return '0.00';
  // Divide by 10^15
  var weiBig = BigInt(weiStr);
  var dollars = Number(weiBig) / 1e15;
  return dollars.toFixed(2);
}

module.exports = {
  WEI_PER_DOLLAR: WEI_PER_DOLLAR,
  dollarsToWei: dollarsToWei,
  weiToDollars: weiToDollars
};
