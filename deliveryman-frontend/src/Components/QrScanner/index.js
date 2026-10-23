import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';

import { ScannerContainer, CloseButton } from './styles';

// Each scanner needs its own container id: html5-qrcode looks the element up
// by id, so two scanners on the same page must not share one.
let instanceCounter = 0;

// Scan box: 80% of the shorter side of the camera image.
function viewfinderBox(viewfinderWidth, viewfinderHeight) {
  const edge = Math.max(50, Math.floor(Math.min(viewfinderWidth, viewfinderHeight) * 0.8));
  return { width: edge, height: edge };
}

// What is shown and printed of a camera error: its message, never the object.
function errorDetail(err) {
  return err && err.message ? err.message : String(err);
}

function cameraErrorMessage(err) {
  const detail = errorDetail(err);
  const hint = window.isSecureContext === false
    ? ' The camera only works on HTTPS pages or on localhost.'
    : '';
  return 'Could not open the camera (' + detail + ').' + hint;
}

/**
 * Opens the rear camera and reads one QR code.
 *
 * - validate(text): optional; a code it rejects shows `invalidMessage` and the
 *   camera keeps scanning.
 * - onScan(text): called once with the accepted (trimmed) text, after the
 *   camera has been stopped.
 * - onClose(): called after the camera has been stopped by the Close button.
 *
 * The camera is also stopped when the component unmounts.
 */
export default function QrScanner({ onScan, onClose, validate, invalidMessage, prompt }) {
  const idRef = useRef(null);
  if (idRef.current === null) {
    instanceCounter += 1;
    idRef.current = 'qr-scanner-' + instanceCounter;
  }
  // Latest props, read from inside the camera callbacks.
  const props = useRef({});
  props.current = { onScan, onClose, validate, invalidMessage };
  const stopRef = useRef(() => Promise.resolve());
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;
    let accepted = false;
    let stopping = null;
    const scanner = new Html5Qrcode(idRef.current, {
      formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
      verbose: false,
    });

    const onDecoded = (decodedText) => {
      if (accepted || !mounted) return;
      const text = String(decodedText).trim();
      const { validate, invalidMessage } = props.current;
      if (validate && !validate(text)) {
        setError(invalidMessage || 'This QR code is not valid here.');
        return;
      }
      accepted = true;
      stopCamera().then(() => {
        if (mounted) props.current.onScan(text);
      });
    };

    // Resolves to true once the camera is running, false if it failed to start
    // or the scanner was closed before it started.
    const started = Promise.resolve()
      .then(() => {
        if (!mounted) return false;
        return scanner.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: viewfinderBox },
          onDecoded,
          () => {} // no QR code in this frame
        ).then(() => true);
      })
      .then((running) => {
        if (running && mounted) setReady(true);
        return running;
      })
      .catch((err) => {
        console.error('QR scanner failed to start:', errorDetail(err));
        if (mounted) setError(cameraErrorMessage(err));
        return false;
      });

    // Stops the camera once, waiting for a start that is still in progress.
    const stopCamera = () => {
      if (!stopping) {
        stopping = started
          .then((running) => (running ? scanner.stop() : undefined))
          .catch((err) => console.warn('QR scanner failed to stop:', errorDetail(err)))
          .then(() => {
            try { scanner.clear(); } catch (_) { /* nothing to clear */ }
          });
      }
      return stopping;
    };
    stopRef.current = stopCamera;

    return () => {
      mounted = false;
      stopCamera();
    };
  }, []);

  const close = () => {
    stopRef.current().then(() => {
      if (props.current.onClose) props.current.onClose();
    });
  };

  return (
    <ScannerContainer>
      <div id={idRef.current} className="viewfinder" />
      {error
        ? <p className="error">{error}</p>
        : <p>{ready ? (prompt || 'Point the camera at the QR code.') : 'Starting camera…'}</p>}
      <CloseButton type="button" onClick={close}>Close camera</CloseButton>
    </ScannerContainer>
  );
}
