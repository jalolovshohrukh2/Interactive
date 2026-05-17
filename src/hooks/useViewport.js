import { useState, useEffect, useRef, useCallback } from 'react';

const ZOOM_MIN = 0.1;
const ZOOM_MAX = 16;
const ZOOM_STEP = 1.25;

// Owns the canvas viewport: zoom factor, pan offset (in viewport pixels),
// and the measured viewport size (via ResizeObserver).
//
// At zoom = 1 the image fits the viewport (fitScale chosen so the larger
// dimension touches the edge). Zoom > 1 makes it larger; pan handles the
// part that overflows. Pan is in viewport pixels relative to the *centered*
// position, so { 0, 0 } means "perfectly centered" regardless of zoom.
export function useViewport({ image }) {
  const [zoom, setZoomState] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [viewportSize, setViewportSize] = useState({ w: 1, h: 1 });
  const viewportRef = useRef(null);

  // Track viewport size. Re-run when the image becomes available — the
  // Canvas <div> (which carries viewportRef) is only mounted when image is
  // truthy, so the first run on app load has a null ref.
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    // Sync initial size immediately so the first paint isn't 1x1.
    const r0 = el.getBoundingClientRect();
    setViewportSize({ w: Math.max(1, r0.width), h: Math.max(1, r0.height) });
    const ro = new ResizeObserver((entries) => {
      const r = entries[0].contentRect;
      setViewportSize({ w: Math.max(1, r.width), h: Math.max(1, r.height) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [image]);

  // When the image changes, reset the view.
  const imageKey = image?.url;
  useEffect(() => {
    setZoomState(1);
    setPan({ x: 0, y: 0 });
  }, [imageKey]);

  const fitScale = image
    ? Math.min(viewportSize.w / image.width, viewportSize.h / image.height)
    : 1;
  const displayScale = fitScale * zoom;
  const dispW = image ? image.width * displayScale : 0;
  const dispH = image ? image.height * displayScale : 0;
  const baseX = (viewportSize.w - dispW) / 2;
  const baseY = (viewportSize.h - dispH) / 2;

  const clampZoom = (z) => Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, z));

  // Zoom in/out keeping the point under (screenX, screenY) fixed on screen.
  // screenX/Y are relative to the viewport element.
  const zoomAtPoint = useCallback(
    (factor, screenX, screenY) => {
      if (!image) return;
      const z1 = zoom;
      const z2 = clampZoom(z1 * factor);
      if (z2 === z1) return;
      const ds1 = fitScale * z1;
      const ds2 = fitScale * z2;
      const baseX1 = (viewportSize.w - image.width * ds1) / 2;
      const baseY1 = (viewportSize.h - image.height * ds1) / 2;
      const baseX2 = (viewportSize.w - image.width * ds2) / 2;
      const baseY2 = (viewportSize.h - image.height * ds2) / 2;
      // Image-space coords of the focal point.
      const ix = (screenX - baseX1 - pan.x) / ds1;
      const iy = (screenY - baseY1 - pan.y) / ds1;
      const newPanX = screenX - baseX2 - ix * ds2;
      const newPanY = screenY - baseY2 - iy * ds2;
      setZoomState(z2);
      setPan({ x: newPanX, y: newPanY });
    },
    [image, zoom, fitScale, viewportSize.w, viewportSize.h, pan.x, pan.y]
  );

  const zoomBy = useCallback(
    (factor) => {
      // Zoom around viewport center.
      zoomAtPoint(factor, viewportSize.w / 2, viewportSize.h / 2);
    },
    [zoomAtPoint, viewportSize.w, viewportSize.h]
  );

  const zoomIn = useCallback(() => zoomBy(ZOOM_STEP), [zoomBy]);
  const zoomOut = useCallback(() => zoomBy(1 / ZOOM_STEP), [zoomBy]);
  const resetView = useCallback(() => {
    setZoomState(1);
    setPan({ x: 0, y: 0 });
  }, []);

  const panBy = useCallback((dx, dy) => setPan((p) => ({ x: p.x + dx, y: p.y + dy })), []);

  return {
    viewportRef,
    zoom,
    pan,
    setPan,
    panBy,
    fitScale,
    displayScale,
    dispW,
    dispH,
    baseX,
    baseY,
    viewportSize,
    zoomIn,
    zoomOut,
    zoomBy,
    zoomAtPoint,
    resetView,
    ZOOM_MIN,
    ZOOM_MAX,
  };
}
