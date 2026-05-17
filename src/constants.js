import { MousePointer2, Square, Hexagon, Spline, Circle } from 'lucide-react';

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

export const HOVER_LABEL = { spotlight: 'Spotlight mask', fill: 'Fill swap' };

export const DEFAULT_FILL = '#c4c4c4';
export const DEFAULT_HOVER_FILL = '#d8d8d8';

export const CLOSE_POLYGON_THRESHOLD = 10;
export const MIN_SHAPE_SIZE = 3;
