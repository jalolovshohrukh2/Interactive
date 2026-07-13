import { useState } from 'react';
import { ChevronRight } from 'lucide-react';

// A titled disclosure. Collapsed, it shows just a header bar (plus an optional
// one-line summary of what's inside), so set-once sections don't permanently
// eat the sidebar's vertical space. Expanding reveals the children.
export default function Collapsible({ title, summary, defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="flex-shrink-0 border-b border-[#1f1f22]">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2 px-3 h-10 text-left hover:bg-[#1a1a1d]/60 transition-colors"
      >
        <ChevronRight
          size={14}
          className={`text-[#6a6a70] flex-shrink-0 transition-transform ${open ? 'rotate-90' : ''}`}
        />
        <span className="text-[11px] uppercase tracking-wider text-[#8a8a90] font-medium flex-shrink-0">
          {title}
        </span>
        {!open && summary && (
          <span className="text-[11px] text-[#5a5a60] truncate ml-auto pl-2">{summary}</span>
        )}
      </button>
      {open && <div>{children}</div>}
    </div>
  );
}
