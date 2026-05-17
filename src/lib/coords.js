// Convert a screen-space mouse event to the SVG's viewBox coordinate space.
// Uses getScreenCTM so preserveAspectRatio letterboxing is handled correctly.
export function svgCoords(svg, clientX, clientY) {
  if (!svg) return { x: 0, y: 0 };
  const pt = svg.createSVGPoint();
  pt.x = clientX;
  pt.y = clientY;
  const ctm = svg.getScreenCTM();
  if (!ctm) return { x: 0, y: 0 };
  const t = pt.matrixTransform(ctm.inverse());
  return { x: t.x, y: t.y };
}

export const distXY = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);

export const isInside = (x, y, w, h) => x >= 0 && y >= 0 && x <= w && y <= h;
