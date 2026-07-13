import { useEffect, useRef } from 'react';
import ShapeRender from './ShapeRender.jsx';
import DraftRender from './DraftRender.jsx';
import SelectionHandles from './SelectionHandles.jsx';
import Guides from './Guides.jsx';
import ZoomControls from './ZoomControls.jsx';
import Marquee from './Marquee.jsx';
import { bbox } from '../../lib/snap.js';
import { hasCurves, polygonPathD } from '../../lib/pathGeom.js';

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
  loupeEnabled = true,
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

  // Magnifier loupe for the point tools — lets you click a precise spot without
  // zooming the whole canvas. It's driven imperatively off a rAF-throttled
  // mousemove listener (see the effect below) instead of React state, so it
  // tracks the cursor at 60fps without re-rendering the whole canvas each move.
  const loupeRef = useRef(null);
  const loupeStateRef = useRef({});
  loupeStateRef.current = {
    active: loupeEnabled && mode === 'edit' && (tool === 'polygon' || tool === 'polyline') && !!image,
    baseX, baseY, panX: pan.x, panY: pan.y, displayScale,
    imageW: image ? image.width : 0,
    imageH: image ? image.height : 0,
  };

  useEffect(() => {
    const el = viewportRef.current;
    const loupe = loupeRef.current;
    if (!el || !loupe) return;
    const R = 78, GAP = 18;
    let raf = 0;
    let last = null;
    const hide = () => { loupe.style.display = 'none'; };
    const apply = () => {
      raf = 0;
      const st = loupeStateRef.current;
      const e = last;
      if (!st.active || !e || !st.displayScale) return hide();
      const rect = el.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      if (mx < 0 || my < 0 || mx > rect.width || my > rect.height) return hide();
      const cx = (mx - st.baseX - st.panX) / st.displayScale;
      const cy = (my - st.baseY - st.panY) / st.displayScale;
      // Magnify 2.5x over the current zoom, never below 1.5x native.
      const S = Math.max(st.displayScale * 2.5, 1.5);
      let ly = my - (R + GAP);
      if (ly - R < 6) ly = my + (R + GAP);
      ly = Math.max(R + 6, Math.min(rect.height - R - 6, ly));
      const lx = Math.max(R + 6, Math.min(rect.width - R - 6, mx));
      loupe.style.display = 'block';
      loupe.style.left = (lx - R) + 'px';
      loupe.style.top = (ly - R) + 'px';
      loupe.style.backgroundSize = (st.imageW * S) + 'px ' + (st.imageH * S) + 'px';
      loupe.style.backgroundPosition = (R - cx * S) + 'px ' + (R - cy * S) + 'px';
    };
    const onMove = (e) => { last = e; if (!raf) raf = requestAnimationFrame(apply); };
    const onLeave = () => { last = null; hide(); };
    el.addEventListener('mousemove', onMove);
    el.addEventListener('mouseleave', onLeave);
    return () => {
      el.removeEventListener('mousemove', onMove);
      el.removeEventListener('mouseleave', onLeave);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [viewportRef]);

  // Hide the loupe right away when it's turned off or the tool changes, rather
  // than waiting for the next mouse move.
  useEffect(() => {
    if (loupeRef.current && !loupeStateRef.current.active) loupeRef.current.style.display = 'none';
  }, [loupeEnabled, tool, mode]);

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
      {/* Magnifier loupe — a CSS layer updated imperatively for smoothness.
          Only static styles live here; position + zoom are set in the effect. */}
      <div
        ref={loupeRef}
        style={{
          position: 'absolute',
          display: 'none',
          width: 156,
          height: 156,
          borderRadius: '50%',
          border: '2px solid #a855f7',
          boxShadow: '0 0 0 1px rgba(0,0,0,0.55), 0 6px 18px rgba(0,0,0,0.5)',
          backgroundColor: '#0f0f10',
          backgroundImage: `url("${image.url}")`,
          backgroundRepeat: 'no-repeat',
          overflow: 'hidden',
          pointerEvents: 'none',
          zIndex: 5,
        }}
      >
        <div style={{ position: 'absolute', left: '50%', top: '50%', width: 1.5, height: 24, background: '#a855f7', boxShadow: '0 0 1px rgba(0,0,0,0.9)', transform: 'translate(-50%,-50%)' }} />
        <div style={{ position: 'absolute', left: '50%', top: '50%', width: 24, height: 1.5, background: '#a855f7', boxShadow: '0 0 1px rgba(0,0,0,0.9)', transform: 'translate(-50%,-50%)' }} />
      </div>
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
      return hasCurves(shape)
        ? <path d={polygonPathD(shape.points, shape.curves, true)} />
        : <polygon points={(shape.points || []).map((p) => p.join(',')).join(' ')} />;
    default:
      return null;
  }
}
