// Parse a previously-exported (or hand-authored) SVG matching our format
// back into an editable project. Returns { width, height, shapes }.
//
// Detection:
//   - Shape elements: <rect>, <polygon>, <ellipse>, <polyline> — but a path
//     element with a class ending in "bg" is the spotlight-mask sibling and
//     is skipped.
//   - Hover style is inferred from the <style> rules:
//       fill:black; opacity:0  ⇒ spotlight pattern
//       any other fill         ⇒ fill-swap pattern (record fill + :hover fill)
//
// The parser is permissive — unknown elements or unparsable rules are skipped
// rather than throwing, so a slightly-mangled export still imports usefully.
export function importSvg(svgText) {
  const dom = new DOMParser().parseFromString(svgText, 'image/svg+xml');
  if (dom.querySelector('parsererror')) throw new Error('Invalid SVG');
  const svg = dom.querySelector('svg');
  if (!svg) throw new Error('No <svg> root');

  const vb = svg.getAttribute('viewBox');
  let width = 1000, height = 1000;
  if (vb) {
    const parts = vb.split(/[\s,]+/).map(Number);
    if (parts.length >= 4) {
      width = parts[2];
      height = parts[3];
    }
  } else {
    width = Number(svg.getAttribute('width')) || width;
    height = Number(svg.getAttribute('height')) || height;
  }

  const classInfo = parseStyleClasses(svg);

  const shapes = [];
  const elements = svg.querySelectorAll('rect, polygon, ellipse, polyline, circle');
  for (const el of elements) {
    const cls = (el.getAttribute('class') || '').trim();
    if (!cls) continue;
    if (cls.endsWith('bg')) continue; // spotlight mask sibling
    const info = classInfo.get(cls) || {};
    const base = {
      className: cls,
      hover: info.hover || 'fill',
      fill: info.fill || '#c4c4c4',
      hoverFill: info.hoverFill || '#d8d8d8',
    };
    const id = 'sh_' + Math.random().toString(36).slice(2, 10);
    let shape = null;
    if (el.tagName === 'rect') {
      shape = {
        id, type: 'rect',
        x: numAttr(el, 'x'), y: numAttr(el, 'y'),
        width: numAttr(el, 'width'), height: numAttr(el, 'height'),
        ...base,
      };
    } else if (el.tagName === 'polygon' || el.tagName === 'polyline') {
      const points = parsePoints(el.getAttribute('points'));
      if (points.length >= 2) {
        shape = { id, type: el.tagName, points, ...base };
      }
    } else if (el.tagName === 'ellipse') {
      shape = {
        id, type: 'ellipse',
        cx: numAttr(el, 'cx'), cy: numAttr(el, 'cy'),
        rx: numAttr(el, 'rx'), ry: numAttr(el, 'ry'),
        ...base,
      };
    } else if (el.tagName === 'circle') {
      // Normalize circle → ellipse for our editor.
      const r = numAttr(el, 'r');
      shape = {
        id, type: 'ellipse',
        cx: numAttr(el, 'cx'), cy: numAttr(el, 'cy'),
        rx: r, ry: r,
        ...base,
      };
    }
    if (shape) shapes.push(shape);
  }

  return { width, height, shapes };
}

function numAttr(el, name) { return Number(el.getAttribute(name)) || 0; }

function parsePoints(str) {
  if (!str) return [];
  const nums = str.trim().split(/[\s,]+/).map(Number);
  const pts = [];
  for (let i = 0; i + 1 < nums.length; i += 2) {
    if (!Number.isFinite(nums[i]) || !Number.isFinite(nums[i + 1])) continue;
    pts.push([nums[i], nums[i + 1]]);
  }
  return pts;
}

function parseStyleClasses(svg) {
  const map = new Map();
  for (const styleEl of svg.querySelectorAll('style')) {
    const cssText = stripComments(styleEl.textContent || '');
    for (const rule of parseRules(cssText)) {
      const decls = parseDecls(rule.body);
      for (const sel of rule.selector.split(',').map((s) => s.trim())) {
        const m = sel.match(/^\.([a-zA-Z0-9_-]+)(:hover)?/);
        if (!m) continue;
        const cls = m[1];
        const isHover = !!m[2];
        if (!map.has(cls)) map.set(cls, {});
        const info = map.get(cls);
        if (isHover) {
          if (decls.fill) info.hoverFill = decls.fill;
        } else {
          // Spotlight: black fill with opacity 0 + pointer cursor.
          if (decls.fill === 'black' && decls.opacity === '0' && decls.cursor === 'pointer') {
            info.hover = 'spotlight';
          } else if (decls.fill && decls.fill !== 'black') {
            info.hover = 'fill';
            info.fill = decls.fill;
          }
        }
      }
    }
  }
  return map;
}

function stripComments(s) { return s.replace(/\/\*[\s\S]*?\*\//g, ''); }

function parseRules(text) {
  const rules = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m;
  while ((m = re.exec(text))) {
    rules.push({ selector: m[1].trim(), body: m[2] });
  }
  return rules;
}

function parseDecls(body) {
  const out = {};
  for (const part of body.split(';')) {
    const i = part.indexOf(':');
    if (i < 0) continue;
    const k = part.slice(0, i).trim().toLowerCase();
    const v = part.slice(i + 1).trim();
    if (k) out[k] = v;
  }
  return out;
}
