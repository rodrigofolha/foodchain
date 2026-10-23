import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';

import QrScanner from './index';
import { isHandoverSignature } from '../../utils/handoverSignature';

// Fake camera scanner: records what the component asks of html5-qrcode and
// lets the test deliver decoded text. Plain methods instead of jest.fn(),
// because CRA resets mock implementations before each test.
const mockScanners = [];
let mockStartError = null;
let mockStartGate = null; // a promise that delays the camera start

jest.mock('html5-qrcode', () => ({
  Html5QrcodeSupportedFormats: { QR_CODE: 0 },
  Html5Qrcode: class {
    constructor(elementId, config) {
      this.elementId = elementId;
      this.config = config;
      this.elementInDom = global.document.getElementById(elementId) !== null;
      this.startArgs = null;
      this.onSuccess = null;
      this.stopCalls = 0;
      mockScanners.push(this);
    }
    start(cameraIdOrConfig, configuration, onSuccess, onError) {
      this.startArgs = { cameraIdOrConfig, configuration, onError };
      this.onSuccess = onSuccess;
      if (mockStartError) return Promise.reject(mockStartError);
      return mockStartGate ? mockStartGate.then(() => null) : Promise.resolve(null);
    }
    stop() {
      this.stopCalls += 1;
      return Promise.resolve();
    }
    clear() {}
  },
}));

const SIG = '0x' + 'cd'.repeat(32) + '0e'.repeat(32) + '1c';
const INVALID = 'This QR code is not a delivery confirmation.';

function renderScanner(props = {}) {
  return render(
    <QrScanner
      onScan={props.onScan || (() => {})}
      onClose={props.onClose || (() => {})}
      validate={isHandoverSignature}
      invalidMessage={INVALID}
      prompt="Point the camera at the QR code."
    />
  );
}

async function waitForCamera() {
  await screen.findByText('Point the camera at the QR code.');
  return mockScanners[mockScanners.length - 1];
}

beforeEach(() => {
  mockScanners.length = 0;
  mockStartError = null;
  mockStartGate = null;
});

describe('QrScanner', () => {
  it('opens the rear camera on a container with a unique id', async () => {
    const first = renderScanner();
    const second = renderScanner();
    await waitFor(() => expect(mockScanners.every(s => s.startArgs !== null)).toBe(true));

    expect(mockScanners).toHaveLength(2);
    const [a, b] = mockScanners;
    expect(a.elementId).not.toBe(b.elementId);
    expect(a.elementInDom && b.elementInDom).toBe(true);
    expect(first.container.querySelector('#' + a.elementId)).not.toBeNull();
    expect(second.container.querySelector('#' + b.elementId)).not.toBeNull();
    expect(a.startArgs.cameraIdOrConfig).toEqual({ facingMode: 'environment' });
    expect(a.config.formatsToSupport).toEqual([0]);
  });

  it('rejects text that is not a signature and keeps scanning', async () => {
    const onScan = jest.fn();
    renderScanner({ onScan });
    const scanner = await waitForCamera();

    act(() => { scanner.onSuccess('123456'); });
    act(() => { scanner.onSuccess(SIG.slice(0, -2)); });

    expect(screen.getByText(INVALID)).toBeTruthy();
    expect(onScan).not.toHaveBeenCalled();
    expect(scanner.stopCalls).toBe(0);
  });

  it('accepts a signature once, stops the camera, then reports it', async () => {
    const onScan = jest.fn();
    renderScanner({ onScan });
    const scanner = await waitForCamera();

    act(() => {
      scanner.onSuccess('  ' + SIG + '\n');
      scanner.onSuccess(SIG); // the camera keeps decoding until it stops
    });
    await waitFor(() => expect(onScan).toHaveBeenCalledTimes(1));

    expect(onScan).toHaveBeenCalledWith(SIG);
    expect(scanner.stopCalls).toBe(1);
  });

  it('stops the camera when closed', async () => {
    const onClose = jest.fn();
    renderScanner({ onClose });
    const scanner = await waitForCamera();

    fireEvent.click(screen.getByText('Close camera'));
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(scanner.stopCalls).toBe(1);
  });

  it('stops the camera when unmounted', async () => {
    const { unmount } = renderScanner();
    const scanner = await waitForCamera();
    unmount();
    await waitFor(() => expect(scanner.stopCalls).toBe(1));
  });

  it('stops a camera that finishes starting after the scanner was unmounted', async () => {
    let openCamera;
    mockStartGate = new Promise(resolve => { openCamera = resolve; });
    const { unmount } = renderScanner();
    await waitFor(() => expect(mockScanners[0].startArgs).not.toBeNull());

    unmount();
    await act(() => Promise.resolve());
    expect(mockScanners[0].stopCalls).toBe(0); // stop() would throw while starting

    openCamera();
    await waitFor(() => expect(mockScanners[0].stopCalls).toBe(1));
  });

  it('does not open the camera when unmounted before it starts', async () => {
    const { unmount } = renderScanner();
    unmount();
    await act(() => Promise.resolve());
    expect(mockScanners[0].startArgs).toBeNull();
    expect(mockScanners[0].stopCalls).toBe(0);
  });

  it('shows the camera error and does not try to stop a camera that never started', async () => {
    mockStartError = 'NotAllowedError: Permission denied';
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    const { unmount } = renderScanner();

    expect(await screen.findByText(/Could not open the camera \(NotAllowedError: Permission denied\)/)).toBeTruthy();
    unmount();
    await act(() => Promise.resolve());
    expect(mockScanners[0].stopCalls).toBe(0);
    expect(consoleError).toHaveBeenCalledWith('QR scanner failed to start:', mockStartError);
    consoleError.mockRestore();
  });

  it('prints the message of a camera error, not the error object', async () => {
    mockStartError = Object.assign(new Error('Requested device not found'), { name: 'NotFoundError' });
    const written = [];
    const consoleError = jest.spyOn(console, 'error').mockImplementation((...args) => { written.push(args); });
    const { unmount } = renderScanner();

    expect(await screen.findByText(/Could not open the camera \(Requested device not found\)/)).toBeTruthy();
    unmount();
    await act(() => Promise.resolve());
    consoleError.mockRestore();
    expect(written).toEqual([['QR scanner failed to start:', 'Requested device not found']]);
  });
});
