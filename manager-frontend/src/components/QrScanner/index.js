import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';

import { Container, ScanButton } from './styles';

let nextScannerId = 0;
// Only one camera is open at a time, even with several cards on the page.
let closeActiveScanner = null;

function describeError(err) {
  if (!err) return 'unknown error';
  if (typeof err === 'string') return err;
  return err.message || err.name || String(err);
}

function cameraErrorMessage(err) {
  const hint = window.isSecureContext === false
    ? ' The camera only works on HTTPS pages or on localhost.'
    : '';
  return 'Could not open the camera: ' + describeError(err) + hint;
}

// The square the decoder looks at: 80% of the smaller side of the video.
function qrboxSize(width, height) {
  const side = Math.max(50, Math.floor(Math.min(width, height) * 0.8));
  return { width: side, height: side };
}

export default function QrScanner({
  onScan,
  validate = () => true,
  buttonLabel = 'Scan QR code',
  invalidMessage = 'This QR code is not the expected one. Try again.',
}) {
  const containerIdRef = useRef(null);
  if (containerIdRef.current === null) {
    nextScannerId += 1;
    containerIdRef.current = 'qr-scanner-' + nextScannerId;
  }
  const containerId = containerIdRef.current;

  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');

  // Latest props, read from inside the camera callback.
  const onScanRef = useRef(onScan);
  const validateRef = useRef(validate);
  const invalidMessageRef = useRef(invalidMessage);
  onScanRef.current = onScan;
  validateRef.current = validate;
  invalidMessageRef.current = invalidMessage;

  const mountedRef = useRef(true);
  // Resolves when the previous camera session has fully stopped.
  const idleRef = useRef(Promise.resolve());
  const closeSelf = useCallback(() => setOpen(false), []);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (closeActiveScanner === closeSelf) closeActiveScanner = null;
    };
  }, [closeSelf]);

  useEffect(() => {
    if (!open) return undefined;

    let scanner = null;
    let finished = false;

    const started = idleRef.current.then(() => {
      if (finished) return null;
      scanner = new Html5Qrcode(containerId, {
        formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
        verbose: false,
      });
      return scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: qrboxSize },
        (decodedText) => {
          if (finished) return;
          const text = String(decodedText).trim();
          if (validateRef.current(text)) {
            finished = true;
            setMessage('');
            setOpen(false);
            onScanRef.current(text);
          } else {
            setMessage(invalidMessageRef.current);
          }
        },
        () => {} // called for every frame without a QR code
      );
    }).catch((err) => {
      if (!finished && mountedRef.current) {
        setMessage(cameraErrorMessage(err));
        setOpen(false);
      }
    });

    return () => {
      finished = true;
      if (closeActiveScanner === closeSelf) closeActiveScanner = null;
      idleRef.current = started
        .then(() => (scanner && scanner.isScanning ? scanner.stop() : null))
        .catch((err) => console.log('QR scanner stop error:', describeError(err)))
        .then(() => {
          try {
            if (scanner) scanner.clear();
          } catch (err) {
            console.log('QR scanner clear error:', describeError(err));
          }
        });
    };
  }, [open, containerId, closeSelf]);

  function openCamera() {
    if (closeActiveScanner && closeActiveScanner !== closeSelf) closeActiveScanner();
    closeActiveScanner = closeSelf;
    setMessage('');
    setOpen(true);
  }

  function closeCamera() {
    setOpen(false);
  }

  return (
    <Container className={open ? 'open' : undefined}>
      {open
        ? <ScanButton type="button" secondary onClick={closeCamera}>Close camera</ScanButton>
        : <ScanButton type="button" onClick={openCamera}>{buttonLabel}</ScanButton>}
      <div id={containerId} className="qr-reader" data-testid="qr-reader" />
      {message && <p className="qr-message">{message}</p>}
    </Container>
  );
}
