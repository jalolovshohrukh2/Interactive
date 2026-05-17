import { useState, useEffect, useCallback, useRef } from 'react';
import { loadProject, saveProject } from '../lib/storage.js';

const MAX_HISTORY = 50;

// Owns the persisted project (image + shapes) and the in-memory undo stack.
//
// Two flavors of mutation:
//   - addShape / deleteShape: snapshot the prev shapes into history, then apply.
//   - setShapesLive: apply WITHOUT recording history. Used for mid-gesture
//     mutations (drag-move, resize, vertex drag). The drawing hook calls
//     pushHistory(snapshot) once when the gesture commits, so the whole
//     gesture undoes as one step instead of one entry per mousemove.
//
// Property edits via the sidebar use updateShape; they don't push history
// (a per-keystroke stack would be noisy). We can revisit if needed.
export function useProject() {
  const [image, setImage] = useState(null);
  const [shapes, setShapes] = useState([]);
  const [past, setPast] = useState([]);
  const [loaded, setLoaded] = useState(false);

  // Always-current ref so commit() can snapshot without re-creating on every shapes change.
  const shapesRef = useRef(shapes);
  shapesRef.current = shapes;

  useEffect(() => {
    const data = loadProject();
    if (data?.image) setImage(data.image);
    if (Array.isArray(data?.shapes)) setShapes(data.shapes);
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    // History is in-memory only.
    saveProject({ image, shapes });
  }, [image, shapes, loaded]);

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

  const uploadImage = useCallback((file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const url = ev.target.result;
        const img = new Image();
        img.onload = () => {
          const next = { url, width: img.naturalWidth, height: img.naturalHeight };
          setImage(next);
          resolve(next);
        };
        img.onerror = reject;
        img.src = url;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }, []);

  const addShape = useCallback((s) => commit((arr) => [...arr, s]), [commit]);

  // Bulk append / delete — one history entry covers the whole batch.
  const commitMany = useCallback((added) => commit((arr) => [...arr, ...added]), [commit]);
  const deleteMany = useCallback(
    (ids) => {
      const idSet = new Set(ids);
      commit((arr) => arr.filter((s) => !idSet.has(s.id)));
    },
    [commit]
  );

  // Property edits skip history (see comment above).
  const updateShape = useCallback(
    (id, patch) => setShapes((arr) => arr.map((s) => (s.id === id ? { ...s, ...patch } : s))),
    []
  );

  const deleteShape = useCallback((id) => commit((arr) => arr.filter((s) => s.id !== id)), [commit]);

  // Z-order. Array index = render order (later = on top). `action` is one of
  // 'front', 'back', 'forward', 'backward'.
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

  const clear = useCallback(() => {
    setImage(null);
    setShapes([]);
    setPast([]);
  }, []);

  // For SVG import — drop in an image without going through FileReader.
  const setImageRaw = useCallback((img) => setImage(img), []);

  // For SVG import — replace the entire shapes array as a single undo entry.
  const replaceShapes = useCallback((next) => commit(next), [commit]);

  return {
    image,
    shapes,
    uploadImage,
    setImageRaw,
    replaceShapes,
    addShape,
    commitMany,
    deleteMany,
    updateShape,
    deleteShape,
    reorderShape,
    setShapesLive,
    pushHistory,
    undo,
    canUndo: past.length > 0,
    clear,
  };
}
