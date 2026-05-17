import { Upload, Download, Pencil, Eye, Undo2, Keyboard, FileInput, Image as ImageIcon } from 'lucide-react';

export default function Header({
  mode, onMode, onUpload, onImportSvg, onExport, canExport,
  onUndo, canUndo, onShowShortcuts,
}) {
  return (
    <header className="h-14 flex items-center px-4 border-b border-[#1f1f22] bg-[#131316] flex-shrink-0">
      <Brand />

      <div className="ml-auto flex items-center gap-2">
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
        <div className="flex rounded-md bg-[#1a1a1d] border border-[#26262a] p-0.5">
          <ModeBtn active={mode === 'edit'} onClick={() => onMode('edit')} Icon={Pencil} label="Edit" />
          <ModeBtn active={mode === 'preview'} onClick={() => onMode('preview')} Icon={Eye} label="Preview" />
        </div>
        <label className="cursor-pointer flex items-center gap-1.5 px-3 h-9 rounded-md bg-[#1a1a1d] border border-[#26262a] text-[13px] hover:bg-[#22222a] transition-colors">
          <Upload size={13} />
          Image
          <input type="file" accept="image/*" onChange={onUpload} className="hidden" />
        </label>
        <label className="cursor-pointer flex items-center gap-1.5 px-3 h-9 rounded-md bg-[#1a1a1d] border border-[#26262a] text-[13px] hover:bg-[#22222a] transition-colors">
          <FileInput size={13} />
          Import SVG
          <input type="file" accept=".svg,image/svg+xml" onChange={onImportSvg} className="hidden" />
        </label>
        <button
          onClick={onExport}
          disabled={!canExport}
          className="flex items-center gap-1.5 px-3 h-9 rounded-md bg-violet-500 text-white text-[13px] font-medium disabled:opacity-30 disabled:cursor-not-allowed hover:bg-violet-400 transition-colors"
        >
          <Download size={13} />
          Export SVG
        </button>
      </div>
    </header>
  );
}

function Brand() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="w-8 h-8 rounded-md bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center">
        <ImageIcon size={16} strokeWidth={2.5} className="text-white" />
      </div>
      <div>
        <div className="text-[15px] font-semibold leading-none">Interactive Image</div>
        <div className="text-[10px] text-[#6a6a70] mt-0.5 tracking-wider uppercase">
          SVG hotspot editor
        </div>
      </div>
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
