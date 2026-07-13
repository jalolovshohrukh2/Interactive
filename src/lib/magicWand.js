// Magic-wand selection: click a pixel, flood-fill the connected area of similar
// color, trace the area's outline, and return it as a simplified polygon. Made
// for color-coded floor plans — clicking inside an apartment selects it because
// the fill color stops at the (differently colored) walls.
//
// buildMask / maskToPolygon / simplifyPolygon are pure (no DOM) so they can be
// unit-tested in Node; only getImagePixels touches the canvas.

const pixelCache = new Map(); // image url -> { data, w, h }

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const im = new Image();
    // Hosted images (e.g. Vercel Blob) need CORS to be canvas-readable.
    if (!url.startsWith('data:')) im.crossOrigin = 'anonymous';
    im.onload = () => resolve(im);
    im.onerror = () => reject(new Error('Could not read the image pixels.'));
    im.src = url;
  });
}

// Raw RGBA pixels at the project's image size, cached (one image at a time —
// a full-plan buffer is tens of MB).
export async function getImagePixels(url, w, h) {
  const hit = pixelCache.get(url);
  if (hit) return hit;
  const img = await loadImage(url);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, w, h);
  const data = ctx.getImageData(0, 0, w, h).data;
  pixelCache.clear();
  const entry = { data, w, h };
  pixelCache.set(url, entry);
  return entry;
}

// Flood-fill from (sx, sy): every 4-connected pixel whose RGB distance to the
// seed color is within `tol` joins the mask.
export function buildMask(data, w, h, sx, sy, tol) {
  const seed = sy * w + sx;
  const si = seed * 4;
  const sr = data[si], sg = data[si + 1], sb = data[si + 2];
  const tol2 = tol * tol;
  const match = (p) => {
    const j = p * 4;
    const dr = data[j] - sr, dg = data[j + 1] - sg, db = data[j + 2] - sb;
    return dr * dr + dg * dg + db * db <= tol2;
  };
  const mask = new Uint8Array(w * h);
  const stack = [seed];
  mask[seed] = 1;
  while (stack.length) {
    const p = stack.pop();
    const x = p % w;
    if (x > 0        && !mask[p - 1] && match(p - 1)) { mask[p - 1] = 1; stack.push(p - 1); }
    if (x < w - 1    && !mask[p + 1] && match(p + 1)) { mask[p + 1] = 1; stack.push(p + 1); }
    if (p >= w       && !mask[p - w] && match(p - w)) { mask[p - w] = 1; stack.push(p - w); }
    if (p < w * (h - 1) && !mask[p + w] && match(p + w)) { mask[p + w] = 1; stack.push(p + w); }
  }
  return mask;
}

// Trace the mask's outer boundary with a marching-squares walk (region kept on
// the left of the travel direction; saddles resolved by where we came from),
// then Douglas-Peucker the corner points down to a clean polygon.
export function maskToPolygon(mask, w, h, epsilon = 2) {
  let s = -1;
  for (let i = 0; i < w * h; i++) { if (mask[i]) { s = i; break; } }
  if (s < 0) return [];
  const startX = s % w, startY = (s / w) | 0;
  const at = (x, y) => (x >= 0 && y >= 0 && x < w && y < h && mask[y * w + x] ? 1 : 0);

  const pts = [];
  let x = startX, y = startY;
  let dx = 0, dy = 0, pdx = NaN, pdy = NaN;
  let guard = 4 * w * h + 16;
  do {
    let i = 0;
    if (at(x - 1, y - 1)) i |= 1; // top-left of this corner
    if (at(x,     y - 1)) i |= 2; // top-right
    if (at(x - 1, y    )) i |= 4; // bottom-left
    if (at(x,     y    )) i |= 8; // bottom-right
    if (i === 6)      { dx = pdy === -1 ? -1 : 1; dy = 0; }        // saddle
    else if (i === 9) { dx = 0; dy = pdx === 1 ? -1 : 1; }         // saddle
    else if (i === 1 || i === 5 || i === 13) { dx = 0; dy = -1; }  // up
    else if (i === 2 || i === 3 || i === 7)  { dx = 1; dy = 0; }   // right
    else if (i === 4 || i === 12 || i === 14) { dx = -1; dy = 0; } // left
    else if (i === 8 || i === 10 || i === 11) { dx = 0; dy = 1; }  // down
    else return []; // 0 / 15 — walked off the boundary, bail out
    if (dx !== pdx || dy !== pdy) { pts.push([x, y]); pdx = dx; pdy = dy; }
    x += dx; y += dy;
  } while ((x !== startX || y !== startY) && --guard > 0);
  if (guard <= 0) return [];
  return simplifyPolygon(pts, epsilon);
}

// Iterative Douglas-Peucker (recursion-free — plan outlines can have thousands
// of corner points).
export function simplifyPolygon(pts, eps) {
  if (pts.length <= 4 || eps <= 0) return pts;
  const keep = new Uint8Array(pts.length);
  keep[0] = 1;
  keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [first, last] = stack.pop();
    if (last - first < 2) continue;
    const [x1, y1] = pts[first];
    const [x2, y2] = pts[last];
    const ddx = x2 - x1, ddy = y2 - y1;
    const len = Math.hypot(ddx, ddy) || 1;
    let maxD = 0, idx = -1;
    for (let i = first + 1; i < last; i++) {
      const d = Math.abs((pts[i][0] - x1) * ddy - (pts[i][1] - y1) * ddx) / len;
      if (d > maxD) { maxD = d; idx = i; }
    }
    if (maxD > eps && idx > 0) {
      keep[idx] = 1;
      stack.push([first, idx], [idx, last]);
    }
  }
  const out = [];
  for (let i = 0; i < pts.length; i++) if (keep[i]) out.push(pts[i]);
  return out;
}

// --- Morphology (box kernel, separable, O(n) via running window counts) ---

// Max-filter: 1 if any mask pixel within Chebyshev distance r. Outside = 0.
export function dilateMask(mask, w, h, r) {
  const tmp = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    const row = y * w;
    let cnt = 0;
    for (let x = 0; x <= Math.min(r, w - 1); x++) cnt += mask[row + x];
    for (let x = 0; x < w; x++) {
      tmp[row + x] = cnt > 0 ? 1 : 0;
      const add = x + r + 1, rem = x - r;
      if (add < w) cnt += mask[row + add];
      if (rem >= 0) cnt -= mask[row + rem];
    }
  }
  const out = new Uint8Array(w * h);
  for (let x = 0; x < w; x++) {
    let cnt = 0;
    for (let y = 0; y <= Math.min(r, h - 1); y++) cnt += tmp[y * w + x];
    for (let y = 0; y < h; y++) {
      out[y * w + x] = cnt > 0 ? 1 : 0;
      const add = y + r + 1, rem = y - r;
      if (add < h) cnt += tmp[add * w + x];
      if (rem >= 0) cnt -= tmp[rem * w + x];
    }
  }
  return out;
}

// Min-filter: 0 if any zero within distance r. Outside the image counts as 1
// so regions touching the image edge don't get eaten.
export function erodeMask(mask, w, h, r) {
  const tmp = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    const row = y * w;
    let zeros = 0;
    for (let x = 0; x <= Math.min(r, w - 1); x++) zeros += 1 - mask[row + x];
    for (let x = 0; x < w; x++) {
      tmp[row + x] = zeros > 0 ? 0 : 1;
      const add = x + r + 1, rem = x - r;
      if (add < w) zeros += 1 - mask[row + add];
      if (rem >= 0) zeros -= 1 - mask[row + rem];
    }
  }
  const out = new Uint8Array(w * h);
  for (let x = 0; x < w; x++) {
    let zeros = 0;
    for (let y = 0; y <= Math.min(r, h - 1); y++) zeros += 1 - tmp[y * w + x];
    for (let y = 0; y < h; y++) {
      out[y * w + x] = zeros > 0 ? 0 : 1;
      const add = y + r + 1, rem = y - r;
      if (add < h) zeros += 1 - tmp[add * w + x];
      if (rem >= 0) zeros -= 1 - tmp[rem * w + x];
    }
  }
  return out;
}

// Morphological close: fills gaps/slits narrower than ~2r (door arcs, and the
// interior wall between two unioned rooms) without growing the outer boundary.
export function closeMask(mask, w, h, r) {
  if (r <= 0) return mask;
  return erodeMask(dilateMask(mask, w, h, r), w, h, r);
}

// Rasterize an existing shape into a mask so a wand click can union with it.
function rasterizeShapeMask(shape, w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  switch (shape.type) {
    case 'rect': ctx.rect(shape.x, shape.y, shape.width, shape.height); break;
    case 'ellipse': ctx.ellipse(shape.cx, shape.cy, shape.rx, shape.ry, 0, 0, Math.PI * 2); break;
    case 'polygon':
    case 'polyline': {
      const pts = shape.points || [];
      if (!pts.length) break;
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
      ctx.closePath();
      break;
    }
    default: break;
  }
  ctx.fill();
  const d = ctx.getImageData(0, 0, w, h).data;
  const mask = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) mask[i] = d[i * 4 + 3] > 127 ? 1 : 0;
  return mask;
}

const countMask = (mask) => {
  let n = 0;
  for (let i = 0; i < mask.length; i++) n += mask[i];
  return n;
};

// One-call helper for the drawing hook: click → { points, coverage }.
// `coverage` (0..1, share of the image the fill grabbed) lets the caller catch
// "you clicked the background" selections before creating a giant shape.
// A small close pass smooths slits left by door-swing arcs drawn on the floor.
export async function magicWandPolygon(url, w, h, x, y, tolerance = 32, epsilon = 2, growPx = 0) {
  const { data } = await getImagePixels(url, w, h);
  const cx = Math.max(0, Math.min(w - 1, Math.round(x)));
  const cy = Math.max(0, Math.min(h - 1, Math.round(y)));
  let mask = closeMask(buildMask(data, w, h, cx, cy, tolerance), w, h, 2);
  // Grow: push the boundary outward (e.g. onto the surrounding walls so
  // neighbouring units meet at the wall centreline instead of leaving a gap).
  if (growPx > 0) mask = dilateMask(mask, w, h, Math.round(growPx));
  const points = maskToPolygon(mask, w, h, epsilon);
  return { points, coverage: countMask(mask) / (w * h) };
}

// Shift+click: flood the clicked room and merge it into an existing shape as
// ONE region. The close radius is sized to bridge a typical interior wall, so
// two rooms separated by a wall fuse into a single apartment outline (the wall
// is included in the footprint, which is what an apartment hotspot wants).
export async function magicWandAddToShape(url, w, h, x, y, tolerance, shape, epsilon = 2, growPx = 0) {
  const { data } = await getImagePixels(url, w, h);
  const cx = Math.max(0, Math.min(w - 1, Math.round(x)));
  const cy = Math.max(0, Math.min(h - 1, Math.round(y)));
  const mask = buildMask(data, w, h, cx, cy, tolerance);
  const prev = rasterizeShapeMask(shape, w, h);
  for (let i = 0; i < mask.length; i++) mask[i] |= prev[i];
  const bridge = Math.max(12, Math.round(Math.min(w, h) * 0.012));
  let closed = closeMask(mask, w, h, bridge);
  if (growPx > 0) closed = dilateMask(closed, w, h, Math.round(growPx));
  const points = maskToPolygon(closed, w, h, epsilon);
  return { points, coverage: countMask(closed) / (w * h) };
}

// Grow (delta > 0) or shrink (delta < 0) an existing shape's outline by |delta|
// px, as a uniform offset — used to nudge a finished unit outward onto the walls
// AFTER it's built, so it never compounds while you're merging rooms. Returns
// the new outline points (a plain polygon), or null if nothing to do.
export function growShapeMask(shape, w, h, delta) {
  const r = Math.abs(Math.round(delta));
  if (!r) return null;
  const mask = rasterizeShapeMask(shape, w, h);
  const out = delta > 0 ? dilateMask(mask, w, h, r) : erodeMask(mask, w, h, r);
  return maskToPolygon(out, w, h, 2);
}
