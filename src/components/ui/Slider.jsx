// Compact range-slider + numeric badge. Used in detail / settings panels.
export default function Slider({
  value, min = 0, max = 1, step = 0.01,
  onChange, format,
}) {
  const display = format ? format(value) : value.toFixed(2);
  return (
    <div className="mt-1 flex items-center gap-2">
      <input
        type="range"
        min={min} max={max} step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="flex-1 accent-violet-500 cursor-pointer"
      />
      <span className="text-[10px] font-mono text-[#9a9aa0] min-w-[36px] text-right tabular-nums">
        {display}
      </span>
    </div>
  );
}
