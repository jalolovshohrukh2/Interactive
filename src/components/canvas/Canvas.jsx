import { useEffect } from 'react';
import ShapeRender from './ShapeRender.jsx';
import DraftRender from './DraftRender.jsx';
import SelectionHandles from './SelectionHandles.jsx';
import Guides from './Guides.jsx';
import ZoomControls from './ZoomControls.jsx';
import Marquee from './Marquee.jsx';
import { bbox } from '../../lib/snap.js';

// Single SVG fills the viewport. Image + shapes live inside a <g> with a
// translate+scale transform driven by the viewport hook. That means:
//   - Zoom/pan don't touch the surrounding chrome (header/toolbar/sidebar
//     stay put — only the canvas content moves).
//   - getScreenCTM isn't needed; mouse → image coords is one subtract and
//     divide (see useDrawing.getPos).
//   - The dark area around the image is part of the SVG, so pan gestures
//     (middle-drag, space-drag, wheel) work from anywhere in the viewport.
export default function Canvas({
  image, shapes, draft, cursor, guides, marquee, tool, mode,
  selectedIds, hoveredId, setHoveredId, svgRef, gRef,
  onMouseDown, onMouseMove, onMouseUp, onMouseLeave, onDoubleClick, onContextMenu,
  viewport, glow = 0.4, showNames = false, imageSelected = false,
}) {
  const {
    viewportRef, viewportSize, baseX, baseY, pan, displayScale,
    zoom, zoomIn, zoomOut, resetView, zoomAtPoint, panBy,
  } = viewport;

  // React's onWheel is passive in React 19 — we need preventDefault, so we
  // attach the listener via DOM with passive: false.
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const onWheel = (e) => {
      const rect = el.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
        zoomAtPoint(factor, sx, sy);
      } else {
        e.preventDefault();
        panBy(-e.deltaX, -e.deltaY);
      }
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [viewportRef, zoomAtPoint, panBy]);

  const selectedSet = new Set(selectedIds);
  const visibleShapes = shapes.filter((s) => !s.hidden);
  const cursorStyle =
    mode === 'preview' ? 'default' : tool === 'select' ? 'default' : 'crosshair';

  return (
    <div
      ref={viewportRef}
      className="absolute inset-0 overflow-hidden"
      style={{
        backgroundImage:
          'linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px),' +
          'linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)',
        backgroundSize: '32px 32px',
      }}
    >
      <svg
        ref={svgRef}
        width={viewportSize.w}
        height={viewportSize.h}
        style={{ display: 'block', cursor: cursorStyle, userSelect: 'none' }}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseLeave || onMouseUp}
        onDoubleClick={onDoubleClick}
        onContextMenu={(e) => {
          e.preventDefault();
          onContextMenu?.(e);
        }}
      >
        <g
          ref={gRef}
          transform={`translate(${baseX + pan.x},${baseY + pan.y}) scale(${displayScale})`}
        >
          <image
            href={image.url}
            x={0} y={0}
            width={image.width} height={image.height}
            preserveAspectRatio="none"
            style={{ pointerEvents: 'none' }}
          />
          {imageSelected && (
            <g pointerEvents="none">
              <rect
                x={0} y={0} width={image.width} height={image.height}
                fill="rgba(168,85,247,0.08)"
                stroke="#a855f7" strokeWidth={2 / displayScale}
              />
              {[[0, 0], [image.width, 0], [0, image.height], [image.width, image.height]].map(([x, y], i) => (
                <rect
                  key={i}
                  x={x - 5 / displayScale} y={y - 5 / displayScale}
                  width={10 / displayScale} height={10 / displayScale}
                  fill="#a855f7"
                />
              ))}
            </g>
          )}
          {visibleShapes.map((s) => (
            <ShapeRender
              key={s.id}
              shape={s}
              isSelected={selectedSet.has(s.id)}
              isHovered={s.id === hoveredId}
              mode={mode}
              onHover={setHoveredId}
              displayScale={displayScale}
              glow={glow}
            />
          ))}
          {showNames && visibleShapes.map((s) => {
            const b = bbox(s);
            return (
              <text
                key={'lbl-' + s.id}
                x={b.x + 5 / displayScale}
                y={b.y + 16 / displayScale}
                fontSize={13 / displayScale}
                fontFamily="ui-monospace, 'JetBrains Mono', monospace"
                fontWeight="600"
                fill="#fff"
                stroke="#04210f"
                strokeWidth={3.5 / displayScale}
                paintOrder="stroke"
                style={{ pointerEvents: 'none' }}
              >
                {s.name}
              </text>
            );
          })}
          {mode === 'edit' && selectedIds.length > 0 && (
            <SelectionHandles
              shapes={shapes}
              selectedIds={selectedIds}
              displayScale={displayScale}
            />
          )}
          {draft && <DraftRender draft={draft} cursor={cursor} displayScale={displayScale} />}
          <Marquee marquee={marquee} displayScale={displayScale} />
          <Guides
            guides={guides}
            imageWidth={image.width}
            imageHeight={image.height}
            displayScale={displayScale}
          />
        </g>
      </svg>
      <ZoomControls
        zoom={zoom}
        onZoomIn={zoomIn}
        onZoomOut={zoomOut}
        onReset={resetView}
      />
    </div>
  );
}
