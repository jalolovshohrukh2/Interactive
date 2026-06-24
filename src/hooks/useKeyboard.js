import { useEffect } from 'react';
import { TOOL_SHORTCUTS } from '../constants.js';

// Wires global keyboard shortcuts.
// Ignores keys while the user types in form fields.
export function useKeyboard({
  draft,
  hasSelection,
  deleteSelected,
  cancelDraft,
  switchTool,
  finishPolyDraft,
  onUndo,
  onCopy,
  onDuplicate,
  onNudge,
  onZoomIn,
  onZoomOut,
  onResetZoom,
  onShowShortcuts,
  toolShortcuts = TOOL_SHORTCUTS,
}) {
  useEffect(() => {
    const onKey = (e) => {
      const tag = e.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      const ctrl = e.ctrlKey || e.metaKey;

      // Editing shortcuts
      if (ctrl && !e.shiftKey && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault(); onUndo?.(); return;
      }
      if (ctrl && (e.key === 'c' || e.key === 'C')) {
        e.preventDefault(); onCopy?.(); return;
      }
      // Ctrl+V is intentionally NOT handled here — we want the native paste
      // event to fire, so the document-level paste listener can read the
      // clipboard and decide between SVG-import and shape-paste.
      if (ctrl && (e.key === 'd' || e.key === 'D')) {
        e.preventDefault(); onDuplicate?.(); return;
      }

      // Zoom shortcuts
      if (ctrl && (e.key === '=' || e.key === '+')) {
        e.preventDefault(); onZoomIn?.(); return;
      }
      if (ctrl && e.key === '-') {
        e.preventDefault(); onZoomOut?.(); return;
      }
      if (ctrl && e.key === '0') {
        e.preventDefault(); onResetZoom?.(); return;
      }

      if (!ctrl && !e.altKey && e.key === '?') {
        e.preventDefault(); onShowShortcuts?.(); return;
      }

      if (e.key === 'Escape') {
        cancelDraft();
        return;
      }
      if (e.key === 'Enter' && draft && (draft.type === 'polygon' || draft.type === 'polyline')) {
        e.preventDefault();
        finishPolyDraft();
        return;
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && hasSelection) {
        e.preventDefault();
        deleteSelected();
        return;
      }

      // Arrow keys nudge — 1px or 10px with Shift
      if (!ctrl && !e.altKey && hasSelection) {
        const step = e.shiftKey ? 10 : 1;
        const map = {
          ArrowLeft:  [-step, 0],
          ArrowRight: [ step, 0],
          ArrowUp:    [0, -step],
          ArrowDown:  [0,  step],
        };
        if (map[e.key]) {
          e.preventDefault();
          onNudge?.(...map[e.key]);
          return;
        }
      }

      // Plain-key tool shortcuts — skip if any modifier is held.
      if (ctrl || e.altKey || e.shiftKey) return;
      const toolId = toolShortcuts[e.key.toLowerCase()];
      if (toolId) switchTool(toolId);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [
    draft, hasSelection, deleteSelected, cancelDraft, switchTool, finishPolyDraft,
    onUndo, onCopy, onDuplicate, onNudge,
    onZoomIn, onZoomOut, onResetZoom, onShowShortcuts, toolShortcuts,
  ]);
}
