// Smart-guide overlay. Renders thin lines across the full image for each
// active alignment, scaled inversely so they stay 1px regardless of zoom.
export default function Guides({ guides, imageWidth, imageHeight, displayScale }) {
  if (!guides || !guides.length) return null;
  const strokeWidth = 1 / displayScale;
  return (
    <g pointerEvents="none">
      {guides.map((g, i) =>
        g.type === 'v' ? (
          <line
            key={i}
            x1={g.value} y1={0}
            x2={g.value} y2={imageHeight}
            stroke="#ec4899"
            strokeWidth={strokeWidth}
          />
        ) : (
          <line
            key={i}
            x1={0} y1={g.value}
            x2={imageWidth} y2={g.value}
            stroke="#ec4899"
            strokeWidth={strokeWidth}
          />
        )
      )}
    </g>
  );
}
