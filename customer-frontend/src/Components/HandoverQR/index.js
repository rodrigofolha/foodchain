import React from 'react';
import QRCode from 'qrcode.react';

// QR code of a handover signature (0x + 130 hex chars) so the delivery worker
// can scan it instead of copying the text. Rendered as SVG so it stays sharp,
// with level M error correction and the standard 4-module white quiet zone.
export default function HandoverQR({ value, size = 220 }) {
  if (!value) return null;

  return (
    <QRCode
      value={value}
      renderAs="svg"
      level="M"
      size={size}
      includeMargin
      bgColor="#FFFFFF"
      fgColor="#000000"
      role="img"
      aria-label="Delivery confirmation QR code"
    />
  );
}
