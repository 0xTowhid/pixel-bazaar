// Bundled into vendor/qr.mjs (esbuild): QR codes for the wallet address.
import qrcode from 'qrcode-generator';
export function qrSvg(text) { const q = qrcode(0, 'M'); q.addData(text); q.make(); return q.createSvgTag({ cellSize: 4, margin: 2, scalable: true }); }
