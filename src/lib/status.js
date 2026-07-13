// Sales status for a unit. A set status colors the hotspot on the plan and in
// the exported SVG (fill = translucent, hover = stronger) so availability reads
// at a glance. 'none' leaves the hotspot's normal styling untouched.
//
// Kept here (not in constants.js) so the pure SVG exporter can use it without
// pulling in the icon library that constants.js imports.
export const UNIT_STATUSES = [
  { id: 'none',      label: 'None' },
  { id: 'available', label: 'Available', color: '#22c55e', fill: 'rgba(34,197,94,0.30)',  hoverFill: 'rgba(34,197,94,0.55)' },
  { id: 'reserved',  label: 'Reserved',  color: '#f59e0b', fill: 'rgba(245,158,11,0.30)', hoverFill: 'rgba(245,158,11,0.55)' },
  { id: 'sold',      label: 'Sold',      color: '#ef4444', fill: 'rgba(239,68,68,0.30)',  hoverFill: 'rgba(239,68,68,0.55)' },
];
export const UNIT_STATUS_BY_ID = Object.fromEntries(UNIT_STATUSES.map((s) => [s.id, s]));

// The status object for a shape, or null when it has no (real) status.
export function statusOf(shape) {
  const st = shape && UNIT_STATUS_BY_ID[shape.status];
  return st && st.color ? st : null;
}
