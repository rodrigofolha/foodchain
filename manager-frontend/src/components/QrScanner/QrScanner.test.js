import React from 'react';
import { render, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';

import QrScanner from './index';
import { isHandoverSignature } from '../../utils/handoverSignature';

const mockInstances = [];

jest.mock('html5-qrcode', () => ({
  Html5QrcodeSupportedFormats: { QR_CODE: 0 },
  Html5Qrcode: jest.fn().mockImplementation(function (elementId) {
    const instance = {
      elementId,
      isScanning: false,
      onSuccess: null,
      start: jest.fn((camera, config, onSuccess) => {
        instance.isScanning = true;
        instance.onSuccess = onSuccess;
        return Promise.resolve(null);
      }),
      stop: jest.fn(() => {
        instance.isScanning = false;
        return Promise.resolve();
      }),
      clear: jest.fn(),
    };
    mockInstances.push(instance);
    return instance;
  }),
}));

const { Html5Qrcode } = require('html5-qrcode');

const SIGNATURE = '0x' + '1f'.repeat(64) + '1c';

// Let the scanner's promise chain (start / stop / clear) settle.
const flush = () => act(() => new Promise((resolve) => setTimeout(resolve, 0)));

beforeEach(() => {
  mockInstances.length = 0;
  Html5Qrcode.mockClear();
});

describe('QrScanner', () => {
  it('renders its container without starting the camera', async () => {
    const { getByTestId, getByText } = render(
      <QrScanner buttonLabel="Scan worker's QR" onScan={jest.fn()} />
    );

    const container = getByTestId('qr-reader');
    expect(container).toBeInTheDocument();
    expect(container.id).toMatch(/^qr-scanner-\d+$/);
    expect(document.getElementById(container.id)).toBe(container);
    expect(getByText("Scan worker's QR")).toBeInTheDocument();

    await flush();
    expect(Html5Qrcode).not.toHaveBeenCalled();
  });

  it('gives every instance its own container id', () => {
    const { getAllByTestId } = render(
      <div>
        <QrScanner onScan={jest.fn()} />
        <QrScanner onScan={jest.fn()} />
      </div>
    );
    const ids = getAllByTestId('qr-reader').map((el) => el.id);
    expect(ids).toHaveLength(2);
    expect(ids[0]).not.toBe(ids[1]);
  });

  it('opens the rear camera on click', async () => {
    const { getByTestId, getByText } = render(
      <QrScanner buttonLabel="Scan worker's QR" onScan={jest.fn()} />
    );
    const containerId = getByTestId('qr-reader').id;

    fireEvent.click(getByText("Scan worker's QR"));
    await flush();

    expect(Html5Qrcode).toHaveBeenCalledTimes(1);
    expect(Html5Qrcode.mock.calls[0][0]).toBe(containerId);
    expect(Html5Qrcode.mock.calls[0][1].formatsToSupport).toEqual([0]);
    const scanner = mockInstances[0];
    expect(scanner.start).toHaveBeenCalledTimes(1);
    expect(scanner.start.mock.calls[0][0]).toEqual({ facingMode: 'environment' });
    expect(getByText('Close camera')).toBeInTheDocument();
  });

  it('accepts a valid scan and stops the camera', async () => {
    const onScan = jest.fn();
    const { getByText } = render(
      <QrScanner buttonLabel="Scan worker's QR" validate={isHandoverSignature} onScan={onScan} />
    );

    fireEvent.click(getByText("Scan worker's QR"));
    await flush();
    const scanner = mockInstances[0];

    act(() => { scanner.onSuccess('  ' + SIGNATURE + '\n'); });
    // Later frames of the same code are ignored.
    act(() => { scanner.onSuccess(SIGNATURE); });
    await flush();

    expect(onScan).toHaveBeenCalledTimes(1);
    expect(onScan).toHaveBeenCalledWith(SIGNATURE);
    expect(scanner.stop).toHaveBeenCalledTimes(1);
    expect(scanner.clear).toHaveBeenCalledTimes(1);
    expect(getByText("Scan worker's QR")).toBeInTheDocument();
  });

  it('rejects a QR that is not a signature and keeps scanning', async () => {
    const onScan = jest.fn();
    const { getByText } = render(
      <QrScanner
        buttonLabel="Scan worker's QR"
        validate={isHandoverSignature}
        invalidMessage="Not a pickup confirmation."
        onScan={onScan} />
    );

    fireEvent.click(getByText("Scan worker's QR"));
    await flush();
    const scanner = mockInstances[0];

    act(() => { scanner.onSuccess('https://example.com/menu'); });
    act(() => { scanner.onSuccess(SIGNATURE.slice(0, -2)); });
    await flush();

    expect(onScan).not.toHaveBeenCalled();
    expect(scanner.stop).not.toHaveBeenCalled();
    expect(getByText('Not a pickup confirmation.')).toBeInTheDocument();
    expect(getByText('Close camera')).toBeInTheDocument();
  });

  it('stops the camera when closed', async () => {
    const onScan = jest.fn();
    const { getByText } = render(
      <QrScanner buttonLabel="Scan worker's QR" onScan={onScan} />
    );

    fireEvent.click(getByText("Scan worker's QR"));
    await flush();
    const scanner = mockInstances[0];

    fireEvent.click(getByText('Close camera'));
    await flush();

    expect(scanner.stop).toHaveBeenCalledTimes(1);
    expect(scanner.clear).toHaveBeenCalledTimes(1);
    expect(onScan).not.toHaveBeenCalled();
    expect(getByText("Scan worker's QR")).toBeInTheDocument();
  });

  it('stops the camera when unmounted while scanning', async () => {
    const { getByText, unmount } = render(
      <QrScanner buttonLabel="Scan worker's QR" onScan={jest.fn()} />
    );

    fireEvent.click(getByText("Scan worker's QR"));
    await flush();
    const scanner = mockInstances[0];

    unmount();
    await flush();

    expect(scanner.stop).toHaveBeenCalledTimes(1);
  });

  it('keeps one camera open across instances', async () => {
    const { getAllByText } = render(
      <div>
        <QrScanner buttonLabel="Scan" onScan={jest.fn()} />
        <QrScanner buttonLabel="Scan" onScan={jest.fn()} />
      </div>
    );

    fireEvent.click(getAllByText('Scan')[0]);
    await flush();
    fireEvent.click(getAllByText('Scan')[0]); // the second card's button
    await flush();

    expect(mockInstances).toHaveLength(2);
    expect(mockInstances[0].elementId).not.toBe(mockInstances[1].elementId);
    expect(mockInstances[0].stop).toHaveBeenCalledTimes(1);
    expect(mockInstances[1].isScanning).toBe(true);
  });

  it('shows the error and closes when the camera cannot start', async () => {
    const { getByText } = render(
      <QrScanner buttonLabel="Scan worker's QR" onScan={jest.fn()} />
    );
    Html5Qrcode.mockImplementationOnce(function (elementId) {
      const instance = {
        elementId,
        isScanning: false,
        start: jest.fn(() => Promise.reject(new Error('Permission denied'))),
        stop: jest.fn(),
        clear: jest.fn(),
      };
      mockInstances.push(instance);
      return instance;
    });

    fireEvent.click(getByText("Scan worker's QR"));
    await flush();

    expect(getByText('Could not open the camera: Permission denied')).toBeInTheDocument();
    expect(getByText("Scan worker's QR")).toBeInTheDocument();
    expect(mockInstances[0].stop).not.toHaveBeenCalled();
  });
});
