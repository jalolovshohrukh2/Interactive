// Render the background image with everything blurred EXCEPT a set of "focus"
// region shapes, then hand it back as a single PNG/JPG download.
//
// The Blur workspace is the inverse of a spotlight: the shapes mark the areas
// that stay sharp; everything else is softened by a Gaussian blur.
import { tracePolygonPath } from './pathGeom.js';

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const im = new Image();
    // Hosted images (e.g. Vercel Blob) need CORS to be readable on a canvas;
    // data URLs are same-origin and ignore this.
    if (!url.startsWith('data:')) im.crossOrigin = 'anonymous';
    im.onload = () => resolve(im);
    im.onerror = () => reject(new Error('Could not load the image to blur.'));
    im.src = url;
  });
}

// Trace a shape's outline onto a 2D context (image coordinate space).
function tracePath(ctx, shape) {
  switch (shape.type) {
    case 'rect':
      ctx.rect(shape.x, shape.y, shape.width, shape.height);
      break;
    case 'ellipse':
      ctx.moveTo(shape.cx + shape.rx, shape.cy);
      ctx.ellipse(shape.cx, shape.cy, shape.rx, shape.ry, 0, 0, Math.PI * 2);
      break;
    case 'polygon':
    case 'polyline': {
      const pts = shape.points || [];
      if (!pts.length) break;
      tracePolygonPath(ctx, pts, shape.curves, true, 0, 0);
      break;
    }
    default:
      break;
  }
}

// Build the composited canvas:
//   1. Sharp base — guarantees no transparent/faded edges from the blur.
//   2. Blurred copy on top — the blur samples transparent pixels beyond the
//      image edge, but the sharp base shows through there so edges stay clean.
//   3. Sharp focus regions punched back in via a clip path.
export function renderBlurredCanvas(img, focusShapes, imageW, imageH, { amount = 12, scale = 1, jpeg = false, stroke = 0, strokeColor = '#38bdf8', outside = 'blur', fillColor = '#ffffff' } = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(imageW * scale));
  canvas.height = Math.max(1, Math.round(imageH * scale));
  const ctx = canvas.getContext('2d');
  if (scale !== 1) ctx.scale(scale, scale);

  const regions = (focusShapes || []).filter((s) => !s.hidden);

  // 1+2. The "outside" — everything that isn't a focus region. Three modes:
  //   - color:       fill the whole canvas with a solid color.
  //   - transparent: leave it empty (JPEG has no alpha, so white there).
  //   - blur:        sharp base + a blurred copy over the top.
  if (outside === 'color') {
    ctx.fillStyle = fillColor;
    ctx.fillRect(0, 0, imageW, imageH);
  } else if (outside === 'transparent') {
    if (jpeg) { ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, imageW, imageH); }
  } else {
    if (jpeg) { ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, imageW, imageH); }
    ctx.drawImage(img, 0, 0, imageW, imageH);
    if (amount > 0 && typeof ctx.filter !== 'undefined') {
      ctx.save();
      ctx.filter = `blur(${amount}px)`;
      ctx.drawImage(img, 0, 0, imageW, imageH);
      ctx.restore();
    }
  }

  // 3. Sharp focus regions clipped back in (the kept area).
  if (regions.length) {
    ctx.save();
    ctx.beginPath();
    for (const s of regions) tracePath(ctx, s);
    ctx.clip();
    ctx.drawImage(img, 0, 0, imageW, imageH);
    ctx.restore();
  }

  // 4. Optional colored outline around each sharp region. Stroked per-shape so
  //    borders never bridge between separate regions. Width is image-space px.
  if (stroke > 0 && regions.length) {
    ctx.save();
    ctx.lineJoin = 'round';
    ctx.lineWidth = stroke;
    ctx.strokeStyle = strokeColor;
    for (const s of regions) {
      ctx.beginPath();
      tracePath(ctx, s);
      ctx.stroke();
    }
    ctx.restore();
  }

  return canvas;
}

function canvasToBlob(canvas, jpeg) {
  return new Promise((resolve) =>
    canvas.toBlob(resolve, jpeg ? 'image/jpeg' : 'image/png', jpeg ? 0.92 : undefined)
  );
}

function safeName(name) {
  return (name || 'blurred').replace(/[\\/:*?"<>|]/g, '_').trim() || 'blurred';
}

const triggerDownload = (blob, filename) => {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
};

// Compose and download the blurred image as a single file.
export async function downloadBlurredImage(imageUrl, focusShapes, imageW, imageH, opts = {}) {
  const jpeg = opts.format === 'jpeg';
  const ext = jpeg ? '.jpg' : '.png';
  const img = await loadImage(imageUrl);
  const canvas = renderBlurredCanvas(img, focusShapes, imageW, imageH, {
    amount: opts.amount ?? 12,
    scale: opts.scale ?? 1,
    jpeg,
    stroke: opts.stroke ?? 0,
    strokeColor: opts.strokeColor ?? '#38bdf8',
    outside: opts.outside ?? 'blur',
    fillColor: opts.fillColor ?? '#ffffff',
  });
  const blob = await canvasToBlob(canvas, jpeg);
  if (!blob) throw new Error('Could not encode the image.');
  triggerDownload(blob, safeName(opts.name) + ext);
  return true;
}

// Export ONE file per visible region — each output keeps only that single
// region (everything else is treated as outside) and is named after the
// region. The image is loaded once and reused for every render.
export async function downloadBlurredImagePerRegion(imageUrl, focusShapes, imageW, imageH, opts = {}) {
  const jpeg = opts.format === 'jpeg';
  const ext = jpeg ? '.jpg' : '.png';
  const img = await loadImage(imageUrl);
  const visible = (focusShapes || []).filter((s) => !s.hidden);
  let count = 0;
  for (let i = 0; i < visible.length; i++) {
    const region = visible[i];
    const canvas = renderBlurredCanvas(img, [region], imageW, imageH, {
      amount: opts.amount ?? 12,
      scale: opts.scale ?? 1,
      jpeg,
      stroke: opts.stroke ?? 0,
      strokeColor: opts.strokeColor ?? '#38bdf8',
      outside: opts.outside ?? 'blur',
      fillColor: opts.fillColor ?? '#ffffff',
    });
    const blob = await canvasToBlob(canvas, jpeg);
    if (!blob) continue;
    const fallback = `${opts.name || 'region'}-${i + 1}`;
    triggerDownload(blob, safeName(region.name || fallback) + ext);
    count++;
    // Stagger the saves so the browser doesn't drop rapid successive downloads.
    await new Promise((r) => setTimeout(r, 250));
  }
  return count;
}
