// A handover confirmation (pickup or delivery) is a 65-byte EIP-191 signature
// over Chain.handoverDigest, written as 0x followed by 130 hex characters.
export const HANDOVER_SIGNATURE_PATTERN = /^0x[0-9a-fA-F]{130}$/;

export function isHandoverSignature(value) {
  return typeof value === 'string' && HANDOVER_SIGNATURE_PATTERN.test(value);
}
