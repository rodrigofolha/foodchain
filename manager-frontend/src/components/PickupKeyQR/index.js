import React from 'react';
import QRCode from 'qrcode.react';

// QR code of a pickup key (dcpk1: + 22 characters) for the worker to scan at
// pickup. Rendered as SVG, with level M error correction and the standard
// 4-module white quiet zone.
export default function PickupKeyQR({ value, size = 200 }) {
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
      aria-label="Pickup key QR code"
    />
  );
}
