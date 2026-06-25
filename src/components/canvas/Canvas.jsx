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
  blurMode = false, blurAmount = 0, blurStroke = 0, blurStrokeColor = '#38bdf8',
  blurOutside = 'blur', blurFillColor = '#ffffff',
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
  // Blur preview: every region defines a clip area. Polylines are auto-closed.
  const focusShapes = blurMode ? visibleShapes : [];
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
          {blurMode ? (
            <>
              <defs>
                <filter id="blur-preview-filter" x="-10%" y="-10%" width="120%" height="120%">
                  <feGaussianBlur stdDeviation={Math.max(0, blurAmount)} edgeMode="duplicate" />
                </filter>
                {focusShapes.length > 0 && (
                  <clipPath id="blur-focus-clip">
                    {focusShapes.map((s) => (
                      <ClipShape key={s.id} shape={s} />
                    ))}
                  </clipPath>
                )}
                {blurOutside === 'transparent' && (
                  <pattern id="blur-transparent-checker" width={16} height={16} patternUnits="userSpaceOnUse">
                    <rect width={16} height={16} fill="#9aa0a6" />
                    <rect width={8} height={8} fill="#cfd3d6" />
                    <rect x={8} y={8} width={8} height={8} fill="#cfd3d6" />
                  </pattern>
                )}
              </defs>
              {/* The "outside" layer — everything that is NOT a focus region.
                  Either the blurred image, a solid fill color, or a checker
                  that signals transparency. The sharp regions are drawn on top. */}
              {blurOutside === 'color' ? (
                <rect
                  x={0} y={0} width={image.width} height={image.height}
                  fill={blurFillColor}
                  style={{ pointerEvents: 'none' }}
                />
              ) : blurOutside === 'transparent' ? (
                <rect
                  x={0} y={0} width={image.width} height={image.height}
                  fill="url(#blur-transparent-checker)"
                  style={{ pointerEvents: 'none' }}
                />
              ) : (
                <>
                  {/* Sharp base keeps the image edges clean under the blur. */}
                  <image
                    href={image.url}
                    x={0} y={0}
                    width={image.width} height={image.height}
                    preserveAspectRatio="none"
                    style={{ pointerEvents: 'none' }}
                  />
                  {/* Blurred copy over the whole image. */}
                  {blurAmount > 0 && (
                    <image
                      href={image.url}
                      x={0} y={0}
                      width={image.width} height={image.height}
                      preserveAspectRatio="none"
                      filter="url(#blur-preview-filter)"
                      style={{ pointerEvents: 'none' }}
                    />
                  )}
                </>
              )}
              {/* Sharp focus regions punched back in. */}
              {focusShapes.length > 0 && (
                <g clipPath="url(#blur-focus-clip)" pointerEvents="none">
                  <image
                    href={image.url}
                    x={0} y={0}
                    width={image.width} height={image.height}
                    preserveAspectRatio="none"
                    style={{ pointerEvents: 'none' }}
                  />
                </g>
              )}
              {/* Colored outline around each sharp region — WYSIWYG with the
                  exported image. Width is in image px so it scales with zoom. */}
              {blurStroke > 0 && focusShapes.length > 0 && (
                <g
                  pointerEvents="none"
                  fill="none"
                  stroke={blurStrokeColor}
                  strokeWidth={blurStroke}
                  strokeLinejoin="round"
                >
                  {focusShapes.map((s) => (
                    <ClipShape key={'stroke-' + s.id} shape={s} />
                  ))}
                </g>
              )}
            </>
          ) : (
            <image
              href={image.url}
              x={0} y={0}
              width={image.width} height={image.height}
              preserveAspectRatio="none"
              style={{ pointerEvents: 'none' }}
            />
          )}
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
          {/* Pass only the visible shapes so a hidden-but-still-selected region
              (e.g. after Solo or Hide) doesn't leave dangling handles behind. */}
          {mode === 'edit' && selectedIds.length > 0 && (
            <SelectionHandles
              shapes={visibleShapes}
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

// A focus-region outline emitted as a <clipPath> child for the blur preview.
// Polylines are treated as closed polygons so they enclose an area like the
// other region shapes.
function ClipShape({ shape }) {
  switch (shape.type) {
    case 'rect':
      return <rect x={shape.x} y={shape.y} width={shape.width} height={shape.height} />;
    case 'ellipse':
      return <ellipse cx={shape.cx} cy={shape.cy} rx={shape.rx} ry={shape.ry} />;
    case 'polygon':
    case 'polyline':
      return <polygon points={(shape.points || []).map((p) => p.join(',')).join(' ')} />;
    default:
      return null;
  }
}
