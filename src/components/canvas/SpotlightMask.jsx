// Renders a viewport-filling black overlay with the given shape punched out.
// Used in preview mode for shapes that use the "spotlight" hover pattern.
// Relies on fill-rule="evenodd" so winding order doesn't matter.
export default function SpotlightMask({ shape }) {
  const inner = innerSubpath(shape);
  if (!inner) return null;
  return (
    <path
      d={`M-100000,-100000h300000v300000h-300000Z ${inner}`}
      fill="black"
      fillOpacity={0.7}
      fillRule="evenodd"
      pointerEvents="none"
    />
  );
}

function innerSubpath(s) {
  switch (s.type) {
    case 'polygon': {
      if (!s.points.length) return '';
      const [x0, y0] = s.points[0];
      return (
        `M${x0},${y0}` +
        s.points.slice(1).map(([x, y]) => `L${x},${y}`).join('') +
        'Z'
      );
    }
    case 'rect':
      return `M${s.x},${s.y}h${s.width}v${s.height}h${-s.width}Z`;
    case 'ellipse':
      return (
        `M${s.cx + s.rx},${s.cy}` +
        `A${s.rx},${s.ry} 0 1,0 ${s.cx - s.rx},${s.cy}` +
        `A${s.rx},${s.ry} 0 1,0 ${s.cx + s.rx},${s.cy}Z`
      );
    default:
      return '';
  }
}
