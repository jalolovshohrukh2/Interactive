import { useEffect } from 'react';
import { X } from 'lucide-react';
import ShapeRow from './ShapeRow.jsx';

// Full-height overlay listing every shape at once — the "View all" escape hatch
// so the whole list is browsable without the cramped inline scroll. Clicking a
// row selects it; the modal stays open so you can keep scanning.
export default function ShapesModal({ shapes, selectedSet, onSelect, onDelete, onUpdate, onClose }) {
  useEffect(() => {
    // Capture phase + stopImmediatePropagation so Escape closes THIS modal and
    // doesn't also fall through to the app's global Escape (which deselects).
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.stopImmediatePropagation();
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-6"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[440px] max-h-[85vh] flex flex-col bg-[#131316] border border-[#26262a] rounded-xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 h-12 border-b border-[#1f1f22] flex-shrink-0">
          <div className="text-[13px] font-medium text-white">
            All shapes <span className="text-[#6a6a70] font-mono ml-1">{shapes.length}</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-[#8a8a90] hover:text-white transition-colors"
            title="Close (Esc)"
          >
            <X size={16} />
          </button>
        </div>
        <div className="overflow-y-auto flex-1 min-h-0">
          {!shapes.length ? (
            <div className="px-4 py-10 text-center text-[12px] text-[#5a5a60]">No shapes yet.</div>
          ) : (
            shapes.map((s) => (
              <ShapeRow
                key={s.id}
                shape={s}
                active={selectedSet.has(s.id)}
                onSelect={onSelect}
                onDelete={() => onDelete(s.id)}
                onUpdate={onUpdate}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
