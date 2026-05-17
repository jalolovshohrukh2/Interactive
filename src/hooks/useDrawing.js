import { useState, useRef, useCallback, useEffect } from 'react';
import { distXY } from '../lib/coords.js';
import { buildCandidates, snapMove, snapPoint, bbox } from '../lib/snap.js';
import {
  makeBaseShape,
  moveShape,
  resizeShape,
  updateVertex,
  buildShapeFromDraft,
} from '../lib/shapes.js';
import { CLOSE_POLYGON_THRESHOLD, MIN_SHAPE_SIZE } from '../constants.js';

const SNAP_THRESHOLD_PX = 6;

// Returns true if two axis-aligned bounding boxes overlap (any intersection).
const bboxIntersects = (a, b) =>
  a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

// Owns all interaction state: tool, mode, in-progress draft, selection,
// mid-flight gestures (move / resize / vertex / pan / marquee), guide overlay.
//
// Selection is multi: `selectedIds` is an array of shape ids. Most operations
// (move, delete, duplicate, nudge, copy/paste) work on the whole array.
// Resize and vertex-drag only run when exactly one shape is selected.
//
// Coords / pan / snap notes — see prior commits.
export function useDrawing({ image, shapes, addShape, setShapesLive, pushHistory, viewport }) {
  const [tool, setTool] = useState('select');
  const [mode, setMode] = useState('edit');
  const [selectedIds, setSelectedIdsState] = useState([]);
  const [hoveredId, setHoveredId] = useState(null);
  const [draft, setDraft] = useState(null);
  const [cursor, setCursor] = useState(null);
  const [interaction, setInteraction] = useState(null);
  const [guides, setGuides] = useState([]);
  const [marquee, setMarquee] = useState(null);
  const svgRef = useRef(null);
  const gRef = useRef(null);
  const spaceHeldRef = useRef(false);
  const panOriginRef = useRef(null);

  // Selection helpers — clean public API.
  const setSelectedIds = useCallback((ids) => setSelectedIdsState(ids), []);
  const selectOne = useCallback((id) => setSelectedIdsState(id ? [id] : []), []);
  const toggleInSelection = useCallback(
    (id) => setSelectedIdsState((arr) => (arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id])),
    []
  );
  const clearSelection = useCallback(() => setSelectedIdsState([]), []);

  useEffect(() => {
    const dn = (e) => {
      if (e.code !== 'Space' || e.repeat) return;
      const tag = e.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      spaceHeldRef.current = true;
      e.preventDefault();
    };
    const up = (e) => { if (e.code === 'Space') spaceHeldRef.current = false; };
    window.addEventListener('keydown', dn);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', dn);
      window.removeEventListener('keyup', up);
    };
  }, []);

  const getPos = (e) => {
    const rect = viewport.viewportRef.current?.getBoundingClientRect();
    if (!rect || !image || !viewport.displayScale) return { x: 0, y: 0 };
    return {
      x: (e.clientX - rect.left - viewport.baseX - viewport.pan.x) / viewport.displayScale,
      y: (e.clientY - rect.top - viewport.baseY - viewport.pan.y) / viewport.displayScale,
    };
  };

  const isInsideImage = (p) =>
    image && p.x >= 0 && p.y >= 0 && p.x <= image.width && p.y <= image.height;

  const finishPolyDraft = useCallback(() => {
    setDraft((d) => {
      if (!d) return null;
      const min = d.type === 'polygon' ? 3 : 2;
      if (d.points.length < min) return null;
      const overrides = d.type === 'polyline' ? { hover: 'fill' } : {};
      const built = buildShapeFromDraft(d, makeBaseShape(shapes.length, overrides));
      if (built) {
        addShape(built);
        selectOne(built.id);
      }
      return null;
    });
    setGuides([]);
  }, [shapes.length, addShape, selectOne]);

  const startPan = (e) => {
    e.preventDefault();
    panOriginRef.current = { x: e.clientX, y: e.clientY };
    setInteraction({ type: 'pan' });
  };

  const onMouseDown = (e) => {
    if (e.button === 1 || (e.button === 0 && spaceHeldRef.current)) {
      startPan(e);
      return;
    }
    if (mode !== 'edit' || !image) return;

    const target = e.target;
    const dataId = target.dataset?.shapeId;
    const handle = target.dataset?.handle;
    const vertexAttr = target.dataset?.vertex;
    const pos = getPos(e);

    // Resize handle — only meaningful when exactly one shape is selected
    if (handle && dataId) {
      const sh = shapes.find((s) => s.id === dataId);
      if (!sh) return;
      selectOne(dataId);
      setInteraction({ type: 'resize', handle, start: pos, original: sh, snapshot: shapes });
      return;
    }

    // Vertex drag — same restriction
    if (vertexAttr !== undefined && dataId) {
      const sh = shapes.find((s) => s.id === dataId);
      if (!sh) return;
      // Alt+click deletes the vertex instead of dragging it.
      if (e.altKey && (sh.type === 'polygon' || sh.type === 'polyline')) {
        const min = sh.type === 'polygon' ? 3 : 2;
        if (sh.points.length > min) {
          const i = parseInt(vertexAttr, 10);
          const next = { ...sh, points: sh.points.filter((_, idx) => idx !== i) };
          // Treat as committed change with history.
          pushHistory(shapes);
          setShapesLive((arr) => arr.map((s) => (s.id === sh.id ? next : s)));
        }
        return;
      }
      selectOne(dataId);
      setInteraction({ type: 'vertex', index: parseInt(vertexAttr, 10), original: sh, snapshot: shapes });
      return;
    }

    // Clicked a shape body in select tool
    if (dataId && tool === 'select') {
      const sh = shapes.find((s) => s.id === dataId);
      if (!sh || sh.locked) return;
      if (e.shiftKey) {
        toggleInSelection(dataId);
        return;
      }
      // Build the set of ids to drag:
      //   - If clicked shape is already in selection, drag the whole selection.
      //   - Otherwise replace selection with this shape and drag it.
      let movingIds;
      if (selectedIds.includes(dataId)) {
        movingIds = selectedIds;
      } else {
        movingIds = [dataId];
        setSelectedIdsState(movingIds);
      }
      const originals = movingIds
        .map((id) => shapes.find((s) => s.id === id))
        .filter((s) => s && !s.locked);
      setInteraction({
        type: 'move',
        start: pos,
        originals,
        primary: sh,
        snapshot: shapes,
      });
      return;
    }

    // Select tool, empty area → either marquee select or clear selection
    if (tool === 'select') {
      if (!isInsideImage(pos)) {
        clearSelection();
        return;
      }
      setMarquee({ x0: pos.x, y0: pos.y, x1: pos.x, y1: pos.y, additive: e.shiftKey });
      setInteraction({ type: 'marquee' });
      if (!e.shiftKey) clearSelection();
      return;
    }

    if (!isInsideImage(pos)) return;

    const threshold = SNAP_THRESHOLD_PX / viewport.displayScale;

    if (tool === 'rect' || tool === 'ellipse') {
      const candidates = buildCandidates(shapes, image.width, image.height);
      const snapped = snapPoint({ x: pos.x, y: pos.y, candidates, threshold });
      clearSelection();
      setDraft({ type: tool, start: snapped, current: snapped });
      return;
    }
    if (tool === 'polygon' || tool === 'polyline') {
      if (!draft || draft.type !== tool) {
        const candidates = buildCandidates(shapes, image.width, image.height);
        const snapped = snapPoint({ x: pos.x, y: pos.y, candidates, threshold });
        clearSelection();
        setDraft({ type: tool, points: [[snapped.x, snapped.y]] });
        return;
      }
      if (tool === 'polygon' && draft.points.length >= 3) {
        const [fx, fy] = draft.points[0];
        if (distXY(pos.x, pos.y, fx, fy) < CLOSE_POLYGON_THRESHOLD) {
          finishPolyDraft();
          return;
        }
      }
      const candidates = buildCandidates(shapes, image.width, image.height, draft.points);
      const snapped = snapPoint({ x: pos.x, y: pos.y, candidates, threshold });
      // Shift constrains the new segment to a 15° multiple of the previous point.
      let placed = snapped;
      if (e.shiftKey && draft.points.length > 0) {
        const last = draft.points[draft.points.length - 1];
        placed = constrainAngle(last, snapped, 15);
      }
      setDraft({ ...draft, points: [...draft.points, [placed.x, placed.y]] });
    }
  };

  const onMouseMove = (e) => {
    if (interaction?.type === 'pan') {
      const o = panOriginRef.current;
      if (o) {
        viewport.panBy(e.clientX - o.x, e.clientY - o.y);
        panOriginRef.current = { x: e.clientX, y: e.clientY };
      }
      return;
    }
    if (!image) return;
    const pos = getPos(e);
    setCursor(pos);

    const threshold = SNAP_THRESHOLD_PX / viewport.displayScale;

    if (interaction?.type === 'marquee') {
      setMarquee((m) => (m ? { ...m, x1: pos.x, y1: pos.y } : m));
      return;
    }

    if (interaction?.type === 'move') {
      const dx = pos.x - interaction.start.x;
      const dy = pos.y - interaction.start.y;
      const movingIdSet = new Set(interaction.originals.map((o) => o.id));
      const others = shapes.filter((s) => !movingIdSet.has(s.id));
      const candidates = buildCandidates(others, image.width, image.height);
      const snapped = snapMove({ shape: interaction.primary, dx, dy, candidates, threshold });
      const idToOriginal = new Map(interaction.originals.map((o) => [o.id, o]));
      setShapesLive((arr) =>
        arr.map((s) => {
          const o = idToOriginal.get(s.id);
          return o ? moveShape(o, snapped.dx, snapped.dy) : s;
        })
      );
      setGuides(snapped.guides);
      return;
    }
    if (interaction?.type === 'resize') {
      const others = shapes.filter((s) => s.id !== interaction.original.id);
      const candidates = buildCandidates(others, image.width, image.height);
      const snapped = snapPoint({ x: pos.x, y: pos.y, candidates, threshold });
      setShapesLive((arr) =>
        arr.map((s) =>
          s.id === interaction.original.id
            ? resizeShape(interaction.original, interaction.handle, snapped, { shift: e.shiftKey })
            : s
        )
      );
      setGuides(snapped.guides);
      return;
    }
    if (interaction?.type === 'vertex') {
      const others = shapes.filter((s) => s.id !== interaction.original.id);
      const candidates = buildCandidates(others, image.width, image.height);
      const snapped = snapPoint({ x: pos.x, y: pos.y, candidates, threshold });
      setShapesLive((arr) =>
        arr.map((s) =>
          s.id === interaction.original.id ? updateVertex(s, interaction.index, snapped) : s
        )
      );
      setGuides(snapped.guides);
      return;
    }

    // Snap during drawing.
    if (draft) {
      const extra = (draft.type === 'polygon' || draft.type === 'polyline') ? draft.points : [];
      const candidates = buildCandidates(shapes, image.width, image.height, extra);
      const snapped = snapPoint({ x: pos.x, y: pos.y, candidates, threshold });
      setGuides(snapped.guides);
      setCursor(snapped);
      if (draft.type === 'rect' || draft.type === 'ellipse') {
        setDraft({ ...draft, current: snapped });
      }
      return;
    }

    if (guides.length) setGuides([]);
  };

  const onMouseUp = () => {
    if (interaction?.type === 'marquee') {
      const m = marquee;
      if (m) {
        const box = {
          x: Math.min(m.x0, m.x1), y: Math.min(m.y0, m.y1),
          w: Math.abs(m.x1 - m.x0), h: Math.abs(m.y1 - m.y0),
        };
        const hits = shapes.filter((s) => !s.hidden && !s.locked && bboxIntersects(box, bbox(s))).map((s) => s.id);
        if (m.additive) {
          setSelectedIdsState((prev) => Array.from(new Set([...prev, ...hits])));
        } else {
          setSelectedIdsState(hits);
        }
      }
      setMarquee(null);
      setInteraction(null);
      return;
    }
    if (interaction) {
      if (interaction.type !== 'pan' && interaction.snapshot && interaction.snapshot !== shapes) {
        pushHistory(interaction.snapshot);
      }
      setInteraction(null);
      setGuides([]);
      panOriginRef.current = null;
      return;
    }
    if (draft && (draft.type === 'rect' || draft.type === 'ellipse')) {
      const { start, current } = draft;
      const w = Math.abs(current.x - start.x);
      const h = Math.abs(current.y - start.y);
      if (w > MIN_SHAPE_SIZE && h > MIN_SHAPE_SIZE) {
        const built = buildShapeFromDraft(draft, makeBaseShape(shapes.length));
        if (built) {
          addShape(built);
          selectOne(built.id);
        }
      }
      setDraft(null);
      setGuides([]);
    }
  };

  const onMouseLeave = () => {
    onMouseUp();
    setGuides([]);
    setCursor(null);
  };

  const onDoubleClick = (e) => {
    if (draft && (draft.type === 'polygon' || draft.type === 'polyline')) {
      finishPolyDraft();
      return;
    }
    // Double-click on a polygon/polyline edge in select tool → insert a vertex.
    if (mode === 'edit' && tool === 'select') {
      const dataId = e.target.dataset?.shapeId;
      if (!dataId) return;
      const sh = shapes.find((s) => s.id === dataId);
      if (!sh || sh.locked) return;
      if (sh.type !== 'polygon' && sh.type !== 'polyline') return;
      const pos = getPos(e);
      const inserted = insertVertexOnEdge(sh, pos);
      if (inserted) {
        pushHistory(shapes);
        setShapesLive((arr) => arr.map((s) => (s.id === sh.id ? inserted : s)));
      }
    }
  };

  const switchTool = useCallback((t) => {
    setTool(t);
    setDraft(null);
    setGuides([]);
  }, []);
  const switchMode = useCallback((m) => {
    setMode(m);
    setDraft(null);
    setSelectedIdsState([]);
    setHoveredId(null);
    setGuides([]);
  }, []);
  const cancelDraft = useCallback(() => {
    setDraft(null);
    setGuides([]);
  }, []);
  const popDraftPoint = useCallback(() => {
    if (!draft || (draft.type !== 'polygon' && draft.type !== 'polyline')) return false;
    if (draft.points.length <= 1) setDraft(null);
    else setDraft({ ...draft, points: draft.points.slice(0, -1) });
    return true;
  }, [draft]);

  // Move every selected shape by (dx, dy). Used by arrow-key nudge.
  const nudgeSelected = useCallback(
    (dx, dy) => {
      if (!selectedIds.length) return;
      const idSet = new Set(selectedIds);
      pushHistory(shapes);
      setShapesLive((arr) =>
        arr.map((s) => (idSet.has(s.id) && !s.locked ? moveShape(s, dx, dy) : s))
      );
    },
    [selectedIds, shapes, setShapesLive, pushHistory]
  );

  return {
    tool, mode, selectedIds, hoveredId, draft, cursor, guides, marquee,
    svgRef, gRef,
    setSelectedIds, selectOne, toggleInSelection, clearSelection, setHoveredId,
    switchTool, switchMode, cancelDraft, finishPolyDraft, popDraftPoint, nudgeSelected,
    onMouseDown, onMouseMove, onMouseUp, onMouseLeave, onDoubleClick,
  };
}

// Constrain `target` so the segment from `from` to it is along a multiple of
// `stepDeg` degrees, preserving the distance.
function constrainAngle(from, target, stepDeg) {
  const dx = target.x - from[0];
  const dy = target.y - from[1];
  const len = Math.hypot(dx, dy);
  if (len === 0) return target;
  const step = (stepDeg * Math.PI) / 180;
  const angle = Math.atan2(dy, dx);
  const snapped = Math.round(angle / step) * step;
  return {
    x: from[0] + Math.cos(snapped) * len,
    y: from[1] + Math.sin(snapped) * len,
  };
}

// Find the polygon/polyline edge closest to `pos` within a reasonable
// threshold and return a new shape with a vertex inserted at the projection.
// Returns null if no edge is close enough.
function insertVertexOnEdge(shape, pos) {
  const pts = shape.points;
  const closed = shape.type === 'polygon';
  const n = pts.length;
  const segCount = closed ? n : n - 1;

  let best = { idx: -1, dist: Infinity, proj: null };
  for (let i = 0; i < segCount; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % n];
    const p = projectOnSegment(pos, a, b);
    const d = Math.hypot(pos.x - p.x, pos.y - p.y);
    if (d < best.dist) best = { idx: i, dist: d, proj: p };
  }
  // Threshold in viewBox units — generous since the user double-clicked the body.
  if (best.dist > 12) return null;
  const next = [...pts];
  next.splice(best.idx + 1, 0, [best.proj.x, best.proj.y]);
  return { ...shape, points: next };
}

function projectOnSegment(p, a, b) {
  const ax = a[0], ay = a[1], bx = b[0], by = b[1];
  const vx = bx - ax, vy = by - ay;
  const len2 = vx * vx + vy * vy;
  if (len2 === 0) return { x: ax, y: ay };
  const t = Math.max(0, Math.min(1, ((p.x - ax) * vx + (p.y - ay) * vy) / len2));
  return { x: ax + vx * t, y: ay + vy * t };
}
