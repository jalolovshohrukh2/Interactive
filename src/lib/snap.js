// Smart-guide / snap helpers.
// Coordinates are in viewBox space. The caller picks a threshold in viewBox
// units — typically (SCREEN_THRESHOLD / displayScale), so the snap zone
// stays the same in pixels regardless of zoom.

export function bbox(shape) {
  switch (shape.type) {
    case 'rect':
      return { x: shape.x, y: shape.y, w: shape.width, h: shape.height };
    case 'ellipse':
      return {
        x: shape.cx - shape.rx,
        y: shape.cy - shape.ry,
        w: shape.rx * 2,
        h: shape.ry * 2,
      };
    case 'polygon':
    case 'polyline': {
      if (!shape.points.length) return { x: 0, y: 0, w: 0, h: 0 };
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const [x, y] of shape.points) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
      return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
    }
    default:
      return { x: 0, y: 0, w: 0, h: 0 };
  }
}

// Anchor points of a shape that should snap when the shape moves.
// Bounding-box corners, edge midpoints, center; plus every vertex for polygons.
export function anchorPoints(shape) {
  const b = bbox(shape);
  const cx = b.x + b.w / 2;
  const cy = b.y + b.h / 2;
  const anchors = [
    [b.x, b.y], [b.x + b.w, b.y], [b.x, b.y + b.h], [b.x + b.w, b.y + b.h],
    [cx, cy],
    [cx, b.y], [cx, b.y + b.h],
    [b.x, cy], [b.x + b.w, cy],
  ];
  if (shape.type === 'polygon' || shape.type === 'polyline') {
    for (const [x, y] of shape.points) anchors.push([x, y]);
  }
  return anchors;
}

// Build sets of candidate alignment lines from all the OTHER shapes plus the
// image edges/center. `extraPoints` lets callers add ad-hoc points (used by
// the drawing tools so each new polygon vertex can align to the previous
// ones in the same draft). Returns flat arrays — close-enough duplicates
// aren't deduped because exact equality is rare and overlap is harmless.
export function buildCandidates(otherShapes, imageWidth, imageHeight, extraPoints = []) {
  const xs = [0, imageWidth / 2, imageWidth];
  const ys = [0, imageHeight / 2, imageHeight];
  for (const s of otherShapes) {
    const b = bbox(s);
    xs.push(b.x, b.x + b.w / 2, b.x + b.w);
    ys.push(b.y, b.y + b.h / 2, b.y + b.h);
    if (s.type === 'polygon' || s.type === 'polyline') {
      for (const [x, y] of s.points) {
        xs.push(x);
        ys.push(y);
      }
    }
  }
  for (const [x, y] of extraPoints) {
    xs.push(x);
    ys.push(y);
  }
  return { xs, ys };
}

// Adjust a (dx, dy) move so an anchor of the dragged shape snaps to the
// nearest candidate within threshold. X and Y are independent. Returns the
// adjusted dx/dy plus guide lines to render.
export function snapMove({ shape, dx, dy, candidates, threshold }) {
  const anchors = anchorPoints(shape);

  let bestX = { adjust: 0, candidate: null, anchorY: null, dist: threshold };
  let bestY = { adjust: 0, candidate: null, anchorX: null, dist: threshold };

  for (const [ax, ay] of anchors) {
    const mx = ax + dx;
    const my = ay + dy;
    for (const c of candidates.xs) {
      const d = Math.abs(mx - c);
      if (d < bestX.dist) bestX = { adjust: c - mx, candidate: c, anchorY: my, dist: d };
    }
    for (const c of candidates.ys) {
      const d = Math.abs(my - c);
      if (d < bestY.dist) bestY = { adjust: c - my, candidate: c, anchorX: mx, dist: d };
    }
  }

  const guides = [];
  if (bestX.candidate !== null) guides.push({ type: 'v', value: bestX.candidate });
  if (bestY.candidate !== null) guides.push({ type: 'h', value: bestY.candidate });

  return { dx: dx + bestX.adjust, dy: dy + bestY.adjust, guides };
}

// Snap a single point (for vertex drag) to the closest candidate on each axis.
export function snapPoint({ x, y, candidates, threshold }) {
  let bestVDist = threshold, bestHDist = threshold;
  let snapX = x, snapY = y;
  let guideV = null, guideH = null;
  for (const c of candidates.xs) {
    const d = Math.abs(x - c);
    if (d < bestVDist) { bestVDist = d; snapX = c; guideV = c; }
  }
  for (const c of candidates.ys) {
    const d = Math.abs(y - c);
    if (d < bestHDist) { bestHDist = d; snapY = c; guideH = c; }
  }
  const guides = [];
  if (guideV !== null) guides.push({ type: 'v', value: guideV });
  if (guideH !== null) guides.push({ type: 'h', value: guideH });
  return { x: snapX, y: snapY, guides };
}
