import { Trash2, Copy } from 'lucide-react';
import ShapeRow from './ShapeRow.jsx';
import DetailPanel from './DetailPanel.jsx';
import Slider from '../ui/Slider.jsx';
import Label from '../ui/Label.jsx';

// Right-side panel: shape list at top, detail or bulk-actions at bottom.
//
// Selection model is multi: `selectedIds` is an array of shape ids.
//   - 0 selected: no detail panel.
//   - 1 selected: full DetailPanel for that shape.
//   - >1 selected: bulk-action strip (delete all, duplicate all).
export default function Sidebar({
  shapes, selectedIds,
  onSelect, onDelete, onUpdate, onClear,
  onDeleteSelected, onDuplicateSelected, onReorder,
  glow, onGlowChange,
  hasImage,
}) {
  const selectedSet = new Set(selectedIds);
  const onlyOne = selectedIds.length === 1 ? shapes.find((s) => s.id === selectedIds[0]) : null;
  const multiCount = selectedIds.length > 1 ? selectedIds.length : 0;

  return (
    <aside className="w-80 border-l border-[#1f1f22] bg-[#131316] flex-shrink-0 flex flex-col overflow-hidden">
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

      <div className="border-t border-[#1f1f22] flex-shrink-0 p-4">
        <Label>Selection glow</Label>
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

function ShapeList({ shapes, selectedSet, onSelect, onDelete, onUpdate, hasImage }) {
  return (
    <div className="flex flex-col min-h-0 flex-1">
      <div className="h-10 px-4 flex items-center justify-between border-b border-[#1f1f22] flex-shrink-0">
        <span className="text-[11px] uppercase tracking-wider text-[#6a6a70] font-medium">
          Shapes
        </span>
        <span className="text-[11px] font-mono text-[#6a6a70]">{shapes.length}</span>
      </div>
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
