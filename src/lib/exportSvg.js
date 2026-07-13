// Pure SVG export.
// Matches the target format: <defs><style> with per-class rules,
// then per-shape: shape element + (if spotlight) immediate <path> sibling
// that darkens everything EXCEPT the shape on hover.
import { statusOf } from './status.js';
import { hasCurves, polygonPathD } from './pathGeom.js';

const r2 = (n) => Math.round(n * 100) / 100;

const escapeClass = (s) => s.trim().replace(/[^a-zA-Z0-9_-]/g, '_');

// Escape text/attribute values destined for markup (labels, hrefs).
const escapeXml = (s) =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

const titleTag = (shape) => {
  const st = statusOf(shape);
  if (st) {
    // Sales tooltip: unit name, status, and price/note when present.
    const parts = [shape.label || shape.className, st.label, shape.price].filter(Boolean);
    return parts.length ? `<title>${escapeXml(parts.join(' · '))}</title>` : '';
  }
  return shape.label ? `<title>${escapeXml(shape.label)}</title>` : '';
};

function polygonPointsAttr(points) {
  return points.map(([x, y]) => `${r2(x)} ${r2(y)}`).join(' ');
}

function polygonAsPathSubpath(points) {
  if (!points.length) return '';
  const [x0, y0] = points[0];
  let d = `M${r2(x0)},${r2(y0)}`;
  for (let i = 1; i < points.length; i++) {
    d += `L${r2(points[i][0])},${r2(points[i][1])}`;
  }
  return d + 'Z';
}

function rectAsPathSubpath(x, y, w, h) {
  return `M${r2(x)},${r2(y)}h${r2(w)}v${r2(h)}h${r2(-w)}Z`;
}

function ellipseAsPathSubpath(cx, cy, rx, ry) {
  // Two arc segments forming a full ellipse.
  return (
    `M${r2(cx + rx)},${r2(cy)}` +
    `A${r2(rx)},${r2(ry)} 0 1,0 ${r2(cx - rx)},${r2(cy)}` +
    `A${r2(rx)},${r2(ry)} 0 1,0 ${r2(cx + rx)},${r2(cy)}Z`
  );
}

function shapeElement(shape) {
  const cls = escapeClass(shape.className);
  const st = statusOf(shape);
  const dataAttrs =
    (shape.category ? ` data-category="${escapeXml(shape.category)}"` : '') +
    (st ? ` data-status="${escapeXml(shape.status)}"` : '') +
    (shape.price ? ` data-price="${escapeXml(shape.price)}"` : '');
  const t = titleTag(shape);
  // With a title we need an open/close element so <title> can be a child;
  // without one we keep the compact self-closing form.
  const el = (tag, attrs) => (t ? `<${tag} ${attrs}>${t}</${tag}>` : `<${tag} ${attrs}/>`);
  const curved = hasCurves(shape);
  switch (shape.type) {
    case 'polygon':
      return curved
        ? el('path', `class="${cls}"${dataAttrs} d="${polygonPathD(shape.points, shape.curves, true)}"`)
        : el('polygon', `class="${cls}"${dataAttrs} points="${polygonPointsAttr(shape.points)}"`);
    case 'rect':
      return el('rect', `class="${cls}"${dataAttrs} x="${r2(shape.x)}" y="${r2(shape.y)}" width="${r2(shape.width)}" height="${r2(shape.height)}"`);
    case 'polyline':
      return curved
        ? el('path', `class="${cls}"${dataAttrs} d="${polygonPathD(shape.points, shape.curves, false)}" fill="none" stroke="currentColor" stroke-width="2"`)
        : el('polyline', `class="${cls}"${dataAttrs} points="${polygonPointsAttr(shape.points)}" fill="none" stroke="currentColor" stroke-width="2"`);
    case 'ellipse':
      return el('ellipse', `class="${cls}"${dataAttrs} cx="${r2(shape.cx)}" cy="${r2(shape.cy)}" rx="${r2(shape.rx)}" ry="${r2(shape.ry)}"`);
    case 'circle':
      return el('circle', `class="${cls}"${dataAttrs} cx="${r2(shape.cx)}" cy="${r2(shape.cy)}" r="${r2(shape.r)}"`);
    default:
      return '';
  }
}

function bgPathFor(shape, W, H) {
  // The CCW outer rectangle + inner subpath. fill-rule="evenodd" guarantees
  // the inner shape punches through regardless of winding.
  const outer = `M0,0v${r2(H)}h${r2(W)}V0H0Z`;
  let inner = '';
  switch (shape.type) {
    case 'polygon':
      inner = hasCurves(shape) ? polygonPathD(shape.points, shape.curves, true) : polygonAsPathSubpath(shape.points);
      break;
    case 'rect':
      inner = rectAsPathSubpath(shape.x, shape.y, shape.width, shape.height);
      break;
    case 'ellipse':
      inner = ellipseAsPathSubpath(shape.cx, shape.cy, shape.rx, shape.ry);
      break;
    case 'circle':
      inner = ellipseAsPathSubpath(shape.cx, shape.cy, shape.r, shape.r);
      break;
    default:
      return '';
  }
  const bgCls = escapeClass(shape.className) + 'bg';
  return `<path class="${bgCls}" d="${outer} ${inner}" fill-rule="evenodd"/>`;
}

function buildGlowRules(spotlight, fill, glow) {
  if (!(glow > 0)) return [];
  // Subtle gray hover outline. Alpha scales with the slider; 0 = no outline,
  // 1 = "almost not visible but there if you look". No animation, no halo —
  // just a hint that the shape is interactive.
  const alpha = (glow * 0.35).toFixed(2);

  const allHover = [...spotlight.keys(), ...fill.keys()].map((c) => `.${c}:hover`).join(', ');
  const rules = [
    `      ${allHover} {\n        stroke: rgba(160, 160, 160, ${alpha});\n        stroke-width: 1;\n      }`,
  ];
  // Spotlight shapes are opacity: 0 by default. Force the element visible on
  // hover (with the fill kept transparent) so the stroke can render.
  if (spotlight.size) {
    const spotHover = [...spotlight.keys()].map((c) => `.${c}:hover`).join(', ');
    rules.push(`      ${spotHover} { opacity: 1; fill-opacity: 0; }`);
  }
  return rules;
}

function buildStyles(shapes, glow = 0) {
  // Per-class info — each class can have its own opacity / transition
  // because the user can set those per shape.
  const spotlight = new Map(); // cls -> { opacity, transition }
  const fill = new Map();      // cls -> { fill, hoverFill, opacity, transition }

  for (const s of shapes) {
    const cls = escapeClass(s.className);
    if (!cls) continue;
    const opacity = s.opacity ?? 0.7;
    const transition = s.transition ?? 0.2;
    const st = statusOf(s);
    if (st) {
      // A sales status colors the unit as a translucent fill (alpha baked into
      // the color, so opacity stays 1) regardless of its own hover mode.
      fill.set(cls, { fill: st.fill, hoverFill: st.hoverFill, opacity: 1, transition });
    } else if (s.hover === 'spotlight') {
      spotlight.set(cls, { opacity, transition });
    } else {
      fill.set(cls, {
        fill: s.fill || '#c4c4c4',
        hoverFill: s.hoverFill || '#d8d8d8',
        opacity, transition,
      });
    }
  }

  const rules = [];

  for (const [cls, info] of fill) {
    const opacityRule = info.opacity < 1 ? `\n        opacity: ${r2(info.opacity)};` : '';
    rules.push(
      `      .${cls} {\n        fill: ${info.fill};${opacityRule}\n        cursor: pointer;\n        transition: fill ${r2(info.transition)}s;\n      }`,
      `      .${cls}:hover {\n        fill: ${info.hoverFill};\n      }`
    );
  }

  if (spotlight.size) {
    const clickList = [...spotlight.keys()].map((c) => `.${c}`).join(', ');
    const bgList = [...spotlight.keys()].map((c) => `.${c}bg`).join(', ');
    rules.push(
      `      ${clickList} {\n        fill: black;\n        opacity: 0;\n        cursor: pointer;\n      }`,
      `      ${bgList} {\n        fill: black;\n        opacity: 0;\n        pointer-events: none;\n      }`
    );
    // Per-class transition + hover opacity (so each shape can have its own).
    for (const [cls, info] of spotlight) {
      rules.push(
        `      .${cls}bg { transition: opacity ${r2(info.transition)}s; }`,
        `      .${cls}:hover + .${cls}bg { opacity: ${r2(info.opacity)}; }`
      );
    }
  }

  rules.push(...buildGlowRules(spotlight, fill, glow));

  return rules.join('\n');
}

export function exportSvg({ width, height, shapes, glow = 0, building }) {
  const W = width || 1661;
  const H = height || 1080;
  const styleBlock = buildStyles(shapes, glow);

  // Descriptive metadata: building + floor range as attributes on the root, plus
  // a JSON manifest of every hotspot (name, category, link, label) so the data
  // travels with the file and stays machine-readable.
  const b = building || {};
  const bType = (b.planType || '').trim();
  const bName = (b.name || '').trim();
  const bFrom = String(b.floorFrom ?? '').trim();
  const bTo = String(b.floorTo ?? '').trim();
  const rootAttrs = [
    bType && `data-plan-type="${escapeXml(bType)}"`,
    // Project-level files name the complex; building/floor files name the building.
    bName && (bType === 'project' ? `data-project="${escapeXml(bName)}"` : `data-building="${escapeXml(bName)}"`),
    bFrom && `data-floor-from="${escapeXml(bFrom)}"`,
    bTo && `data-floor-to="${escapeXml(bTo)}"`,
  ].filter(Boolean).join(' ');
  const manifest = {
    planType: bType,
    building: bName,
    floorFrom: bFrom,
    floorTo: bTo,
    hotspots: shapes.map((s) => ({
      name: s.className || '',
      category: s.category || '',
      status: s.status && s.status !== 'none' ? s.status : '',
      price: s.price || '',
      link: s.link || '',
      label: s.label || '',
    })),
  };
  const metadata = `<metadata id="floorplan-metadata">${escapeXml(JSON.stringify(manifest))}</metadata>`;

  const body = shapes
    .map((s) => {
      const main = shapeElement(s);
      let el = (s.hover === 'spotlight' && !statusOf(s) && s.type !== 'polyline')
        ? main + '\n  ' + bgPathFor(s, W, H)
        : main;
      // A link turns the hotspot into a navigable <a>. Opens in a new tab.
      if (s.link) {
        el = `<a href="${escapeXml(s.link)}" target="_blank" rel="noopener noreferrer">${el}</a>`;
      }
      return el;
    })
    .join('\n  ');

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg id="Layer_1" xmlns="http://www.w3.org/2000/svg" version="1.1" viewBox="0 0 ${W} ${H}"${rootAttrs ? ' ' + rootAttrs : ''}>
  <defs>
    <style>
${styleBlock}
    </style>
  </defs>
  ${metadata}
  ${body}
</svg>
`;
}
