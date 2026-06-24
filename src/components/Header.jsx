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
  const isCut = workspace === 'cut';
  return (
    <header className="h-14 grid grid-cols-[1fr_auto_1fr] items-center gap-3 px-4 border-b border-[#1f1f22] bg-[#131316] flex-shrink-0">
      {/* Left — brand. */}
      <div className="min-w-0 flex items-center overflow-hidden">
        <Brand />
      </div>

      {/* Center — workspace switcher. The two 1fr columns are always equal, so
          the tabs stay dead-centered and DON'T move when switching modes
          changes the action-bar width. */}
      <div className="flex-shrink-0">
        <WorkspaceSwitch workspace={workspace} onWorkspace={onWorkspace} />
      </div>

      {/* Right — actions, pinned to the right edge with room to breathe. */}
      <div className="min-w-0 flex items-center justify-end gap-2 [&>*]:flex-shrink-0 [&_*]:whitespace-nowrap">
        <button
          onClick={onCloud}
          title="Cloud sync"
          className="relative w-9 h-9 flex items-center justify-center rounded-md bg-[#1a1a1d] border border-[#26262a] text-[#9a9aa0] hover:bg-[#22222a] hover:text-white transition-colors"
        >
          <Cloud size={14} />
          <span
            className={`absolute top-1 right-1 w-1.5 h-1.5 rounded-full ${CLOUD_DOT[cloudStatus] || CLOUD_DOT.disabled} ${
              cloudStatus === 'saving' || cloudStatus === 'connecting' ? 'animate-pulse' : ''
            }`}
          />
        </button>
        <button
          onClick={onShowShortcuts}
          title="Keyboard shortcuts (?)"
          className="w-9 h-9 flex items-center justify-center rounded-md bg-[#1a1a1d] border border-[#26262a] text-[#9a9aa0] hover:bg-[#22222a] hover:text-white transition-colors"
        >
          <Keyboard size={14} />
        </button>
        <button
          onClick={onUndo}
          disabled={!canUndo}
          title="Undo (Ctrl+Z or right-click on canvas)"
          className="flex items-center gap-1.5 px-2.5 h-9 rounded-md bg-[#1a1a1d] border border-[#26262a] text-[13px] hover:bg-[#22222a] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <Undo2 size={13} />
          Undo
        </button>
        {!isCut && (
          <div className="flex rounded-md bg-[#1a1a1d] border border-[#26262a] p-0.5">
            <ModeBtn active={mode === 'edit'} onClick={() => onMode('edit')} Icon={Pencil} label="Edit" />
            <ModeBtn active={mode === 'preview'} onClick={() => onMode('preview')} Icon={Eye} label="Preview" />
          </div>
        )}
        <label className="cursor-pointer flex items-center gap-1.5 px-3 h-9 rounded-md bg-[#1a1a1d] border border-[#26262a] text-[13px] hover:bg-[#22222a] transition-colors">
          <Upload size={13} />
          Image
          <input type="file" accept="image/*" onChange={onUpload} className="hidden" />
        </label>
        {!isCut && (
          <label className="cursor-pointer flex items-center gap-1.5 px-3 h-9 rounded-md bg-[#1a1a1d] border border-[#26262a] text-[13px] hover:bg-[#22222a] transition-colors">
            <FileInput size={13} />
            Import SVG
            <input type="file" accept=".svg,image/svg+xml" onChange={onImportSvg} className="hidden" />
          </label>
        )}
        {!isCut && (
          <button
            onClick={onExport}
            disabled={!canExport}
            className="flex items-center gap-1.5 px-3 h-9 rounded-md bg-violet-500 text-white text-[13px] font-medium disabled:opacity-30 disabled:cursor-not-allowed hover:bg-violet-400 transition-colors"
          >
            <Download size={13} />
            Export SVG
          </button>
        )}
      </div>
    </header>
  );
}

function Brand() {
  return (
    <div className="flex items-center gap-2.5 min-w-0">
      <div className="w-8 h-8 rounded-md bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center flex-shrink-0">
        <ImageIcon size={16} strokeWidth={2.5} className="text-white" />
      </div>
      <div className="min-w-0">
        <div className="text-[15px] font-semibold leading-none whitespace-nowrap truncate">Interactive Image</div>
        <div className="text-[10px] text-[#6a6a70] mt-0.5 tracking-wider uppercase whitespace-nowrap truncate">
          SVG hotspot editor
        </div>
      </div>
    </div>
  );
}

// iOS-style segmented control with a sliding highlight pill. Mirrors the
// sidebar's tab control so the chrome feels consistent.
function WorkspaceSwitch({ workspace, onWorkspace }) {
  const activeIdx = Math.max(0, WORKSPACES.findIndex((w) => w.id === workspace));
  return (
    <div className="relative h-9 rounded-lg bg-[#0a0a0c] border border-[#26262a] flex">
      <div
        className="absolute inset-y-0 left-0 p-0.5 pointer-events-none"
        style={{
          width: `${100 / WORKSPACES.length}%`,
          transform: `translateX(${activeIdx * 100}%)`,
          transition: 'transform 220ms cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        <div className="h-full rounded-md bg-[#26262a] border border-[#3a3a3e] shadow-[0_1px_2px_rgba(0,0,0,0.4)]" />
      </div>
      {WORKSPACES.map((w) => {
        const active = w.id === workspace;
        return (
          <button
            key={w.id}
            onClick={() => onWorkspace(w.id)}
            className={`relative z-10 flex items-center justify-center gap-1.5 px-4 text-[12.5px] font-medium transition-colors ${
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
      className={`flex items-center gap-1.5 px-2.5 h-8 rounded text-[12px] font-medium transition-colors ${
        active ? 'bg-[#26262a] text-white' : 'text-[#8a8a90] hover:text-white'
      }`}
    >
      <Icon size={12} />
      {label}
    </button>
  );
}
