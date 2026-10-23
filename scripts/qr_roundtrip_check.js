/**
 * Dev-only check: a handover confirmation (65-byte signature, 0x + 130 hex
 * characters) survives being shown as a QR code and scanned back.
 *
 * 1. For 20 random signatures: encode with `qrcode` (error correction M) as a
 *    PNG, decode the PNG with pngjs + jsQR, and compare with the input.
 * 2. If deliveryman-frontend/node_modules is installed: the same for the SVG
 *    the deliveryman dApp renders (qrcode.react QRCodeSVG with the props used
 *    in deliveryman-frontend/src/Components/QrCode/index.js), rasterised to
 *    pixels and decoded with jsQR.
 *
 * Every decoded text must also pass the scanner's acceptance rule
 * (deliveryman-frontend/src/utils/handoverSignature.js).
 *
 * Run with:
 *   node scripts/qr_roundtrip_check.js
 */

const assert = require("assert");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { createRequire } = require("module");
const QRCode = require("qrcode");
const jsQR = require("jsqr");
const { PNG } = require("pngjs");

const SAMPLES = 20;
const SIZE_PX = 220; // same size as the dApp's QR code
const HANDOVER_SIGNATURE_REGEX = /^0x[0-9a-fA-F]{130}$/;

// r (32 bytes) + s (32 bytes) + v (27 or 28), lowercase like personal_sign.
function randomSignature() {
  const bytes = crypto.randomBytes(65);
  bytes[64] = 27 + (bytes[64] & 1);
  return "0x" + bytes.toString("hex");
}

function checkDecoded(decoded, sig, label, i) {
  assert.ok(decoded, `${label} #${i}: jsQR could not find a QR code`);
  assert.strictEqual(decoded.data, sig, `${label} #${i}: decoded text differs from the input`);
  assert.ok(HANDOVER_SIGNATURE_REGEX.test(decoded.data), `${label} #${i}: scanner would reject the decoded text`);
}

// --- 1. qrcode (PNG) -> pngjs -> jsQR ---------------------------------------
async function checkQrcodePng(signatures) {
  const versions = new Set();
  for (let i = 0; i < signatures.length; i++) {
    const sig = signatures[i];
    assert.ok(HANDOVER_SIGNATURE_REGEX.test(sig), `sample #${i} is not 0x + 130 hex chars`);

    const symbol = QRCode.create(sig, { errorCorrectionLevel: "M" });
    // Format-information bits (ISO/IEC 18004): L = 1, M = 0, Q = 3, H = 2.
    assert.strictEqual(symbol.errorCorrectionLevel.bit, 0, `sample #${i}: not error correction M`);
    versions.add(symbol.version);

    const png = await QRCode.toBuffer(sig, {
      type: "png",
      errorCorrectionLevel: "M",
      margin: 4,
      width: SIZE_PX,
      color: { dark: "#000000ff", light: "#ffffffff" },
    });
    const image = PNG.sync.read(png);
    const decoded = jsQR(new Uint8ClampedArray(image.data), image.width, image.height);
    checkDecoded(decoded, sig, "qrcode PNG", i);
  }
  return versions;
}

// --- 2. qrcode.react (SVG, as rendered by the dApp) -> pixels -> jsQR ------
function loadDappRenderer() {
  const dappDir = path.join(__dirname, "..", "deliveryman-frontend");
  try {
    const dappRequire = createRequire(path.join(dappDir, "package.json"));
    const React = dappRequire("react");
    const ReactDOMServer = dappRequire("react-dom/server");
    const { QRCodeSVG } = dappRequire("qrcode.react");
    // qrcode.react's "exports" field hides package.json, so read it from disk.
    const pkgFile = path.join(dappDir, "node_modules", "qrcode.react", "package.json");
    const version = JSON.parse(fs.readFileSync(pkgFile, "utf8")).version;
    return { React, ReactDOMServer, QRCodeSVG, version };
  } catch (err) {
    return { skipReason: err.code || err.message };
  }
}

function svgToPixels(svg, pxPerModule) {
  const viewBox = svg.match(/viewBox="0 0 (\d+) (\d+)"/);
  assert.ok(viewBox && viewBox[1] === viewBox[2], "SVG has no square viewBox");
  const n = Number(viewBox[1]);
  const fills = [...svg.matchAll(/<path fill="([^"]+)" d="([^"]+)"/g)];
  assert.strictEqual(fills.length, 2, "expected a background path and a modules path");
  assert.strictEqual(fills[0][1], "#ffffff", "background is not white");
  assert.strictEqual(fills[1][1], "#000000", "modules are not black");

  // Dark modules are drawn as horizontal runs, "M{x} {y}h{len}v1H{x}z", or
  // "M{x},{y} h{len}v1H{x}z" for a run that ends at the last column.
  const dark = Array.from({ length: n }, () => new Array(n).fill(false));
  const d = fills[1][2];
  let parsed = 0;
  for (const run of d.matchAll(/M(\d+)[ ,](\d+) ?h(\d+)v1H\d+z/g)) {
    const x = Number(run[1]);
    const y = Number(run[2]);
    const len = Number(run[3]);
    for (let k = 0; k < len; k++) dark[y][x + k] = true;
    parsed += run[0].length;
  }
  assert.ok(parsed > 0, "no dark modules in the SVG");
  assert.strictEqual(parsed, d.length, "SVG path has commands this parser does not understand");

  const width = n * pxPerModule;
  const data = new Uint8ClampedArray(width * width * 4);
  for (let py = 0; py < width; py++) {
    for (let px = 0; px < width; px++) {
      const v = dark[Math.floor(py / pxPerModule)][Math.floor(px / pxPerModule)] ? 0 : 255;
      const o = (py * width + px) * 4;
      data[o] = data[o + 1] = data[o + 2] = v;
      data[o + 3] = 255;
    }
  }
  return { data, width, modules: n };
}

function checkDappSvg(signatures, renderer) {
  const { React, ReactDOMServer, QRCodeSVG } = renderer;
  const gridSizes = new Set();
  for (let i = 0; i < signatures.length; i++) {
    const sig = signatures[i];
    // Same props as deliveryman-frontend/src/Components/QrCode/index.js
    const svg = ReactDOMServer.renderToStaticMarkup(
      React.createElement(QRCodeSVG, {
        value: sig,
        size: SIZE_PX,
        level: "M",
        includeMargin: true,
        bgColor: "#ffffff",
        fgColor: "#000000",
      })
    );
    assert.ok(svg.includes(`width="${SIZE_PX}"`), "SVG is not 220px wide");
    const { data, width, modules } = svgToPixels(svg, 4);
    gridSizes.add(modules);
    const decoded = jsQR(data, width, width);
    checkDecoded(decoded, sig, "dApp SVG", i);
  }
  return gridSizes;
}

async function main() {
  const signatures = Array.from({ length: SAMPLES }, randomSignature);

  const versions = await checkQrcodePng(signatures);
  console.log(
    `qrcode PNG (level M, ${SIZE_PX}px): ${SAMPLES}/${SAMPLES} signatures decoded back exactly ` +
      `(QR version ${[...versions].join(", ")})`
  );

  const renderer = loadDappRenderer();
  if (!renderer.skipReason) {
    const gridSizes = checkDappSvg(signatures, renderer);
    console.log(
      `dApp SVG (qrcode.react ${renderer.version}, level M, margin): ${SAMPLES}/${SAMPLES} signatures decoded back exactly ` +
        `(${[...gridSizes].join(", ")} modules incl. margin)`
    );
  } else {
    console.log(`dApp SVG: skipped, could not load deliveryman-frontend's qrcode.react (${renderer.skipReason})`);
  }

  console.log("QR round-trip check passed.");
}

main().catch((err) => {
  console.error("QR round-trip check FAILED:", err.message);
  process.exit(1);
});
