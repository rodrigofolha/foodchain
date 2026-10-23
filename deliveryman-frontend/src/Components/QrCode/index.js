import React from 'react';
import { QRCodeSVG } from 'qrcode.react';

import { QrContainer } from './styles';

// Shows `value` as a QR code: error correction M, white quiet zone (margin).
export default function QrCode({ value, size = 220, label = 'QR code' }) {
  if (!value) return null;
  return (
    <QrContainer>
      <QRCodeSVG
        value={value}
        size={size}
        level="M"
        includeMargin={true}
        bgColor="#ffffff"
        fgColor="#000000"
        role="img"
        aria-label={label}
      />
    </QrContainer>
  );
}
