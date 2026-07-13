import { DEFAULT_FILL, DEFAULT_HOVER_FILL } from '../constants.js';
import { buildFreehandPolygon } from './freehand.js';

export const newId = () =>
  'sh_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

// Next free number for a name prefix — e.g. nextNameNumber('Store', shapes) is
// 3 when "Store 1" and "Store 2" exist. Reads the highest existing number so
// deletions don't cause collisions; matches "Store 3" and "Store3", any case.
export function nextNameNumber(prefix, shapes) {
  const esc = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp('^\\s*' + esc + '\\s*(\\d+)\\s*$', 'i');
  let max = 0;
  for (const s of shapes || []) {
    const m = (s.className || '').match(re);
    if (m) { const n = parseInt(m[1], 10); if (n > max) max = n; }
  }
  return max + 1;
}

export function makeBaseShape(count, overrides = {}) {
  return {
    className: `Apt ${count + 1}`,
    hover: 'spotlight',
    fill: DEFAULT_FILL,
    hoverFill: DEFAULT_HOVER_FILL,
    // Spotlight mode: opacity = how dark the mask gets on hover (was hardcoded 0.7).
    // Fill mode: opacity = idle opacity of the shape itself (default fully opaque).
    opacity: 0.7,
    // Seconds for the CSS transition on the hover effect.
    transition: 0.2,
    // Optional: makes the hotspot a clickable link, and a hover tooltip.
    link: '',
    label: '',
    ...overrides,
  };
}

// Base props for a cut piece. Unlike a hotspot, a piece carries no hover/fill
// styling — it's just a named region to crop. `role: 'cut'` tags it so the
// renderer can color it distinctly and so it never leaks into the SVG export.
export function makeCutPiece(count, prefix = 'piece') {
  return {
    role: 'cut',
    name: `${prefix}-${count + 1}`,
  };
}

// Base props for a blur focus region. Like a cut piece it's just a named
// region — `role: 'blur'` tags it so the renderer colors it distinctly and it
// never leaks into the hotspot SVG export. Everything OUTSIDE these regions is
// blurred; the regions themselves stay sharp.
export function makeBlurRegion(count, prefix = 'focus') {
  return {
    role: 'blur',
    name: `${prefix}-${count + 1}`,
  };
}

export function moveShape(s, dx, dy) {
  switch (s.type) {
    case 'rect':
      return { ...s, x: s.x + dx, y: s.y + dy };
    case 'ellipse':
      return { ...s, cx: s.cx + dx, cy: s.cy + dy };
    case 'polygon':
    case 'polyline':
      return {
        ...s,
        points: s.points.map(([x, y]) => [x + dx, y + dy]),
        // Curve control points are absolute, so they move with the shape too.
        ...(s.curves ? { curves: s.curves.map((c) => (c ? [c[0] + dx, c[1] + dy] : c)) } : null),
      };
    default:
      return s;
  }
}

// Resize a shape by dragging one of its 8 handles. `pos` is the new world
// position of the handle (post-snap). `opts.shift = true` keeps proportions.
//
// Handle layout (rect/ellipse):
//
//     nw  n   ne
//      \  |  /
//   w —— body —— e
//      /  |  \
//     sw  s   se
export function resizeShape(s, handle, pos, opts = {}) {
  const shift = !!opts.shift;
  if (s.type === 'rect') {
    return resizeRect(s, handle, pos, shift);
  }
  if (s.type === 'ellipse') {
    return resizeEllipse(s, handle, pos, shift);
  }
  return s;
}

function resizeRect(s, handle, pos, shift) {
  // Each handle keeps the OPPOSITE corner/edge fixed.
  let x = s.x, y = s.y, w = s.width, h = s.height;
  const right = s.x + s.width;
  const bottom = s.y + s.height;

  if (handle.includes('n')) {
    y = pos.y;
    h = Math.max(2, bottom - pos.y);
  }
  if (handle.includes('s')) {
    h = Math.max(2, pos.y - s.y);
  }
  if (handle.includes('w')) {
    x = pos.x;
    w = Math.max(2, right - pos.x);
  }
  if (handle.includes('e')) {
    w = Math.max(2, pos.x - s.x);
  }

  if (shift) {
    const ratio = s.width / s.height;
    // Corner handles: use whichever axis moved more, derive the other from ratio.
    if (handle.length === 2) {
      if (w / h > ratio) {
        const newH = w / ratio;
        if (handle.includes('n')) y = bottom - newH;
        h = newH;
      } else {
        const newW = h * ratio;
        if (handle.includes('w')) x = right - newW;
        w = newW;
      }
    } else if (handle === 'n' || handle === 's') {
      // Edge handle: maintain ratio centered on the anchored edge's midpoint X.
      const cx = s.x + s.width / 2;
      const newW = h * ratio;
      x = cx - newW / 2;
      w = newW;
    } else if (handle === 'e' || handle === 'w') {
      const cy = s.y + s.height / 2;
      const newH = w / ratio;
      y = cy - newH / 2;
      h = newH;
    }
  }

  return { ...s, x, y, width: w, height: h };
}

function resizeEllipse(s, handle, pos, shift) {
  // Treat the ellipse like a rect of (cx - rx, cy - ry, 2rx, 2ry) and reuse the math.
  const rect = { x: s.cx - s.rx, y: s.cy - s.ry, width: 2 * s.rx, height: 2 * s.ry };
  const r2 = resizeRect({ ...rect, type: 'rect' }, handle, pos, shift);
  const rx = Math.max(2, r2.width / 2);
  const ry = Math.max(2, r2.height / 2);
  return { ...s, cx: r2.x + r2.width / 2, cy: r2.y + r2.height / 2, rx, ry };
}

export function updateVertex(s, idx, pos) {
  if (s.type !== 'polygon' && s.type !== 'polyline') return s;
  return { ...s, points: s.points.map((p, i) => (i === idx ? [pos.x, pos.y] : p)) };
}

// Bow (or straighten) the edge from points[edgeIdx] → points[edgeIdx+1].
// `control` is the quadratic control point, or null to make it straight again.
export function setEdgeCurve(s, edgeIdx, control) {
  if (s.type !== 'polygon' && s.type !== 'polyline') return s;
  const n = s.points.length;
  const curves = Array.from({ length: n }, (_, i) => (s.curves ? s.curves[i] : null) || null);
  curves[edgeIdx] = control || null;
  return { ...s, curves };
}

// Deep-clone a shape with a fresh id and a positional offset.
// Used for Ctrl+V paste — caller can override the className suffix.
export function cloneShape(s, { offset = 20 } = {}) {
  const id = newId();
  switch (s.type) {
    case 'rect':
      return { ...s, id, x: s.x + offset, y: s.y + offset };
    case 'ellipse':
      return { ...s, id, cx: s.cx + offset, cy: s.cy + offset };
    case 'polygon':
    case 'polyline':
      return {
        ...s, id,
        points: s.points.map(([x, y]) => [x + offset, y + offset]),
        ...(s.curves ? { curves: s.curves.map((c) => (c ? [c[0] + offset, c[1] + offset] : c)) } : null),
      };
    default:
      return { ...s, id };
  }
}

export function buildShapeFromDraft(draft, base) {
  const id = newId();
  if (draft.type === 'rect' || draft.type === 'ellipse') {
    const { start, current } = draft;
    const w = Math.abs(current.x - start.x);
    const h = Math.abs(current.y - start.y);
    const x = Math.min(start.x, current.x);
    const y = Math.min(start.y, current.y);
    if (draft.type === 'rect') {
      return { id, type: 'rect', x, y, width: w, height: h, ...base };
    }
    return { id, type: 'ellipse', cx: x + w / 2, cy: y + h / 2, rx: w / 2, ry: h / 2, ...base };
  }
  if (draft.type === 'polygon' || draft.type === 'polyline') {
    return { id, type: draft.type, points: draft.points, ...base };
  }
  // Freehand lasso → simplified + smoothed closed polygon region.
  if (draft.type === 'lasso') {
    const points = buildFreehandPolygon(draft.points);
    if (points.length < 3) return null;
    return { id, type: 'polygon', points, ...base };
  }
  return null;
}
