import { useState, useCallback, useRef } from 'react';
import { useProject } from './hooks/useProject.js';
import { useDrawing } from './hooks/useDrawing.js';
import { useKeyboard } from './hooks/useKeyboard.js';
import { useViewport } from './hooks/useViewport.js';
import { exportSvg } from './lib/exportSvg.js';
import { importSvg } from './lib/importSvg.js';
import { cloneShape } from './lib/shapes.js';

import Header from './components/Header.jsx';
import Toolbar from './components/Toolbar.jsx';
import StatusBar from './components/StatusBar.jsx';
import ExportModal from './components/ExportModal.jsx';
import ShortcutsOverlay from './components/ShortcutsOverlay.jsx';
import Canvas from './components/canvas/Canvas.jsx';
import EmptyCanvas from './components/canvas/EmptyCanvas.jsx';
import Sidebar from './components/sidebar/Sidebar.jsx';

// Tiny placeholder for SVG import when the user has no background image yet.
const blankImage = (w, h) => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}"><rect width="${w}" height="${h}" fill="#1a1a1d"/></svg>`;
  return { url: 'data:image/svg+xml;utf8,' + encodeURIComponent(svg), width: w, height: h };
};

export default function App() {
  const project = useProject();
  const viewport = useViewport({ image: project.image });
  const drawing = useDrawing({
    image: project.image,
    shapes: project.shapes,
    addShape: project.addShape,
    setShapesLive: project.setShapesLive,
    pushHistory: project.pushHistory,
    viewport,
  });

  // Clipboard: array of shape snapshots. Empty array means nothing to paste.
  const clipboardRef = useRef([]);

  const selectedSet = () => new Set(drawing.selectedIds);

  const handleCopy = useCallback(() => {
    const ids = new Set(drawing.selectedIds);
    if (ids.size === 0) return;
    clipboardRef.current = project.shapes.filter((s) => ids.has(s.id));
  }, [project.shapes, drawing.selectedIds]);

  const handlePaste = useCallback(() => {
    const src = clipboardRef.current;
    if (!src.length) return;
    const copies = src.map((s) => cloneShape(s));
    project.commitMany(copies);
    drawing.setSelectedIds(copies.map((c) => c.id));
  }, [project, drawing]);

  const handleDuplicate = useCallback(() => {
    const ids = new Set(drawing.selectedIds);
    if (ids.size === 0) return;
    const src = project.shapes.filter((s) => ids.has(s.id));
    const copies = src.map((s) => cloneShape(s));
    project.commitMany(copies);
    drawing.setSelectedIds(copies.map((c) => c.id));
  }, [project, drawing]);

  const handleDeleteSelected = useCallback(() => {
    const ids = drawing.selectedIds;
    if (!ids.length) return;
    project.deleteMany(ids);
    drawing.clearSelection();
  }, [project, drawing]);

  const handleUndo = useCallback(() => {
    if (!drawing.popDraftPoint()) project.undo();
  }, [drawing, project]);

  // Single-row click in the sidebar: replace selection.
  // Shift+click in the sidebar: toggle the row in/out of the selection.
  const handleSidebarSelect = useCallback(
    (id, opts = {}) => {
      if (opts.shift) drawing.toggleInSelection(id);
      else drawing.selectOne(id);
    },
    [drawing]
  );

  useKeyboard({
    draft: drawing.draft,
    hasSelection: drawing.selectedIds.length > 0,
    deleteSelected: handleDeleteSelected,
    cancelDraft: () => { drawing.cancelDraft(); drawing.clearSelection(); },
    switchTool: drawing.switchTool,
    finishPolyDraft: drawing.finishPolyDraft,
    onUndo: handleUndo,
    onCopy: handleCopy,
    onPaste: handlePaste,
    onDuplicate: handleDuplicate,
    onNudge: drawing.nudgeSelected,
    onZoomIn: viewport.zoomIn,
    onZoomOut: viewport.zoomOut,
    onResetZoom: viewport.resetView,
    onShowShortcuts: () => setShortcutsOpen(true),
  });

  const [exportText, setExportText] = useState(null);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
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

  const handleImportSvg = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const text = await file.text();
    try {
      const parsed = importSvg(text);
      const replace = project.shapes.length > 0
        ? confirm(
            `This SVG contains ${parsed.shapes.length} shape(s). Replace your current ${project.shapes.length}?`
          )
        : true;
      if (!replace) return;
      // If no image is loaded yet, drop a placeholder at the imported viewBox.
      if (!project.image) {
        project.setImageRaw(blankImage(parsed.width, parsed.height));
      }
      project.replaceShapes(parsed.shapes);
      drawing.clearSelection();
    } catch (err) {
      alert('Could not parse SVG: ' + err.message);
    }
  };

  const handleExport = () => {
    if (!project.image) return;
    const text = exportSvg({
      width: project.image.width,
      height: project.image.height,
      shapes: project.shapes,
      glow,
    });
    setExportText(text);
  };

  const handleClear = () => {
    if (!confirm('Clear image and all shapes? This cannot be undone.')) return;
    project.clear();
    drawing.clearSelection();
    drawing.cancelDraft();
  };

  const hasImage = !!project.image;
  const canExport = hasImage && project.shapes.length > 0;

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
        canUndo={project.canUndo || (drawing.draft?.points?.length > 0)}
        onShowShortcuts={() => setShortcutsOpen(true)}
      />

      <div className="flex-1 flex min-h-0">
        <Toolbar
          activeTool={drawing.tool}
          onPick={drawing.switchTool}
          disabled={drawing.mode !== 'edit'}
        />

        <main className="flex-1 min-w-0 relative overflow-hidden bg-[#0f0f10]">
          {!hasImage ? (
            <EmptyCanvas onUpload={handleUpload} />
          ) : (
            <Canvas
              image={project.image}
              shapes={project.shapes}
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
            />
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

        <Sidebar
          shapes={project.shapes}
          selectedIds={drawing.selectedIds}
          onSelect={handleSidebarSelect}
          onDelete={(id) => project.deleteShape(id)}
          onUpdate={project.updateShape}
          onDeleteSelected={handleDeleteSelected}
          onDuplicateSelected={handleDuplicate}
          onReorder={project.reorderShape}
          glow={glow}
          onGlowChange={updateGlow}
          onClear={handleClear}
          hasImage={hasImage}
        />
      </div>

      {exportText !== null && (
        <ExportModal text={exportText} onClose={() => setExportText(null)} />
      )}
      {shortcutsOpen && <ShortcutsOverlay onClose={() => setShortcutsOpen(false)} />}
    </div>
  );
}
