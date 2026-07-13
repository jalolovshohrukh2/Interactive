import SpotlightMask from './SpotlightMask.jsx';
import { statusOf } from '../../lib/status.js';
import { hasCurves, polygonPathD } from '../../lib/pathGeom.js';

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
  // Region shapes are color-coded by role so they read distinctly from
  // interactive hotspots (violet): cut pieces are emerald, blur focus regions
  // are sky/cyan. Blur regions keep a very light fill so the sharp underlying
  // image shows through.
  const isCut = shape.role === 'cut';
  const isBlur = shape.role === 'blur';
  // A sales status colors the hotspot (green/amber/red) both while editing and
  // in preview, so availability reads at a glance and matches the exported SVG.
  const status = (!isCut && !isBlur) ? statusOf(shape) : null;

  const editFill = isCut
    ? (isHovered ? 'rgba(16, 185, 129, 0.22)' : 'rgba(16, 185, 129, 0.14)')
    : isBlur
      ? (isHovered ? 'rgba(56, 189, 248, 0.16)' : 'rgba(56, 189, 248, 0.08)')
      : status
        ? (isHovered ? status.hoverFill : status.fill)
        : shape.hover === 'fill'
          ? (shape.fill || '#c4c4c4')
          : (isHovered ? 'rgba(168, 85, 247, 0.18)' : 'rgba(99, 102, 241, 0.12)');

  const previewFill = status
    ? (isHovered ? status.hoverFill : status.fill)
    : shape.hover === 'fill'
      ? (isHovered ? (shape.hoverFill || '#d8d8d8') : (shape.fill || '#c4c4c4'))
      : 'transparent';

  const fill = mode === 'edit' ? editFill : previewFill;
  const editStroke = isCut
    ? (isSelected ? '#34d399' : isHovered ? '#6ee7b7' : '#10b981')
    : isBlur
      ? (isSelected ? '#38bdf8' : isHovered ? '#7dd3fc' : '#0ea5e9')
      : status
        ? status.color
        : (isSelected ? '#a855f7' : isHovered ? '#c084fc' : '#6366f1');
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
      {shape.label ? <title>{shape.label}</title> : null}
      {showSpotlight && <SpotlightMask shape={shape} />}
      {shape.type === 'rect' && (
        <rect {...common} x={shape.x} y={shape.y} width={shape.width} height={shape.height} />
      )}
      {shape.type === 'ellipse' && (
        <ellipse {...common} cx={shape.cx} cy={shape.cy} rx={shape.rx} ry={shape.ry} />
      )}
      {shape.type === 'polygon' && (
        hasCurves(shape)
          ? <path {...common} d={polygonPathD(shape.points, shape.curves, true)} />
          : <polygon {...common} points={shape.points.map((p) => p.join(',')).join(' ')} />
      )}
      {/* In Cut/Blur a polyline marks a region, so render it closed + filled
          like a polygon. In Hotspots it stays an open, unfilled line. */}
      {shape.type === 'polyline' && (isCut || isBlur) && (
        hasCurves(shape)
          ? <path {...common} d={polygonPathD(shape.points, shape.curves, true)} />
          : <polygon {...common} points={shape.points.map((p) => p.join(',')).join(' ')} />
      )}
      {shape.type === 'polyline' && !isCut && !isBlur && (
        hasCurves(shape) ? (
        <path
          {...common}
          d={polygonPathD(shape.points, shape.curves, false)}
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
        ) : (
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
        )
      )}
    </g>
  );
}
