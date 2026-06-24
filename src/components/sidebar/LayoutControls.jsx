import { Save, FolderOpen } from 'lucide-react';

// Save / load a reusable layout (hotspots + cut pieces, WITHOUT the image), so
// the same annotations can be applied to another floor render. Shown in both
// sidebars' footers.
export default function LayoutControls({ onSave, onLoad }) {
  return (
    <div className="flex gap-1.5">
      <button
        onClick={onSave}
        title="Download hotspots + pieces as a reusable layout file"
        className="flex-1 flex items-center justify-center gap-1.5 h-8 rounded border border-[#26262a] text-[11px] text-[#9a9aa0] hover:text-white hover:border-[#3a3a3e] transition-colors"
      >
        <Save size={12} /> Save layout
      </button>
      <label
        title="Apply a saved layout to the current image"
        className="flex-1 flex items-center justify-center gap-1.5 h-8 rounded border border-[#26262a] text-[11px] text-[#9a9aa0] hover:text-white hover:border-[#3a3a3e] transition-colors cursor-pointer"
      >
        <FolderOpen size={12} /> Load layout
        <input
          type="file"
          accept=".json,application/json"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) onLoad(f); }}
        />
      </label>
    </div>
  );
}
