import { MousePointer2, Square, Hexagon, Spline, Circle, Lasso, Wand2, Target, Scissors, Droplet } from 'lucide-react';

export const STORAGE_KEY = 'interactive-image:project';

export const TOOLS = [
  { id: 'select',   label: 'Select',    Icon: MousePointer2, shortcut: 'V', hint: 'V — click shapes to select, drag to move' },
  { id: 'rect',     label: 'Rectangle', Icon: Square,        shortcut: 'R', hint: 'R — drag corner to corner' },
  { id: 'polygon',  label: 'Polygon',   Icon: Hexagon,       shortcut: 'P', hint: 'P — click points, Enter or double-click to close' },
  { id: 'polyline', label: 'Polyline',  Icon: Spline,        shortcut: 'L', hint: 'L — click points, Enter to finish' },
  { id: 'ellipse',  label: 'Ellipse',   Icon: Circle,        shortcut: 'E', hint: 'E — drag bounding box' },
  { id: 'lasso',    label: 'Freehand',  Icon: Lasso,         shortcut: 'F', hint: 'F — hold and drag to trace a curved area, release to close' },
  { id: 'wand',     label: 'Magic wand', Icon: Wand2,        shortcut: 'W', hint: 'W — click a colored area to select it automatically' },
];

export const TOOL_SHORTCUTS = Object.fromEntries(
  TOOLS.map((t) => [t.shortcut.toLowerCase(), t.id])
);

// The top-level workspaces, shown in the header switcher.
export const WORKSPACES = [
  { id: 'hotspots', label: 'Hotspots', Icon: Target },
  { id: 'cut',      label: 'Cut',      Icon: Scissors },
  { id: 'blur',     label: 'Blur',     Icon: Droplet },
];

// Cut workspace: full shape toolset (same as Hotspots). Every shape becomes a
// crop region — polylines are auto-closed when the piece is cut.
export const CUT_TOOLS = [
  { id: 'select',   label: 'Select',    Icon: MousePointer2, shortcut: 'V', hint: 'V — click a piece to select, drag to move' },
  { id: 'rect',     label: 'Rectangle', Icon: Square,        shortcut: 'R', hint: 'R — drag corner to corner' },
  { id: 'polygon',  label: 'Polygon',   Icon: Hexagon,       shortcut: 'P', hint: 'P — click points, Enter or double-click to close' },
  { id: 'polyline', label: 'Polyline',  Icon: Spline,        shortcut: 'L', hint: 'L — click points, Enter to finish' },
  { id: 'ellipse',  label: 'Ellipse',   Icon: Circle,        shortcut: 'E', hint: 'E — drag bounding box' },
  { id: 'lasso',    label: 'Freehand',  Icon: Lasso,         shortcut: 'F', hint: 'F — hold and drag to trace a curved area, release to close' },
  { id: 'wand',     label: 'Magic wand', Icon: Wand2,        shortcut: 'W', hint: 'W — click a colored area to select it automatically' },
];

export const CUT_TOOL_SHORTCUTS = Object.fromEntries(
  CUT_TOOLS.map((t) => [t.shortcut.toLowerCase(), t.id])
);

// Blur workspace: draw "focus" regions that stay sharp; everything outside
// them is blurred. Polylines are auto-closed into a region when masking.
export const BLUR_TOOLS = [
  { id: 'select',   label: 'Select',    Icon: MousePointer2, shortcut: 'V', hint: 'V — click a region to select, drag to move' },
  { id: 'rect',     label: 'Rectangle', Icon: Square,        shortcut: 'R', hint: 'R — drag corner to corner' },
  { id: 'polygon',  label: 'Polygon',   Icon: Hexagon,       shortcut: 'P', hint: 'P — click points, Enter or double-click to close' },
  { id: 'polyline', label: 'Polyline',  Icon: Spline,        shortcut: 'L', hint: 'L — click points, Enter to finish' },
  { id: 'ellipse',  label: 'Ellipse',   Icon: Circle,        shortcut: 'E', hint: 'E — drag bounding box' },
  { id: 'lasso',    label: 'Freehand',  Icon: Lasso,         shortcut: 'F', hint: 'F — hold and drag to trace a curved area, release to close' },
  { id: 'wand',     label: 'Magic wand', Icon: Wand2,        shortcut: 'W', hint: 'W — click a colored area to select it automatically' },
];

export const BLUR_TOOL_SHORTCUTS = Object.fromEntries(
  BLUR_TOOLS.map((t) => [t.shortcut.toLowerCase(), t.id])
);

export const DEFAULT_PIECE_PREFIX = 'piece';
export const DEFAULT_FOCUS_PREFIX = 'focus';
export const DEFAULT_BLUR_AMOUNT = 12;

// Hotspot categories. The picked category decides how a newly drawn hotspot is
// named — Apartment → "Apt 1", Store → "Store 1", Parking → "Parking 1" — each
// numbered independently.
export const HOTSPOT_CATEGORIES = [
  { id: 'apartment', label: 'Apartment', prefix: 'Apt' },
  { id: 'store',     label: 'Store',     prefix: 'Store' },
  { id: 'parking',   label: 'Parking',   prefix: 'Parking' },
];
export const DEFAULT_HOTSPOT_CATEGORY = 'apartment';

// What this document represents in the master-plan → building → floor flow.
// The level decides what a new hotspot means (and how it's auto-named):
//   project  → the whole complex; hotspots are buildings  → "Building 1, 2…"
//   building → one building;      hotspots are floors     → "Floor 1, 2…"
//   floor    → one floor plan;    hotspots are units      → Apt/Store/Parking
export const PLAN_TYPES = [
  { id: 'project',  label: 'Project',    hint: 'Master plan — draw a hotspot over each building.' },
  { id: 'building', label: 'Building',   hint: 'One building — draw a hotspot over each floor.' },
  { id: 'floor',    label: 'Floor plan', hint: 'One floor — draw apartments, stores, parking.' },
];
export const DEFAULT_PLAN_TYPE = 'floor';
export const PROJECT_PLAN_CATEGORIES = [
  { id: 'building', label: 'Building', prefix: 'Building' },
];
export const BUILDING_PLAN_CATEGORIES = [
  { id: 'floor', label: 'Floor', prefix: 'Floor' },
];

// Sales statuses live in a lucide-free module so the pure SVG exporter can use
// them; re-exported here for the UI's convenience.
export { UNIT_STATUSES, UNIT_STATUS_BY_ID, statusOf } from './lib/status.js';

// Magic-wand color tolerance (max RGB distance from the clicked pixel, 1–120).
export const DEFAULT_WAND_TOLERANCE = 32;

// Blur workspace "Outside" treatment — what happens to everything OUTSIDE the
// focus regions: blur it, fill it with a solid color, or make it transparent.
export const DEFAULT_BLUR_OUTSIDE = 'blur';
export const DEFAULT_BLUR_FILL_COLOR = '#ffffff';

// Blur workspace: an optional colored outline drawn around each sharp focus
// region in the preview AND the exported image. Width is in image pixels so the
// two always match. Width 0 = no outline.
export const DEFAULT_BLUR_STROKE_COLOR = '#38bdf8';
export const DEFAULT_BLUR_STROKE_WIDTH = 0;

export const HOVER_LABEL = { spotlight: 'Spotlight mask', fill: 'Fill swap' };

export const DEFAULT_FILL = '#c4c4c4';
export const DEFAULT_HOVER_FILL = '#d8d8d8';

export const CLOSE_POLYGON_THRESHOLD = 10;
export const MIN_SHAPE_SIZE = 3;
