import JSZip from 'jszip';
import { bbox } from './snap.js';
import { tracePolygonPath } from './pathGeom.js';

// Crop the background image down to a set of "piece" shapes and hand them back
// as PNGs — either downloaded individually or bundled into a ZIP.
//
// Each piece is cropped to its bounding box. When `mask` is true (the default)
// the canvas is clipped to the piece's exact outline first, so anything
// outside the lassoed area is transparent rather than a rectangle of leftover
// background.

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const im = new Image();
    // Hosted images (e.g. Vercel Blob) need CORS to be readable on a canvas;
    // data URLs are same-origin and ignore this.
    if (!url.startsWith('data:')) im.crossOrigin = 'anonymous';
    im.onload = () => resolve(im);
    im.onerror = () => reject(new Error('Could not load the image to crop.'));
    im.src = url;
  });
}

// Trace a shape's outline onto a 2D context, offset so the shape's bounding-box
// origin lands at (0, 0) in the destination canvas.
function tracePath(ctx, shape, offX, offY) {
  ctx.beginPath();
  switch (shape.type) {
    case 'rect':
      ctx.rect(shape.x + offX, shape.y + offY, shape.width, shape.height);
      break;
    case 'ellipse':
      ctx.ellipse(shape.cx + offX, shape.cy + offY, shape.rx, shape.ry, 0, 0, Math.PI * 2);
      break;
    case 'polygon':
    case 'polyline': {
      const pts = shape.points || [];
      if (!pts.length) break;
      // Handles both straight and per-edge-curved outlines.
      tracePolygonPath(ctx, pts, shape.curves, true, offX, offY);
      break;
    }
    default:
      break;
  }
}

// Render one piece to an offscreen canvas. Returns null if the region has no area.
//   mask     – clip to the exact outline (transparent outside); off = rect crop
//   padding  – extra px of margin around the bounding box on every side; may
//              extend past the image edges (that overhang is pure background)
//   scale    – output resolution multiplier (e.g. 2 for crisp 2× exports)
//   bg       – 'white' fills an opaque white background around the piece;
//              'transparent' (default) leaves the outside alpha-transparent
//   jpeg     – JPEG has no alpha, so it always gets a white background
export function cropPieceToCanvas(img, shape, imageW, imageH, { mask = true, padding = 0, scale = 1, jpeg = false, bg = 'transparent' } = {}) {
  const b = bbox(shape);
  // The output box is the padded bounding box. Unlike the source crop, it is NOT
  // clamped to the image — padding always adds a full margin on every side, even
  // when the piece runs to the image edge.
  const boxX = Math.floor(b.x - padding);
  const boxY = Math.floor(b.y - padding);
  const w = Math.ceil(b.x + b.w + padding) - boxX;
  const h = Math.ceil(b.y + b.h + padding) - boxY;
  if (w < 1 || h < 1) return null;

  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(w * scale));
  canvas.height = Math.max(1, Math.round(h * scale));
  const ctx = canvas.getContext('2d');
  if (scale !== 1) ctx.scale(scale, scale);

  if (jpeg || bg === 'white') { ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w, h); }
  if (mask) {
    ctx.save();
    tracePath(ctx, shape, -boxX, -boxY);
    ctx.clip();
  }
  // Draw only the part of the box that overlaps the source image; the rest of the
  // box (any padding beyond the image edge) stays background.
  const sx = Math.max(0, boxX);
  const sy = Math.max(0, boxY);
  const sw = Math.min(imageW, boxX + w) - sx;
  const sh = Math.min(imageH, boxY + h) - sy;
  if (sw > 0 && sh > 0) ctx.drawImage(img, sx, sy, sw, sh, sx - boxX, sy - boxY, sw, sh);
  if (mask) ctx.restore();

  return canvas;
}

function canvasToBlob(canvas, jpeg) {
  return new Promise((resolve) =>
    canvas.toBlob(resolve, jpeg ? 'image/jpeg' : 'image/png', jpeg ? 0.92 : undefined)
  );
}

function safeName(name) {
  return (name || 'piece').replace(/[\\/:*?"<>|]/g, '_').trim() || 'piece';
}

// Disambiguate duplicate names so files don't overwrite each other in a ZIP /
// download batch. Mutates the provided `seen` map.
function uniqueName(base, seen) {
  const n = (seen.get(base) || 0) + 1;
  seen.set(base, n);
  return n === 1 ? base : `${base}_${n}`;
}

const triggerDownload = (blob, filename) => {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoke after a tick so the download has time to start.
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
};

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

// Download each piece as its own file.
export async function downloadPiecesAsFiles(imageUrl, pieces, imageW, imageH, opts = {}) {
  if (!pieces.length) return 0;
  const jpeg = opts.format === 'jpeg';
  const ext = jpeg ? '.jpg' : '.png';
  const img = await loadImage(imageUrl);
  const seen = new Map();
  let count = 0;
  for (const piece of pieces) {
    const canvas = cropPieceToCanvas(img, piece, imageW, imageH, { ...opts, jpeg });
    if (!canvas) continue;
    const blob = await canvasToBlob(canvas, jpeg);
    if (!blob) continue;
    triggerDownload(blob, uniqueName(safeName(piece.name), seen) + ext);
    count++;
    // Give browsers a beat to queue each file when downloading many at once.
    if (pieces.length > 1) await delay(300);
  }
  return count;
}

// Bundle all pieces into a single ZIP and download it.
export async function downloadPiecesAsZip(imageUrl, pieces, imageW, imageH, opts = {}) {
  if (!pieces.length) return 0;
  const jpeg = opts.format === 'jpeg';
  const ext = jpeg ? '.jpg' : '.png';
  const img = await loadImage(imageUrl);
  const zip = new JSZip();
  const seen = new Map();
  let count = 0;
  for (const piece of pieces) {
    const canvas = cropPieceToCanvas(img, piece, imageW, imageH, { ...opts, jpeg });
    if (!canvas) continue;
    const blob = await canvasToBlob(canvas, jpeg);
    if (!blob) continue;
    zip.file(uniqueName(safeName(piece.name), seen) + ext, blob);
    count++;
  }
  if (!count) return 0;
  const out = await zip.generateAsync({ type: 'blob' });
  triggerDownload(out, opts.zipName || 'pieces.zip');
  return count;
}
