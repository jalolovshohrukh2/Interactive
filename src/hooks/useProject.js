import { useState, useEffect, useCallback } from 'react';
import { loadProject, saveProject } from '../lib/storage.js';
import { idbGet, idbSet, idbDel } from '../lib/idb.js';
import { useShapeCollection } from './useShapeCollection.js';

const IMAGE_KEY = 'image';

// Owns the persisted project: the shared background image plus two independent
// shape collections —
//   - hotspots: interactive shapes exported as the SVG.
//   - pieces:   cut regions used by the Cut workspace to slice the image.
//
// The two collections never share state or history, which is what keeps the
// Hotspots and Cut workspaces from bleeding into each other. The flat
// hotspot API (shapes, addShape, …) is preserved for back-compat with the
// rest of the app; `hotspots` and `pieces` expose the full collection objects
// for the parts that need to pick one based on the active workspace.
export function useProject() {
  const [image, setImage] = useState(null);
  const [loaded, setLoaded] = useState(false);

  const hotspots = useShapeCollection([]);
  const pieces = useShapeCollection([]);

  const { setAll: setHotspots } = hotspots;
  const { setAll: setPieces } = pieces;

  useEffect(() => {
    let cancelled = false;
    const data = loadProject();
    if (Array.isArray(data?.shapes)) setHotspots(data.shapes);
    if (Array.isArray(data?.pieces)) setPieces(data.pieces);
    // Image lives in IndexedDB now. Migrate any legacy inline image and then
    // mark loaded (so the save effects don't fire before we've restored).
    (async () => {
      let img = await idbGet(IMAGE_KEY);
      if (!img && data?.image) { img = data.image; idbSet(IMAGE_KEY, img); }
      if (cancelled) return;
      if (img) setImage(img);
      setLoaded(true);
    })();
    return () => { cancelled = true; };
  }, [setHotspots, setPieces]);

  // Shapes + pieces are small → localStorage. (History is in-memory only.)
  useEffect(() => {
    if (!loaded) return;
    saveProject({ shapes: hotspots.shapes, pieces: pieces.shapes });
  }, [hotspots.shapes, pieces.shapes, loaded]);

  // The image can be several MB → IndexedDB, written only when it changes so
  // shape edits don't rewrite it.
  useEffect(() => {
    if (!loaded) return;
    if (image) idbSet(IMAGE_KEY, image);
    else idbDel(IMAGE_KEY);
  }, [image, loaded]);

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

  // For SVG import — drop in an image without going through FileReader.
  const setImageRaw = useCallback((img) => setImage(img), []);

  const clear = useCallback(() => {
    setImage(null);
    hotspots.reset();
    pieces.reset();
  }, [hotspots, pieces]);

  // Remove just the background image (shapes/pieces are kept, so a replacement
  // image drops them right back into place).
  const deleteImage = useCallback(() => setImage(null), []);

  // Replace the whole project at once (used when pulling from the cloud).
  // Seeds both collections without an undo entry — a fresh load, not an edit.
  const loadSnapshot = useCallback((snap) => {
    setImage(snap?.image ?? null);
    hotspots.setAll(snap?.shapes ?? []);
    pieces.setAll(snap?.pieces ?? []);
  }, [hotspots, pieces]);

  return {
    image,
    uploadImage,
    setImageRaw,
    clear,
    deleteImage,
    loadSnapshot,

    // Back-compat flat hotspot API (used throughout App / Sidebar).
    shapes: hotspots.shapes,
    addShape: hotspots.addShape,
    commitMany: hotspots.commitMany,
    deleteMany: hotspots.deleteMany,
    updateShape: hotspots.updateShape,
    deleteShape: hotspots.deleteShape,
    reorderShape: hotspots.reorderShape,
    moveShape: hotspots.moveShape,
    setShapesLive: hotspots.setShapesLive,
    pushHistory: hotspots.pushHistory,
    undo: hotspots.undo,
    canUndo: hotspots.canUndo,
    replaceShapes: hotspots.replaceShapes,

    // Full collection objects, for workspace-aware wiring.
    hotspots,
    pieces,
  };
}
