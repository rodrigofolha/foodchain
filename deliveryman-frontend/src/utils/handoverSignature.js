// A handover confirmation (pickup or delivery) is a 65-byte EIP-191 signature
// over Chain.handoverDigest, written as 0x followed by 130 hex characters.
export const HANDOVER_SIGNATURE_REGEX = /^0x[0-9a-fA-F]{130}$/;

/**
 * Returns true when `text` has the exact shape of a handover signature.
 * It only checks the format; the contract checks who signed it.
 */
export function isHandoverSignature(text) {
  return typeof text === 'string' && HANDOVER_SIGNATURE_REGEX.test(text);
}
