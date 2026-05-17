// Selection marquee rectangle drawn while the user drags on empty canvas.
export default function Marquee({ marquee, displayScale = 1 }) {
  if (!marquee) return null;
  const x = Math.min(marquee.x0, marquee.x1);
  const y = Math.min(marquee.y0, marquee.y1);
  const w = Math.abs(marquee.x1 - marquee.x0);
  const h = Math.abs(marquee.y1 - marquee.y0);
  const sw = 1 / displayScale;
  return (
    <rect
      x={x} y={y} width={w} height={h}
      fill="rgba(168, 85, 247, 0.10)"
      stroke="#a855f7"
      strokeWidth={sw}
      strokeDasharray={`${4 / displayScale} ${3 / displayScale}`}
      pointerEvents="none"
    />
  );
}
