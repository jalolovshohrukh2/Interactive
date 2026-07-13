import { ChevronsUp, ChevronUp, ChevronDown, ChevronsDown, Plus, Minus } from 'lucide-react';
import Label from '../ui/Label.jsx';
import ColorInput from '../ui/ColorInput.jsx';
import Slider from '../ui/Slider.jsx';
import { HOVER_LABEL } from '../../constants.js';

export default function DetailPanel({ shape, onUpdate, onReorder, onGrow }) {
  const canSpotlight = shape.type !== 'polyline';
  const GROW_STEP = 5; // image px per click

  return (
    <div className="p-4 space-y-3">
      <div>
        <Label>CSS class</Label>
        <input
          type="text"
          data-shape-name
          value={shape.className}
          onChange={(e) => onUpdate({ className: e.target.value })}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Escape') e.currentTarget.blur(); }}
          className="w-full mt-1 px-2.5 py-1.5 text-[13px] font-mono bg-[#0a0a0c] border border-[#26262a] rounded text-white"
          placeholder="Apt 1"
        />
      </div>

      <div>
        <Label>Hover behavior</Label>
        <div className="grid grid-cols-2 gap-1.5 mt-1">
          {['spotlight', 'fill'].map((h) => {
            const disabled = h === 'spotlight' && !canSpotlight;
            return (
              <button
                key={h}
                onClick={() => onUpdate({ hover: h })}
                disabled={disabled}
                className={`text-[11px] py-1.5 rounded border transition-colors ${
                  shape.hover === h
                    ? 'border-violet-500 bg-violet-500/15 text-violet-300'
                    : 'border-[#26262a] text-[#9a9aa0] hover:border-[#3a3a3e]'
                } disabled:opacity-30 disabled:cursor-not-allowed`}
              >
                {HOVER_LABEL[h]}
              </button>
            );
          })}
        </div>
      </div>

      {shape.hover === 'fill' && (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label>Idle fill</Label>
            <ColorInput value={shape.fill || '#c4c4c4'} onChange={(v) => onUpdate({ fill: v })} />
          </div>
          <div>
            <Label>Hover fill</Label>
            <ColorInput value={shape.hoverFill || '#d8d8d8'} onChange={(v) => onUpdate({ hoverFill: v })} />
          </div>
        </div>
      )}

      <div>
        <Label>
          {shape.hover === 'spotlight' ? 'Mask opacity on hover' : 'Opacity'}
        </Label>
        <Slider
          value={shape.opacity ?? 0.7}
          min={0} max={1} step={0.05}
          onChange={(v) => onUpdate({ opacity: v })}
        />
      </div>

      <div>
        <Label>Transition (s)</Label>
        <Slider
          value={shape.transition ?? 0.2}
          min={0} max={1.5} step={0.05}
          onChange={(v) => onUpdate({ transition: v })}
          format={(v) => `${v.toFixed(2)}s`}
        />
      </div>

      {onGrow && (
        <div>
          <Label>Grow / shrink outline</Label>
          <div className="grid grid-cols-2 gap-1.5 mt-1">
            <button
              onClick={() => onGrow(-GROW_STEP)}
              className="flex items-center justify-center gap-1 h-8 rounded border border-[#26262a] text-[12px] text-[#c4c4c8] hover:border-[#3a3a3e] hover:text-white transition-colors"
            >
              <Minus size={13} /> Shrink
            </button>
            <button
              onClick={() => onGrow(GROW_STEP)}
              className="flex items-center justify-center gap-1 h-8 rounded border border-[#26262a] text-[12px] text-[#c4c4c8] hover:border-violet-500/50 hover:text-white transition-colors"
            >
              <Plus size={13} /> Grow
            </button>
          </div>
          <div className="text-[10px] text-[#5a5a60] mt-1 leading-snug">
            Nudge the boundary outward (onto the walls) or back in — ~{GROW_STEP}px per click. Click a few times to reach the wall.
          </div>
        </div>
      )}

      <div>
        <Label>Arrange</Label>
        <div className="grid grid-cols-4 gap-1 mt-1">
          <ArrangeBtn title="Send to back" onClick={() => onReorder('back')}><ChevronsDown size={13} /></ArrangeBtn>
          <ArrangeBtn title="Send backward" onClick={() => onReorder('backward')}><ChevronDown size={13} /></ArrangeBtn>
          <ArrangeBtn title="Bring forward" onClick={() => onReorder('forward')}><ChevronUp size={13} /></ArrangeBtn>
          <ArrangeBtn title="Bring to front" onClick={() => onReorder('front')}><ChevronsUp size={13} /></ArrangeBtn>
        </div>
      </div>

      <ShapeMetadata shape={shape} />
    </div>
  );
}

function ArrangeBtn({ children, onClick, title }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="flex items-center justify-center h-7 rounded border border-[#26262a] text-[#9a9aa0] hover:border-[#3a3a3e] hover:text-white transition-colors"
    >
      {children}
    </button>
  );
}

function ShapeMetadata({ shape }) {
  return (
    <div className="pt-2 mt-1 border-t border-[#1f1f22] text-[10px] font-mono text-[#5a5a60] flex flex-wrap gap-x-3 gap-y-1">
      <span>type: {shape.type}</span>
      {shape.type === 'rect' && (
        <>
          <span>x: {Math.round(shape.x)}</span>
          <span>y: {Math.round(shape.y)}</span>
          <span>w: {Math.round(shape.width)}</span>
          <span>h: {Math.round(shape.height)}</span>
        </>
      )}
      {shape.type === 'ellipse' && (
        <>
          <span>cx: {Math.round(shape.cx)}</span>
          <span>cy: {Math.round(shape.cy)}</span>
          <span>rx: {Math.round(shape.rx)}</span>
          <span>ry: {Math.round(shape.ry)}</span>
        </>
      )}
      {(shape.type === 'polygon' || shape.type === 'polyline') && (
        <span>points: {shape.points.length}</span>
      )}
    </div>
  );
}
