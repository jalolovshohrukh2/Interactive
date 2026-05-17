import SpotlightMask from './SpotlightMask.jsx';

// Renders a single shape on the editor canvas.
// In "edit" mode shows the bounds in violet so the user can see them.
// In "preview" mode emulates the exported SVG: transparent (spotlight pattern)
// or solid fill that swaps on hover (fill pattern). For spotlight previews
// it also paints the punch-out mask on hover.
//
// Stroke widths are divided by displayScale so they stay constant in screen
// pixels at any zoom.
export default function ShapeRender({ shape, isSelected, isHovered, mode, onHover, displayScale = 1 }) {
  const editFill = shape.hover === 'fill'
    ? (shape.fill || '#c4c4c4')
    : (isHovered ? 'rgba(168, 85, 247, 0.18)' : 'rgba(99, 102, 241, 0.12)');

  const previewFill = shape.hover === 'fill'
    ? (isHovered ? (shape.hoverFill || '#d8d8d8') : (shape.fill || '#c4c4c4'))
    : 'transparent';

  const fill = mode === 'edit' ? editFill : previewFill;
  const stroke = mode === 'edit'
    ? (isSelected ? '#a855f7' : isHovered ? '#c084fc' : '#6366f1')
    : 'transparent';
  const baseSW = isSelected ? 3 : 2;
  const strokeWidth = mode === 'edit' ? baseSW / displayScale : 0;

  const common = {
    fill,
    stroke,
    strokeWidth,
    'data-shape-id': shape.id,
    onMouseEnter: () => onHover(shape.id),
    onMouseLeave: () => onHover(null),
    style: { cursor: 'pointer' },
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
          stroke={mode === 'edit' ? stroke : (shape.fill || '#c4c4c4')}
          strokeWidth={mode === 'edit' ? (isSelected ? 4 : 3) / displayScale : 3 / displayScale}
        />
      )}
    </g>
  );
}
