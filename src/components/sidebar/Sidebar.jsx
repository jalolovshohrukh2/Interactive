import { useState } from 'react';
import { Trash2, Copy, Layers, Code2, Package, Maximize2 } from 'lucide-react';
import ShapeRow from './ShapeRow.jsx';
import DetailPanel from './DetailPanel.jsx';
import CodePanel from './CodePanel.jsx';
import BuildingInfo from './BuildingInfo.jsx';
import ResizableAside from './ResizableAside.jsx';
import LayoutControls from './LayoutControls.jsx';
import ShapesModal from './ShapesModal.jsx';
import Slider from '../ui/Slider.jsx';
import Label from '../ui/Label.jsx';
import Collapsible from '../ui/Collapsible.jsx';
import { PLAN_TYPES } from '../../constants.js';

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
  onDeleteSelected, onDuplicateSelected, onReorder, onMoveShape, onGrow,
  glow, onGlowChange,
  tab, onTabChange, exportText, onApplyCode, canExport,
  onExportBundle,
  planType = 'floor', onPlanTypeChange,
  siteName, onSiteNameChange,
  buildingName, onBuildingNameChange,
  floorFrom, onFloorFromChange,
  floorTo, onFloorToChange,
  categories = [], category, onCategoryChange,
  width, onWidthChange,
  onSaveLayout, onLoadLayout,
  hasImage,
}) {
  const selectedSet = new Set(selectedIds);
  const onlyOne = selectedIds.length === 1 ? shapes.find((s) => s.id === selectedIds[0]) : null;
  const multiCount = selectedIds.length > 1 ? selectedIds.length : 0;
  const [bundleBusy, setBundleBusy] = useState(false);
  const [viewAll, setViewAll] = useState(false);

  // One-line recap of the setup fields, shown when the Setup section is collapsed.
  const planLabel = (PLAN_TYPES.find((p) => p.id === planType) || PLAN_TYPES[2]).label;
  const nameBit = planType === 'project' ? siteName : buildingName;
  const setupSummary = [
    planLabel,
    nameBit || null,
    planType === 'floor' ? `floors ${floorFrom || 1}–${floorTo || 10}` : null,
  ].filter(Boolean).join(' · ');

  const runBundle = async () => {
    if (bundleBusy || !onExportBundle) return;
    setBundleBusy(true);
    try { await onExportBundle(); }
    finally { setBundleBusy(false); }
  };

  return (
    <ResizableAside width={width} onWidthChange={onWidthChange}>
      {/* What this document is: master plan / one building / one floor. Drives
          hotspot naming and which metadata fields make sense. Tucked into a
          collapsible so this set-once config doesn't crowd out the shape list. */}
      <Collapsible title="Setup" summary={setupSummary} defaultOpen={false}>
        <div className="px-3 pt-3 pb-3 border-b border-[#1f1f22]">
          <Label>Plan level</Label>
          <div className="mt-1 flex rounded-md border border-[#26262a] overflow-hidden">
            {PLAN_TYPES.map((p) => (
              <button
                key={p.id}
                onClick={() => onPlanTypeChange?.(p.id)}
                className={`flex-1 h-7 text-[11px] font-medium transition-colors ${
                  planType === p.id ? 'bg-[#26262a] text-white' : 'text-[#8a8a90] hover:text-white'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <div className="text-[10px] text-[#5a5a60] mt-1.5 leading-snug">
            {(PLAN_TYPES.find((p) => p.id === planType) || PLAN_TYPES[2]).hint}
          </div>
        </div>

        <BuildingInfo
          planType={planType}
          siteName={siteName}
          onSiteNameChange={onSiteNameChange}
          buildingName={buildingName}
          onBuildingNameChange={onBuildingNameChange}
          floorFrom={floorFrom}
          onFloorFromChange={onFloorFromChange}
          floorTo={floorTo}
          onFloorToChange={onFloorToChange}
        />

        {categories.length > 1 ? (
          <div className="px-3 pt-3 pb-3">
            <Label>New hotspot type</Label>
            <select
              value={category}
              onChange={(e) => onCategoryChange(e.target.value)}
              className="w-full mt-1 bg-[#0a0a0c] border border-[#26262a] rounded-md px-2.5 h-8 text-[12px] text-white outline-none focus:border-violet-500/60 transition-colors cursor-pointer"
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.label}</option>
              ))}
            </select>
            <div className="text-[10px] text-[#5a5a60] mt-1">
              New shapes are named {(categories.find((c) => c.id === category) || categories[0]).prefix} 1, 2, 3…
            </div>
          </div>
        ) : categories.length === 1 ? (
          <div className="px-3 pt-3 pb-3">
            <div className="text-[10px] text-[#5a5a60] leading-snug">
              New shapes are named <span className="text-[#c4c4c8]">{categories[0].prefix} 1, 2, 3…</span> — rename them in the detail panel.
            </div>
          </div>
        ) : null}
      </Collapsible>

      <div className="px-3 pt-3 pb-2 flex-shrink-0">
        <SegmentedTabs
          tab={tab}
          onTabChange={onTabChange}
          shapeCount={shapes.length}
        />
      </div>

      {tab === 'shapes' ? (
        <ShapesTab
          shapes={shapes}
          selectedSet={selectedSet}
          onSelect={onSelect}
          onDelete={onDelete}
          onUpdate={onUpdate}
          onReorder={onReorder}
          onMoveShape={onMoveShape}
          onDeleteSelected={onDeleteSelected}
          onDuplicateSelected={onDuplicateSelected}
          onGrow={onGrow}
          onViewAll={() => setViewAll(true)}
          onlyOne={onlyOne}
          multiCount={multiCount}
          hasImage={hasImage}
        />
      ) : (
        <CodePanel text={exportText} onApply={onApplyCode} />
      )}

      {/* Primary action stays pinned + visible. */}
      {hasImage && shapes.length > 0 && (
        <div className="border-t border-[#1f1f22] p-3 flex-shrink-0">
          <button
            onClick={runBundle}
            disabled={bundleBusy}
            className="w-full flex items-center justify-center gap-2 h-9 rounded-md bg-violet-500 text-white text-[12.5px] font-semibold hover:bg-violet-400 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Package size={13} strokeWidth={2.5} />
            {bundleBusy ? 'Packaging…' : 'Download bundle (.zip)'}
          </button>
        </div>
      )}

      {/* Occasional controls tucked away so they don't squeeze the list. */}
      <Collapsible title="Display & project" defaultOpen={false}>
        <div className="p-3 space-y-3">
          <div>
            <Label>Hover outline</Label>
            <Slider
              value={glow ?? 0.4}
              min={0} max={1} step={0.05}
              onChange={(v) => onGlowChange?.(v)}
            />
          </div>
          <div className="text-[10px] text-[#5a5a60] leading-snug">
            Bundle = interactive SVG + a room image per apartment, plus the clean floor plan from the Blur tab.
          </div>
          <LayoutControls onSave={onSaveLayout} onLoad={onLoadLayout} />
          {hasImage && (
            <button
              onClick={onClear}
              className="w-full text-[11px] text-[#6a6a70] py-1.5 rounded border border-dashed border-[#26262a] hover:text-red-400 hover:border-red-500/50 transition-colors"
            >
              Reset project
            </button>
          )}
        </div>
      </Collapsible>

      {viewAll && (
        <ShapesModal
          shapes={shapes}
          selectedSet={selectedSet}
          onSelect={onSelect}
          onDelete={onDelete}
          onUpdate={onUpdate}
          onClose={() => setViewAll(false)}
        />
      )}
    </ResizableAside>
  );
}

// iOS-style segmented control. A "pill" sits inside each half with a small
// inset; clicking the other segment slides the pill across with a smooth
// cubic-bezier easing. The pill is an inner div wrapped in a sliding
// container so we can apply both the position transform AND a uniform
// inset on all four sides without arithmetic gymnastics.
function SegmentedTabs({ tab, onTabChange, shapeCount }) {
  const activeIdx = tab === 'shapes' ? 0 : 1;
  return (
    <div className="relative h-10 rounded-lg bg-[#0a0a0c] border border-[#26262a] flex">
      <div
        className="absolute inset-y-0 left-0 w-1/2 p-1 pointer-events-none"
        style={{
          transform: `translateX(${activeIdx * 100}%)`,
          transition: 'transform 220ms cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        <div className="h-full rounded-md bg-[#26262a] border border-[#3a3a3e] shadow-[0_1px_2px_rgba(0,0,0,0.4)]" />
      </div>
      <Seg
        active={tab === 'shapes'}
        onClick={() => onTabChange('shapes')}
        Icon={Layers}
        label="Shapes"
        count={shapeCount}
      />
      <Seg
        active={tab === 'code'}
        onClick={() => onTabChange('code')}
        Icon={Code2}
        label="Code"
      />
    </div>
  );
}

function Seg({ active, onClick, Icon, label, count }) {
  return (
    <button
      onClick={onClick}
      className={`relative z-10 flex-1 flex items-center justify-center gap-1.5 text-[12px] font-medium transition-colors ${
        active ? 'text-white' : 'text-[#8a8a90] hover:text-white'
      }`}
    >
      <Icon size={13} />
      <span>{label}</span>
      {count !== undefined && (
        <span className={`text-[10px] font-mono transition-colors ${active ? 'text-[#c4c4c8]' : 'text-[#6a6a70]'}`}>
          {count}
        </span>
      )}
    </button>
  );
}

function ShapesTab({
  shapes, selectedSet, onSelect, onDelete, onUpdate, onReorder, onMoveShape,
  onDeleteSelected, onDuplicateSelected, onGrow, onViewAll, onlyOne, multiCount, hasImage,
}) {
  return (
    <div className="flex-1 min-h-0 flex flex-col">
      {/* Pinned header: count + a full-height "View all" escape hatch, so the
          whole list is reachable even when the inline area is short. */}
      {shapes.length > 0 && (
        <div className="flex items-center justify-between px-3 h-8 flex-shrink-0 border-b border-[#1f1f22]">
          <span className="text-[10px] uppercase tracking-wider text-[#6a6a70] font-medium">
            {shapes.length} {shapes.length === 1 ? 'shape' : 'shapes'}
          </span>
          <button
            onClick={onViewAll}
            className="flex items-center gap-1 text-[11px] text-[#8a8a90] hover:text-white transition-colors"
          >
            <Maximize2 size={11} /> View all
          </button>
        </div>
      )}

      {/* The list and the detail panel share ONE scroll region so a tall detail
          panel (status, price, grow, arrange…) can't push itself past the viewport. */}
      <div className="flex-1 min-h-0 overflow-y-auto flex flex-col">
        <ShapeList
          shapes={shapes}
          selectedSet={selectedSet}
          onSelect={onSelect}
          onDelete={onDelete}
          onUpdate={onUpdate}
          onMoveShape={onMoveShape}
          hasImage={hasImage}
        />

      {onlyOne && (
        <div className="border-t border-[#1f1f22] flex-shrink-0">
          <DetailPanel
            shape={onlyOne}
            onUpdate={(patch) => onUpdate(onlyOne.id, patch)}
            onReorder={(action) => onReorder?.(onlyOne.id, action)}
            onGrow={(delta) => onGrow?.(onlyOne.id, delta)}
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
      </div>
    </div>
  );
}

function ShapeList({ shapes, selectedSet, onSelect, onDelete, onUpdate, onMoveShape, hasImage }) {
  // HTML5 drag-and-drop reorder.
  // dragIdx = which row was picked up
  // overIdx + overPos = where it'll drop (before or after the hovered row)
  const [dragIdx, setDragIdx] = useState(null);
  const [overIdx, setOverIdx] = useState(null);
  const [overPos, setOverPos] = useState('before');

  const onDragStart = (e, i) => {
    setDragIdx(i);
    e.dataTransfer.effectAllowed = 'move';
    // Required for Firefox to start the drag at all.
    try { e.dataTransfer.setData('text/plain', String(i)); } catch {}
  };

  const onDragOver = (e, i) => {
    if (dragIdx === null) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const r = e.currentTarget.getBoundingClientRect();
    const pos = (e.clientY - r.top) < r.height / 2 ? 'before' : 'after';
    if (overIdx !== i || overPos !== pos) {
      setOverIdx(i);
      setOverPos(pos);
    }
  };

  const onDrop = (e) => {
    e.preventDefault();
    if (dragIdx !== null && overIdx !== null && onMoveShape) {
      // Convert (hover-row, before/after) into a target index. If we're
      // moving downward we need to compensate for the removed source.
      let to = overPos === 'before' ? overIdx : overIdx + 1;
      if (to > dragIdx) to -= 1;
      if (to !== dragIdx) onMoveShape(shapes[dragIdx].id, to);
    }
    setDragIdx(null);
    setOverIdx(null);
  };

  const onDragEnd = () => {
    setDragIdx(null);
    setOverIdx(null);
  };

  return (
    <div className="flex flex-col">
      <div>
        {!shapes.length ? (
          <div className="px-4 py-8 text-center text-[12px] text-[#5a5a60]">
            {hasImage ? 'Pick a tool and start drawing' : 'Upload an image to begin'}
          </div>
        ) : (
          shapes.map((s, i) => {
            const showIndicator = overIdx === i && dragIdx !== null && dragIdx !== i;
            return (
              <div
                key={s.id}
                draggable
                onDragStart={(e) => onDragStart(e, i)}
                onDragOver={(e) => onDragOver(e, i)}
                onDrop={onDrop}
                onDragEnd={onDragEnd}
                className={`relative ${dragIdx === i ? 'opacity-40' : ''}`}
                style={{ cursor: 'grab' }}
              >
                {showIndicator && overPos === 'before' && (
                  <div className="absolute top-0 left-0 right-0 h-0.5 bg-violet-500 z-10 pointer-events-none" />
                )}
                <ShapeRow
                  shape={s}
                  active={selectedSet.has(s.id)}
                  onSelect={onSelect}
                  onDelete={() => onDelete(s.id)}
                  onUpdate={onUpdate}
                />
                {showIndicator && overPos === 'after' && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-violet-500 z-10 pointer-events-none" />
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
