import { useState } from 'react';
import { X, Download, Copy, Check } from 'lucide-react';

export default function ExportModal({ text, onClose }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  const download = () => {
    const blob = new Blob([text], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'interactive-image.svg';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-6"
      onClick={onClose}
    >
      <div
        className="bg-[#131316] border border-[#26262a] rounded-lg w-full max-w-3xl max-h-[85vh] flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="h-12 px-4 flex items-center justify-between border-b border-[#1f1f22] flex-shrink-0">
          <div className="text-[14px] font-semibold">Export SVG</div>
          <button onClick={onClose} className="text-[#6a6a70] hover:text-white p-1">
            <X size={16} />
          </button>
        </div>
        <pre className="flex-1 overflow-auto p-4 text-[11.5px] font-mono leading-relaxed text-[#c4c4c8] bg-[#0a0a0c] whitespace-pre">
          {text}
        </pre>
        <div className="h-14 px-4 flex items-center justify-end gap-2 border-t border-[#1f1f22] flex-shrink-0">
          <button
            onClick={copy}
            className="flex items-center gap-1.5 px-3 h-9 rounded-md bg-[#1a1a1d] border border-[#26262a] text-[13px] hover:bg-[#22222a] transition-colors"
          >
            {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
            {copied ? 'Copied' : 'Copy to clipboard'}
          </button>
          <button
            onClick={download}
            className="flex items-center gap-1.5 px-3 h-9 rounded-md bg-violet-500 hover:bg-violet-400 text-white text-[13px] font-medium transition-colors"
          >
            <Download size={13} />
            Download .svg
          </button>
        </div>
      </div>
    </div>
  );
}
