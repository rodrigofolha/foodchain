// The total of an order is public on-chain and is a sum of menu prices. Totals made
// of whole prices are common to many menus, so they say less about which
// establishment received the order. The dApp recommends whole prices; it does not
// require them.
export const WHOLE_PRICE_HINT =
  'Prefer whole prices (for example 8 instead of 7.98). The total of an order is public, ' +
  'and totals made of whole prices say less about which establishment received the order.';

export const NOT_WHOLE_PRICE_NOTICE =
  'This price is not a whole number. It is accepted, but see the note above.';

// True for an empty field and for a whole number; false for a number with cents.
// Text that is not a number is left to the form's own validation.
export function isWholePrice(value) {
  const text = String(value === undefined || value === null ? '' : value).trim();
  if (text === '') return true;
  const number = Number(text.replace(',', '.'));
  if (!Number.isFinite(number)) return true;
  return Number.isInteger(number);
}
