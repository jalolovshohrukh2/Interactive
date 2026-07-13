// Curved-edge support for polygons / polylines.
//
// A shape may carry `curves`: an array where curves[i] is the quadratic control
// point [cx, cy] for the edge from points[i] → points[i+1], or null/undefined
// for a straight edge. When any edge is curved the shape renders as an SVG
// <path> (Q commands) instead of a <polygon>. Shapes with no `curves` behave
// exactly as before, so this is fully backward-compatible.
//
// Pure geometry only (no imports) so the SVG exporter and canvas both use it.

const r2 = (n) => Math.round(n * 100) / 100;

export function hasCurves(shape) {
  return Array.isArray(shape.curves) && shape.curves.some(Boolean);
}

// SVG path `d` for a point list with optional per-edge quadratic curves.
// `closed` adds the wrap-around edge and a Z.
export function polygonPathD(points, curves, closed) {
  if (!points || !points.length) return '';
  const n = points.length;
  let d = `M${r2(points[0][0])},${r2(points[0][1])}`;
  const segs = closed ? n : n - 1;
  for (let i = 0; i < segs; i++) {
    const [x, y] = points[(i + 1) % n];
    const c = curves && curves[i];
    d += c ? `Q${r2(c[0])},${r2(c[1])} ${r2(x)},${r2(y)}` : `L${r2(x)},${r2(y)}`;
  }
  if (closed) d += 'Z';
  return d;
}

// Trace the same onto a Canvas 2D context (offset lets cropped exports place the
// piece's bbox origin at 0,0).
export function tracePolygonPath(ctx, points, curves, closed, offX = 0, offY = 0) {
  if (!points || !points.length) return;
  const n = points.length;
  ctx.moveTo(points[0][0] + offX, points[0][1] + offY);
  const segs = closed ? n : n - 1;
  for (let i = 0; i < segs; i++) {
    const [x, y] = points[(i + 1) % n];
    const c = curves && curves[i];
    if (c) ctx.quadraticCurveTo(c[0] + offX, c[1] + offY, x + offX, y + offY);
    else ctx.lineTo(x + offX, y + offY);
  }
  if (closed) ctx.closePath();
}

// Where the drag handle for edge i sits (curve midpoint if curved, else the
// straight segment midpoint).
export function edgeMidpoint(points, curves, i) {
  const n = points.length;
  const p0 = points[i], p1 = points[(i + 1) % n];
  const c = curves && curves[i];
  if (c) {
    return [
      0.25 * p0[0] + 0.5 * c[0] + 0.25 * p1[0],
      0.25 * p0[1] + 0.5 * c[1] + 0.25 * p1[1],
    ];
  }
  return [(p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2];
}

// Control point so the curve's midpoint (t=0.5) passes through m.
export function controlForMidpoint(p0, p1, m) {
  return [2 * m[0] - 0.5 * (p0[0] + p1[0]), 2 * m[1] - 0.5 * (p0[1] + p1[1])];
}
