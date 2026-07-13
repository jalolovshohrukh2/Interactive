import { useState, useEffect, useCallback, useRef } from 'react';
import { loadProject, saveProject } from '../lib/storage.js';
import { idbGet, idbSet, idbDel } from '../lib/idb.js';
import { useShapeCollection } from './useShapeCollection.js';

const IMAGE_KEY = 'image';

// Owns the persisted project: the shared background image plus three
// independent shape collections —
//   - hotspots: interactive shapes exported as the SVG.
//   - pieces:   cut regions used by the Cut workspace to slice the image.
//   - blurs:    focus regions used by the Blur workspace (everything outside
//               them is blurred on export).
//
// The collections never share state or history, which is what keeps the
// workspaces from bleeding into each other. The flat hotspot API (shapes,
// addShape, …) is preserved for back-compat with the rest of the app;
// `hotspots`, `pieces`, and `blurs` expose the full collection objects for the
// parts that need to pick one based on the active workspace.
export function useProject() {
  const [image, setImage] = useState(null);
  const [loaded, setLoaded] = useState(false);

  // Stash the last-deleted image so it can be brought back with undo. Kept as a
  // ref-mirrored state: state so the UI can enable the Undo affordance, ref so
  // the delete/restore callbacks stay stable and read the latest value.
  const imageRef = useRef(image);
  imageRef.current = image;
  const [deletedImage, setDeletedImage] = useState(null);
  const deletedImageRef = useRef(null);
  deletedImageRef.current = deletedImage;
  // True right after an undoable image op (delete / bake-in / reframe). Cleared
  // as soon as any shape collection is edited, so Ctrl+Z then targets the shape
  // edit rather than reverting the image out from under later work.
  const [imageUndoable, setImageUndoable] = useState(false);
  // For ops that shift shapes too (reframe): the pre-op shape arrays to restore
  // on undo, and the post-op arrays the op itself set (so the "spend on edit"
  // effect can tell its own change apart from a real user edit).
  const stashedShapesRef = useRef(null);
  const opShapesRef = useRef(null);

  const hotspots = useShapeCollection([]);
  const pieces = useShapeCollection([]);
  const blurs = useShapeCollection([]);

  const { setAll: setHotspots } = hotspots;
  const { setAll: setPieces } = pieces;
  const { setAll: setBlurs } = blurs;

  useEffect(() => {
    let cancelled = false;
    const data = loadProject();
    if (Array.isArray(data?.shapes)) setHotspots(data.shapes);
    if (Array.isArray(data?.pieces)) setPieces(data.pieces);
    if (Array.isArray(data?.blurs)) setBlurs(data.blurs);
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
  }, [setHotspots, setPieces, setBlurs]);

  // Shapes + pieces + blurs are small → localStorage. (History is in-memory only.)
  useEffect(() => {
    if (!loaded) return;
    saveProject({ shapes: hotspots.shapes, pieces: pieces.shapes, blurs: blurs.shapes });
  }, [hotspots.shapes, pieces.shapes, blurs.shapes, loaded]);

  // The image can be several MB → IndexedDB, written only when it changes so
  // shape edits don't rewrite it.
  useEffect(() => {
    if (!loaded) return;
    if (image) idbSet(IMAGE_KEY, image);
    else idbDel(IMAGE_KEY);
  }, [image, loaded]);

  // Any shape edit spends the one-shot image-undo. After this, Ctrl+Z goes to
  // the shape history, not back to the pre-delete / pre-bake image. A reframe
  // sets shapes itself; that run is recognised by reference and left alone.
  useEffect(() => {
    const op = opShapesRef.current;
    if (op && hotspots.shapes === op.hotspots && pieces.shapes === op.pieces && blurs.shapes === op.blurs) return;
    setImageUndoable(false);
  }, [hotspots.shapes, pieces.shapes, blurs.shapes]);

  const uploadImage = useCallback((file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const url = ev.target.result;
        const img = new Image();
        img.onload = () => {
          const next = { url, width: img.naturalWidth, height: img.naturalHeight };
          setImage(next);
          setDeletedImage(null);
          stashedShapesRef.current = null;
          opShapesRef.current = null;
          setImageUndoable(false);
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
  const setImageRaw = useCallback((img) => {
    setImage(img);
    setDeletedImage(null);
    stashedShapesRef.current = null;
    opShapesRef.current = null;
    setImageUndoable(false);
  }, []);

  const clear = useCallback(() => {
    setImage(null);
    setDeletedImage(null); // Reset is intentional — don't let undo resurrect it.
    stashedShapesRef.current = null;
    opShapesRef.current = null;
    setImageUndoable(false);
    hotspots.reset();
    pieces.reset();
    blurs.reset();
  }, [hotspots, pieces, blurs]);

  // Remove just the background image (shapes/pieces are kept, so a replacement
  // image drops them right back into place). Stash it first so an accidental
  // delete can be undone with Ctrl+Z (see restoreImage).
  const deleteImage = useCallback(() => {
    if (imageRef.current) setDeletedImage(imageRef.current);
    stashedShapesRef.current = null;
    opShapesRef.current = null;
    setImage(null);
    setImageUndoable(true);
  }, []);

  // Replace the working image with a new one (e.g. the Blur workspace baking its
  // result in), stashing the previous image so Ctrl+Z reverts it — until the
  // next shape edit spends the undo.
  const applyImage = useCallback((next) => {
    if (imageRef.current) setDeletedImage(imageRef.current);
    stashedShapesRef.current = null;
    opShapesRef.current = null;
    setImage(next);
    setImageUndoable(true);
  }, []);

  // Reframe: swap in a new image AND replace every shape collection at once (the
  // shapes shifted to line up with the new framing), as ONE undoable action.
  const frameImage = useCallback((next, after) => {
    if (imageRef.current) setDeletedImage(imageRef.current);
    stashedShapesRef.current = {
      hotspots: hotspots.shapes, pieces: pieces.shapes, blurs: blurs.shapes,
    };
    opShapesRef.current = after;
    setImage(next);
    hotspots.setShapesLive(() => after.hotspots);
    pieces.setShapesLive(() => after.pieces);
    blurs.setShapesLive(() => after.blurs);
    setImageUndoable(true);
  }, [hotspots, pieces, blurs]);

  // Bring back the stashed image (undo a delete / bake / reframe). For a reframe
  // it also restores the pre-op shapes. The app routes Ctrl+Z here while the
  // image op is still the freshest undoable action.
  const restoreImage = useCallback(() => {
    if (deletedImageRef.current) setImage(deletedImageRef.current);
    const prev = stashedShapesRef.current;
    if (prev) {
      hotspots.setShapesLive(() => prev.hotspots);
      pieces.setShapesLive(() => prev.pieces);
      blurs.setShapesLive(() => prev.blurs);
    }
    stashedShapesRef.current = null;
    opShapesRef.current = null;
    setDeletedImage(null);
    setImageUndoable(false);
  }, [hotspots, pieces, blurs]);

  // Replace the whole project at once (used when pulling from the cloud).
  // Seeds both collections without an undo entry — a fresh load, not an edit.
  const loadSnapshot = useCallback((snap) => {
    setImage(snap?.image ?? null);
    setDeletedImage(null); // Fresh load — the previous delete stash is moot.
    stashedShapesRef.current = null;
    opShapesRef.current = null;
    setImageUndoable(false);
    hotspots.setAll(snap?.shapes ?? []);
    pieces.setAll(snap?.pieces ?? []);
    blurs.setAll(snap?.blurs ?? []);
  }, [hotspots, pieces, blurs]);

  return {
    image,
    uploadImage,
    setImageRaw,
    clear,
    deleteImage,
    applyImage,
    frameImage,
    restoreImage,
    canRestoreImage: imageUndoable && !!deletedImage,
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
    blurs,
  };
}
