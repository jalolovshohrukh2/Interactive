import { useState } from 'react';
import { Droplet, Download, X, Check, Eye, EyeOff, CircleDot } from 'lucide-react';
import ResizableAside from './ResizableAside.jsx';
import LayoutControls from './LayoutControls.jsx';
import Slider from '../ui/Slider.jsx';
import Label from '../ui/Label.jsx';
import ColorInput from '../ui/ColorInput.jsx';

// Right-hand panel for the Blur workspace. Draw focus regions (rect, polygon,
// ellipse), set the blur strength, and export a single image where everything
// OUTSIDE the regions is blurred and the regions themselves stay sharp.
export default function BlurSidebar({
  width, onWidthChange,
  regions, selectedIds, onSelect, onUpdateName, onUpdate, onSolo, onDelete,
  onSelectAll, onSelectNone, onClearAll,
  amount, onAmountChange,
  outside = 'blur', onOutsideChange,
  fillColor = '#ffffff', onFillColorChange,
  stroke = 0, onStrokeChange,
  strokeColor = '#38bdf8', onStrokeColorChange,
  scale, onScaleChange,
  format, onFormatChange,
  prefix, onPrefixChange,
  onExport, onExportEach,
  onSaveLayout, onLoadLayout,
  hasImage,
}) {
  const [busy, setBusy] = useState(false);
  const selectedSet = new Set(selectedIds);
  const fmtLabel = format === 'jpeg' ? 'JPG' : 'PNG';
  // Hidden regions are excluded from the export, so it's the visible count that
  // actually shapes the result.
  const visibleIds = regions.filter((r) => !r.hidden).map((r) => r.id);
  const visibleCount = visibleIds.length;
  // A region is "soloed" when it's the only visible one (and there are others).
  const isSoloed = (r) => regions.length > 1 && visibleCount === 1 && visibleIds[0] === r.id;

  const run = async () => {
    if (!hasImage || busy) return;
    setBusy(true);
    try { await onExport(); }
    finally { setBusy(false); }
  };

  const runEach = async () => {
    if (!hasImage || busy) return;
    setBusy(true);
    try { await onExportEach(); }
    finally { setBusy(false); }
  };

  return (
    <ResizableAside width={width} onWidthChange={onWidthChange}>
      {/* Header */}
      <div className="px-4 pt-3.5 pb-3 flex items-center gap-2 flex-shrink-0 border-b border-[#1f1f22]">
        <Droplet size={14} className="text-sky-400" />
        <span className="text-[13px] font-medium text-white">Focus regions</span>
        <span className="text-[11px] font-mono text-[#6a6a70]">{regions.length}</span>
        <div className="ml-auto flex items-center gap-1">
          <MiniBtn onClick={onSelectAll} disabled={!regions.length}>All</MiniBtn>
          <MiniBtn onClick={onSelectNone} disabled={!selectedIds.length}>None</MiniBtn>
        </div>
      </div>

      {/* Outside treatment — what happens to everything OUTSIDE the kept
          regions: blur it, paint it a solid color, or make it transparent. */}
      {hasImage && (
        <div className="px-4 py-3 flex-shrink-0 border-b border-[#1f1f22]">
          <Label>Outside the area</Label>
          <Seg
            options={[['blur', 'Blur'], ['color', 'Color'], ['transparent', 'Transparent']]}
            value={outside}
            onChange={onOutsideChange}
          />
          {outside === 'color' && (
            <div className="mt-2">
              <ColorInput value={fillColor} onChange={onFillColorChange} />
            </div>
          )}
          <div className="text-[10px] text-[#5a5a60] mt-1.5 leading-snug">
            {outside === 'color'
              ? 'Everything outside your regions is filled with this color.'
              : outside === 'transparent'
                ? 'Everything outside your regions becomes transparent (PNG).'
                : 'Everything outside your regions is blurred.'}
          </div>
        </div>
      )}

      {/* Blur strength — only relevant when the outside is being blurred. */}
      {hasImage && outside === 'blur' && (
        <div className="px-4 py-3 flex-shrink-0 border-b border-[#1f1f22]">
          <Label>Blur strength</Label>
          <Slider
            value={amount}
            min={0} max={50} step={1}
            onChange={onAmountChange}
            format={(v) => `${Math.round(v)}px`}
          />
        </div>
      )}

      {/* Region outline — a colored border drawn around every sharp region,
          shown live and baked into the export. Width 0 turns it off. */}
      {hasImage && (
        <div className="px-4 py-3 flex-shrink-0 border-b border-[#1f1f22]">
          <Label>Region outline</Label>
          <ColorInput value={strokeColor} onChange={onStrokeColorChange} />
          <div className="mt-2">
            <Slider
              value={stroke}
              min={0} max={40} step={1}
              onChange={onStrokeChange}
              format={(v) => `${Math.round(v)}px`}
            />
          </div>
          <div className="text-[10px] text-[#5a5a60] mt-1.5 leading-snug">
            Colored border around each sharp region. Set the width to 0 to turn it off.
          </div>
        </div>
      )}

      {/* List */}
      <div className="overflow-y-auto flex-1 min-h-0">
        {!regions.length ? (
          <div className="px-5 py-10 text-center text-[12px] text-[#5a5a60] leading-relaxed">
            {hasImage ? (
              <>
                <Droplet size={26} strokeWidth={1.5} className="mx-auto mb-3 text-[#3a3a40]" />
                Draw a <span className="text-sky-400">rectangle</span>, <span className="text-sky-400">polygon</span>,
                <span className="text-sky-400"> polyline</span>, or <span className="text-sky-400">ellipse</span> over
                the area to keep — {outside === 'color'
                  ? 'everything else is filled with your color.'
                  : outside === 'transparent'
                    ? 'everything else becomes transparent.'
                    : 'everything else gets blurred.'}
              </>
            ) : (
              'Upload an image to begin'
            )}
          </div>
        ) : (
          regions.map((r, i) => (
            <RegionRow
              key={r.id}
              region={r}
              index={i}
              active={selectedSet.has(r.id)}
              soloed={isSoloed(r)}
              onSelect={onSelect}
              onUpdateName={onUpdateName}
              onToggleHidden={() => onUpdate(r.id, { hidden: !r.hidden })}
              onSolo={() => onSolo(r.id)}
              onDelete={() => onDelete(r.id)}
            />
          ))
        )}
      </div>

      {/* Export controls */}
      {hasImage && (
        <div className="border-t border-[#1f1f22] flex-shrink-0 p-4 flex flex-col gap-3">
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

          <div>
            <Label>Name prefix</Label>
            <input
              type="text"
              value={prefix}
              onChange={(e) => onPrefixChange(e.target.value)}
              placeholder="focus"
              className="w-full bg-[#0a0a0c] border border-[#26262a] rounded-md px-2.5 h-8 text-[12px] text-white font-mono outline-none focus:border-sky-500/60 transition-colors"
            />
          </div>

          <button
            onClick={run}
            disabled={busy}
            className="flex items-center justify-center gap-2 h-9 rounded-md bg-sky-500 text-[#04212f] text-[12.5px] font-semibold hover:bg-sky-400 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Download size={13} strokeWidth={2.5} />
            {busy ? 'Working…' : `Export → ${fmtLabel}`}
          </button>
          {visibleCount > 1 && (
            <button
              onClick={runEach}
              disabled={busy}
              className="flex items-center justify-center gap-2 h-8 rounded-md border border-[#26262a] text-[12px] text-[#c4c4c8] hover:border-sky-500/50 hover:text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Download size={12} />
              {busy ? 'Working…' : `Export each region (${visibleCount}) → ${fmtLabel}`}
            </button>
          )}
          <div className="text-[10.5px] text-[#5a5a60] leading-snug">
            {(() => {
              const treat = outside === 'color' ? 'filled with color' : outside === 'transparent' ? 'made transparent' : 'blurred';
              if (!regions.length) {
                return outside === 'blur'
                  ? 'No regions — the whole image will be blurred.'
                  : 'No regions yet — draw an area to keep.';
              }
              if (!visibleCount) return `All regions hidden — the whole image will be ${treat}.`;
              return `Everything outside your ${visibleCount} visible region${visibleCount > 1 ? 's' : ''} is ${treat}.`;
            })()}
          </div>

          {!!regions.length && (
            <button
              onClick={onClearAll}
              className="mt-1 w-full text-[11px] text-[#6a6a70] py-1.5 rounded border border-dashed border-[#26262a] hover:text-red-400 hover:border-red-500/50 transition-colors"
            >
              Clear all regions
            </button>
          )}
        </div>
      )}

      <div className="border-t border-[#1f1f22] p-3 flex-shrink-0">
        <LayoutControls onSave={onSaveLayout} onLoad={onLoadLayout} />
      </div>
    </ResizableAside>
  );
}

function RegionRow({ region, index, active, soloed, onSelect, onUpdateName, onToggleHidden, onSolo, onDelete }) {
  const hidden = !!region.hidden;
  return (
    <div
      onClick={(e) => onSelect(region.id, { shift: e.shiftKey })}
      className={`group flex items-center gap-2.5 px-3 py-2 cursor-pointer border-b border-[#1a1a1d] transition-colors ${
        active ? 'bg-sky-500/10' : 'hover:bg-[#1a1a1d]'
      } ${hidden ? 'opacity-50' : ''}`}
    >
      <div className={`w-1 h-7 rounded-full flex-shrink-0 ${active ? 'bg-sky-500' : 'bg-transparent'}`} />
      <button
        onClick={(e) => { e.stopPropagation(); onSelect(region.id, { shift: true }); }}
        title={active ? 'Deselect' : 'Select'}
        className={`w-4 h-4 rounded flex items-center justify-center border transition-colors flex-shrink-0 ${
          active ? 'bg-sky-500 border-sky-500 text-[#04212f]' : 'border-[#3a3a3e] text-transparent hover:border-[#4a4a4e]'
        }`}
      >
        <Check size={12} strokeWidth={3} />
      </button>
      <span className="text-[10px] font-mono text-[#5a5a60] w-5 flex-shrink-0 text-right">{index + 1}</span>
      <input
        type="text"
        data-shape-name
        value={region.name || ''}
        onClick={(e) => e.stopPropagation()}
        onFocus={() => onSelect(region.id)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Escape') e.currentTarget.blur(); }}
        onChange={(e) => onUpdateName(region.id, e.target.value)}
        className={`flex-1 min-w-0 bg-transparent text-[13px] font-mono outline-none rounded px-1 py-0.5 focus:bg-[#0a0a0c] focus:ring-1 focus:ring-sky-500/40 transition-colors ${
          active ? 'text-white' : 'text-[#c4c4c8]'
        }`}
      />
      <button
        onClick={(e) => { e.stopPropagation(); onSolo(); }}
        title={soloed ? 'Show all regions' : 'Show only this region'}
        className={`p-1 transition-all flex-shrink-0 ${
          soloed ? 'opacity-100 text-sky-400' : 'opacity-0 group-hover:opacity-100 text-[#6a6a70] hover:text-white'
        }`}
      >
        <CircleDot size={13} />
      </button>
      <button
        onClick={(e) => { e.stopPropagation(); onToggleHidden(); }}
        title={hidden ? 'Show region (include in export)' : 'Hide region (exclude from export)'}
        className={`p-1 transition-all flex-shrink-0 ${
          hidden ? 'opacity-100 text-sky-400' : 'opacity-0 group-hover:opacity-100 text-[#6a6a70] hover:text-white'
        }`}
      >
        {hidden ? <EyeOff size={13} /> : <Eye size={13} />}
      </button>
      <button
        onClick={(e) => { e.stopPropagation(); onDelete(); }}
        className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-[#6a6a70] hover:text-red-400 flex-shrink-0"
        title="Delete region"
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
