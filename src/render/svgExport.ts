// src/render/svgExport.ts
//
// Transforms a cloned SVG element into a clean, Inkscape-compatible export file.
// No React, no Tauri, no component state — pure DOM manipulation + serialization.
//
// The component wrapper (exportSVG in tattingindex) is responsible for:
//   - Getting the SVG from canvasRef
//   - Calculating element bounds (needs getPicotPosition which closes over component state)
//   - Calling showSaveSvgDialog + writeTextToFile (Tauri side effects)

// Exported so tattingindex can use the same colors for canvas rendering.
// TODO: move to a shared constants file when more consumers exist.
export const ORDER_GROUP_COLORS: [string, string][] = [
  ['#FFD700', '#000000'], // gold        (ungrouped — legacy)
  ['#38BDF8', '#003366'], // sky blue    (Round 1)
  ['#F472B6', '#5C0030'], // pink        (Round 2)
  ['#4ADE80', '#004420'], // green       (Round 3)
  ['#FB923C', '#5C1A00'], // orange      (Round 4)
  ['#A78BFA', '#2D0060'], // violet      (Round 5)
  ['#F87171', '#5C0000'], // red         (Round 6)
  ['#34D399', '#003322'], // teal        (Round 7)
  ['#FACC15', '#4D3000'], // amber       (Round 8)
  ['#818CF8', '#1E1B5C'], // indigo      (Round 9)
  ['#F9A8D4', '#5C002B'], // rose        (Round 10)
  ['#2DD4BF', '#003D36'], // cyan-teal   (Round 11)
  ['#C084FC', '#3B0764'], // purple      (Round 12)
  ['#86EFAC', '#003D1A'], // mint        (Round 13)
  ['#FCA5A5', '#5C0000'], // salmon      (Round 14)
  ['#67E8F9', '#003344'], // light cyan  (Round 15)
  ['#FCD34D', '#4D3000'], // yellow      (Round 16)
];

export interface ExportBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface PrepareSvgParams {
  bounds: ExportBounds;
  elements: any[];
  orderGroups: any[];
  patternNotes: string;
  dsWidth: number;
}

// Mutates clonedSvg in-place, then serializes and returns the SVG string.
// clonedSvg must already be a deep clone — this function removes UI-only nodes,
// reorganizes into Inkscape layers, sets the viewBox, and appends notes.
export function prepareSvgForExport(
  clonedSvg: SVGSVGElement,
  params: PrepareSvgParams,
): string {
  const { bounds, elements, orderGroups, patternNotes, dsWidth } = params;

  // ── Step 1: Strip all UI-only elements ───────────────────────────────────
  clonedSvg.querySelectorAll('[fill="url(#grid)"]').forEach(n => n.remove());
  clonedSvg.querySelectorAll('[stroke="#3B82F6"]').forEach(n => n.remove());
  clonedSvg.querySelectorAll('[data-ui]').forEach(n => n.remove());
  clonedSvg.querySelectorAll('[stroke="#888"]').forEach(n => n.remove());
  // Remove glow filters (invalid-notation red, search pink — not for export)
  clonedSvg.querySelectorAll('[filter]').forEach(n => n.removeAttribute('filter'));

  // ── Step 1b: Reorganize into Inkscape-compatible layers ──────────────────
  const ns = 'http://www.w3.org/2000/svg';
  const inkNs = 'http://www.inkscape.org/namespaces/inkscape';

  const makeLayer = (id: string, label: string) => {
    const g = document.createElementNS(ns, 'g');
    g.setAttribute('id', id);
    g.setAttributeNS(inkNs, 'inkscape:groupmode', 'layer');
    g.setAttributeNS(inkNs, 'inkscape:label', label);
    return g;
  };

  const layerDesign   = makeLayer('layer-design',   'Design');
  const layerNotation = makeLayer('layer-notation',  'Notation');
  const layerOrder    = makeLayer('layer-order',     'Order Numbers');
  const layerGroups   = makeLayer('layer-groups',    'Group Markers');

  // Move data-layer marked nodes into their respective layers
  const mg = Array.from(clonedSvg.children).find(
    c => c.tagName.toLowerCase() === 'g'
  ) as SVGGElement | undefined;

  if (mg) {
    Array.from(mg.querySelectorAll('[data-layer]')).forEach(node => {
      const layer = node.getAttribute('data-layer');
      node.removeAttribute('data-layer');
      if (layer === 'notation')    layerNotation.appendChild(node);
      else if (layer === 'order')  layerOrder.appendChild(node);
      else if (layer === 'groups') layerGroups.appendChild(node);
    });

    while (mg.firstChild) layerDesign.appendChild(mg.firstChild);
    mg.appendChild(layerDesign);
    mg.appendChild(layerNotation);
    mg.appendChild(layerOrder);
    mg.appendChild(layerGroups);
  }

  clonedSvg.setAttribute('xmlns:inkscape', inkNs);
  clonedSvg.style.backgroundColor = 'white';
  clonedSvg.style.userSelect = '';

  // Remove camera transform — viewBox handles positioning instead
  const mainGroup = Array.from(clonedSvg.children).find(
    el => el.tagName.toLowerCase() === 'g'
  ) as SVGGElement | undefined;
  if (mainGroup) mainGroup.removeAttribute('transform');

  // ── Step 2: Set viewBox to content bounds + padding ──────────────────────
  const padding = 30;
  const vMinX = bounds.minX - padding;
  const vMinY = bounds.minY - padding;
  const vMaxX = bounds.maxX + padding;
  const vMaxY = bounds.maxY + padding;
  const width  = vMaxX - vMinX;
  const height = vMaxY - vMinY;

  clonedSvg.setAttribute('viewBox', `${vMinX} ${vMinY} ${width} ${height}`);
  clonedSvg.setAttribute('width',  String(Math.round(width)));
  clonedSvg.setAttribute('height', String(Math.round(height)));

  // ── Step 3: Append pattern notes below design ─────────────────────────────
  if (patternNotes && patternNotes.trim()) {
    const noteLines = patternNotes.trim().split('\n');
    const lineHeight = 20;
    const notesY = vMaxY + 10;
    const notesHeight = noteLines.length * lineHeight + 40;
    const newHeight = height + notesHeight;

    clonedSvg.setAttribute('height', String(Math.round(newHeight)));
    clonedSvg.setAttribute('viewBox', `${vMinX} ${vMinY} ${width} ${newHeight}`);

    const notesGroup = document.createElementNS(ns, 'g');

    const header = document.createElementNS(ns, 'text');
    header.setAttribute('x', String(vMinX + padding));
    header.setAttribute('y', String(notesY + 20));
    header.setAttribute('font-family', 'sans-serif');
    header.setAttribute('font-size', '14');
    header.setAttribute('font-weight', 'bold');
    header.setAttribute('fill', '#333');
    header.textContent = 'Notes:';
    notesGroup.appendChild(header);

    noteLines.forEach((line, i) => {
      const t = document.createElementNS(ns, 'text');
      t.setAttribute('x', String(vMinX + padding));
      t.setAttribute('y', String(notesY + 44 + i * lineHeight));
      t.setAttribute('font-family', 'sans-serif');
      t.setAttribute('font-size', '13');
      t.setAttribute('fill', '#333');
      t.textContent = line || ' ';
      notesGroup.appendChild(t);
    });

    clonedSvg.appendChild(notesGroup);
  }

  // ── Step 4: Order number layer ────────────────────────────────────────────
  // Only run if Step 1b didn't already extract data-layer="order" nodes from
  // the DOM (which happens when showUnnumbered is active). Avoids duplicates.
  const numberedEls = elements.filter(
    el => el.orderNumber != null && String(el.orderNumber).trim() !== '' && el.center
  );
  if (numberedEls.length > 0 && layerOrder.childNodes.length === 0) {
    const fontSize = Math.max(8, Math.round(width / 60));
    numberedEls.forEach(el => {
      const groupIndex = el.orderGroup
        ? orderGroups.findIndex(g => g.id === el.orderGroup)
        : -1;
      const [fillColor, strokeColor] = ORDER_GROUP_COLORS[
        groupIndex >= 0 ? (groupIndex + 1) % ORDER_GROUP_COLORS.length : 0
      ];
      const bg = document.createElementNS(ns, 'text');
      bg.setAttribute('x', String(el.center.x));
      bg.setAttribute('y', String(el.center.y));
      bg.setAttribute('text-anchor', 'middle');
      bg.setAttribute('dominant-baseline', 'middle');
      bg.setAttribute('font-family', 'sans-serif');
      bg.setAttribute('font-size', String(fontSize));
      bg.setAttribute('font-weight', 'bold');
      bg.setAttribute('stroke', strokeColor);
      bg.setAttribute('stroke-width', '3');
      bg.setAttribute('paint-order', 'stroke');
      bg.setAttribute('fill', fillColor);
      bg.textContent = String(el.orderNumber);
      layerOrder.appendChild(bg);
    });
  }

  // ── Serialize ─────────────────────────────────────────────────────────────
  const serializer = new XMLSerializer();
  return '<?xml version="1.0" encoding="UTF-8"?>\n' +
    serializer.serializeToString(clonedSvg);
}
