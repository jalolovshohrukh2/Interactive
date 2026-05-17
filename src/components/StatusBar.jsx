import { TOOLS } from '../constants.js';

export default function StatusBar({ image, cursor, mode, tool }) {
  const toolHint = TOOLS.find((t) => t.id === tool)?.hint;
  return (
    <div className="absolute bottom-3 left-3 right-3 flex items-center gap-3 text-[11px] text-[#6a6a70] pointer-events-none">
      <Chip>{image.width} × {image.height}</Chip>
      {cursor && (
        <Chip>{Math.round(cursor.x)}, {Math.round(cursor.y)}</Chip>
      )}
      <Chip className="ml-auto">
        {mode === 'edit' ? toolHint : 'Hover shapes to preview interaction'}
      </Chip>
    </div>
  );
}

function Chip({ children, className = '' }) {
  return (
    <span className={`font-mono bg-[#131316]/80 px-2 py-1 rounded border border-[#1f1f22] ${className}`}>
      {children}
    </span>
  );
}
