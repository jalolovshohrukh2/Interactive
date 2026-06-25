import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useProject } from './hooks/useProject.js';
import { useDrawing } from './hooks/useDrawing.js';
import { useKeyboard } from './hooks/useKeyboard.js';
import { useViewport } from './hooks/useViewport.js';
import { useCloudSync } from './hooks/useCloudSync.js';
import { exportSvg } from './lib/exportSvg.js';
import { importSvg } from './lib/importSvg.js';
import { cloneShape, makeCutPiece, makeBlurRegion, newId } from './lib/shapes.js';
import { downloadPiecesAsFiles, downloadPiecesAsZip } from './lib/cropPieces.js';
import { downloadBlurredImage, downloadBlurredImagePerRegion } from './lib/blurExport.js';
import * as cloud from './lib/cloud.js';
import {
  TOOLS, CUT_TOOLS, BLUR_TOOLS,
  TOOL_SHORTCUTS, CUT_TOOL_SHORTCUTS, BLUR_TOOL_SHORTCUTS,
  DEFAULT_PIECE_PREFIX, DEFAULT_FOCUS_PREFIX, DEFAULT_BLUR_AMOUNT,
  DEFAULT_BLUR_STROKE_COLOR, DEFAULT_BLUR_STROKE_WIDTH,
  DEFAULT_BLUR_OUTSIDE, DEFAULT_BLUR_FILL_COLOR,
} from './constants.js';

import { Trash2 } from 'lucide-react';
import Header from './components/Header.jsx';
import Toolbar from './components/Toolbar.jsx';
import StatusBar from './components/StatusBar.jsx';
import ShortcutsOverlay from './components/ShortcutsOverlay.jsx';
import CloudPanel from './components/CloudPanel.jsx';
import Canvas from './components/canvas/Canvas.jsx';
import EmptyCanvas from './components/canvas/EmptyCanvas.jsx';
import Sidebar from './components/sidebar/Sidebar.jsx';
import CutSidebar from './components/sidebar/CutSidebar.jsx';
import BlurSidebar from './components/sidebar/BlurSidebar.jsx';

// Tiny placeholder for SVG import when the user has no background image yet.
const blankImage = (w, h) => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}"><rect width="${w}" height="${h}" fill="#1a1a1d"/></svg>`;
  return { url: 'data:image/svg+xml;utf8,' + encodeURIComponent(svg), width: w, height: h };
};

const readLS = (key, fallback) => {
  try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; }
};

export default function App() {
  const project = useProject();
  const viewport = useViewport({ image: project.image });

  // Whether the background image itself is selected (click it with the Select
  // tool). When selected it can be deleted via Delete or the floating button.
  const [imageSelected, setImageSelected] = useState(false);
  const selectBackground = useCallback((v) => setImageSelected(v), []);

  // Top-level workspace: 'hotspots' (the interactive-SVG editor), 'cut' (slice
  // the image into pieces), or 'blur' (blur everything except focus regions).
  // Each has its own toolset, sidebar, and shape collection so they never mix.
  const [workspace, setWorkspaceState] = useState(() => {
    const v = readLS('interactive-image:workspace', 'hotspots');
    return v === 'cut' || v === 'blur' ? v : 'hotspots';
  });
  const setWorkspace = useCallback((w) => {
    setWorkspaceState(w);
    try { localStorage.setItem('interactive-image:workspace', w); } catch {}
  }, []);

  // Cut-workspace settings.
  const [piecePrefix, setPiecePrefixState] = useState(() => readLS('interactive-image:piecePrefix', DEFAULT_PIECE_PREFIX));
  const setPiecePrefix = useCallback((v) => {
    setPiecePrefixState(v);
    try { localStorage.setItem('interactive-image:piecePrefix', v); } catch {}
  }, []);
  const [pieceMask, setPieceMaskState] = useState(() => readLS('interactive-image:pieceMask', 'true') !== 'false');
  const setPieceMask = useCallback((v) => {
    setPieceMaskState(v);
    try { localStorage.setItem('interactive-image:pieceMask', v ? 'true' : 'false'); } catch {}
  }, []);
  const [piecePadding, setPiecePaddingState] = useState(() => Number(readLS('interactive-image:piecePadding', '0')) || 0);
  const setPiecePadding = useCallback((v) => {
    const n = Math.max(0, Math.min(500, Number(v) || 0));
    setPiecePaddingState(n);
    try { localStorage.setItem('interactive-image:piecePadding', String(n)); } catch {}
  }, []);
  const [pieceScale, setPieceScaleState] = useState(() => Number(readLS('interactive-image:pieceScale', '1')) || 1);
  const setPieceScale = useCallback((v) => {
    setPieceScaleState(v);
    try { localStorage.setItem('interactive-image:pieceScale', String(v)); } catch {}
  }, []);
  const [pieceFormat, setPieceFormatState] = useState(() => (readLS('interactive-image:pieceFormat', 'png') === 'jpeg' ? 'jpeg' : 'png'));
  const setPieceFormat = useCallback((v) => {
    setPieceFormatState(v);
    try { localStorage.setItem('interactive-image:pieceFormat', v); } catch {}
  }, []);

  // Blur-workspace settings.
  const [blurAmount, setBlurAmountState] = useState(() => {
    const v = Number(readLS('interactive-image:blurAmount', String(DEFAULT_BLUR_AMOUNT)));
    return Number.isFinite(v) && v >= 0 && v <= 50 ? v : DEFAULT_BLUR_AMOUNT;
  });
  const setBlurAmount = useCallback((v) => {
    const n = Math.max(0, Math.min(50, Number(v) || 0));
    setBlurAmountState(n);
    try { localStorage.setItem('interactive-image:blurAmount', String(n)); } catch {}
  }, []);
  const [blurScale, setBlurScaleState] = useState(() => Number(readLS('interactive-image:blurScale', '1')) || 1);
  const setBlurScale = useCallback((v) => {
    setBlurScaleState(v);
    try { localStorage.setItem('interactive-image:blurScale', String(v)); } catch {}
  }, []);
  const [blurFormat, setBlurFormatState] = useState(() => (readLS('interactive-image:blurFormat', 'png') === 'jpeg' ? 'jpeg' : 'png'));
  const setBlurFormat = useCallback((v) => {
    setBlurFormatState(v);
    try { localStorage.setItem('interactive-image:blurFormat', v); } catch {}
  }, []);
  const [focusPrefix, setFocusPrefixState] = useState(() => readLS('interactive-image:focusPrefix', DEFAULT_FOCUS_PREFIX));
  const setFocusPrefix = useCallback((v) => {
    setFocusPrefixState(v);
    try { localStorage.setItem('interactive-image:focusPrefix', v); } catch {}
  }, []);
  // Optional colored outline drawn around each sharp focus region (px in image
  // space, 0 = off) and its color.
  const [blurStroke, setBlurStrokeState] = useState(() => {
    const v = Number(readLS('interactive-image:blurStroke', String(DEFAULT_BLUR_STROKE_WIDTH)));
    return Number.isFinite(v) && v >= 0 && v <= 40 ? v : DEFAULT_BLUR_STROKE_WIDTH;
  });
  const setBlurStroke = useCallback((v) => {
    const n = Math.max(0, Math.min(40, Number(v) || 0));
    setBlurStrokeState(n);
    try { localStorage.setItem('interactive-image:blurStroke', String(n)); } catch {}
  }, []);
  const [blurStrokeColor, setBlurStrokeColorState] = useState(() => readLS('interactive-image:blurStrokeColor', DEFAULT_BLUR_STROKE_COLOR));
  const setBlurStrokeColor = useCallback((v) => {
    setBlurStrokeColorState(v);
    try { localStorage.setItem('interactive-image:blurStrokeColor', v); } catch {}
  }, []);
  // How to treat everything OUTSIDE the focus regions: 'blur', 'color', or
  // 'transparent'. With 'color', everything outside the kept area is painted a
  // solid color (white/black/anything).
  const [blurOutside, setBlurOutsideState] = useState(() => {
    const v = readLS('interactive-image:blurOutside', DEFAULT_BLUR_OUTSIDE);
    return v === 'color' || v === 'transparent' ? v : 'blur';
  });
  const setBlurOutside = useCallback((v) => {
    setBlurOutsideState(v);
    try { localStorage.setItem('interactive-image:blurOutside', v); } catch {}
  }, []);
  const [blurFillColor, setBlurFillColorState] = useState(() => readLS('interactive-image:blurFillColor', DEFAULT_BLUR_FILL_COLOR));
  const setBlurFillColor = useCallback((v) => {
    setBlurFillColorState(v);
    try { localStorage.setItem('interactive-image:blurFillColor', v); } catch {}
  }, []);

  // One drawing engine per workspace, each bound to its own collection.
  const hotspotDrawing = useDrawing({
    image: project.image,
    shapes: project.shapes,
    addShape: project.addShape,
    setShapesLive: project.setShapesLive,
    pushHistory: project.pushHistory,
    viewport,
    onBackgroundSelect: selectBackground,
  });
  const cutDrawing = useDrawing({
    image: project.image,
    shapes: project.pieces.shapes,
    addShape: project.pieces.addShape,
    setShapesLive: project.pieces.setShapesLive,
    pushHistory: project.pieces.pushHistory,
    viewport,
    makeBase: (count) => makeCutPiece(count, (piecePrefix || DEFAULT_PIECE_PREFIX).trim() || DEFAULT_PIECE_PREFIX),
    onBackgroundSelect: selectBackground,
  });
  const blurDrawing = useDrawing({
    image: project.image,
    shapes: project.blurs.shapes,
    addShape: project.blurs.addShape,
    setShapesLive: project.blurs.setShapesLive,
    pushHistory: project.blurs.pushHistory,
    viewport,
    makeBase: (count) => makeBlurRegion(count, (focusPrefix || DEFAULT_FOCUS_PREFIX).trim() || DEFAULT_FOCUS_PREFIX),
    onBackgroundSelect: selectBackground,
  });

  const isHotspots = workspace === 'hotspots';
  const isCut = workspace === 'cut';
  const isBlur = workspace === 'blur';
  const drawing = isCut ? cutDrawing : isBlur ? blurDrawing : hotspotDrawing;
  const activeColl = isCut ? project.pieces : isBlur ? project.blurs : project.hotspots;
  const activeShapes = activeColl.shapes;

  // Clipboard: tagged with the workspace it was copied from so a hotspot
  // never pastes into the Cut workspace (or vice-versa).
  const clipboardRef = useRef({ workspace: null, shapes: [] });

  const handleCopy = useCallback(() => {
    const ids = new Set(drawing.selectedIds);
    if (ids.size === 0) return;
    clipboardRef.current = {
      workspace,
      shapes: activeShapes.filter((s) => ids.has(s.id)),
    };
  }, [activeShapes, drawing.selectedIds, workspace]);

  const handlePaste = useCallback(() => {
    const clip = clipboardRef.current;
    if (clip.workspace !== workspace || !clip.shapes.length) return;
    const copies = clip.shapes.map((s) => cloneShape(s));
    activeColl.commitMany(copies);
    drawing.setSelectedIds(copies.map((c) => c.id));
  }, [activeColl, drawing, workspace]);

  const handleDuplicate = useCallback(() => {
    const ids = new Set(drawing.selectedIds);
    if (ids.size === 0) return;
    const copies = activeShapes.filter((s) => ids.has(s.id)).map((s) => cloneShape(s));
    if (!copies.length) return;
    activeColl.commitMany(copies);
    drawing.setSelectedIds(copies.map((c) => c.id));
  }, [activeColl, activeShapes, drawing]);

  const handleDeleteImage = useCallback(() => {
    project.deleteImage();
    setImageSelected(false);
    hotspotDrawing.clearSelection();
    cutDrawing.clearSelection();
    blurDrawing.clearSelection();
  }, [project, hotspotDrawing, cutDrawing, blurDrawing]);

  const handleDeleteSelected = useCallback(() => {
    if (imageSelected) { handleDeleteImage(); return; }
    const ids = drawing.selectedIds;
    if (!ids.length) return;
    activeColl.deleteMany(ids);
    drawing.clearSelection();
  }, [imageSelected, handleDeleteImage, activeColl, drawing]);

  // Selecting any shape deselects the background image.
  useEffect(() => {
    if (drawing.selectedIds.length > 0) setImageSelected(false);
  }, [drawing.selectedIds]);

  const handleUndo = useCallback(() => {
    if (!drawing.popDraftPoint()) activeColl.undo();
  }, [drawing, activeColl]);

  // Single-row click in the sidebar: replace selection.
  // Shift+click in the sidebar: toggle the row in/out of the selection.
  const handleSidebarSelect = useCallback(
    (id, opts = {}) => {
      if (opts.shift) drawing.toggleInSelection(id);
      else drawing.selectOne(id);
    },
    [drawing]
  );

  // ---- Cloud sync (single active project) ----
  const [cloudOpen, setCloudOpen] = useState(false);
  const [cloudEnabled, setCloudEnabled] = useState(() => cloud.isEnabled());
  const [projectId, setProjectId] = useState(() => {
    try {
      let v = localStorage.getItem('interactive-image:projectId');
      if (!v) { v = newId(); localStorage.setItem('interactive-image:projectId', v); }
      return v;
    } catch { return newId(); }
  });
  const [projectName, setProjectNameState] = useState(() => {
    try { return localStorage.getItem('interactive-image:projectName') || 'Untitled'; } catch { return 'Untitled'; }
  });
  const setProjectName = useCallback((n) => {
    setProjectNameState(n);
    try { localStorage.setItem('interactive-image:projectName', n); } catch {}
  }, []);
  const persistProjectId = useCallback((id) => {
    setProjectId(id);
    try { localStorage.setItem('interactive-image:projectId', id); } catch {}
  }, []);

  // Stable snapshot for the sync hook — depends on the inner fields, not the
  // per-render project wrapper, so the auto-sync effect only fires on real edits.
  const cloudProject = useMemo(
    () => ({ id: projectId, name: projectName, image: project.image, shapes: project.shapes, pieces: project.pieces }),
    [projectId, projectName, project.image, project.shapes, project.pieces]
  );

  const applyRemote = useCallback((remote) => {
    persistProjectId(remote.id);
    setProjectName(remote.name || 'Untitled');
    project.loadSnapshot({ image: remote.image, shapes: remote.shapes, pieces: remote.pieces, blurs: remote.blurs });
    hotspotDrawing.clearSelection(); hotspotDrawing.cancelDraft();
    cutDrawing.clearSelection(); cutDrawing.cancelDraft();
    blurDrawing.clearSelection(); blurDrawing.cancelDraft();
  }, [persistProjectId, setProjectName, project, hotspotDrawing, cutDrawing, blurDrawing]);

  const sync = useCloudSync({ enabled: cloudEnabled, project: cloudProject, onApplyRemote: applyRemote });

  const handleConnect = useCallback(async (token) => {
    const r = await sync.connect(token);
    if (r.ok) setCloudEnabled(true);
    return r;
  }, [sync]);
  const handleDisconnect = useCallback(() => { sync.disconnect(); setCloudEnabled(false); }, [sync]);
  const handleNewProject = useCallback(() => {
    if (!confirm('Start a new empty project? Your current one stays saved in the cloud.')) return;
    persistProjectId(newId());
    setProjectName('Untitled');
    project.clear();
    hotspotDrawing.clearSelection(); hotspotDrawing.cancelDraft();
    cutDrawing.clearSelection(); cutDrawing.cancelDraft();
    blurDrawing.clearSelection(); blurDrawing.cancelDraft();
    setCloudOpen(false);
  }, [persistProjectId, setProjectName, project, hotspotDrawing, cutDrawing, blurDrawing]);

  useKeyboard({
    draft: drawing.draft,
    hasSelection: drawing.selectedIds.length > 0 || imageSelected,
    deleteSelected: handleDeleteSelected,
    cancelDraft: () => { drawing.cancelDraft(); drawing.clearSelection(); setImageSelected(false); },
    switchTool: drawing.switchTool,
    finishPolyDraft: drawing.finishPolyDraft,
    onUndo: handleUndo,
    onCopy: handleCopy,
    onDuplicate: handleDuplicate,
    onNudge: drawing.nudgeSelected,
    onZoomIn: viewport.zoomIn,
    onZoomOut: viewport.zoomOut,
    onResetZoom: viewport.resetView,
    onShowShortcuts: () => setShortcutsOpen(true),
    toolShortcuts: isCut ? CUT_TOOL_SHORTCUTS : isBlur ? BLUR_TOOL_SHORTCUTS : TOOL_SHORTCUTS,
  });

  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [sidebarTab, setSidebarTab] = useState('shapes');
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    try {
      const v = Number(localStorage.getItem('interactive-image:sidebarWidth'));
      return Number.isFinite(v) && v >= 240 && v <= 800 ? v : 320;
    } catch { return 320; }
  });
  const updateSidebarWidth = useCallback((w) => {
    setSidebarWidth(w);
    try { localStorage.setItem('interactive-image:sidebarWidth', String(w)); } catch {}
  }, []);
  // Selection-glow intensity (0..1). Purely editor-side; not exported.
  // Persisted to its own localStorage key so it survives reloads.
  const [glow, setGlow] = useState(() => {
    try {
      const v = Number(localStorage.getItem('interactive-image:glow'));
      return Number.isFinite(v) && v >= 0 && v <= 1 ? v : 0.4;
    } catch { return 0.4; }
  });
  const updateGlow = useCallback((v) => {
    setGlow(v);
    try { localStorage.setItem('interactive-image:glow', String(v)); } catch {}
  }, []);

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (file) await project.uploadImage(file);
    e.target.value = '';
  };

  // Shared by file-upload import AND clipboard-paste import. Hotspot-only.
  // Shows a confirm() dialog when there's already work on the canvas, so the
  // user doesn't accidentally wipe it out from a stray paste.
  const importSvgText = useCallback((text) => {
    try {
      const parsed = importSvg(text);
      const replace = project.shapes.length > 0
        ? confirm(
            `This SVG contains ${parsed.shapes.length} shape(s). Replace your current ${project.shapes.length}?`
          )
        : true;
      if (!replace) return;
      if (!project.image) {
        project.setImageRaw(blankImage(parsed.width, parsed.height));
      }
      project.replaceShapes(parsed.shapes);
      hotspotDrawing.clearSelection();
    } catch (err) {
      alert('Could not parse SVG: ' + err.message);
    }
  }, [project, hotspotDrawing]);

  // Silent apply — used by the Code-panel textarea where the user is
  // actively editing markup. No confirm; if a typo blows away shapes the
  // user can Ctrl+Z. Throws on parse failure so CodePanel can flash its
  // status dot red.
  const applySvgText = useCallback((text) => {
    const parsed = importSvg(text);
    if (!project.image) {
      project.setImageRaw(blankImage(parsed.width, parsed.height));
    }
    project.replaceShapes(parsed.shapes);
    hotspotDrawing.clearSelection();
  }, [project, hotspotDrawing]);

  const handleImportSvg = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const text = await file.text();
    importSvgText(text);
  };

  // Listen for clipboard paste anywhere in the app. Two cases:
  //   1. Pasted text looks like SVG → import it as a new project (Hotspots only).
  //   2. Internal clipboard has shapes → paste-as-duplicate in the active workspace.
  // We listen on document so it works regardless of focus, but skip when the
  // user is typing into a form field (they want the input to handle paste).
  useEffect(() => {
    const looksLikeSvg = (t) => /^\s*<(?:\?xml|svg)/i.test(t);
    const onPaste = (e) => {
      const tag = e.target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      // 1. An image on the clipboard (screenshot, copied picture) → load it as
      //    the background. Highest priority.
      const items = e.clipboardData?.items;
      if (items) {
        for (const it of items) {
          if (it.kind === 'file' && it.type.startsWith('image/')) {
            const file = it.getAsFile();
            if (file) {
              e.preventDefault();
              project.uploadImage(file);
              setImageSelected(false);
              return;
            }
          }
        }
      }

      // 2. SVG markup as text → import as a project (Hotspots only).
      const text = e.clipboardData?.getData('text/plain') || '';
      if (isHotspots && text && looksLikeSvg(text)) {
        e.preventDefault();
        importSvgText(text);
        return;
      }

      // 3. Internal shape clipboard → paste-as-duplicate.
      if (clipboardRef.current.shapes.length > 0) {
        e.preventDefault();
        handlePaste();
      }
    };
    document.addEventListener('paste', onPaste);
    return () => document.removeEventListener('paste', onPaste);
  }, [importSvgText, handlePaste, isHotspots, project.uploadImage]);

  // Live SVG export — regenerates whenever shapes / image / glow change.
  // The Code tab in the sidebar mirrors this string in real time. Always the
  // hotspot collection; cut pieces never enter the SVG.
  const exportText = useMemo(() => {
    if (!project.image) return '';
    return exportSvg({
      width: project.image.width,
      height: project.image.height,
      shapes: project.shapes,
      glow,
    });
  }, [project.image, project.shapes, glow]);

  // The "Export SVG" header button just switches the sidebar to the Code tab.
  const handleExport = () => setSidebarTab('code');

  // ---- Reusable layouts (hotspots + pieces + blurs, without the image) ----
  const handleSaveLayout = useCallback(() => {
    const data = {
      version: 3,
      name: projectName,
      shapes: project.shapes,
      pieces: project.pieces.shapes,
      blurs: project.blurs.shapes,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = (projectName || 'layout').replace(/[^\w-]+/g, '_') + '.layout.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }, [project.shapes, project.pieces.shapes, project.blurs.shapes, projectName]);

  const handleLoadLayout = useCallback(async (file) => {
    try {
      const data = JSON.parse(await file.text());
      const shapes = Array.isArray(data.shapes) ? data.shapes : [];
      const pieces = Array.isArray(data.pieces) ? data.pieces : [];
      const blurs = Array.isArray(data.blurs) ? data.blurs : [];
      if (!shapes.length && !pieces.length && !blurs.length) { alert('That file has no layout in it.'); return; }
      const have = project.shapes.length + project.pieces.shapes.length + project.blurs.shapes.length;
      if (have > 0 && !confirm(
        `Replace your current ${project.shapes.length} hotspot(s), ${project.pieces.shapes.length} piece(s) and ${project.blurs.shapes.length} blur region(s) with this layout?`
      )) return;
      // Fresh ids so the loaded layout never collides with anything.
      project.hotspots.replaceShapes(shapes.map((s) => ({ ...s, id: newId() })));
      project.pieces.replaceShapes(pieces.map((s) => ({ ...s, id: newId() })));
      project.blurs.replaceShapes(blurs.map((s) => ({ ...s, id: newId() })));
      hotspotDrawing.clearSelection();
      cutDrawing.clearSelection();
      blurDrawing.clearSelection();
    } catch (err) {
      alert('Could not read layout file: ' + err.message);
    }
  }, [project, hotspotDrawing, cutDrawing, blurDrawing]);

  const handleClear = () => {
    if (!confirm('Clear image and all shapes? This cannot be undone.')) return;
    project.clear();
    hotspotDrawing.clearSelection();
    hotspotDrawing.cancelDraft();
    cutDrawing.clearSelection();
    cutDrawing.cancelDraft();
    blurDrawing.clearSelection();
    blurDrawing.cancelDraft();
  };

  // ---- Cut workspace handlers ----
  const handlePieceDelete = useCallback((id) => {
    project.pieces.deleteShape(id);
    cutDrawing.setSelectedIds(cutDrawing.selectedIds.filter((x) => x !== id));
  }, [project.pieces, cutDrawing]);

  const handlePieceSelectAll = useCallback(() => {
    cutDrawing.setSelectedIds(project.pieces.shapes.map((p) => p.id));
  }, [cutDrawing, project.pieces.shapes]);

  const handleClearPieces = useCallback(() => {
    if (!project.pieces.shapes.length) return;
    if (!confirm('Remove all pieces?')) return;
    project.pieces.replaceShapes([]);
    cutDrawing.clearSelection();
    cutDrawing.cancelDraft();
  }, [project.pieces, cutDrawing]);

  const handleExportPieces = useCallback(async (list, delivery) => {
    if (!project.image || !list.length) return;
    const { url, width, height } = project.image;
    const opts = { mask: pieceMask, padding: piecePadding, scale: pieceScale, format: pieceFormat };
    try {
      if (delivery === 'zip') {
        await downloadPiecesAsZip(url, list, width, height, { ...opts, zipName: 'pieces.zip' });
      } else {
        await downloadPiecesAsFiles(url, list, width, height, opts);
      }
    } catch (err) {
      alert('Could not export pieces: ' + err.message);
    }
  }, [project.image, pieceMask, piecePadding, pieceScale, pieceFormat]);

  // Auto-cut the whole image into a cols × rows grid of rectangular pieces.
  const handleGridSlice = useCallback((cols, rows) => {
    if (!project.image) return;
    const c = Math.max(1, Math.min(50, Math.round(cols)));
    const r = Math.max(1, Math.min(50, Math.round(rows)));
    if (project.pieces.shapes.length && !confirm(
      `Replace the current ${project.pieces.shapes.length} piece(s) with a ${c}×${r} grid?`
    )) return;
    const { width, height } = project.image;
    const prefix = (piecePrefix || DEFAULT_PIECE_PREFIX).trim() || DEFAULT_PIECE_PREFIX;
    const tiles = [];
    for (let ry = 0; ry < r; ry++) {
      for (let cx = 0; cx < c; cx++) {
        tiles.push({
          id: newId(), type: 'rect', role: 'cut',
          name: `${prefix}-r${ry + 1}c${cx + 1}`,
          x: (cx / c) * width, y: (ry / r) * height,
          width: width / c, height: height / r,
        });
      }
    }
    project.pieces.replaceShapes(tiles);
    cutDrawing.clearSelection();
  }, [project.image, project.pieces, piecePrefix, cutDrawing]);

  // ---- Blur workspace handlers ----
  const handleBlurDelete = useCallback((id) => {
    project.blurs.deleteShape(id);
    blurDrawing.setSelectedIds(blurDrawing.selectedIds.filter((x) => x !== id));
  }, [project.blurs, blurDrawing]);

  const handleBlurSelectAll = useCallback(() => {
    blurDrawing.setSelectedIds(project.blurs.shapes.map((b) => b.id));
  }, [blurDrawing, project.blurs.shapes]);

  const handleClearBlurs = useCallback(() => {
    if (!project.blurs.shapes.length) return;
    if (!confirm('Remove all focus regions?')) return;
    project.blurs.replaceShapes([]);
    blurDrawing.clearSelection();
    blurDrawing.cancelDraft();
  }, [project.blurs, blurDrawing]);

  const handleExportBlur = useCallback(async () => {
    if (!project.image) return;
    const { url, width, height } = project.image;
    try {
      await downloadBlurredImage(url, project.blurs.shapes, width, height, {
        amount: blurAmount,
        scale: blurScale,
        format: blurFormat,
        stroke: blurStroke,
        strokeColor: blurStrokeColor,
        outside: blurOutside,
        fillColor: blurFillColor,
        name: (projectName || 'blurred').trim() || 'blurred',
      });
    } catch (err) {
      alert('Could not export the blurred image: ' + err.message);
    }
  }, [project.image, project.blurs.shapes, blurAmount, blurScale, blurFormat, blurStroke, blurStrokeColor, blurOutside, blurFillColor, projectName]);

  // Export one file per visible region (each keeps only that one region).
  const handleExportBlurEach = useCallback(async () => {
    if (!project.image) return;
    const { url, width, height } = project.image;
    try {
      const n = await downloadBlurredImagePerRegion(url, project.blurs.shapes, width, height, {
        amount: blurAmount,
        scale: blurScale,
        format: blurFormat,
        stroke: blurStroke,
        strokeColor: blurStrokeColor,
        outside: blurOutside,
        fillColor: blurFillColor,
        name: (focusPrefix || DEFAULT_FOCUS_PREFIX).trim() || DEFAULT_FOCUS_PREFIX,
      });
      if (!n) alert('No visible regions to export — draw a region (and make sure it isn’t hidden).');
    } catch (err) {
      alert('Could not export the regions: ' + err.message);
    }
  }, [project.image, project.blurs.shapes, blurAmount, blurScale, blurFormat, blurStroke, blurStrokeColor, blurOutside, blurFillColor, focusPrefix]);

  // "Solo" a region: show only it (hide the rest). Clicking an already-soloed
  // region shows everything again. Visibility only, no undo entry — same as the
  // per-row hide toggle.
  const handleBlurSolo = useCallback((id) => {
    const regions = project.blurs.shapes;
    const isSoloed = regions.length > 1 && regions.every((r) => (r.id === id ? !r.hidden : r.hidden));
    project.blurs.setShapesLive((arr) =>
      arr.map((r) => ({ ...r, hidden: isSoloed ? false : r.id !== id }))
    );
  }, [project.blurs]);

  const hasImage = !!project.image;
  const canExport = hasImage && project.shapes.length > 0;
  const canUndo = activeColl.canUndo || (drawing.draft?.points?.length > 0);

  return (
    <div className="h-full flex flex-col bg-[#0f0f10] text-[#e8e8e8]">
      <Header
        mode={drawing.mode}
        onMode={drawing.switchMode}
        onUpload={handleUpload}
        onImportSvg={handleImportSvg}
        onExport={handleExport}
        canExport={canExport}
        onUndo={handleUndo}
        canUndo={canUndo}
        onShowShortcuts={() => setShortcutsOpen(true)}
        workspace={workspace}
        onWorkspace={setWorkspace}
        onCloud={() => setCloudOpen(true)}
        cloudStatus={sync.status}
      />

      <div className="flex-1 flex min-h-0">
        <Toolbar
          activeTool={drawing.tool}
          onPick={drawing.switchTool}
          disabled={drawing.mode !== 'edit'}
          tools={isCut ? CUT_TOOLS : isBlur ? BLUR_TOOLS : TOOLS}
        />

        <main className="flex-1 min-w-0 relative overflow-hidden bg-[#0f0f10]">
          {!hasImage ? (
            <EmptyCanvas onUpload={handleUpload} />
          ) : (
            <Canvas
              image={project.image}
              shapes={activeShapes}
              draft={drawing.draft}
              cursor={drawing.cursor}
              guides={drawing.guides}
              marquee={drawing.marquee}
              tool={drawing.tool}
              mode={drawing.mode}
              selectedIds={drawing.selectedIds}
              hoveredId={drawing.hoveredId}
              setHoveredId={drawing.setHoveredId}
              svgRef={drawing.svgRef}
              gRef={drawing.gRef}
              onMouseDown={drawing.onMouseDown}
              onMouseMove={drawing.onMouseMove}
              onMouseUp={drawing.onMouseUp}
              onMouseLeave={drawing.onMouseLeave}
              onDoubleClick={drawing.onDoubleClick}
              onContextMenu={handleUndo}
              viewport={viewport}
              glow={glow}
              showNames={isCut || isBlur}
              imageSelected={imageSelected}
              blurMode={isBlur}
              blurAmount={blurAmount}
              blurStroke={blurStroke}
              blurStrokeColor={blurStrokeColor}
              blurOutside={blurOutside}
              blurFillColor={blurFillColor}
            />
          )}

          {hasImage && imageSelected && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10">
              <button
                onClick={handleDeleteImage}
                className="flex items-center gap-1.5 px-3 h-9 rounded-md bg-[#1a1a1d]/95 backdrop-blur border border-[#26262a] text-[13px] text-[#c4c4c8] shadow-xl hover:border-red-500/60 hover:text-red-400 transition-colors"
              >
                <Trash2 size={14} /> Delete image
              </button>
            </div>
          )}

          {hasImage && (
            <StatusBar
              image={project.image}
              cursor={drawing.cursor}
              mode={drawing.mode}
              tool={drawing.tool}
            />
          )}
        </main>

        {isCut ? (
          <CutSidebar
            width={sidebarWidth}
            onWidthChange={updateSidebarWidth}
            pieces={project.pieces.shapes}
            selectedIds={drawing.selectedIds}
            onSelect={handleSidebarSelect}
            onUpdateName={(id, name) => project.pieces.updateShape(id, { name })}
            onDelete={handlePieceDelete}
            onSelectAll={handlePieceSelectAll}
            onSelectNone={drawing.clearSelection}
            onClearAll={handleClearPieces}
            mask={pieceMask}
            onMaskChange={setPieceMask}
            padding={piecePadding}
            onPaddingChange={setPiecePadding}
            scale={pieceScale}
            onScaleChange={setPieceScale}
            format={pieceFormat}
            onFormatChange={setPieceFormat}
            prefix={piecePrefix}
            onPrefixChange={setPiecePrefix}
            onExport={handleExportPieces}
            onGridSlice={handleGridSlice}
            onSaveLayout={handleSaveLayout}
            onLoadLayout={handleLoadLayout}
            hasImage={hasImage}
          />
        ) : isBlur ? (
          <BlurSidebar
            width={sidebarWidth}
            onWidthChange={updateSidebarWidth}
            regions={project.blurs.shapes}
            selectedIds={drawing.selectedIds}
            onSelect={handleSidebarSelect}
            onUpdateName={(id, name) => project.blurs.updateShape(id, { name })}
            onUpdate={(id, patch) => project.blurs.updateShape(id, patch)}
            onSolo={handleBlurSolo}
            onDelete={handleBlurDelete}
            onSelectAll={handleBlurSelectAll}
            onSelectNone={drawing.clearSelection}
            onClearAll={handleClearBlurs}
            amount={blurAmount}
            onAmountChange={setBlurAmount}
            outside={blurOutside}
            onOutsideChange={setBlurOutside}
            fillColor={blurFillColor}
            onFillColorChange={setBlurFillColor}
            stroke={blurStroke}
            onStrokeChange={setBlurStroke}
            strokeColor={blurStrokeColor}
            onStrokeColorChange={setBlurStrokeColor}
            scale={blurScale}
            onScaleChange={setBlurScale}
            format={blurFormat}
            onFormatChange={setBlurFormat}
            prefix={focusPrefix}
            onPrefixChange={setFocusPrefix}
            onExport={handleExportBlur}
            onExportEach={handleExportBlurEach}
            onSaveLayout={handleSaveLayout}
            onLoadLayout={handleLoadLayout}
            hasImage={hasImage}
          />
        ) : (
          <Sidebar
            shapes={project.shapes}
            selectedIds={drawing.selectedIds}
            onSelect={handleSidebarSelect}
            onDelete={(id) => project.deleteShape(id)}
            onUpdate={project.updateShape}
            onDeleteSelected={handleDeleteSelected}
            onDuplicateSelected={handleDuplicate}
            onReorder={project.reorderShape}
            onMoveShape={project.moveShape}
            glow={glow}
            onGlowChange={updateGlow}
            tab={sidebarTab}
            onTabChange={setSidebarTab}
            exportText={exportText}
            onApplyCode={applySvgText}
            canExport={canExport}
            width={sidebarWidth}
            onWidthChange={updateSidebarWidth}
            onClear={handleClear}
            onSaveLayout={handleSaveLayout}
            onLoadLayout={handleLoadLayout}
            hasImage={hasImage}
          />
        )}
      </div>

      {shortcutsOpen && <ShortcutsOverlay onClose={() => setShortcutsOpen(false)} />}

      {cloudOpen && (
        <CloudPanel
          onClose={() => setCloudOpen(false)}
          status={sync.status}
          enabled={cloudEnabled}
          currentId={projectId}
          currentName={projectName}
          onConnect={handleConnect}
          onDisconnect={handleDisconnect}
          onList={sync.list}
          onOpen={sync.open}
          onRemove={sync.remove}
          onSaveNow={sync.saveNow}
          onRename={setProjectName}
          onNewProject={handleNewProject}
        />
      )}
    </div>
  );
}
