export default function ColorInput({ value, onChange }) {
  return (
    <div className="mt-1 flex items-center gap-1.5">
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-7 h-7 rounded border border-[#26262a] bg-transparent cursor-pointer"
        style={{ padding: 0 }}
      />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 min-w-0 px-2 py-1 text-[11px] font-mono bg-[#0a0a0c] border border-[#26262a] rounded text-white"
      />
    </div>
  );
}
