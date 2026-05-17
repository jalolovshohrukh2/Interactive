import SpotlightMask from './SpotlightMask.jsx';

// Renders a single shape on the editor canvas.
//
// Edit mode: shows the shape's outline in violet (or fill swatch for
// fill-pattern shapes) so the user can see the geometry they're working on.
//
// Preview mode: emulates the exported SVG.
//   - Spotlight shapes are transparent at rest; on hover, SpotlightMask
//     darkens everything else.
//   - Fill shapes swap fill on hover.
//   - On hover, both shape types ALSO get a marching-ants stroke and a
//     violet drop-shadow halo, scaled by the global `glow` slider. This
//     matches the CSS we emit into the exported file, so what you see
//     in preview is what end users will see.
//
// Stroke widths and animation values divide by displayScale so on-screen
// thickness is constant regardless of zoom.
export default function ShapeRender({ shape, isSelected, isHovered, mode, onHover, displayScale = 1, glow = 0 }) {
  const editFill = shape.hover === 'fill'
    ? (shape.fill || '#c4c4c4')
    : (isHovered ? 'rgba(168, 85, 247, 0.18)' : 'rgba(99, 102, 241, 0.12)');

  const previewFill = shape.hover === 'fill'
    ? (isHovered ? (shape.hoverFill || '#d8d8d8') : (shape.fill || '#c4c4c4'))
    : 'transparent';

  const fill = mode === 'edit' ? editFill : previewFill;
  const editStroke = isSelected ? '#a855f7' : isHovered ? '#c084fc' : '#6366f1';
  const baseSW = isSelected ? 3 : 2;

  // Preview-mode hover effect — mirrors the exported CSS. A thin static
  // gray outline, alpha scales with the slider. No animation, no halo —
  // the goal is a barely-visible affordance, not a visual effect.
  const showHoverGlow = mode === 'preview' && isHovered && glow > 0;
  const glowProps = showHoverGlow
    ? {
        stroke: `rgba(160, 160, 160, ${(glow * 0.35).toFixed(2)})`,
        strokeWidth: 1 / displayScale,
        style: { cursor: 'pointer' },
      }
    : null;

  // Default (edit mode or preview without hover glow)
  const baseProps = {
    fill,
    stroke: mode === 'edit' ? editStroke : 'transparent',
    strokeWidth: mode === 'edit' ? baseSW / displayScale : 0,
    style: { cursor: 'pointer' },
  };

  // Glow props override stroke + style when active.
  const common = {
    ...(glowProps || baseProps),
    fill, // preserve fill computed above (don't let glowProps clobber it)
    'data-shape-id': shape.id,
    onMouseEnter: () => onHover(shape.id),
    onMouseLeave: () => onHover(null),
  };

  const showSpotlight = mode === 'preview' && shape.hover === 'spotlight' && isHovered;

  return (
    <g>
      {showSpotlight && <SpotlightMask shape={shape} />}
      {shape.type === 'rect' && (
        <rect {...common} x={shape.x} y={shape.y} width={shape.width} height={shape.height} />
      )}
      {shape.type === 'ellipse' && (
        <ellipse {...common} cx={shape.cx} cy={shape.cy} rx={shape.rx} ry={shape.ry} />
      )}
      {shape.type === 'polygon' && (
        <polygon {...common} points={shape.points.map((p) => p.join(',')).join(' ')} />
      )}
      {shape.type === 'polyline' && (
        <polyline
          {...common}
          points={shape.points.map((p) => p.join(',')).join(' ')}
          fill="none"
          stroke={
            showHoverGlow ? glowProps.stroke
            : mode === 'edit' ? editStroke
            : (shape.fill || '#c4c4c4')
          }
          strokeWidth={
            showHoverGlow ? glowProps.strokeWidth
            : mode === 'edit' ? (isSelected ? 4 : 3) / displayScale
            : 3 / displayScale
          }
        />
      )}
    </g>
  );
}
