import { TOOLS } from '../constants.js';

export default function Toolbar({ activeTool, onPick, disabled, tools = TOOLS }) {
  return (
    <nav className="w-14 flex flex-col items-center py-3 gap-1 border-r border-[#1f1f22] bg-[#131316] flex-shrink-0">
      {tools.map((t) => (
        <ToolBtn
          key={t.id}
          active={!disabled && activeTool === t.id}
          disabled={disabled}
          onClick={() => onPick(t.id)}
          Icon={t.Icon}
          label={t.label}
          hint={t.hint}
        />
      ))}
    </nav>
  );
}

function ToolBtn({ active, disabled, onClick, Icon, label, hint }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={`${label} — ${hint}`}
      className={`w-10 h-10 flex items-center justify-center rounded-md transition-colors ${
        active
          ? 'bg-violet-500/20 text-violet-300 ring-1 ring-violet-500/40'
          : 'text-[#8a8a90] hover:bg-[#1a1a1d] hover:text-white'
      } disabled:opacity-30 disabled:cursor-not-allowed`}
    >
      <Icon size={16} strokeWidth={1.8} />
    </button>
  );
}
