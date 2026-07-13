import { useState, useRef, useCallback, useEffect } from 'react';
import { distXY } from '../lib/coords.js';
import { buildCandidates, snapMove, snapPoint, bbox } from '../lib/snap.js';
import { magicWandPolygon, magicWandAddToShape } from '../lib/magicWand.js';
import {
  makeBaseShape,
  moveShape,
  resizeShape,
  updateVertex,
  setEdgeCurve,
  buildShapeFromDraft,
} from '../lib/shapes.js';
import { controlForMidpoint } from '../lib/pathGeom.js';
import { CLOSE_POLYGON_THRESHOLD, MIN_SHAPE_SIZE } from '../constants.js';

const SNAP_THRESHOLD_PX = 10;

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
export function useDrawing({ image, shapes, addShape, setShapesLive, pushHistory, viewport, makeBase = makeBaseShape, onBackgroundSelect, wandTolerance = 32 }) {
  // Notify the app when the background image is clicked (select it) or when any
  // other interaction deselects it. Held in a ref so handlers don't need it in
  // their dep arrays.
  const bgSelectRef = useRef(onBackgroundSelect);
  bgSelectRef.current = onBackgroundSelect;
  const setBg = (v) => bgSelectRef.current?.(v);
  // Held in a ref so the build callbacks below don't need it in their deps —
  // lets the caller pass a fresh closure (e.g. capturing the piece-name
  // prefix) every render without churning memoized handlers.
  const makeBaseRef = useRef(makeBase);
  makeBaseRef.current = makeBase;

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

  // Current draft mirrored into a ref so finishPolyDraft can read it WITHOUT
  // performing the addShape side effect inside a setState updater — StrictMode
  // double-invokes updaters in dev, which was committing two shapes per polygon.
  const draftRef = useRef(null);
  draftRef.current = draft;

  // Magic-wand tolerance, in a ref so pointer handlers stay dependency-free.
  const wandTolRef = useRef(wandTolerance);
  wandTolRef.current = wandTolerance;
  // Guards against double-firing while a wand click is still computing.
  const wandBusyRef = useRef(false);

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
    const d = draftRef.current;
    if (!d) return;
    const min = d.type === 'polygon' ? 3 : 2;
    if (d.points.length >= min) {
      const overrides = d.type === 'polyline' ? { hover: 'fill' } : {};
      const built = buildShapeFromDraft(d, makeBaseRef.current(shapes.length, overrides));
      if (built) {
        addShape(built);
        selectOne(built.id);
      }
    }
    setDraft(null);
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
    const edgeAttr = target.dataset?.edge;
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
          // Editing the vertex count invalidates per-edge curve indices, so
          // straighten the shape rather than risk a misaligned curve.
          const next = { ...sh, points: sh.points.filter((_, idx) => idx !== i), curves: undefined };
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

    // Edge-midpoint drag — bow the edge into a curve. Alt+click straightens it.
    if (edgeAttr !== undefined && dataId) {
      const sh = shapes.find((s) => s.id === dataId);
      if (!sh) return;
      const i = parseInt(edgeAttr, 10);
      if (e.altKey) {
        pushHistory(shapes);
        const next = setEdgeCurve(sh, i, null);
        setShapesLive((arr) => arr.map((s) => (s.id === sh.id ? next : s)));
        return;
      }
      selectOne(dataId);
      setInteraction({ type: 'edgeCurve', index: i, original: sh, snapshot: shapes });
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
        setBg(false);
        return;
      }
      setMarquee({ x0: pos.x, y0: pos.y, x1: pos.x, y1: pos.y, additive: e.shiftKey });
      setInteraction({ type: 'marquee' });
      if (!e.shiftKey) clearSelection();
      return;
    }

    if (!isInsideImage(pos)) return;

    const threshold = SNAP_THRESHOLD_PX / viewport.displayScale;

    // Magic wand — flood-fill the clicked color into a polygon region.
    //   plain click  → new shape (one room)
    //   shift+click  → merge the clicked room INTO the selected shape as one
    //                  region, bridging the wall between them (build an apartment
    //                  from its rooms).
    if (tool === 'wand') {
      if (wandBusyRef.current) return;
      const addTo = e.shiftKey && selectedIds.length === 1
        ? shapes.find((s) => s.id === selectedIds[0])
        : null;
      wandBusyRef.current = true;
      if (!addTo) { clearSelection(); setBg(false); }
      const base = addTo ? null : makeBaseRef.current(shapes.length);
      // No grow here — the wand always selects the clean interior so merging
      // rooms never compounds. Grow is applied afterwards to the finished shape.
      const job = addTo
        ? magicWandAddToShape(image.url, image.width, image.height, pos.x, pos.y, wandTolRef.current, addTo)
        : magicWandPolygon(image.url, image.width, image.height, pos.x, pos.y, wandTolRef.current);
      job
        .then(({ points, coverage }) => {
          if (!points || points.length < 3) return;
          if (coverage > 0.9) {
            alert('That click flooded almost the whole image — click inside a colored area, or lower the wand tolerance.');
            return;
          }
          if (addTo) {
            pushHistory(shapes);
            setShapesLive((arr) => arr.map((s) => (s.id === addTo.id ? { ...s, type: 'polygon', points } : s)));
          } else {
            const built = buildShapeFromDraft({ type: 'polygon', points }, base);
            if (built) {
              addShape(built);
              selectOne(built.id);
            }
          }
        })
        .catch((err) => alert('Magic wand could not read the image: ' + err.message))
        .finally(() => { wandBusyRef.current = false; });
      return;
    }

    if (tool === 'lasso') {
      clearSelection();
      setBg(false);
      setDraft({ type: 'lasso', points: [[pos.x, pos.y]] });
      return;
    }
    if (tool === 'rect' || tool === 'ellipse') {
      const candidates = buildCandidates(shapes, image.width, image.height);
      const snapped = snapPoint({ x: pos.x, y: pos.y, candidates, threshold });
      clearSelection();
      setBg(false);
      setDraft({ type: tool, start: snapped, current: snapped });
      return;
    }
    if (tool === 'polygon' || tool === 'polyline') {
      if (!draft || draft.type !== tool) {
        const candidates = buildCandidates(shapes, image.width, image.height);
        const snapped = snapPoint({ x: pos.x, y: pos.y, candidates, threshold });
        clearSelection();
        setBg(false);
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

    // Freehand lasso: append points as the pointer drags (throttled by a
    // small screen-space distance so we don't capture thousands of points).
    if (draft?.type === 'lasso') {
      setDraft((d) => {
        if (!d) return d;
        const last = d.points[d.points.length - 1];
        const minDist = 2.5 / viewport.displayScale;
        if (distXY(pos.x, pos.y, last[0], last[1]) < minDist) return d;
        return { ...d, points: [...d.points, [pos.x, pos.y]] };
      });
      return;
    }

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
      // Snap to: other shapes + the OTHER vertices of THIS same polygon
      // (excluding the vertex currently being dragged, since it would
      // snap to its own un-moved old position).
      const others = shapes.filter((s) => s.id !== interaction.original.id);
      const sameShapeOtherPoints = (interaction.original.points || [])
        .filter((_, i) => i !== interaction.index);
      const candidates = buildCandidates(
        others,
        image.width, image.height,
        sameShapeOtherPoints,
      );
      const snapped = snapPoint({ x: pos.x, y: pos.y, candidates, threshold });
      setShapesLive((arr) =>
        arr.map((s) =>
          s.id === interaction.original.id ? updateVertex(s, interaction.index, snapped) : s
        )
      );
      setGuides(snapped.guides);
      return;
    }
    if (interaction?.type === 'edgeCurve') {
      const sh = interaction.original;
      const n = sh.points.length;
      const p0 = sh.points[interaction.index];
      const p1 = sh.points[(interaction.index + 1) % n];
      // Dragging back near the straight midpoint flattens the edge again.
      const midX = (p0[0] + p1[0]) / 2, midY = (p0[1] + p1[1]) / 2;
      const flatTol = 4 / viewport.displayScale;
      const control = distXY(pos.x, pos.y, midX, midY) < flatTol
        ? null
        : controlForMidpoint(p0, p1, [pos.x, pos.y]);
      setShapesLive((arr) => arr.map((s) => (s.id === sh.id ? setEdgeCurve(s, interaction.index, control) : s)));
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
        const w = Math.abs(m.x1 - m.x0), h = Math.abs(m.y1 - m.y0);
        if (w < 2 && h < 2 && !m.additive) {
          // A plain click on empty image area (no drag) → select the image.
          setBg(true);
        } else {
          const box = { x: Math.min(m.x0, m.x1), y: Math.min(m.y0, m.y1), w, h };
          const hits = shapes.filter((s) => !s.hidden && !s.locked && bboxIntersects(box, bbox(s))).map((s) => s.id);
          if (m.additive) {
            setSelectedIdsState((prev) => Array.from(new Set([...prev, ...hits])));
          } else {
            setSelectedIdsState(hits);
          }
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
    if (draft && draft.type === 'lasso') {
      const built = buildShapeFromDraft(draft, makeBaseRef.current(shapes.length));
      if (built) {
        addShape(built);
        selectOne(built.id);
      }
      setDraft(null);
      setGuides([]);
      return;
    }
    if (draft && (draft.type === 'rect' || draft.type === 'ellipse')) {
      const { start, current } = draft;
      const w = Math.abs(current.x - start.x);
      const h = Math.abs(current.y - start.y);
      if (w > MIN_SHAPE_SIZE && h > MIN_SHAPE_SIZE) {
        const built = buildShapeFromDraft(draft, makeBaseRef.current(shapes.length));
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
    // Vertex deletion is Alt+click, handled in onMouseDown.
    if (mode === 'edit' && tool === 'select') {
      const dataId = e.target.dataset?.shapeId;
      if (!dataId) return;
      const sh = shapes.find((s) => s.id === dataId);
      if (!sh || sh.locked) return;
      if (sh.type !== 'polygon' && sh.type !== 'polyline') return;
      // If the user happened to double-click on a vertex dot, ignore — they
      // probably meant Alt+click. Doing nothing is safer than guessing.
      if (e.target.dataset?.vertex !== undefined) return;
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
  // Adding a vertex changes the edge indexing — straighten to keep curves valid.
  return { ...shape, points: next, curves: undefined };
}

function projectOnSegment(p, a, b) {
  const ax = a[0], ay = a[1], bx = b[0], by = b[1];
  const vx = bx - ax, vy = by - ay;
  const len2 = vx * vx + vy * vy;
  if (len2 === 0) return { x: ax, y: ay };
  const t = Math.max(0, Math.min(1, ((p.x - ax) * vx + (p.y - ay) * vy) / len2));
  return { x: ax + vx * t, y: ay + vy * t };
}
