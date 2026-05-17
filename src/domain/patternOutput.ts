// src/domain/patternOutput.ts
//
// Pure pattern text generator — no React, no side effects, no DOM.
// Extracted from the generatePattern useCallback in tattingindex.tsx.
//
// TODO: DEFAULT_THREAD_PRESET is also defined in tattingindex.tsx for other
// use sites. Consolidate both into useBeadState.ts when that hook is extended.

const DEFAULT_THREAD_PRESET = {
  id: 'default',
  name: 'Pearl Cotton Size 10, Needle Tat',
  ds20Working: 285,
  ds20Core: 35,
  picotRegular: 8,
  picotJoined: 5,
  sample20DS10Regular: null,
  sample20DS10Short: null,
};

export interface GeneratePatternParams {
  elements: any[];
  picotConnections: any[];
  orderGroups: any[];
  materials: any[];
  beadLibrary: any[];
  threadPresets: any[];
  activePresetId: string;
  dsWidth: number;
  patternNotes: string;
  projectName: string;
  currentFilePath: string | null;
}

export interface GeneratePatternResult {
  text: string;
  elementCount: number;
}

// Returns null when the canvas has no tatting elements at all —
// the caller (tattingindex) handles the "No objects on canvas" clipboard message.
// Otherwise returns { text, elementCount } and the caller copies text to clipboard.
export function generatePatternText(params: GeneratePatternParams): GeneratePatternResult | null {
  const {
    elements, picotConnections, orderGroups, materials, beadLibrary,
    threadPresets, activePresetId, dsWidth, patternNotes, projectName, currentFilePath,
  } = params;

  // O(1) element lookup — built here rather than passed in
  const elementById = new Map(elements.map(e => [e.id, e]));

  // ── Element reference labels ───────────────────────────────────────────
  // Build a lookup: elementId → type label + order number.
  // Handles duplicate order numbers safely — marks them with ⚠.
  const orderNumberCount = {};
  elements.forEach(el => {
    const num = el.orderNumber?.toString().trim();
    if (num) orderNumberCount[num] = (orderNumberCount[num] || 0) + 1;
  });

  const getElementRef = (elementId: string) => {
    const el = elementById.get(elementId);
    if (!el) return null;
    const num = el.orderNumber?.toString().trim();
    const typeLabel = el.type === 'ring' ? 'R' : el.type === 'chain' ? (el.isSplitChain ? 'SC' : 'CH') : null;
    if (!typeLabel) return null;
    if (!num) return `${typeLabel}#?`;
    const samNumEls = elements.filter(e => e.orderNumber?.toString().trim() === num);
    if (samNumEls.length > 1) {
      const grp = el.orderGroup ? orderGroups.find(g => g.id === el.orderGroup) : null;
      const qualifier = grp ? `/${grp.name.replace(/\s+/g, '')}` : '/ungrouped';
      return `${typeLabel}#${num}${qualifier}`;
    }
    return `${typeLabel}#${num}`;
  };

  // ── Picot connection map ───────────────────────────────────────────────
  // key: "elementId:picotId" → list of connected element refs
  const picotConnectionMap: Record<string, string[]> = {};
  picotConnections.forEach(conn => {
    if (conn.picots.length < 2) return;
    conn.picots.forEach(p => {
      const key = `${p.elementId}:${p.picotId}`;
      if (!picotConnectionMap[key]) picotConnectionMap[key] = [];
      conn.picots.forEach(other => {
        if (other.elementId === p.elementId && other.picotId === p.picotId) return;
        const ref = getElementRef(other.elementId);
        if (ref && !picotConnectionMap[key].includes(ref)) {
          picotConnectionMap[key].push(ref);
        }
      });
    });
  });

  // ── Output notation builder ────────────────────────────────────────────
  // Rebuilds notation from picot data so each join picot carries its inline
  // connection refs. Avoids fragility of parsing the stored notation string.
  //
  // Format: 3ds-jp//r3//-3ds-jp//r3//r5//r7//-3ds
  //
  // Picot tokens:
  //   jp with connections  → jp//r3//r5//  (sorted lex)
  //   jp with no refs      → jp(?)
  //   bead-jp              → bjp//r3//
  //   regular medium       → p
  //   regular small        → sp
  //   regular large        → lp
  //   bead picot (non-jp)  → bp
  //   guide / guide-point  → skipped
  const buildOutputNotation = (el: any, elementId: string): string => {
    const typePrefix = el.isSplitRing ? 'sr'
      : el.type === 'ring'  ? 'r'
      : el.type === 'chain' ? (el.isSplitChain ? 'sc' : 'c')
      : null;
    if (!typePrefix) return el.notation || '';

    const refToLower = (ref: string) => {
      const m = ref.match(/^([A-Za-z]+)#(.+)$/);
      if (!m) return ref.toLowerCase();
      return m[1].toLowerCase() + m[2];
    };

    // jpg (isGuide + isJoint) → output as plain jp
    // gp  (isGuidePoint, no arm) → skip
    const picots = [...(el.picots || [])]
      .filter(p => !(p.isGuidePoint && !p.isJoint))
      .sort((a, b) => a.stitchesBefore - b.stitchesBefore);

    const totalStitches = el.stitchCount;
    const parts: string[] = [];
    let prev = 0;

    for (const picot of picots) {
      const ds = picot.stitchesBefore - prev;
      if (ds > 0) parts.push(`${ds}ds`);

      const key = `${elementId}:${picot.id}`;

      if (picot.isJoint) {
        const refs = picotConnectionMap[key] || [];
        let token: string;
        if (picot.beadType)              token = 'bjp';
        else if (picot.isCoreJoin && picot.hasPicotArm) token = 'cjp';
        else if (picot.isCoreJoin)       token = 'cj';
        else                             token = 'jp';

        if (refs.length === 0) {
          parts.push(`${token}(?)`);
        } else {
          const refStrs = [...refs].sort().map(refToLower);
          parts.push(token + refStrs.map(r => `//${r}`).join('') + '//');
        }
      } else if (picot.beadType) {
        parts.push('bp');
      } else {
        const lengthToken = picot.length === 'small' ? 'sp'
          : picot.length === 'large' ? 'lp'
          : 'p';
        parts.push(lengthToken);
      }

      prev = picot.stitchesBefore;
    }

    const trailing = totalStitches - prev;
    if (trailing > 0) parts.push(`${trailing}ds`);

    if (el.isSplitRing) {
      const splitAt = el.splitPosition || 0;
      const body = parts.join('-');
      if (!splitAt) {
        const notationA = el.notation.replace(/^sr:\s*/, '');
        const notationB = el.notationB || '5ds';
        return `sr: A: ${notationA} B: ${notationB}`;
      }
      return `sr: ${body}`;
    }

    return `${typePrefix}: ${parts.join('-')}`;
  };

  // ── Ordered elements ───────────────────────────────────────────────────
  const orderedElements = elements
    .filter(el => {
      const num = el.orderNumber?.toString().trim();
      return num && num !== '';
    })
    .map(el => ({
      order: parseFloat(el.orderNumber),
      rawOrder: el.orderNumber.toString().trim(),
      element: el,
    }))
    .filter(item => !isNaN(item.order))
    .sort((a, b) => a.order - b.order);

  // ── No numbered elements ───────────────────────────────────────────────
  let fallbackHeader = '';
  if (orderedElements.length === 0) {
    const hasAnyElements = elements.some(el => el.type !== 'line');
    if (hasAnyElements) {
      const unnumbered = elements.filter(el => el.type !== 'line');
      const list = unnumbered.map(el => {
        const typeLabel = el.type === 'ring' ? (el.isSplitRing ? 'SR' : 'R') : (el.isSplitChain ? 'SC' : 'CH');
        const hint = el.notation
          ? ' (' + el.notation.replace(/^(r|c|sc|sr):\s*/i, '').slice(0, 35) + ')' : '';
        return `  • ${typeLabel}${hint}${el.rw ? ' RW' : ''}`;
      });
      fallbackHeader = `⚠ Some elements don't have an assigned order number:\n${list.join('\n')}`;
    } else {
      // No tatting elements at all — caller handles clipboard message
      return null;
    }
  }

  // ── Duplicate order number detection ──────────────────────────────────
  const groupDupNums: string[] = [];
  {
    const groupNumCount: Record<string, number> = {};
    orderedElements.forEach(item => {
      const gKey = (item.element.orderGroup ?? '') + '|' + item.rawOrder;
      groupNumCount[gKey] = (groupNumCount[gKey] || 0) + 1;
    });
    Object.entries(groupNumCount).forEach(([k, count]) => {
      if (count > 1) {
        const [, num] = k.split('|');
        groupDupNums.push(num);
      }
    });
  }

  // ── Element line renderer ──────────────────────────────────────────────
  const renderElementLine = (item: any): string => {
    const el = item.element;
    const gKey = (el.orderGroup ?? '') + '|' + item.rawOrder;
    const isDup = orderedElements.filter(x =>
      (x.element.orderGroup ?? '') + '|' + x.rawOrder === gKey
    ).length > 1;
    const dupWarning = isDup ? ' ⚠DUPLICATE#' : '';
    if (el.type === 'line') return `${item.rawOrder}${dupWarning}. [Line]`;
    const notationText = buildOutputNotation(el, el.id);
    return `${item.rawOrder}${dupWarning}. ${notationText}${el.rw ? ' RW' : ''}`;
  };

  // ── Pattern body — grouped or flat ────────────────────────────────────
  const hasAnyGroup = orderedElements.some(item => item.element.orderGroup);
  let patternBody: string;

  if (hasAnyGroup) {
    const sections: string[] = [];
    for (const group of orderGroups) {
      const groupItems = orderedElements.filter(item => item.element.orderGroup === group.id);
      if (groupItems.length === 0) continue;
      sections.push(`=== ${group.name} ===\n` + groupItems.map(renderElementLine).join('\n'));
    }
    const knownGroupIds = new Set(orderGroups.map(g => g.id));
    const ungroupedItems = orderedElements.filter(item =>
      !item.element.orderGroup || !knownGroupIds.has(item.element.orderGroup)
    );
    if (ungroupedItems.length > 0) {
      sections.push(`=== Ungrouped ===\n` + ungroupedItems.map(renderElementLine).join('\n'));
    }
    patternBody = sections.join('\n\n');
  } else {
    const patternLines = orderedElements.map(renderElementLine);
    if (groupDupNums.length > 0) {
      patternLines.unshift(`⚠ Warning: duplicate order numbers: ${groupDupNums.join(', ')}`);
    }
    patternBody = patternLines.join('\n');
  }

  // ── Unnumbered block ───────────────────────────────────────────────────
  const unnumberedElements = elements.filter(el => {
    if (el.type === 'line') return false;
    const num = el.orderNumber?.toString().trim();
    return !num || num === '';
  });

  const unnumberedBlock = unnumberedElements.length > 0
    ? (() => {
        const list = unnumberedElements.map(el => {
          const typeLabel = el.type === 'ring'
            ? (el.isSplitRing ? 'SR' : 'R')
            : (el.isSplitChain ? 'SC' : 'CH');
          const hint = el.notation
            ? ' (' + el.notation.replace(/^(r|c|sc|sr):\s*/i, '').slice(0, 35)
              + (el.notation.length > 40 ? '…' : '') + ')'
            : '';
          return `  • ${typeLabel}${hint}${el.rw ? ' RW' : ''}`;
        });
        return `\n\n⚠ Some elements don't have an assigned order number:\n${list.join('\n')}`;
      })()
    : '';

  const notesBlock = patternNotes && patternNotes.trim()
    ? `\n\n--- Notes ---\n${patternNotes.trim()}`
    : '';

  // ── Thread estimate ────────────────────────────────────────────────────
  const activePreset = threadPresets.find(p => p.id === activePresetId)
    || threadPresets[0]
    || DEFAULT_THREAD_PRESET;

  const perDsWorking = activePreset.ds20Working / 20;
  const perDsCore    = activePreset.ds20Core / 20;
  const perSsWorking = perDsWorking * 0.5;
  const picotMm: Record<string, number> = {
    regular: activePreset.picotRegular,
    joined:  activePreset.picotJoined,
    long:    activePreset.picotRegular * 2,
    short:   activePreset.picotShort ?? (activePreset.picotRegular * 0.5),
    medium:  activePreset.picotRegular,
    lp:      activePreset.picotRegular * 2,
    sp:      activePreset.picotShort ?? (activePreset.picotRegular * 0.5),
    p:       activePreset.picotRegular,
  };

  const materialMm: Record<string, number> = {};
  const ensureMat = (id: string) => { if (!(id in materialMm)) materialMm[id] = 0; };
  let coreTotal = 0;
  let countDS = 0, countSS = 0, countPicots = 0, countJoined = 0;

  const countStitchType = (notation: string) => {
    const result = { ds: 0, ss: 0, regular: 0, long: 0, short: 0, joined: 0, beadDs: 0 };
    if (!notation) return result;

    const countBeadsInSeq = (seq: string) => {
      let count = 0, i = 0;
      while (i < seq.length) {
        if (/\d/.test(seq[i])) {
          const n = parseInt(seq[i]); i++;
          if (i < seq.length && /[YZV]/i.test(seq[i])) { count += n; i++; }
        } else if (/[YZV]/i.test(seq[i])) { count += 1; i++; }
        else { i++; }
      }
      return count;
    };

    const tokens = notation.replace(/^(r|c|sc|sr|ch):\s*/i, '').split(/[,\s\-]+/);
    for (const tok of tokens) {
      const bcMatch  = tok.match(/^bc:([YZVyzv0-9]+)$/i);
      if (bcMatch)  { result.beadDs += countBeadsInSeq(bcMatch[1]); continue; }
      const bcpMatch = tok.match(/^bcp:([YZVyzv])(:([YZVyzv0-9]+))?$/i);
      if (bcpMatch) { result.beadDs += 1; continue; }
      const bcjpMatch = tok.match(/^bcjp:([YZVyzv])(:([YZVyzv0-9]+))?$/i);
      if (bcjpMatch) { result.beadDs += 1; continue; }
      if (tok.match(/^be$/i)) { result.beadDs += 1; continue; }

      const m = tok.match(/^(\d+)(ds|ss|rds|p|lp|sp|jp|gjp|bjp|cj|cjp)?$/i);
      if (!m) continue;
      const n = parseInt(m[1]);
      const t = (m[2] || 'ds').toLowerCase();
      if (t === 'ds')  result.ds += n;
      else if (t === 'rds') result.ds += n * 2;
      else if (t === 'ss')  result.ss += n;
      else if (t === 'p')   result.regular += n;
      else if (t === 'lp')  result.long += n;
      else if (t === 'sp')  result.short += n;
      else if (t === 'jp' || t === 'gjp') result.joined += n;
      else if (t === 'cj' || t === 'cjp') result.joined += n;
    }
    return result;
  };

  for (const el of elements) {
    const matId = el.materialId || 'default';
    ensureMat(matId);

    if (el.type === 'line') {
      const totalPx = (el.paths || []).reduce((sum: number, path: any) => {
        const pts: { x: number; y: number }[] = [];
        for (let i = 0; i <= 20; i++) {
          const t = i / 20, u = 1 - t;
          if (path.type === 'cubic') {
            pts.push({
              x: u*u*u*path.x + 3*u*u*t*path.control1X + 3*u*t*t*path.control2X + t*t*t*path.endX,
              y: u*u*u*path.y + 3*u*u*t*path.control1Y + 3*u*t*t*path.control2Y + t*t*t*path.endY,
            });
          } else {
            pts.push({
              x: u*u*path.x + 2*u*t*(path.controlX||path.control1X) + t*t*path.endX,
              y: u*u*path.y + 2*u*t*(path.controlY||path.control1Y) + t*t*path.endY,
            });
          }
        }
        let len = 0;
        for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i].x - pts[i-1].x, pts[i].y - pts[i-1].y);
        return sum + len;
      }, 0);
      const dsUnits = totalPx / dsWidth;
      materialMm[matId] += dsUnits * perDsWorking;
      coreTotal += dsUnits * perDsCore;
      countDS += Math.round(dsUnits);
      continue;
    }

    const s = countStitchType(el.notation || '');
    materialMm[matId] += s.ds * perDsWorking + s.ss * perSsWorking;
    coreTotal += (s.ds + s.ss * 0.5 + s.beadDs) * perDsCore;
    countDS += s.ds + s.beadDs;
    countSS += s.ss;

    const picotList = el.picots || [];
    for (const p of picotList) {
      if (p.beadType && !(p.beadType === 'bcp' && !p.beadSeq) && !(p.beadType === 'bcjp' && !p.beadSeq)) continue;
      if (p.isJoint) continue;
      const pLen = picotMm[p.length] || picotMm['regular'];
      materialMm[matId] += pLen;
      countPicots++;
    }

    if (el.isSplitRing && el.notationB) {
      const matIdB = el.materialIdB || matId;
      ensureMat(matIdB);
      const sB = countStitchType(el.notationB);
      materialMm[matIdB] += sB.ds * perDsWorking + sB.ss * perSsWorking;
      coreTotal += (sB.ds + sB.ss * 0.5 + sB.beadDs) * perDsCore;
      countDS += sB.ds + sB.beadDs;
      countSS += sB.ss;
    }
  }

  for (const conn of picotConnections) {
    countJoined++;
    for (const cp of conn.picots) {
      const el = elementById.get(cp.elementId);
      if (!el) continue;
      const matId = el.materialId || 'default';
      ensureMat(matId);
      materialMm[matId] += picotMm['joined'];
    }
  }

  // ── Bead count ─────────────────────────────────────────────────────────
  const countBeadsInSeqObj = (seq: string) => {
    const counts: Record<string, number> = { Y: 0, Z: 0, V: 0 };
    if (!seq) return counts;
    let i = 0;
    const s = seq.toUpperCase();
    while (i < s.length) {
      let n = 1;
      if (/\d/.test(s[i])) { n = parseInt(s[i]); i++; }
      if (i < s.length && /[YZV]/.test(s[i])) { counts[s[i]] += n; i++; }
      else { i++; }
    }
    return counts;
  };
  const addBeads = (totals: Record<string, number>, counts: Record<string, number>) => {
    for (const k of ['Y', 'Z', 'V']) totals[k] += counts[k] || 0;
  };

  const beadTotals: Record<string, number> = { Y: 0, Z: 0, V: 0 };
  const namedBeadCounts = new Map<string, { name: string; count: number }>();

  for (const el of elements) {
    for (const p of (el.picots || [])) {
      if (!p.beadType) continue;
      if (p.beadType === 'bc') {
        const sz = (p.beadSize || 'Y').toUpperCase();
        if (sz in beadTotals) beadTotals[sz]++;
      } else if (p.beadType === 'bcp' || p.beadType === 'bcjp') {
        const coreSz = (p.coreSize || 'Y').toUpperCase();
        if (coreSz in beadTotals) beadTotals[coreSz]++;
        addBeads(beadTotals, countBeadsInSeqObj(p.beadSeq || ''));
      } else if (p.beadSeq) {
        addBeads(beadTotals, countBeadsInSeqObj(p.beadSeq));
      }
    }
    if (el.type === 'line' && el.lineBeads) {
      addBeads(beadTotals, countBeadsInSeqObj(el.lineBeads));
    }
    if (el.type === 'line' && el.lineBeadSlots?.length > 0) {
      el.lineBeadSlots.forEach((slotId: string) => {
        if (!slotId) return;
        const libBead = beadLibrary.find(b => b.id === slotId);
        if (libBead) {
          const key = `named:${libBead.name}`;
          beadTotals[key] = (beadTotals[key] || 0) + 1;
        }
      });
    } else if (el.type === 'line' && el.lineBeadId && (el.lineBeadCount ?? 1) > 0) {
      const libBead = beadLibrary.find(b => b.id === el.lineBeadId);
      if (libBead) {
        const key = `named:${libBead.name}`;
        beadTotals[key] = (beadTotals[key] || 0) + (el.lineBeadCount ?? 1);
      }
    }
    for (const p of (el.picots || [])) {
      if (p.beadType !== 'be') continue;
      const countNamedBead = (beadId: string) => {
        if (!beadId) return;
        const b = beadLibrary.find(b => b.id === beadId);
        if (!b) return;
        const sz = b.size === 'S' ? 'Y' : b.size === 'M' ? 'Z' : b.size === 'L' ? 'V' : b.size;
        if (sz in beadTotals) beadTotals[sz]++;
        if (!namedBeadCounts.has(beadId)) namedBeadCounts.set(beadId, { name: b.name, count: 0 });
        namedBeadCounts.get(beadId)!.count++;
      };
      for (const beadId of (p.coreBeads || [])) countNamedBead(beadId);
      for (const beadId of (p.picotBeads || [])) countNamedBead(beadId);
    }
  }

  const beadEntries = [
    beadTotals.Y > 0 ? `Y (small) × ${beadTotals.Y}` : null,
    beadTotals.Z > 0 ? `Z (medium) × ${beadTotals.Z}` : null,
    beadTotals.V > 0 ? `V (large) × ${beadTotals.V}` : null,
  ].filter(Boolean);

  const namedEntries = [...namedBeadCounts.values()]
    .sort((a, b) => b.count - a.count)
    .map(({ name, count }) => `  ${name} × ${count}`);

  const beadBlock = beadEntries.length > 0
    ? `\n\n--- Beads ---\n` +
      beadEntries.join('\n') +
      (namedEntries.length > 0 ? `\n\nNamed beads (BE):\n` + namedEntries.join('\n') : '')
    : '';

  // ── Thread block ───────────────────────────────────────────────────────
  const mmToM = (mm: number) => (mm / 1000).toFixed(2);

  const materialLines = Object.entries(materialMm)
    .filter(([, mm]) => mm > 0)
    .map(([id, mm]) => {
      const mat = materials.find(m => m.id === id);
      const name = mat ? mat.name : id;
      return `${name} ~ ${mmToM(mm)} m`;
    });

  const coreM = parseFloat(mmToM(coreTotal));
  const multiMat = Object.keys(materialMm).filter(id => (materialMm[id] || 0) > 0).length > 1;

  const threadBlock = materialLines.length > 0
    ? `\n\n--- Thread Estimate (${activePreset.name}) ---` +
      `\n(tie-ins and tails not included)\n` +
      materialLines.map(l => `\n${l}`).join('') +
      `\n\nNote: core thread not included — add manually` +
      (multiMat ? ` (multi-material pattern)` : '') +
      `\nCore thread ~ ${coreM} m` +
      `\n\nDS: ${countDS}  SS: ${countSS}  Picots: ${countPicots}  Joined: ${countJoined}`
    : '';

  // ── Final assembly ─────────────────────────────────────────────────────
  const displayName = currentFilePath
    ? currentFilePath.split(/[\\\/]/).pop()?.replace(/\.json$/i, '') ?? projectName
    : projectName;

  const text = fallbackHeader
    ? fallbackHeader + (threadBlock || '') + beadBlock + notesBlock
    : `${displayName.trim() || 'Untitled Pattern'}\n\n` + patternBody + unnumberedBlock + notesBlock + threadBlock + beadBlock;

  return { text, elementCount: orderedElements.length };
}
