// Render handles for the currently selected shape(s) (edit mode only).
//
//   - Single selection: dashed bounding outline + 8 resize handles (or
//     vertex handles for polygons/polylines).
//   - Multi-selection: dashed outline around each selected shape, no handles.
//
// No animation, no glow — this is a static "you've selected this" affordance
// in edit mode. The animated hover effect lives in ShapeRender's preview
// branch and matches what shows up in the exported SVG.
//
// Sizes are divided by displayScale so they stay constant in screen pixels.
export default function SelectionHandles({ shapes, selectedIds, displayScale = 1 }) {
  const sw = 1.5 / displayScale;
  const dash = `${5 / displayScale} ${3 / displayScale}`;
  const handleSize = 10 / displayScale;
  const vertexSize = 5 / displayScale;

  if (selectedIds.length === 0) return null;

  if (selectedIds.length > 1) {
    return (
      <g pointerEvents="none">
        {selectedIds.map((id) => {
          const s = shapes.find((x) => x.id === id);
          if (!s) return null;
          return <OutlineShape key={id} shape={s} stroke="#a855f7" strokeWidth={sw} strokeDasharray={dash} />;
        })}
      </g>
    );
  }

  const shape = shapes.find((s) => s.id === selectedIds[0]);
  if (!shape) return null;

  return (
    <g>
      <OutlineShape
        shape={shape}
        stroke="#a855f7"
        strokeWidth={sw}
        strokeDasharray={dash}
        pointerEvents="none"
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

function OutlineShape({ shape, ...props }) {
  const finalProps = { ...props, fill: 'none' };
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
