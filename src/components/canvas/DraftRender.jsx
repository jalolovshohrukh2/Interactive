import { distXY } from '../../lib/coords.js';
import { CLOSE_POLYGON_THRESHOLD } from '../../constants.js';

// Live preview of the shape currently being drawn.
// Stroke/marker sizes are divided by displayScale so they stay constant in
// screen pixels at any zoom level.
export default function DraftRender({ draft, cursor, displayScale = 1 }) {
  const sw = 2 / displayScale;
  const dash = `${6 / displayScale} ${4 / displayScale}`;

  if (draft.type === 'rect') {
    const { start, current } = draft;
    const x = Math.min(start.x, current.x);
    const y = Math.min(start.y, current.y);
    const w = Math.abs(current.x - start.x);
    const h = Math.abs(current.y - start.y);
    return (
      <rect
        x={x} y={y} width={w} height={h}
        fill="rgba(168,85,247,0.18)" stroke="#a855f7"
        strokeWidth={sw} strokeDasharray={dash}
        pointerEvents="none"
      />
    );
  }
  if (draft.type === 'ellipse') {
    const { start, current } = draft;
    const cx = (start.x + current.x) / 2;
    const cy = (start.y + current.y) / 2;
    const rx = Math.abs(current.x - start.x) / 2;
    const ry = Math.abs(current.y - start.y) / 2;
    return (
      <ellipse
        cx={cx} cy={cy} rx={rx} ry={ry}
        fill="rgba(168,85,247,0.18)" stroke="#a855f7"
        strokeWidth={sw} strokeDasharray={dash}
        pointerEvents="none"
      />
    );
  }
  if (draft.type === 'polygon' || draft.type === 'polyline') {
    const pts = draft.points;
    if (!pts.length) return null;
    const livePts = cursor ? [...pts, [cursor.x, cursor.y]] : pts;
    const pointsStr = livePts.map((p) => p.join(',')).join(' ');
    const closing =
      draft.type === 'polygon' &&
      pts.length >= 3 &&
      cursor &&
      distXY(cursor.x, cursor.y, pts[0][0], pts[0][1]) < CLOSE_POLYGON_THRESHOLD;
    const dotR = 4 / displayScale;
    const dotRClose = 7 / displayScale;
    return (
      <g pointerEvents="none">
        <polyline
          points={pointsStr}
          fill="none"
          stroke="#a855f7"
          strokeWidth={sw}
          strokeDasharray={dash}
        />
        {pts.map(([x, y], i) => (
          <circle
            key={i}
            cx={x} cy={y}
            r={i === 0 && closing ? dotRClose : dotR}
            fill={i === 0 && closing ? '#a855f7' : '#fff'}
            stroke="#a855f7" strokeWidth={sw}
          />
        ))}
      </g>
    );
  }
  return null;
}
