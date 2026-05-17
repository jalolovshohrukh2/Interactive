import { Plus, Minus, Maximize2 } from 'lucide-react';

export default function ZoomControls({ zoom, onZoomIn, onZoomOut, onReset }) {
  const pct = Math.round(zoom * 100);
  return (
    <div className="absolute bottom-3 right-3 flex items-center gap-1 bg-[#131316]/95 border border-[#26262a] rounded-md p-1 shadow-lg backdrop-blur-sm">
      <IconBtn onClick={onZoomOut} title="Zoom out (Ctrl+−)"><Minus size={13} /></IconBtn>
      <button
        onClick={onReset}
        title="Reset zoom (Ctrl+0)"
        className="min-w-[52px] h-7 px-2 text-[11px] font-mono text-[#c4c4c8] rounded hover:bg-[#1f1f22] transition-colors"
      >
        {pct}%
      </button>
      <IconBtn onClick={onZoomIn} title="Zoom in (Ctrl+=)"><Plus size={13} /></IconBtn>
      <div className="w-px h-5 bg-[#26262a] mx-0.5" />
      <IconBtn onClick={onReset} title="Fit to window"><Maximize2 size={12} /></IconBtn>
    </div>
  );
}

function IconBtn({ children, onClick, title }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="w-7 h-7 flex items-center justify-center rounded text-[#9a9aa0] hover:bg-[#1f1f22] hover:text-white transition-colors"
    >
      {children}
    </button>
  );
}
