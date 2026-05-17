// Pure SVG export.
// Matches the target format: <defs><style> with per-class rules,
// then per-shape: shape element + (if spotlight) immediate <path> sibling
// that darkens everything EXCEPT the shape on hover.

const r2 = (n) => Math.round(n * 100) / 100;

const escapeClass = (s) => s.trim().replace(/[^a-zA-Z0-9_-]/g, '_');

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
  switch (shape.type) {
    case 'polygon':
      return `<polygon class="${cls}" points="${polygonPointsAttr(shape.points)}"/>`;
    case 'rect':
      return `<rect class="${cls}" x="${r2(shape.x)}" y="${r2(shape.y)}" width="${r2(shape.width)}" height="${r2(shape.height)}"/>`;
    case 'polyline':
      return `<polyline class="${cls}" points="${polygonPointsAttr(shape.points)}" fill="none" stroke="currentColor" stroke-width="2"/>`;
    case 'ellipse':
      return `<ellipse class="${cls}" cx="${r2(shape.cx)}" cy="${r2(shape.cy)}" rx="${r2(shape.rx)}" ry="${r2(shape.ry)}"/>`;
    case 'circle':
      return `<circle class="${cls}" cx="${r2(shape.cx)}" cy="${r2(shape.cy)}" r="${r2(shape.r)}"/>`;
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
      inner = polygonAsPathSubpath(shape.points);
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
  // Animation speed scales with glow strength so the editor preview matches.
  const duration = Math.max(0.4, 2.5 - glow * 1.7).toFixed(2);
  const strokeW = (1 + glow * 1.5).toFixed(2);
  const haloR = (2 + glow * 5).toFixed(1);
  const haloAlpha = (glow * 0.7).toFixed(2);
  const dashOn = (6).toFixed(0);
  const dashOff = (4).toFixed(0);

  const allHover = [...spotlight.keys(), ...fill.keys()].map((c) => `.${c}:hover`).join(', ');
  const rules = [
    `      @keyframes ii-march { to { stroke-dashoffset: -10; } }`,
    `      ${allHover} {\n        stroke: #a855f7;\n        stroke-width: ${strokeW};\n        stroke-dasharray: ${dashOn} ${dashOff};\n        animation: ii-march ${duration}s linear infinite;\n        filter: drop-shadow(0 0 ${haloR}px rgba(168, 85, 247, ${haloAlpha}));\n      }`,
  ];
  // Spotlight shapes are opacity: 0 by default. Force the element visible on
  // hover (with the fill kept transparent) so the stroke can render.
  if (spotlight.size) {
    const spotHover = [...spotlight.keys()].map((c) => `.${c}:hover`).join(', ');
    rules.push(
      `      ${spotHover} { opacity: 1; fill-opacity: 0; }`
    );
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
    if (s.hover === 'spotlight') {
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

export function exportSvg({ width, height, shapes, glow = 0 }) {
  const W = width || 1661;
  const H = height || 1080;
  const styleBlock = buildStyles(shapes, glow);

  const body = shapes
    .map((s) => {
      const main = shapeElement(s);
      if (s.hover === 'spotlight' && s.type !== 'polyline') {
        return main + '\n  ' + bgPathFor(s, W, H);
      }
      return main;
    })
    .join('\n  ');

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg id="Layer_1" xmlns="http://www.w3.org/2000/svg" version="1.1" viewBox="0 0 ${W} ${H}">
  <defs>
    <style>
${styleBlock}
    </style>
  </defs>
  ${body}
</svg>
`;
}
