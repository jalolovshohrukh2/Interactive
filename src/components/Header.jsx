import { useRef, useState, useLayoutEffect } from 'react';
import { Upload, Download, Pencil, Eye, Undo2, Keyboard, FileInput, Image as ImageIcon, Cloud } from 'lucide-react';
import { WORKSPACES } from '../constants.js';

const CLOUD_DOT = {
  disabled: 'bg-[#3a3a3e]',
  connecting: 'bg-amber-400',
  saving: 'bg-amber-400',
  saved: 'bg-emerald-400',
  idle: 'bg-emerald-400',
  offline: 'bg-amber-400',
  error: 'bg-red-400',
};

export default function Header({
  mode, onMode, onUpload, onImportSvg, onExport, canExport,
  onUndo, canUndo, onShowShortcuts,
  workspace, onWorkspace,
  onCloud, cloudStatus,
}) {
  // Import SVG, Export SVG, and the Edit/Preview toggle only apply to the
  // hotspot editor. The Cut and Blur workspaces have their own export flows in
  // their sidebars.
  const isHotspots = workspace === 'hotspots';
  return (
    // Three columns: brand | tabs | actions. The two 1fr columns are always
    // equal, so the tab switcher stays dead-centered in the viewport regardless
    // of how wide the action bar is. As the window narrows, the brand text and
    // the lower-priority action buttons drop out (each has a keyboard
    // alternative) so nothing ever overlaps or clips the tabs.
    <header className="h-14 grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-4 border-b border-[#1f1f22] bg-[#131316] flex-shrink-0">
      {/* Left — brand. Text collapses to just the logo on narrow screens. */}
      <div className="min-w-0 flex items-center overflow-hidden">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-md bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center flex-shrink-0">
            <ImageIcon size={16} strokeWidth={2.5} className="text-white" />
          </div>
          <div className="hidden lg:block min-w-0">
            <div className="text-[15px] font-semibold leading-none whitespace-nowrap truncate">Interactive Image</div>
            <div className="text-[10px] text-[#6a6a70] mt-0.5 tracking-wider uppercase whitespace-nowrap truncate">
              SVG hotspot editor
            </div>
          </div>
        </div>
      </div>

      {/* Center — workspace switcher. */}
      <div className="flex-shrink-0">
        <WorkspaceSwitch workspace={workspace} onWorkspace={onWorkspace} />
      </div>

      {/* Right — actions, pinned right. overflow-hidden is a final guard so the
          bar can never paint over the tabs. */}
      <div className="min-w-0 flex items-center justify-end gap-1.5 overflow-hidden [&_*]:whitespace-nowrap">
        <button
          onClick={onCloud}
          title="Cloud sync"
          className="relative w-9 h-9 flex items-center justify-center rounded-md bg-[#1a1a1d] border border-[#26262a] text-[#9a9aa0] hover:bg-[#22222a] hover:text-white transition-colors flex-shrink-0"
        >
          <Cloud size={14} />
          <span
            className={`absolute top-1 right-1 w-1.5 h-1.5 rounded-full ${CLOUD_DOT[cloudStatus] || CLOUD_DOT.disabled} ${
              cloudStatus === 'saving' || cloudStatus === 'connecting' ? 'animate-pulse' : ''
            }`}
          />
        </button>
        {/* Shortcuts — also reachable with the ? key. */}
        <button
          onClick={onShowShortcuts}
          title="Keyboard shortcuts (?)"
          className="hidden xl:flex w-9 h-9 items-center justify-center rounded-md bg-[#1a1a1d] border border-[#26262a] text-[#9a9aa0] hover:bg-[#22222a] hover:text-white transition-colors flex-shrink-0"
        >
          <Keyboard size={14} />
        </button>
        {/* Undo — also Ctrl+Z / right-click on the canvas. */}
        <button
          onClick={onUndo}
          disabled={!canUndo}
          title="Undo (Ctrl+Z or right-click on canvas)"
          className="hidden lg:flex w-9 h-9 items-center justify-center rounded-md bg-[#1a1a1d] border border-[#26262a] hover:bg-[#22222a] transition-colors disabled:opacity-30 disabled:cursor-not-allowed flex-shrink-0"
        >
          <Undo2 size={14} />
        </button>
        {isHotspots && (
          <div className="flex rounded-md bg-[#1a1a1d] border border-[#26262a] p-0.5 flex-shrink-0">
            <ModeBtn active={mode === 'edit'} onClick={() => onMode('edit')} Icon={Pencil} label="Edit" />
            <ModeBtn active={mode === 'preview'} onClick={() => onMode('preview')} Icon={Eye} label="Preview" />
          </div>
        )}
        <label
          title="Upload image"
          className="cursor-pointer w-9 h-9 flex items-center justify-center rounded-md bg-[#1a1a1d] border border-[#26262a] hover:bg-[#22222a] transition-colors flex-shrink-0"
        >
          <Upload size={14} />
          <input type="file" accept="image/*" onChange={onUpload} className="hidden" />
        </label>
        {/* Import SVG — also works by pasting SVG markup. */}
        {isHotspots && (
          <label
            title="Import SVG"
            className="hidden lg:flex cursor-pointer w-9 h-9 items-center justify-center rounded-md bg-[#1a1a1d] border border-[#26262a] hover:bg-[#22222a] transition-colors flex-shrink-0"
          >
            <FileInput size={14} />
            <input type="file" accept=".svg,image/svg+xml" onChange={onImportSvg} className="hidden" />
          </label>
        )}
        {isHotspots && (
          <button
            onClick={onExport}
            disabled={!canExport}
            title="Export SVG"
            className="flex items-center gap-1.5 px-3 h-9 rounded-md bg-violet-500 text-white text-[13px] font-medium disabled:opacity-30 disabled:cursor-not-allowed hover:bg-violet-400 transition-colors flex-shrink-0"
          >
            <Download size={13} />
            <span className="hidden xl:inline">Export SVG</span>
          </button>
        )}
      </div>
    </header>
  );
}

// iOS-style segmented control with a sliding highlight pill. The pill is
// positioned from the ACTIVE tab's measured box (offsetLeft/offsetWidth) rather
// than a fixed per-tab percentage, so it lands exactly on the active tab no
// matter how wide each label is. Uses `left`/`width` (not `transform`) because
// some embedded renderers drop transforms on this element.
function WorkspaceSwitch({ workspace, onWorkspace }) {
  const ref = useRef(null);
  const [pill, setPill] = useState(null);
  const activeIdx = Math.max(0, WORKSPACES.findIndex((w) => w.id === workspace));

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const tabs = el.querySelectorAll('[data-ws-tab]');
      const b = tabs[activeIdx];
      if (b) setPill({ left: b.offsetLeft, width: b.offsetWidth });
    };
    measure();
    // Recompute if fonts load late or the control resizes.
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [activeIdx]);

  return (
    <div ref={ref} className="relative h-9 rounded-lg bg-[#0a0a0c] border border-[#26262a] inline-flex">
      {pill && (
        <div
          className="absolute inset-y-0 p-0.5 pointer-events-none"
          style={{
            left: pill.left,
            width: pill.width,
            transition: 'left 220ms cubic-bezier(0.4, 0, 0.2, 1), width 220ms cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        >
          <div className="h-full rounded-md bg-[#26262a] border border-[#3a3a3e] shadow-[0_1px_2px_rgba(0,0,0,0.4)]" />
        </div>
      )}
      {WORKSPACES.map((w) => {
        const active = w.id === workspace;
        return (
          <button
            key={w.id}
            data-ws-tab
            onClick={() => onWorkspace(w.id)}
            className={`relative z-10 flex items-center justify-center gap-1.5 px-4 text-[12.5px] font-medium whitespace-nowrap transition-colors ${
              active ? 'text-white' : 'text-[#8a8a90] hover:text-white'
            }`}
          >
            <w.Icon size={13} />
            <span>{w.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function ModeBtn({ active, onClick, Icon, label }) {
  return (
    <button
      onClick={onClick}
      title={label}
      className={`flex items-center gap-1.5 px-2.5 h-8 rounded text-[12px] font-medium transition-colors ${
        active ? 'bg-[#26262a] text-white' : 'text-[#8a8a90] hover:text-white'
      }`}
    >
      <Icon size={12} />
      <span className="hidden xl:inline">{label}</span>
    </button>
  );
}
