import { MousePointer2, Square, Hexagon, Spline, Circle, Lasso, Target, Scissors } from 'lucide-react';

export const STORAGE_KEY = 'interactive-image:project';

export const TOOLS = [
  { id: 'select',   label: 'Select',    Icon: MousePointer2, shortcut: 'V', hint: 'V — click shapes to select, drag to move' },
  { id: 'rect',     label: 'Rectangle', Icon: Square,        shortcut: 'R', hint: 'R — drag corner to corner' },
  { id: 'polygon',  label: 'Polygon',   Icon: Hexagon,       shortcut: 'P', hint: 'P — click points, Enter or double-click to close' },
  { id: 'polyline', label: 'Polyline',  Icon: Spline,        shortcut: 'L', hint: 'L — click points, Enter to finish' },
  { id: 'ellipse',  label: 'Ellipse',   Icon: Circle,        shortcut: 'E', hint: 'E — drag bounding box' },
];

export const TOOL_SHORTCUTS = Object.fromEntries(
  TOOLS.map((t) => [t.shortcut.toLowerCase(), t.id])
);

// The two top-level workspaces, shown in the header switcher.
export const WORKSPACES = [
  { id: 'hotspots', label: 'Hotspots', Icon: Target },
  { id: 'cut',      label: 'Cut',      Icon: Scissors },
];

// Cut workspace has its own slim toolset: pick/move pieces, or lasso new ones.
export const CUT_TOOLS = [
  { id: 'select',  label: 'Select', Icon: MousePointer2, shortcut: 'V', hint: 'V — click a piece to select, drag to move' },
  { id: 'polygon', label: 'Lasso',  Icon: Lasso,         shortcut: 'L', hint: 'L — click points around an area, double-click or Enter to close' },
];

export const CUT_TOOL_SHORTCUTS = Object.fromEntries(
  CUT_TOOLS.map((t) => [t.shortcut.toLowerCase(), t.id])
);

export const DEFAULT_PIECE_PREFIX = 'piece';

export const HOVER_LABEL = { spotlight: 'Spotlight mask', fill: 'Fill swap' };

export const DEFAULT_FILL = '#c4c4c4';
export const DEFAULT_HOVER_FILL = '#d8d8d8';

export const CLOSE_POLYGON_THRESHOLD = 10;
export const MIN_SHAPE_SIZE = 3;
