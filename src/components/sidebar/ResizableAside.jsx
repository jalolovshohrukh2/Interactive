const MIN_WIDTH = 280;
const MAX_WIDTH = 720;

// The right-hand panel shell: fixed-position aside with a draggable left edge.
// Both the Hotspots sidebar and the Cut sidebar render their content inside it,
// so the resize behavior and chrome stay identical across workspaces.
export default function ResizableAside({ width, onWidthChange, children }) {
  // Drag the left edge to resize. The sidebar sits on the RIGHT, so dragging
  // left widens and dragging right narrows. Width clamps to [MIN, MAX].
  const onResizeStart = (e) => {
    e.preventDefault();
    const startX = e.clientX;
    const startW = width;
    const onMove = (ev) => {
      const next = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, startW + (startX - ev.clientX)));
      onWidthChange(next);
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  return (
    <aside
      className="border-l border-[#1f1f22] bg-[#131316] flex-shrink-0 flex flex-col overflow-hidden relative"
      style={{ width: `${width}px` }}
    >
      <div
        onMouseDown={onResizeStart}
        title="Drag to resize"
        className="absolute top-0 left-0 w-1.5 h-full -ml-0.5 z-20 cursor-col-resize hover:bg-violet-500/40 active:bg-violet-500/60 transition-colors"
      />
      {children}
    </aside>
  );
}
