// Render handles for the currently selected shape(s) (edit mode only).
//
// Rendering rules:
//   - Single selection: full bounding outline + 8 resize handles (or vertex
//     handles for polygons / polylines).
//   - Multi-selection: a dashed outline around each selected shape, no
//     handles (multi-resize is intentionally out of scope for v1).
//
// `glow` (0..1) controls a violet halo and the marching-ants speed. At 0 the
// outline is static and unblurred; at 1 it has a heavy halo and ants march
// quickly.
//
// Sizes are divided by displayScale so they stay constant in screen pixels.
export default function SelectionHandles({ shapes, selectedIds, displayScale = 1, glow = 0.4 }) {
  const sw = 1.5 / displayScale;
  const haloSW = (4 + glow * 8) / displayScale;
  const haloOpacity = glow * 0.5;
  // dashArray in viewBox units; CSS animation slides one full cycle in N seconds.
  const dashLen = 8 / displayScale;
  const dash = `${dashLen} ${dashLen * 0.6}`;
  const handleSize = 10 / displayScale;
  const vertexSize = 5 / displayScale;
  // 0.4 → 2.5s, 1 → 0.8s; clamp at the low end.
  const antsDuration = `${Math.max(0.4, 2.5 - glow * 1.7).toFixed(2)}s`;
  // Stroke-dashoffset on each ant tick is `-1`; with `pathLength="100"` the
  // outline animates regardless of perimeter, but `stroke-dashoffset` animates
  // in user units — multiply by dashLen to make it visually consistent.
  const animStyle = {
    animation: `marching-ants ${antsDuration} linear infinite`,
    // The keyframe ends at -1; scale to one dash-cycle in user units.
    animationName: 'marching-ants',
    // Use a CSS variable so the keyframe gets the right delta. Instead of
    // hacking through CSS variables, override animation with inline keyframes
    // via a longer dashoffset target.
  };

  if (selectedIds.length === 0) return null;

  // Multi-select: outlines only.
  if (selectedIds.length > 1) {
    return (
      <g pointerEvents="none">
        {selectedIds.map((id) => {
          const s = shapes.find((x) => x.id === id);
          if (!s) return null;
          return (
            <OutlineWithGlow
              key={id}
              shape={s}
              sw={sw} haloSW={haloSW} haloOpacity={haloOpacity}
              dash={dash} dashLen={dashLen} antsDuration={antsDuration}
            />
          );
        })}
      </g>
    );
  }

  const shape = shapes.find((s) => s.id === selectedIds[0]);
  if (!shape) return null;

  return (
    <g>
      <OutlineWithGlow
        shape={shape}
        sw={sw} haloSW={haloSW} haloOpacity={haloOpacity}
        dash={dash} dashLen={dashLen} antsDuration={antsDuration}
      />
      {shape.type === 'rect' && rectHandles(shape).map((h) => (
        <Handle key={h.handle} {...h} shapeId={shape.id} size={handleSize} sw={sw} />
      ))}
      {shape.type === 'ellipse' && ellipseHandles(shape).map((h) => (
        <Handle key={h.handle} {...h} shapeId={shape.id} size={handleSize} sw={sw} />
      ))}
      {(shape.type === 'polygon' || shape.type === 'polyline') &&
        shape.points.map(([x, y], i) => (
          <circle
            key={i}
            cx={x} cy={y} r={vertexSize}
            fill="#a855f7" stroke="#fff" strokeWidth={sw}
            style={{ cursor: 'move' }}
            data-shape-id={shape.id}
            data-vertex={i}
          />
        ))}
    </g>
  );
}

// One shape outline with a softened violet halo (using stroke duplication
// since SVG <filter> blur is expensive when many shapes are selected). The
// inner outline carries the marching-ants animation.
function OutlineWithGlow({ shape, sw, haloSW, haloOpacity, dash, dashLen, antsDuration }) {
  const animStyle = {
    animation: `marching-ants ${antsDuration} linear infinite`,
  };
  return (
    <g pointerEvents="none">
      {haloOpacity > 0 && (
        <OutlineShape
          shape={shape}
          stroke="#a855f7"
          strokeWidth={haloSW}
          strokeOpacity={haloOpacity}
          filter="blur(2px)"
        />
      )}
      <OutlineShape
        shape={shape}
        stroke="#a855f7"
        strokeWidth={sw}
        strokeDasharray={dash}
        className="marching-ants"
        style={animStyle}
      />
    </g>
  );
}

function OutlineShape({ shape, ...props }) {
  const { filter, ...rest } = props;
  const styleWithFilter = filter ? { ...(props.style || {}), filter } : props.style;
  const finalProps = { ...rest, style: styleWithFilter, fill: 'none' };
  if (shape.type === 'rect') {
    return <rect x={shape.x} y={shape.y} width={shape.width} height={shape.height} {...finalProps} />;
  }
  if (shape.type === 'ellipse') {
    return <ellipse cx={shape.cx} cy={shape.cy} rx={shape.rx} ry={shape.ry} {...finalProps} />;
  }
  if (shape.type === 'polygon') {
    return <polygon points={shape.points.map((p) => p.join(',')).join(' ')} {...finalProps} />;
  }
  if (shape.type === 'polyline') {
    return <polyline points={shape.points.map((p) => p.join(',')).join(' ')} {...finalProps} />;
  }
  return null;
}

function rectHandles(s) {
  const x = s.x, y = s.y, r = s.x + s.width, b = s.y + s.height;
  const mx = s.x + s.width / 2, my = s.y + s.height / 2;
  return [
    { handle: 'nw', x: x, y: y, cursor: 'nwse-resize' },
    { handle: 'n',  x: mx, y: y, cursor: 'ns-resize'  },
    { handle: 'ne', x: r, y: y, cursor: 'nesw-resize' },
    { handle: 'e',  x: r, y: my, cursor: 'ew-resize'  },
    { handle: 'se', x: r, y: b, cursor: 'nwse-resize' },
    { handle: 's',  x: mx, y: b, cursor: 'ns-resize'  },
    { handle: 'sw', x: x, y: b, cursor: 'nesw-resize' },
    { handle: 'w',  x: x, y: my, cursor: 'ew-resize'  },
  ];
}

function ellipseHandles(s) {
  const l = s.cx - s.rx, r = s.cx + s.rx, t = s.cy - s.ry, b = s.cy + s.ry;
  return [
    { handle: 'nw', x: l, y: t, cursor: 'nwse-resize' },
    { handle: 'n',  x: s.cx, y: t, cursor: 'ns-resize'  },
    { handle: 'ne', x: r, y: t, cursor: 'nesw-resize' },
    { handle: 'e',  x: r, y: s.cy, cursor: 'ew-resize'  },
    { handle: 'se', x: r, y: b, cursor: 'nwse-resize' },
    { handle: 's',  x: s.cx, y: b, cursor: 'ns-resize'  },
    { handle: 'sw', x: l, y: b, cursor: 'nesw-resize' },
    { handle: 'w',  x: l, y: s.cy, cursor: 'ew-resize'  },
  ];
}

function Handle({ x, y, shapeId, handle, size, sw, cursor }) {
  return (
    <rect
      x={x - size / 2} y={y - size / 2} width={size} height={size}
      fill="#a855f7" stroke="#fff" strokeWidth={sw}
      style={{ cursor, pointerEvents: 'auto' }}
      data-shape-id={shapeId}
      data-handle={handle}
    />
  );
}
