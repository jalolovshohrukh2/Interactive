// Turn a raw freehand drag path into a clean, smooth closed polygon.
//
// Pipeline:
//   1. Ramer–Douglas–Peucker — drop redundant points the drag captured.
//   2. Chaikin corner-cutting — round the remaining corners so the outline
//      follows curves instead of looking like a chain of straight segments.
//
// The result is still a plain points array (type 'polygon'), so it works with
// everything that already understands polygons: rendering, crop, blur masking,
// SVG export, snapping and editing.

// Perpendicular distance from point p to the line through a–b.
function perpDistance(p, a, b) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = Math.hypot(dx, dy);
  if (len === 0) return Math.hypot(p[0] - a[0], p[1] - a[1]);
  return Math.abs((p[0] - a[0]) * dy - (p[1] - a[1]) * dx) / len;
}

// Iterative RDP (no recursion, so a long drag can't blow the stack).
function simplify(points, epsilon) {
  if (points.length < 3) return points.slice();
  const keep = new Array(points.length).fill(false);
  keep[0] = true;
  keep[points.length - 1] = true;
  const stack = [[0, points.length - 1]];
  while (stack.length) {
    const [start, end] = stack.pop();
    let dmax = 0;
    let index = -1;
    for (let i = start + 1; i < end; i++) {
      const d = perpDistance(points[i], points[start], points[end]);
      if (d > dmax) { dmax = d; index = i; }
    }
    if (dmax > epsilon && index !== -1) {
      keep[index] = true;
      stack.push([start, index], [index, end]);
    }
  }
  return points.filter((_, i) => keep[i]);
}

// One Chaikin pass over a CLOSED ring: replace each edge with two points at
// 1/4 and 3/4, which rounds every corner.
function chaikinClosed(pts) {
  const n = pts.length;
  if (n < 3) return pts;
  const out = [];
  for (let i = 0; i < n; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % n];
    out.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25]);
    out.push([a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]);
  }
  return out;
}

export function buildFreehandPolygon(raw, { epsilon = 2, iterations = 2 } = {}) {
  if (!raw || raw.length < 3) return [];
  let pts = simplify(raw, epsilon);
  if (pts.length < 3) return [];
  for (let i = 0; i < iterations; i++) pts = chaikinClosed(pts);
  // Chaikin leaves many near-collinear points on gentle stretches. A final
  // simplify on the already-smooth curve drops them without re-introducing
  // jitter, keeping the vertex count (and exported markup) reasonable.
  pts = simplify(pts, epsilon * 0.5);
  if (pts.length < 3) return [];
  // Round to a tenth of a pixel — plenty precise, keeps the markup small.
  return pts.map(([x, y]) => [Math.round(x * 10) / 10, Math.round(y * 10) / 10]);
}
