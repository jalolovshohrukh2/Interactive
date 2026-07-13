import { useState } from 'react';
import { Scissors, Download, Package, X, Check, Hexagon, Grid2x2 } from 'lucide-react';
import ResizableAside from './ResizableAside.jsx';
import LayoutControls from './LayoutControls.jsx';
import Label from '../ui/Label.jsx';

// Right-hand panel for the Cut workspace. Lasso pieces (or auto-grid), name /
// pick / delete them, and export selected (or all) pieces as masked PNG/JPG —
// individually or zipped, with padding and a resolution multiplier.
export default function CutSidebar({
  width, onWidthChange,
  pieces, selectedIds, onSelect, onUpdateName, onDelete,
  onSelectAll, onSelectNone, onClearAll,
  mask, onMaskChange,
  bg, onBgChange,
  padding, onPaddingChange,
  scale, onScaleChange,
  format, onFormatChange,
  prefix, onPrefixChange,
  onExport, onGridSlice,
  onSaveLayout, onLoadLayout,
  hasImage,
}) {
  const [busy, setBusy] = useState(false);
  const [cols, setCols] = useState(2);
  const [rows, setRows] = useState(2);
  const selectedSet = new Set(selectedIds);
  const selectedPieces = pieces.filter((p) => selectedSet.has(p.id));
  const exportList = selectedPieces.length ? selectedPieces : pieces;
  const exportsSelected = selectedPieces.length > 0;
  const fmtLabel = format === 'jpeg' ? 'JPG' : 'PNG';

  const run = async (delivery) => {
    if (!exportList.length || busy) return;
    setBusy(true);
    try { await onExport(exportList, delivery); }
    finally { setBusy(false); }
  };

  return (
    <ResizableAside width={width} onWidthChange={onWidthChange}>
      {/* Header */}
      <div className="px-4 pt-3.5 pb-3 flex items-center gap-2 flex-shrink-0 border-b border-[#1f1f22]">
        <Scissors size={14} className="text-emerald-400" />
        <span className="text-[13px] font-medium text-white">Pieces</span>
        <span className="text-[11px] font-mono text-[#6a6a70]">{pieces.length}</span>
        <div className="ml-auto flex items-center gap-1">
          <MiniBtn onClick={onSelectAll} disabled={!pieces.length}>All</MiniBtn>
          <MiniBtn onClick={onSelectNone} disabled={!selectedIds.length}>None</MiniBtn>
        </div>
      </div>

      {/* Auto-grid generator */}
      {hasImage && (
        <div className="px-4 py-2.5 flex items-center gap-2 flex-shrink-0 border-b border-[#1f1f22]">
          <Grid2x2 size={13} className="text-[#8a8a90]" />
          <span className="text-[11px] text-[#8a8a90]">Grid</span>
          <NumBox value={cols} min={1} max={50} onChange={setCols} />
          <span className="text-[#5a5a60] text-[12px]">×</span>
          <NumBox value={rows} min={1} max={50} onChange={setRows} />
          <button
            onClick={() => onGridSlice(cols, rows)}
            className="ml-auto px-2.5 h-7 rounded border border-[#26262a] text-[11px] text-[#c4c4c8] hover:text-white hover:border-[#3a3a3e] transition-colors"
          >
            Generate
          </button>
        </div>
      )}

      {/* List */}
      <div className="overflow-y-auto flex-1 min-h-0">
        {!pieces.length ? (
          <div className="px-5 py-10 text-center text-[12px] text-[#5a5a60] leading-relaxed">
            {hasImage ? (
              <>
                <Hexagon size={26} strokeWidth={1.5} className="mx-auto mb-3 text-[#3a3a40]" />
                Draw a <span className="text-emerald-400">rectangle</span>, <span className="text-emerald-400">polygon</span>,
                <span className="text-emerald-400"> polyline</span>, or <span className="text-emerald-400">ellipse</span> over
                an area — or use <span className="text-[#c4c4c8]">Grid</span> above to auto-slice.
              </>
            ) : (
              'Upload an image to begin'
            )}
          </div>
        ) : (
          pieces.map((p, i) => (
            <PieceRow
              key={p.id}
              piece={p}
              index={i}
              active={selectedSet.has(p.id)}
              onSelect={onSelect}
              onUpdateName={onUpdateName}
              onDelete={() => onDelete(p.id)}
            />
          ))
        )}
      </div>

      {/* Export controls */}
      {!!pieces.length && (
        <div className="border-t border-[#1f1f22] flex-shrink-0 p-4 flex flex-col gap-3">
          <button
            type="button"
            onClick={() => onMaskChange(!mask)}
            className="flex items-center gap-2.5 text-left group"
            title="When on, anything outside the outline is transparent. When off, you get a plain rectangular crop."
          >
            <span className={`w-4 h-4 rounded flex items-center justify-center border transition-colors ${
              mask ? 'bg-emerald-500 border-emerald-500 text-[#04210f]' : 'border-[#3a3a3e] text-transparent group-hover:border-[#4a4a4e]'
            }`}>
              <Check size={12} strokeWidth={3} />
            </span>
            <span className="text-[12px] text-[#c4c4c8]">Transparent outside outline</span>
          </button>

          <div>
            <Label>Background</Label>
            <Seg
              options={[['transparent', 'Transparent'], ['white', 'White']]}
              value={format === 'jpeg' ? 'white' : bg}
              onChange={onBgChange}
            />
            {format === 'jpeg' && (
              <div className="mt-1 text-[10.5px] text-[#5a5a60] leading-snug">JPG has no transparency — always white.</div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Format</Label>
              <Seg options={[['png', 'PNG'], ['jpeg', 'JPG']]} value={format} onChange={onFormatChange} />
            </div>
            <div>
              <Label>Scale</Label>
              <Seg options={[[1, '1×'], [2, '2×'], [3, '3×']]} value={scale} onChange={onScaleChange} />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Label>Padding</Label>
            <NumBox value={padding} min={0} max={500} onChange={onPaddingChange} />
            <span className="text-[11px] text-[#5a5a60]">px around each piece</span>
          </div>

          <div>
            <Label>Name prefix</Label>
            <input
              type="text"
              value={prefix}
              onChange={(e) => onPrefixChange(e.target.value)}
              placeholder="piece"
              className="w-full bg-[#0a0a0c] border border-[#26262a] rounded-md px-2.5 h-8 text-[12px] text-white font-mono outline-none focus:border-violet-500/60 transition-colors"
            />
          </div>

          <div className="flex flex-col gap-1.5 pt-0.5">
            <button
              onClick={() => run('files')}
              disabled={busy || !exportList.length}
              className="flex items-center justify-center gap-2 h-9 rounded-md bg-emerald-500 text-[#04210f] text-[12.5px] font-semibold hover:bg-emerald-400 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Download size={13} strokeWidth={2.5} />
              {busy ? 'Cutting…' : `Cut ${exportsSelected ? exportList.length : 'all'} → ${fmtLabel}`}
            </button>
            <button
              onClick={() => run('zip')}
              disabled={busy || !exportList.length}
              className="flex items-center justify-center gap-2 h-9 rounded-md bg-[#1a1a1d] border border-[#26262a] text-[12.5px] text-[#c4c4c8] hover:border-[#3a3a3e] hover:text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Package size={13} />
              {busy ? 'Cutting…' : `Cut ${exportsSelected ? exportList.length : 'all'} → ZIP`}
            </button>
          </div>
          <div className="text-[10.5px] text-[#5a5a60] leading-snug">
            {exportsSelected
              ? `Exporting ${exportList.length} selected piece${exportList.length > 1 ? 's' : ''}.`
              : 'Nothing selected — exports all pieces. Tick rows to export a subset.'}
          </div>

          <button
            onClick={onClearAll}
            className="mt-1 w-full text-[11px] text-[#6a6a70] py-1.5 rounded border border-dashed border-[#26262a] hover:text-red-400 hover:border-red-500/50 transition-colors"
          >
            Clear all pieces
          </button>
        </div>
      )}

      <div className="border-t border-[#1f1f22] p-3 flex-shrink-0">
        <LayoutControls onSave={onSaveLayout} onLoad={onLoadLayout} />
      </div>
    </ResizableAside>
  );
}

function PieceRow({ piece, index, active, onSelect, onUpdateName, onDelete }) {
  return (
    <div
      onClick={(e) => onSelect(piece.id, { shift: e.shiftKey })}
      className={`group flex items-center gap-2.5 px-3 py-2 cursor-pointer border-b border-[#1a1a1d] transition-colors ${
        active ? 'bg-emerald-500/10' : 'hover:bg-[#1a1a1d]'
      }`}
    >
      <div className={`w-1 h-7 rounded-full flex-shrink-0 ${active ? 'bg-emerald-500' : 'bg-transparent'}`} />
      <button
        onClick={(e) => { e.stopPropagation(); onSelect(piece.id, { shift: true }); }}
        title={active ? 'Deselect' : 'Select'}
        className={`w-4 h-4 rounded flex items-center justify-center border transition-colors flex-shrink-0 ${
          active ? 'bg-emerald-500 border-emerald-500 text-[#04210f]' : 'border-[#3a3a3e] text-transparent hover:border-[#4a4a4e]'
        }`}
      >
        <Check size={12} strokeWidth={3} />
      </button>
      <span className="text-[10px] font-mono text-[#5a5a60] w-5 flex-shrink-0 text-right">{index + 1}</span>
      <input
        type="text"
        data-shape-name
        value={piece.name || ''}
        onClick={(e) => e.stopPropagation()}
        onFocus={() => onSelect(piece.id)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Escape') e.currentTarget.blur(); }}
        onChange={(e) => onUpdateName(piece.id, e.target.value)}
        className={`flex-1 min-w-0 bg-transparent text-[13px] font-mono outline-none rounded px-1 py-0.5 focus:bg-[#0a0a0c] focus:ring-1 focus:ring-violet-500/40 transition-colors ${
          active ? 'text-white' : 'text-[#c4c4c8]'
        }`}
      />
      <button
        onClick={(e) => { e.stopPropagation(); onDelete(); }}
        className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-[#6a6a70] hover:text-red-400 flex-shrink-0"
        title="Delete piece"
      >
        <X size={13} />
      </button>
    </div>
  );
}

function MiniBtn({ children, onClick, disabled }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="px-2 h-6 rounded text-[11px] text-[#8a8a90] border border-[#26262a] hover:text-white hover:border-[#3a3a3e] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
    >
      {children}
    </button>
  );
}

function NumBox({ value, min, max, onChange }) {
  return (
    <input
      type="number"
      min={min}
      max={max}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="w-14 bg-[#0a0a0c] border border-[#26262a] rounded px-2 h-7 text-[12px] text-white font-mono outline-none focus:border-violet-500/60 transition-colors"
    />
  );
}

function Seg({ options, value, onChange }) {
  return (
    <div className="mt-1 flex rounded-md border border-[#26262a] overflow-hidden">
      {options.map(([v, label]) => (
        <button
          key={String(v)}
          onClick={() => onChange(v)}
          className={`flex-1 h-7 text-[11px] font-medium transition-colors ${
            value === v ? 'bg-[#26262a] text-white' : 'text-[#8a8a90] hover:text-white'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
