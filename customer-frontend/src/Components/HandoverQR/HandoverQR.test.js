import React from 'react';
import { render } from '@testing-library/react';
import HandoverQR from './index';

// 65-byte signature shape: 0x + r (32 bytes) + s (32 bytes) + v (1 byte).
const SAMPLE_SIGNATURE =
  '0x81fc0112142558b64e4a86ea78c9744082b7a9e51da214a814d4ae469412115b' +
  '43a985b5fc5c146398c07b2b4e4e9d2bf2b0183b91af3e53eb54d39c56e6ccd01b';

describe('HandoverQR', () => {
  it('renders the signature as an SVG QR code', () => {
    expect(SAMPLE_SIGNATURE).toHaveLength(132);

    const { container } = render(<HandoverQR value={SAMPLE_SIGNATURE} />);
    const svg = container.querySelector('svg');

    expect(svg).not.toBeNull();
    expect(svg.getAttribute('width')).toBe('220');
    expect(svg.getAttribute('height')).toBe('220');

    // 132 bytes at level M need a version 8 symbol (49x49 modules); the white
    // margin adds 4 modules on each side, so the grid is 57x57. At level L the
    // same data would fit version 6 (41 modules), so this also checks level M.
    expect(svg.getAttribute('viewBox')).toBe('0 0 57 57');

    const [background, modules] = svg.querySelectorAll('path');
    expect(background.getAttribute('fill')).toBe('#FFFFFF');
    expect(background.getAttribute('d')).toBe('M0,0 h57v57H0z');
    expect(modules.getAttribute('fill')).toBe('#000000');
    expect(modules.getAttribute('d').length).toBeGreaterThan(0);
  });

  it('renders nothing without a signature', () => {
    const { container } = render(<HandoverQR value={null} />);
    expect(container.querySelector('svg')).toBeNull();
  });
});
