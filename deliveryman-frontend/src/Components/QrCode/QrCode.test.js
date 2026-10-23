import React from 'react';
import { render } from '@testing-library/react';

import QrCode from './index';

const SIG = '0x' + '5f'.repeat(32) + 'a0'.repeat(32) + '1c';

describe('QrCode', () => {
  it('renders a 220px SVG QR code for a 132-character signature', () => {
    expect(SIG).toHaveLength(132);
    const { container, getByRole } = render(<QrCode value={SIG} label="Pickup confirmation QR code" />);

    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(getByRole('img', { name: 'Pickup confirmation QR code' })).toBe(svg);
    expect(svg.getAttribute('width')).toBe('220');
    expect(svg.getAttribute('height')).toBe('220');

    // 132 bytes at error correction M need a version 8 symbol (49 modules);
    // with the 4-module white margin on each side the grid is 57 modules wide.
    // Level L would fit in version 7 (45 + 8 = 53).
    expect(svg.getAttribute('viewBox')).toBe('0 0 57 57');

    const paths = svg.querySelectorAll('path');
    expect(paths).toHaveLength(2);
    expect(paths[0].getAttribute('fill')).toBe('#ffffff'); // background + margin
    expect(paths[1].getAttribute('fill')).toBe('#000000'); // dark modules
    expect(paths[1].getAttribute('d').length).toBeGreaterThan(100);
  });

  it('draws different codes for different signatures', () => {
    const other = '0x' + '11'.repeat(64) + '1b';
    const a = render(<QrCode value={SIG} />).container.querySelectorAll('path')[1].getAttribute('d');
    const b = render(<QrCode value={other} />).container.querySelectorAll('path')[1].getAttribute('d');
    expect(a).not.toBe(b);
  });

  it('renders nothing without a value', () => {
    const { container } = render(<QrCode value={null} />);
    expect(container.querySelector('svg')).toBeNull();
    expect(container.innerHTML).toBe('');
  });
});
