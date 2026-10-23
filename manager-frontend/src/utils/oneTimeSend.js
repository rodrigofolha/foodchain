/* global BigInt */
// Gas limits of the transactions this dApp sends.
//
// No transaction carries a fixed gas limit: what a call costs depends on the network's gas
// schedule (on Sepolia since 2026-10-06 a new storage slot costs about five times what it
// costs on the main network). The limit is the node's estimate for the call as it would run
// now, times GAS_MARGIN_PERCENT. The margin is for what can change before the call is mined
// (another note in the pool's tree, a worker's first record); calls that give gas back at the
// end need a limit up to 1.20 times the gas they finally use, which the node's estimate already
// includes.
//
// When no estimate can be made, nothing is sent: either the call would revert (the node says
// why) or the node did not answer. There is no fallback limit.
//
// A transaction from an order's one-time address is paid by that address. Its balance must
// cover the gas limit times the gas price (a legacy gas price, so that this is the exact amount
// the node asks for) plus the value sent; otherwise nothing is sent and the error says how
// much is missing.

import { parseContractError } from './contractErrors';

export const GAS_MARGIN_PERCENT = 120;

/** @returns {BigInt} the gas limit to send for an estimate */
export function withGasMargin(estimate) {
  return (BigInt(String(estimate)) * BigInt(GAS_MARGIN_PERCENT) + 99n) / 100n;
}

/** Wei as ETH, with up to 6 decimals (at least one significant digit for a small amount). */
export function formatEth(wei) {
  var value = BigInt(String(wei));
  var negative = value < 0n;
  if (negative) value = -value;
  var whole = value / 10n ** 18n;
  var fraction = (value % 10n ** 18n).toString().padStart(18, '0');
  var shown = fraction.slice(0, 6);
  if (/^0*$/.test(shown) && !/^0*$/.test(fraction)) shown = fraction.slice(0, fraction.search(/[1-9]/) + 2);
  shown = shown.replace(/0+$/, '');
  return (negative ? '-' : '') + whole.toString() + (shown ? '.' + shown : '') + ' ETH';
}

function estimateError(err) {
  var error = err instanceof Error ? err : new Error(String((err && err.message) || err));
  error.estimateFailed = true;
  return error;
}

/** True when nothing was sent because the gas of the call could not be estimated. */
export function isEstimateError(err) {
  return !!err && err.estimateFailed === true;
}

/** True when nothing was sent because the one-time address cannot pay for the transaction. */
export function isShortOfGasError(err) {
  return !!err && err.shortOfGas === true;
}

/**
 * Sends a call of a web3 contract from the person's wallet with the estimate times the margin.
 *
 * @param {Object} call - contract.methods.name(...args)
 * @param {Object} options - { from, value }
 * @returns the receipt
 * @throws an error for which isEstimateError is true when the gas could not be estimated
 */
export async function sendFromWallet(call, options) {
  var estimate;
  try {
    estimate = await call.estimateGas(options);
  } catch (err) {
    throw estimateError(err);
  }
  return call.send(Object.assign({}, options, { gas: withGasMargin(estimate).toString() }));
}

/**
 * What the one-time address must hold for a transaction, against what it holds.
 * @returns {Object} { cost, missing } as BigInt (missing is 0 when the balance is enough)
 */
export function upfrontCost(balance, gasLimit, gasPrice, value) {
  var cost = BigInt(String(gasLimit)) * BigInt(String(gasPrice)) + BigInt(String(value || 0));
  var held = BigInt(String(balance));
  return { cost: cost, missing: cost > held ? cost - held : 0n };
}

function shortOfGasError(balance, gasLimit, gasPrice, value) {
  var need = upfrontCost(balance, gasLimit, gasPrice, value);
  var sent = BigInt(String(value || 0));
  var gas = BigInt(String(gasLimit));
  var why = gas > 0n
    ? 'a gas limit of ' + gas.toString() + ' at the current gas price' + (sent > 0n ? ', plus ' + formatEth(sent) + ' sent with it' : '')
    : 'the amount sent with it, before any gas';
  var error = new Error("The order's one-time address holds " + formatEth(balance) + ' and this transaction needs up to '
    + formatEth(need.cost) + ' (' + why + '): ' + formatEth(need.missing) + ' is missing. Nothing was sent. '
    + 'Money from your own wallet would link this order to you; try again when the gas price is lower.');
  error.shortOfGas = true;
  error.missing = need.missing;
  error.cost = need.cost;
  return error;
}

/**
 * Gas limit and gas price for a call from an order's one-time address, after checking that the
 * address can pay for it.
 *
 * @param {Object} contract - ethers v5 Contract connected to the one-time wallet
 * @param {string} method
 * @param {Array} args
 * @param {Object} [options] - { value } in wei
 * @returns {Promise<Object>} overrides for the call: { gasLimit, gasPrice[, value] } (strings)
 * @throws an error for which isShortOfGasError or isEstimateError is true; nothing was sent
 */
export async function oneTimeOverrides(contract, method, args, options) {
  var provider = contract.provider;
  var from = await contract.signer.getAddress();
  var value = BigInt(String((options && options.value) || 0));
  var balance = BigInt((await provider.getBalance(from)).toString());
  // without the value the node could not even run the call
  if (balance < value) throw shortOfGasError(balance, 0, 0, value);

  var estimate;
  try {
    estimate = await contract.estimateGas[method].apply(contract, args.concat([value > 0n ? { value: value.toString() } : {}]));
  } catch (err) {
    throw estimateError(err);
  }
  var gasLimit = withGasMargin(estimate.toString());
  var gasPrice = BigInt((await provider.getGasPrice()).toString());
  balance = BigInt((await provider.getBalance(from)).toString());
  if (upfrontCost(balance, gasLimit, gasPrice, value).missing > 0n) throw shortOfGasError(balance, gasLimit, gasPrice, value);

  var overrides = { gasLimit: gasLimit.toString(), gasPrice: gasPrice.toString() };
  if (value > 0n) overrides.value = value.toString();
  return overrides;
}

/**
 * Sends a call from an order's one-time address and waits for it to be mined.
 * @returns {Promise<Object>} the receipt
 */
export async function sendOneTime(contract, method, args, options) {
  var overrides = await oneTimeOverrides(contract, method, args, options);
  var tx = await contract[method].apply(contract, args.concat([overrides]));
  return tx.wait();
}

/** What to tell the person when a transaction of this file failed or was not sent. */
export function sendErrorText(err) {
  if (isShortOfGasError(err)) return err.message;
  if (isEstimateError(err)) return parseContractError(err) + ' Nothing was sent.';
  return parseContractError(err);
}
