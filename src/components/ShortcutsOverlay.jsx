import { useEffect } from 'react';
import { X } from 'lucide-react';

const GROUPS = [
  {
    title: 'Tools',
    rows: [
      ['V', 'Select / move'],
      ['R', 'Rectangle'],
      ['P', 'Polygon'],
      ['L', 'Polyline'],
      ['E', 'Ellipse'],
    ],
  },
  {
    title: 'Drawing',
    rows: [
      ['Click + drag', 'Draw rect or ellipse'],
      ['Click', 'Place a polygon / polyline point'],
      ['Shift + click', 'Constrain segment to 15°'],
      ['Enter / double-click', 'Finish polygon / polyline'],
      ['Esc', 'Cancel current draft'],
    ],
  },
  {
    title: 'Selection',
    rows: [
      ['Click', 'Select one shape'],
      ['Shift + click', 'Add / remove from selection'],
      ['Drag empty area', 'Marquee select'],
      ['Esc', 'Clear selection'],
    ],
  },
  {
    title: 'Editing',
    rows: [
      ['Arrow keys', 'Nudge selected (1 px)'],
      ['Shift + arrows', 'Nudge by 10 px'],
      ['Drag handle', 'Resize · Shift constrains proportions'],
      ['Drag vertex', 'Move polygon vertex'],
      ['Alt + click vertex', 'Delete polygon vertex'],
      ['Double-click edge', 'Insert polygon vertex'],
      ['Del / Backspace', 'Delete selected'],
      ['Ctrl/⌘ + C / V', 'Copy / paste'],
      ['Ctrl/⌘ + D', 'Duplicate selected'],
      ['Ctrl/⌘ + Z', 'Undo'],
      ['Right-click', 'Undo (in canvas)'],
    ],
  },
  {
    title: 'View',
    rows: [
      ['Ctrl/⌘ + =  / −', 'Zoom in / out'],
      ['Ctrl/⌘ + 0', 'Reset zoom'],
      ['Ctrl/⌘ + scroll', 'Zoom to cursor'],
      ['Scroll', 'Pan'],
      ['Middle-drag', 'Pan'],
      ['Space + drag', 'Pan'],
    ],
  },
];

export default function ShortcutsOverlay({ onClose }) {
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape' || e.key === '?') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    // Capture so we beat the global keyboard hook.
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-6"
      onClick={onClose}
    >
      <div
        className="bg-[#131316] border border-[#26262a] rounded-lg w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="h-12 px-4 flex items-center justify-between border-b border-[#1f1f22] flex-shrink-0">
          <div className="text-[14px] font-semibold">Keyboard shortcuts</div>
          <button onClick={onClose} className="text-[#6a6a70] hover:text-white p-1">
            <X size={16} />
          </button>
        </div>
        <div className="flex-1 overflow-auto p-5 grid grid-cols-2 gap-x-8 gap-y-5">
          {GROUPS.map((g) => (
            <div key={g.title}>
              <div className="text-[10px] uppercase tracking-wider text-violet-400 font-medium mb-2">
                {g.title}
              </div>
              <div className="space-y-1.5">
                {g.rows.map(([keys, desc]) => (
                  <div key={keys} className="flex items-center gap-3 text-[12px]">
                    <kbd className="font-mono px-1.5 py-0.5 bg-[#0a0a0c] border border-[#26262a] rounded text-[11px] text-[#c4c4c8] whitespace-nowrap">
                      {keys}
                    </kbd>
                    <span className="text-[#9a9aa0]">{desc}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="h-10 px-4 flex items-center justify-end border-t border-[#1f1f22] text-[11px] text-[#6a6a70] flex-shrink-0">
          Press <kbd className="font-mono mx-1 px-1.5 py-0.5 bg-[#0a0a0c] border border-[#26262a] rounded">?</kbd> or Esc to close
        </div>
      </div>
    </div>
  );
}
