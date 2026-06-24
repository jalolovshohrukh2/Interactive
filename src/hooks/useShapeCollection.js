import { useState, useCallback, useRef } from 'react';

const MAX_HISTORY = 50;

// A self-contained array of shapes with its own in-memory undo stack.
//
// useProject instantiates this twice — once for interactive hotspot shapes,
// once for cut pieces — so the two workspaces never share state, selection,
// or history. The mutation API mirrors what the old useProject exposed, so
// the drawing hook can drive either collection without knowing which it is.
//
// Two flavors of mutation, same as before:
//   - addShape / deleteShape / etc.: snapshot into history, then apply.
//   - setShapesLive: apply WITHOUT recording history (mid-gesture). The
//     drawing hook calls pushHistory(snapshot) once when the gesture commits.
export function useShapeCollection(initial = []) {
  const [shapes, setShapes] = useState(initial);
  const [past, setPast] = useState([]);

  // Always-current ref so commit() can snapshot without re-creating on every change.
  const shapesRef = useRef(shapes);
  shapesRef.current = shapes;

  const pushHistory = useCallback((snapshot) => {
    setPast((p) => {
      const next = [...p, snapshot];
      return next.length > MAX_HISTORY ? next.slice(-MAX_HISTORY) : next;
    });
  }, []);

  const commit = useCallback(
    (updater) => {
      pushHistory(shapesRef.current);
      setShapes(updater);
    },
    [pushHistory]
  );

  const undo = useCallback(() => {
    setPast((p) => {
      if (!p.length) return p;
      const last = p[p.length - 1];
      setShapes(last);
      return p.slice(0, -1);
    });
  }, []);

  const addShape = useCallback((s) => commit((arr) => [...arr, s]), [commit]);

  const commitMany = useCallback((added) => commit((arr) => [...arr, ...added]), [commit]);

  const deleteMany = useCallback(
    (ids) => {
      const idSet = new Set(ids);
      commit((arr) => arr.filter((s) => !idSet.has(s.id)));
    },
    [commit]
  );

  // Property edits skip history (a per-keystroke stack would be noisy).
  const updateShape = useCallback(
    (id, patch) => setShapes((arr) => arr.map((s) => (s.id === id ? { ...s, ...patch } : s))),
    []
  );

  const deleteShape = useCallback((id) => commit((arr) => arr.filter((s) => s.id !== id)), [commit]);

  // Move a shape to an explicit index — used by sidebar drag-and-drop.
  const moveShape = useCallback(
    (id, toIndex) =>
      commit((arr) => {
        const from = arr.findIndex((s) => s.id === id);
        if (from < 0) return arr;
        const next = [...arr];
        const [item] = next.splice(from, 1);
        const insertAt = Math.max(0, Math.min(next.length, toIndex));
        if (insertAt === from) return arr;
        next.splice(insertAt, 0, item);
        return next;
      }),
    [commit]
  );

  // Z-order. Array index = render order (later = on top).
  const reorderShape = useCallback(
    (id, action) =>
      commit((arr) => {
        const idx = arr.findIndex((s) => s.id === id);
        if (idx < 0) return arr;
        const s = arr[idx];
        const rest = [...arr.slice(0, idx), ...arr.slice(idx + 1)];
        if (action === 'front') return [...rest, s];
        if (action === 'back') return [s, ...rest];
        if (action === 'forward') {
          if (idx >= arr.length - 1) return arr;
          rest.splice(idx + 1, 0, s);
          return rest;
        }
        if (action === 'backward') {
          if (idx <= 0) return arr;
          rest.splice(idx - 1, 0, s);
          return rest;
        }
        return arr;
      }),
    [commit]
  );

  const setShapesLive = useCallback((updater) => setShapes(updater), []);

  // Replace everything as a single undo entry (SVG import).
  const replaceShapes = useCallback((next) => commit(next), [commit]);

  // Hard reset — drop shapes and wipe history (project load / clear).
  const reset = useCallback(() => {
    setShapes([]);
    setPast([]);
  }, []);

  // Seed from storage without creating an undo entry.
  const setAll = useCallback((arr) => {
    setShapes(Array.isArray(arr) ? arr : []);
    setPast([]);
  }, []);

  return {
    shapes,
    addShape,
    commitMany,
    deleteMany,
    updateShape,
    deleteShape,
    reorderShape,
    moveShape,
    setShapesLive,
    pushHistory,
    undo,
    canUndo: past.length > 0,
    replaceShapes,
    reset,
    setAll,
  };
}
