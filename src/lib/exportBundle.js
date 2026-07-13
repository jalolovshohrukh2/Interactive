import JSZip from 'jszip';
import { exportSvg } from './exportSvg.js';
import { cropPieceToCanvas } from './cropPieces.js';
import { renderBlurredCanvas } from './blurExport.js';

// One-click "everything" export. From a single set of hotspot shapes it builds
// a ZIP containing:
//   - interactive.svg       the clickable hotspot overlay (same as the Code tab)
//   - floor-plan-white.png  the whole image with everything OUTSIDE the shapes
//                           painted white (a clean plan showing only the units)
//   - rooms/<name>.png      each shape cropped to its outline on a white bg
//   - highlights/<name>.png the whole plan with that one unit sharp and the
//                           rest blurred (in-context shot per apartment)
// so you draw the apartments once and get the SVG, the room cut-outs, the
// per-unit highlights, and the clean plan from that same geometry.

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const im = new Image();
    // Hosted images (e.g. Vercel Blob) need CORS to be canvas-readable.
    if (!url.startsWith('data:')) im.crossOrigin = 'anonymous';
    im.onload = () => resolve(im);
    im.onerror = () => reject(new Error('Could not load the image.'));
    im.src = url;
  });
}

const canvasToBlob = (canvas, jpeg) =>
  new Promise((resolve) => canvas.toBlob(resolve, jpeg ? 'image/jpeg' : 'image/png', jpeg ? 0.92 : undefined));

const safeName = (name) => (name || 'room').replace(/[\\/:*?"<>|]/g, '_').trim() || 'room';

// Disambiguate duplicate names so files don't overwrite each other in the ZIP.
function uniqueName(base, seen) {
  const n = (seen.get(base) || 0) + 1;
  seen.set(base, n);
  return n === 1 ? base : `${base}_${n}`;
}

const triggerDownload = (blob, filename) => {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
};

export async function downloadBundle({
  imageUrl, imageW, imageH, shapes, glow = 0, building,
  floorShapes, floorOutside = 'color', floorFillColor = '#ffffff',
  floorAmount = 12, floorStroke = 0, floorStrokeColor = '#38bdf8',
  format = 'png', scale = 1, mask = true, bg = 'white', roomPadding = 140,
  highlightBlur = 0, highlightStroke = 0, highlightStrokeColor = '#f3e6c8',
  namePrefix = '', zipName = 'plan-bundle.zip',
} = {}) {
  const visible = (shapes || []).filter((s) => !s.hidden);
  if (!visible.length) return { rooms: 0 };

  const jpeg = format === 'jpeg';
  const ext = jpeg ? '.jpg' : '.png';
  const img = await loadImage(imageUrl);
  const zip = new JSZip();

  // 1. Interactive SVG overlay from the apartments (building + category metadata).
  zip.file('interactive.svg', exportSvg({ width: imageW, height: imageH, shapes: visible, glow, building }));

  // 2. Clean floor plan from the FLOOR-AREA selection (the Blur regions) — NOT
  //    the apartments. Everything outside the floor outline gets the chosen
  //    treatment (white by default). If no floor area was drawn, fall back to
  //    the original image so the bundle always has a plan.
  const floorVisible = (floorShapes || []).filter((s) => !s.hidden);
  const planCanvas = floorVisible.length
    ? renderBlurredCanvas(img, floorVisible, imageW, imageH, {
        amount: floorAmount, scale, jpeg,
        outside: floorOutside, fillColor: floorFillColor,
        stroke: floorStroke, strokeColor: floorStrokeColor,
      })
    : renderBlurredCanvas(img, [], imageW, imageH, { amount: 0, scale, jpeg, outside: 'blur' });
  const planBlob = await canvasToBlob(planCanvas, jpeg);
  if (planBlob) zip.file('floor-plan' + ext, planBlob);

  // 3. One cropped image per unit, grouped into folders by category.
  const seen = new Map();
  let rooms = 0;
  for (const shape of visible) {
    // roomPadding adds a uniform white margin around each unit so the crop
    // isn't flush to the apartment edge (the margin is white because bg='white').
    const canvas = cropPieceToCanvas(img, shape, imageW, imageH, { mask, padding: roomPadding, scale, jpeg, bg });
    if (!canvas) continue;
    const blob = await canvasToBlob(canvas, jpeg);
    if (!blob) continue;
    const cat = shape.category || 'other';
    // Filename = "<Building B Floor 10-20> - <unit's own name>", so each image
    // carries the block/floor context. namePrefix is optional (blank → unit only).
    const unit = safeName(shape.className || shape.name);
    const labeled = namePrefix ? `${safeName(namePrefix)} - ${unit}` : unit;
    const name = uniqueName(`${cat}/${labeled}`, seen);
    zip.file('rooms/' + name + ext, blob);
    rooms++;
  }

  // 3b. One "highlight" per unit: the WHOLE plan with just that unit kept sharp
  //     and everything else blurred (the Blur workspace's per-region export, but
  //     driven by the hotspot shapes). Gives an in-context shot of each apartment.
  const hAmount = highlightBlur > 0 ? highlightBlur : (floorAmount > 0 ? floorAmount : 14);
  const seenH = new Map();
  let highlights = 0;
  for (const shape of visible) {
    const canvas = renderBlurredCanvas(img, [shape], imageW, imageH, {
      amount: hAmount, scale, jpeg, outside: 'blur',
      // A soft luminous outline marks the border between the sharp unit and blur.
      stroke: highlightStroke, strokeColor: highlightStrokeColor, softStroke: true,
    });
    const blob = await canvasToBlob(canvas, jpeg);
    if (!blob) continue;
    const cat = shape.category || 'other';
    const unit = safeName(shape.className || shape.name);
    const labeled = namePrefix ? `${safeName(namePrefix)} - ${unit}` : unit;
    const name = uniqueName(`${cat}/${labeled}`, seenH);
    zip.file('highlights/' + name + ext, blob);
    highlights++;
  }

  // 4. Machine-readable manifest + a human-readable summary, so the building,
  //    floors, and each unit's category travel with the download.
  const b = building || {};
  const manifest = {
    planType: (b.planType || '').trim(),
    building: (b.name || '').trim(),
    floorFrom: String(b.floorFrom ?? '').trim(),
    floorTo: String(b.floorTo ?? '').trim(),
    hotspots: visible.map((s) => ({
      name: s.className || '', category: s.category || '',
      status: s.status && s.status !== 'none' ? s.status : '', price: s.price || '',
      link: s.link || '', label: s.label || '',
    })),
  };
  zip.file('manifest.json', JSON.stringify(manifest, null, 2));
  zip.file('info.txt', buildInfoText(manifest, { rooms, highlights }));

  const out = await zip.generateAsync({ type: 'blob' });
  triggerDownload(out, zipName);
  return { rooms, highlights };
}

// Human-readable summary of the bundle contents, grouped by category.
function buildInfoText(m, counts = {}) {
  const floors = m.floorFrom || m.floorTo ? `${m.floorFrom || '?'}-${m.floorTo || '?'}` : '(not set)';
  const byCat = {};
  for (const h of m.hotspots) {
    const c = h.category || 'other';
    (byCat[c] = byCat[c] || []).push(h.name || '(unnamed)');
  }
  const lines = [
    `Plan level: ${m.planType || 'floor'}`,
    `${m.planType === 'project' ? 'Project' : 'Building'}: ${m.building || '(unnamed)'}`,
    // Floor range only means something on a floor plan (elsewhere floors ARE the hotspots).
    ...(m.planType === 'floor' || m.floorFrom || m.floorTo ? [`Floors covered: ${floors}`] : []),
    `Units: ${m.hotspots.length}`,
    '',
    'Files:',
    '  interactive.svg  - clickable hotspot overlay (hover effects baked in)',
    '  floor-plan.*     - clean plan (everything outside the floor area filled)',
    `  rooms/           - ${counts.rooms ?? 0} per-unit crop(s), one image per apartment`,
    `  highlights/      - ${counts.highlights ?? 0} in-context shot(s): that unit sharp, rest of the plan blurred`,
    '  manifest.json    - machine-readable list of every unit',
    '',
  ];
  for (const c of Object.keys(byCat)) {
    lines.push(`${c} (${byCat[c].length}): ${byCat[c].join(', ')}`);
  }
  return lines.join('\n') + '\n';
}
