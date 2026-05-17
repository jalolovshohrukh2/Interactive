import { Trash2, Copy, Layers, Code2 } from 'lucide-react';
import ShapeRow from './ShapeRow.jsx';
import DetailPanel from './DetailPanel.jsx';
import CodePanel from './CodePanel.jsx';
import Slider from '../ui/Slider.jsx';
import Label from '../ui/Label.jsx';

const MIN_WIDTH = 280;
const MAX_WIDTH = 720;

// Right-side panel.
//
// Tabs at the top swap the main content:
//   - Shapes: shape list + detail panel + bulk actions
//   - Code: live SVG output (read-only mirror), with copy / download
//
// Bottom strip stays regardless of tab: glow slider + Reset project.
export default function Sidebar({
  shapes, selectedIds,
  onSelect, onDelete, onUpdate, onClear,
  onDeleteSelected, onDuplicateSelected, onReorder,
  glow, onGlowChange,
  tab, onTabChange, exportText, onApplyCode, canExport,
  width, onWidthChange,
  hasImage,
}) {
  const selectedSet = new Set(selectedIds);
  const onlyOne = selectedIds.length === 1 ? shapes.find((s) => s.id === selectedIds[0]) : null;
  const multiCount = selectedIds.length > 1 ? selectedIds.length : 0;

  // Drag the left edge of the sidebar to resize. Width persists across
  // reloads (caller wires localStorage). Clamps to [MIN_WIDTH, MAX_WIDTH].
  const onResizeStart = (e) => {
    e.preventDefault();
    const startX = e.clientX;
    const startW = width;
    const onMove = (ev) => {
      // Sidebar sits on the RIGHT — dragging left widens, dragging right narrows.
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
      <div className="flex border-b border-[#1f1f22] flex-shrink-0">
        <TabBtn active={tab === 'shapes'} onClick={() => onTabChange('shapes')} Icon={Layers} label="Shapes" count={shapes.length} />
        <TabBtn active={tab === 'code'} onClick={() => onTabChange('code')} Icon={Code2} label="Code" />
      </div>

      {tab === 'shapes' ? (
        <ShapesTab
          shapes={shapes}
          selectedSet={selectedSet}
          onSelect={onSelect}
          onDelete={onDelete}
          onUpdate={onUpdate}
          onReorder={onReorder}
          onDeleteSelected={onDeleteSelected}
          onDuplicateSelected={onDuplicateSelected}
          onlyOne={onlyOne}
          multiCount={multiCount}
          hasImage={hasImage}
        />
      ) : (
        <CodePanel text={exportText} onApply={onApplyCode} />
      )}

      <div className="border-t border-[#1f1f22] flex-shrink-0 p-4">
        <Label>Hover outline</Label>
        <Slider
          value={glow ?? 0.4}
          min={0} max={1} step={0.05}
          onChange={(v) => onGlowChange?.(v)}
        />
      </div>

      {hasImage && (
        <div className="border-t border-[#1f1f22] p-3 flex-shrink-0">
          <button
            onClick={onClear}
            className="w-full text-[11px] text-[#6a6a70] py-1.5 rounded border border-dashed border-[#26262a] hover:text-red-400 hover:border-red-500/50 transition-colors"
          >
            Reset project
          </button>
        </div>
      )}
    </aside>
  );
}

function TabBtn({ active, onClick, Icon, label, count }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 h-10 px-3 flex items-center justify-center gap-2 text-[12px] font-medium border-b-2 transition-colors ${
        active
          ? 'border-violet-500 text-white bg-violet-500/5'
          : 'border-transparent text-[#8a8a90] hover:text-white hover:bg-[#1a1a1d]'
      }`}
    >
      <Icon size={13} />
      <span>{label}</span>
      {count !== undefined && (
        <span className="text-[10px] font-mono text-[#6a6a70]">{count}</span>
      )}
    </button>
  );
}

function ShapesTab({
  shapes, selectedSet, onSelect, onDelete, onUpdate, onReorder,
  onDeleteSelected, onDuplicateSelected, onlyOne, multiCount, hasImage,
}) {
  return (
    <>
      <ShapeList
        shapes={shapes}
        selectedSet={selectedSet}
        onSelect={onSelect}
        onDelete={onDelete}
        onUpdate={onUpdate}
        hasImage={hasImage}
      />

      {onlyOne && (
        <div className="border-t border-[#1f1f22] flex-shrink-0">
          <DetailPanel
            shape={onlyOne}
            onUpdate={(patch) => onUpdate(onlyOne.id, patch)}
            onReorder={(action) => onReorder?.(onlyOne.id, action)}
          />
        </div>
      )}

      {multiCount > 0 && (
        <div className="border-t border-[#1f1f22] flex-shrink-0 p-4">
          <div className="text-[11px] uppercase tracking-wider text-[#6a6a70] font-medium mb-2">
            {multiCount} selected
          </div>
          <div className="flex gap-1.5">
            <button
              onClick={onDuplicateSelected}
              className="flex-1 flex items-center justify-center gap-1.5 h-8 rounded border border-[#26262a] text-[12px] text-[#c4c4c8] hover:border-[#3a3a3e] hover:text-white transition-colors"
            >
              <Copy size={12} /> Duplicate
            </button>
            <button
              onClick={onDeleteSelected}
              className="flex-1 flex items-center justify-center gap-1.5 h-8 rounded border border-[#26262a] text-[12px] text-[#c4c4c8] hover:border-red-500/50 hover:text-red-400 transition-colors"
            >
              <Trash2 size={12} /> Delete
            </button>
          </div>
        </div>
      )}
    </>
  );
}

function ShapeList({ shapes, selectedSet, onSelect, onDelete, onUpdate, hasImage }) {
  return (
    <div className="flex flex-col min-h-0 flex-1">
      <div className="overflow-y-auto flex-1 min-h-0">
        {!shapes.length ? (
          <div className="px-4 py-8 text-center text-[12px] text-[#5a5a60]">
            {hasImage ? 'Pick a tool and start drawing' : 'Upload an image to begin'}
          </div>
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
  );
}
