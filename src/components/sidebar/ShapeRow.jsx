import { Square, Hexagon, Spline, Circle, X, Eye, EyeOff, Lock, Unlock } from 'lucide-react';
import { HOVER_LABEL } from '../../constants.js';

const ICONS = {
  rect: Square,
  polygon: Hexagon,
  polyline: Spline,
  ellipse: Circle,
};

export default function ShapeRow({ shape, active, onSelect, onDelete, onUpdate }) {
  const TypeIcon = ICONS[shape.type] || Square;
  const onClick = (e) => onSelect(shape.id, { shift: e.shiftKey });
  const toggleHidden = (e) => { e.stopPropagation(); onUpdate(shape.id, { hidden: !shape.hidden }); };
  const toggleLocked = (e) => { e.stopPropagation(); onUpdate(shape.id, { locked: !shape.locked }); };

  return (
    <div
      onClick={onClick}
      className={`group flex items-center gap-2.5 px-4 py-2 cursor-pointer border-b border-[#1a1a1d] transition-colors ${
        active ? 'bg-violet-500/10' : 'hover:bg-[#1a1a1d]'
      } ${shape.hidden ? 'opacity-50' : ''}`}
    >
      <div className={`w-1 h-7 rounded-full ${active ? 'bg-violet-500' : 'bg-transparent'}`} />
      <TypeIcon size={13} className={active ? 'text-violet-400' : 'text-[#6a6a70]'} />
      <div className="flex-1 min-w-0">
        <div className={`text-[13px] font-mono truncate ${active ? 'text-white' : 'text-[#c4c4c8]'}`}>
          .{shape.className || '(unnamed)'}
        </div>
        <div className="text-[10px] text-[#5a5a60] uppercase tracking-wider mt-0.5">
          {shape.type} · {HOVER_LABEL[shape.hover]}
        </div>
      </div>
      <RowIconBtn
        title={shape.hidden ? 'Show' : 'Hide'}
        onClick={toggleHidden}
        sticky={shape.hidden}
      >
        {shape.hidden ? <EyeOff size={13} /> : <Eye size={13} />}
      </RowIconBtn>
      <RowIconBtn
        title={shape.locked ? 'Unlock' : 'Lock'}
        onClick={toggleLocked}
        sticky={shape.locked}
      >
        {shape.locked ? <Lock size={13} /> : <Unlock size={13} />}
      </RowIconBtn>
      <button
        onClick={(e) => { e.stopPropagation(); onDelete(); }}
        className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-[#6a6a70] hover:text-red-400"
        title="Delete"
      >
        <X size={13} />
      </button>
    </div>
  );
}

// Eye / lock buttons live in the row. They're hidden by default to keep the
// row clean — `sticky` overrides that when the toggle is active so the user
// can still see the current state at a glance.
function RowIconBtn({ children, onClick, title, sticky }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`p-1 text-[#6a6a70] hover:text-white transition-all ${
        sticky ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
      }`}
    >
      {children}
    </button>
  );
}
