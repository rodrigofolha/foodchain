import React from 'react';
import { render } from '@testing-library/react';
import PickupKeyQR from './index';

const KEY_WORKER_1 = 'dcpk1:mHyYqQwT6_c5_b6cKAwtyQ';
const KEY_WORKER_2 = 'dcpk1:Vh32Dp3DFxebtDusHX79Hw';

describe('PickupKeyQR', () => {
  it('renders the pickup key as an SVG QR code', () => {
    const { container } = render(<PickupKeyQR value={KEY_WORKER_1} />);
    const svg = container.querySelector('svg');

    expect(svg).not.toBeNull();
    expect(svg.getAttribute('width')).toBe('200');
    expect(svg.getAttribute('height')).toBe('200');
    expect(svg.getAttribute('aria-label')).toBe('Pickup key QR code');

    // 28 bytes at level M need a version 3 symbol (29x29 modules); the white
    // margin adds 4 modules on each side, so the grid is 37x37.
    expect(svg.getAttribute('viewBox')).toBe('0 0 37 37');

    const [background, modules] = svg.querySelectorAll('path');
    expect(background.getAttribute('fill')).toBe('#FFFFFF');
    expect(modules.getAttribute('fill')).toBe('#000000');
    expect(modules.getAttribute('d').length).toBeGreaterThan(0);
  });

  it('draws different codes for different keys', () => {
    const a = render(<PickupKeyQR value={KEY_WORKER_1} />).container.querySelectorAll('path')[1].getAttribute('d');
    const b = render(<PickupKeyQR value={KEY_WORKER_2} />).container.querySelectorAll('path')[1].getAttribute('d');
    expect(a).not.toBe(b);
  });

  it('renders nothing without a key', () => {
    const { container } = render(<PickupKeyQR value={null} />);
    expect(container.querySelector('svg')).toBeNull();
  });
});
