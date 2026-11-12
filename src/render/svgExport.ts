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
  rounds: any[];
  patternNotes: string;
  dsWidth: number;
  /** Round badge colours from the theme (session 59); default ORDER_GROUP_COLORS. */
  roundColors?: [string, string][];
}

// Mutates clonedSvg in-place, then serializes and returns the SVG string.
// clonedSvg must already be a deep clone — this function removes UI-only nodes,
// reorganizes into Inkscape layers, sets the viewBox, and appends notes.
export function prepareSvgForExport(
  clonedSvg: SVGSVGElement,
  params: PrepareSvgParams,
): string {
  const { bounds, elements, rounds, patternNotes, dsWidth } = params;
  const roundPalette = params.roundColors ?? ORDER_GROUP_COLORS;

  // Legacy-read shim (session 43 naming-collision fix): elements may still carry the
  // old `orderGroup` field if this function is ever called with data that bypassed the
  // app's normal load path. Reads go through this helper.
  const getRoundId = (el: any) => el?.roundId ?? el?.orderGroup;

  // ── Step 1: Strip all UI-only elements ───────────────────────────────────
  clonedSvg.querySelectorAll('[fill="url(#grid)"]').forEach(n => n.remove());
  clonedSvg.querySelectorAll('[stroke="#3B82F6"]').forEach(n => n.remove());
  clonedSvg.querySelectorAll('[data-ui]').forEach(n => n.remove());
  clonedSvg.querySelectorAll('[stroke="#888"]').forEach(n => n.remove());
  // Session 59: those two colours are themeable now, so the selection
  // outlines and Path Edit guides also carry data-ui (removed above); the
  // colour matches stay as a backstop for the default theme.
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

  // Session 61: join lines (with their beads / centre dots) in their own
  // layer, placed UNDER Design — same stacking as on the canvas.
  const layerJoins    = makeLayer('layer-joins',    'Joins');
  const layerDesign   = makeLayer('layer-design',   'Design');
  const layerNotation = makeLayer('layer-notation',  'Notation');
  const layerOrder    = makeLayer('layer-order',     'Order Numbers');
  const layerGroups   = makeLayer('layer-groups',    'Group Markers');

  // Move data-layer marked nodes into their respective layers
  const mg = Array.from(clonedSvg.children).find(
    c => c.tagName.toLowerCase() === 'g'
  ) as SVGGElement | undefined;

  // ── Rounds as layers (session 63) ─────────────────────────────────────────
  // When the pattern's elements sit in two or more rounds, Design, Notation
  // and Order Numbers each get one SUB-layer per round (named like the
  // round, in round order — Round 1 at the bottom). An element in no round
  // goes with the first round (user's decision). With one round or none the
  // file is laid out exactly as before.
  // How a node's round is known: the canvas tags every element's group
  // with data-round (its round id); the baked realistic pieces carry
  // data-el (the element's place in `elements`).
  const roundIndexOfId = (id: any): number => {
    const i = id ? rounds.findIndex(r => r.id === id) : -1;
    return i >= 0 ? i : 0;
  };
  const roundIndexOfElement = (el: any): number => roundIndexOfId(getRoundId(el));
  const roundIndexOfNode = (node: Element): number => {
    const tagged = node.closest('[data-round],[data-el]');
    if (!tagged) return 0;
    if (tagged.hasAttribute('data-el')) {
      return roundIndexOfElement(elements[Number(tagged.getAttribute('data-el'))]);
    }
    return roundIndexOfId(tagged.getAttribute('data-round'));
  };
  const splitByRound = rounds.length >= 2
    && new Set(elements.map(roundIndexOfElement)).size >= 2;
  // parent layer → (round index → its sub-layer), made on first use
  const roundSubLayers = new Map<Element, Map<number, SVGGElement>>();
  const layerFor = (parent: SVGGElement, key: string, roundIndex: number): SVGGElement => {
    if (!splitByRound) return parent;
    let byRound = roundSubLayers.get(parent);
    if (!byRound) { byRound = new Map(); roundSubLayers.set(parent, byRound); }
    let sub = byRound.get(roundIndex);
    if (!sub) {
      const name = String(rounds[roundIndex]?.name || '').trim() || `Round ${roundIndex + 1}`;
      sub = makeLayer(`layer-${key}-round-${roundIndex + 1}`, name);
      byRound.set(roundIndex, sub);
    }
    return sub;
  };
  // Sub-layers go into their parent in round order, whatever order their
  // first node happened to arrive in.
  const attachRoundSubLayers = (parent: SVGGElement, before: Node | null = null) => {
    const byRound = roundSubLayers.get(parent);
    if (!byRound) return;
    [...byRound.keys()].sort((a, b) => a - b)
      .forEach(i => parent.insertBefore(byRound.get(i)!, before));
  };

  if (mg) {
    // All joins in ONE group inside the Joins layer (session 63, user
    // request) — one click selects every join line.
    const joinsGroup = document.createElementNS(ns, 'g');
    joinsGroup.setAttribute('id', 'joins');

    Array.from(mg.querySelectorAll('[data-layer]')).forEach(node => {
      const layer = node.getAttribute('data-layer');
      // The round is read BEFORE the node leaves its element's group.
      const roundIndex = splitByRound ? roundIndexOfNode(node) : 0;
      node.removeAttribute('data-layer');
      // An empty group (a hidden label) would only make an empty sub-layer.
      if (splitByRound && node.childNodes.length === 0 && node.tagName.toLowerCase() === 'g') { node.remove(); return; }
      if (layer === 'notation')    layerFor(layerNotation, 'notation', roundIndex).appendChild(node);
      else if (layer === 'order')  layerFor(layerOrder, 'order', roundIndex).appendChild(node);
      else if (layer === 'groups') layerGroups.appendChild(node);
      else if (layer === 'joins')  joinsGroup.appendChild(node);
    });
    if (joinsGroup.childNodes.length > 0) layerJoins.appendChild(joinsGroup);
    attachRoundSubLayers(layerNotation);
    attachRoundSubLayers(layerOrder);

    while (mg.firstChild) layerDesign.appendChild(mg.firstChild);

    if (splitByRound) {
      // Each tagged group moves into its round's Design sub-layer, keeping
      // its order within the round. The sub-layers take the place of the
      // first tagged group, so anything drawn under the elements stays under.
      const tagged = (Array.from(layerDesign.querySelectorAll('[data-round],[data-el]')) as Element[])
        .filter(node => !node.parentElement?.closest('[data-round],[data-el]'));
      if (tagged.length > 0) {
        let anchor: Node = tagged[0];
        while (anchor.parentNode && anchor.parentNode !== layerDesign) anchor = anchor.parentNode;
        const marker = document.createComment('rounds');
        layerDesign.insertBefore(marker, anchor);
        const emptied = new Set<Element>();
        tagged.forEach(node => {
          const parent = node.parentNode as Element | null;
          if (parent && (parent as Node) !== (layerDesign as Node)) emptied.add(parent);
          // Nothing drawn for this element here (e.g. no beads) — drop it.
          if (node.childNodes.length === 0) { node.remove(); return; }
          layerFor(layerDesign, 'design', roundIndexOfNode(node)).appendChild(node);
        });
        attachRoundSubLayers(layerDesign, marker);
        marker.remove();
        // Wrapper groups left with nothing in them are dropped.
        emptied.forEach(parent => { if (parent.childNodes.length === 0) parent.remove(); });
      }
    }

    mg.appendChild(layerJoins);
    mg.appendChild(layerDesign);
    mg.appendChild(layerNotation);
    mg.appendChild(layerOrder);
    mg.appendChild(layerGroups);
    // The tags were only for sorting — not part of the exported file
    // (removed here, once the layers are back in the document).
    clonedSvg.querySelectorAll('[data-round]').forEach(n => n.removeAttribute('data-round'));
    clonedSvg.querySelectorAll('[data-el]').forEach(n => n.removeAttribute('data-el'));
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
      const groupIndex = getRoundId(el)
        ? rounds.findIndex(g => g.id === getRoundId(el))
        : -1;
      const [fillColor, strokeColor] = roundPalette[
        groupIndex >= 0 ? (groupIndex + 1) % roundPalette.length : 0
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
      // Session 63: into its round's sub-layer when the file is split by round.
      layerFor(layerOrder, 'order', roundIndexOfElement(el)).appendChild(bg);
    });
    attachRoundSubLayers(layerOrder);
  }

  // ── Serialize ─────────────────────────────────────────────────────────────
  const serializer = new XMLSerializer();
  return '<?xml version="1.0" encoding="UTF-8"?>\n' +
    serializer.serializeToString(clonedSvg);
}
