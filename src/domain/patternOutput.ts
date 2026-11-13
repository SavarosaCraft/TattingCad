// src/domain/patternOutput.ts
//
// Pure pattern text generator — no React, no side effects, no DOM.
// Extracted from the generatePattern useCallback in tattingindex.tsx.
//
// TODO: DEFAULT_THREAD_PRESET is also defined in tattingindex.tsx for other
// use sites. Consolidate both into useBeadState.ts when that hook is extended.

import { DEFAULT_END_ALLOWANCE } from '../geometry/stitchGeometry';
import { fingerprintText } from '../utils/fileFingerprint';
import { isSafeColor } from '../utils/safeColor';
import { parseNotation, expandTokens, splitNotationParts } from './parser';
import { splitRingSides } from './picotTools';

// Session 61: every notation prefix (incl. jk:, fr: floating ring, mr: mock
// ring) — stripped for the short notation hints and the stitch counts.
const NOTATION_PREFIX_RE = /^(r|c|sc|sr|ch|jk|fr|mr):\s*/i;
// Short ring label in the unnumbered list: SR / FR / MR / JK / R.
const ringTypeLabel = (el: any): string =>
  el.isSplitRing ? 'SR' : /^fr:/i.test(el.notation || '') ? 'FR' : /^mr:/i.test(el.notation || '') ? 'MR'
    : /^jk:/i.test(el.notation || '') ? 'JK' : 'R';

// Session 64 (pattern text) — token classes for the numbered lines.
const STITCH_TOKEN_RE = /^(\d*)(ds|ss|lss|rss|rds|bds)$/i;
const PLAIN_PICOT_TOKEN_RE = /^(p|sp|cp|lp)$/i;
// Tokens that ARE joins: with nothing joined to them they're marked (?).
const JOINING_TOKEN_RE = /^(jp|jpg|cj|cjp|bjp(:.*)?|bcjp:.*)$/i;
const NOTATION_MISMATCH = Symbol('notation mismatch');

const DEFAULT_THREAD_PRESET = {
  id: 'default',
  name: 'Pearl Cotton Size 10, Needle Tat',
  ds20Working: 285,
  ds20Core: 35,
  picotRegular: 8,
  picotJoined: 5,
  endAllowance: DEFAULT_END_ALLOWANCE, // ds, from DEFAULT_TENSION (geometry/stitchGeometry.ts)
  sample20DS10Regular: null,
  sample20DS10Short: null,
};

export interface GeneratePatternParams {
  elements: any[];
  picotConnections: any[];
  rounds: any[];
  materials: any[];
  beadLibrary: any[];
  threadPresets: any[];
  activePresetId: string;
  dsWidth: number;
  patternNotes: string;
  projectName: string;
  currentFilePath: string | null;
  // Translation lookup — the copied pattern text follows the UI language.
  // Notation tokens (ds, p, jp, r:, c: …), element-type abbreviations
  // (R, CH, SC, SR) and RW are tatting notation and stay untranslated.
  t: (key: string) => string;
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
    elements, picotConnections, rounds, materials, beadLibrary,
    threadPresets, activePresetId, dsWidth, patternNotes, projectName, currentFilePath, t,
  } = params;

  // Legacy-read shim (session 43 naming-collision fix): elements may still carry the
  // old `orderGroup` field if this function is ever called with data that bypassed the
  // app's normal load path. Reads go through this helper everywhere.
  const getRoundId = (el: any) => el?.roundId ?? el?.orderGroup;

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
      const grp = getRoundId(el) ? rounds.find(g => g.id === getRoundId(el)) : null;
      const qualifier = grp ? `/${grp.name.replace(/\s+/g, '')}` : `/${t('tattingOrderUngrouped').toLowerCase().replace(/\s+/g, '')}`;
      return `${typeLabel}#${num}${qualifier}`;
    }
    return `${typeLabel}#${num}`;
  };

  // ── Picot connection map ───────────────────────────────────────────────
  // key: "elementId:picotId" → list of connected element refs
  const picotConnectionMap: Record<string, string[]> = {};
  // key: "elementId:picotId" — every picot that's the endpoint of a fold
  // connection (connectionType === 'fold'). Folds are always exactly one
  // picot to one picot (see useJoinActions.ts — exclusive, no stacking), so
  // membership alone is enough; no need to track which partner.
  const foldedPicotKeys = new Set<string>();
  picotConnections.forEach(conn => {
    if (conn.picots.length < 2) return;
    if (conn.connectionType === 'fold') {
      conn.picots.forEach(p => foldedPicotKeys.add(`${p.elementId}:${p.picotId}`));
    }
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
  //   fp (folded picot)    → fp//r3//  (session 47 — plain-picot-only fold;
  //                           always has exactly one ref since a fold
  //                           connection is exclusive to one partner)
  //   bead-jp              → bjp//r3//
  //   regular medium       → p
  //   regular small        → sp
  //   regular large        → lp
  //   bead picot (non-jp)  → bp
  //   guide / guide-point  → skipped
  // "R#3" → "r3", "CH#12" → "ch12" — element refs inside the notation.
  const refToLower = (ref: string) => {
    const m = ref.match(/^([A-Za-z]+)#(.+)$/);
    if (!m) return ref.toLowerCase();
    return m[1].toLowerCase() + m[2];
  };

  // Legacy line builder (before session 64): rebuilds the line from picot
  // positions, every stitch as ds. Only used now when an element's picots
  // don't line up with its notation (see buildOutputNotation below).
  const buildOutputNotationLegacy = (el: any, elementId: string): string => {
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
        // fp (folded picot) — only reachable here since fold connections are
        // plain-picot-only by construction (useJoinActions.ts rejects any
        // picot with beadType or isCoreJoin as a fold candidate), so this
        // check only ever needs to sit in the plain-jp fallback branch.
        else if (foldedPicotKeys.has(key)) token = 'fp';
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
  const refs = picotConnectionMap[key] || [];
  if (refs.length > 0) {
    const refStrs = [...refs].sort().map(refToLower);
    parts.push(lengthToken + refStrs.map(r => `//${r}`).join('') + '//');
  } else {
    parts.push(lengthToken);
  }
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

  // ── Output notation (session 64) ───────────────────────────────────────
  // Each numbered line is the element's OWN notation, as typed: its prefix
  // (fr: mr: jk: sc: …), every stitch (ss, lss/rss, rds/bds) and every bead
  // token are kept. The legacy builder above rebuilt the line from stitch
  // counts and picot positions, which wrote every stitch as ds, every bead
  // as bp, every ring as r: (user report: a floating ring came out "r:").
  // User decisions (session 64):
  //  - a joined picot gets the usual //ref// mark; a joined plain picot is
  //    written jp, a fold fp (as before); a joining picot (jp, jpg, cj, cjp,
  //    bjp, bcjp) with nothing joined to it is marked (?);
  //  - gp and jpg stay as written (they are not the same: a jpg's guide
  //    point is offset); an unjoined gp is a drawing aid and is left out —
  //    the runs on either side of it become one;
  //  - a repeat n*(…) stays short unless a picot inside it is joined;
  //  - a split ring is written "sr: side A / side B".
  // Picots are matched to the notation's tokens in order (a bead sequence
  // like bc:YZ is one token with one picot per bead). If the element's
  // picots don't line up with its notation, the legacy builder is used.
  const tokenPicotCount = new Map<string, number>();
  const picotsInToken = (token: string): number => {
    if (STITCH_TOKEN_RE.test(token)) return 0;
    let n = tokenPicotCount.get(token);
    if (n === undefined) {
      n = parseNotation(`r: ${token}`, true)?.picots.length ?? 0;
      tokenPicotCount.set(token, n);
    }
    return n;
  };
  const byPosition = (list: any[]) =>
    list.map((p, i) => ({ p, i }))
      .sort((a, b) => (a.p.stitchesBefore - b.p.stitchesBefore) || (a.i - b.i))
      .map(x => x.p);

  // body = notation without its prefix; picots in notation order.
  const annotateBody = (elementId: string, body: string, picots: any[]): string | null => {
    let next = 0;
    const refsOf = (list: any[]) =>
      [...new Set(list.flatMap(p => picotConnectionMap[`${elementId}:${p.id}`] || []))];
    const isJoinedOrConnected = (list: any[]) => list.some(p => p.isJoint) || refsOf(list).length > 0;

    let mergeWithPrevious = false;   // after a left-out gp: the next run joins the one before
    const renderTokens = (tokens: string[], out: string[]) => {
      for (const token of tokens) {
        const count = picotsInToken(token);
        const own = picots.slice(next, next + count);
        if (own.length < count) throw NOTATION_MISMATCH;
        next += count;
        if (count === 0) {
          const m = token.match(STITCH_TOKEN_RE);
          const prev = out.length > 0 ? out[out.length - 1].match(STITCH_TOKEN_RE) : null;
          if (mergeWithPrevious && m && prev && prev[2].toLowerCase() === m[2].toLowerCase()) {
            out[out.length - 1] = `${parseInt(prev[1] || '1', 10) + parseInt(m[1] || '1', 10)}${m[2]}`;
          } else out.push(token);
          mergeWithPrevious = false;
          continue;
        }
        const refs = refsOf(own);
        const joined = own.some(p => p.isJoint);
        if (token.toLowerCase() === 'gp' && refs.length === 0 && !joined) { mergeWithPrevious = true; continue; }
        let word = token;
        if (PLAIN_PICOT_TOKEN_RE.test(token)) {
          if (own.some(p => foldedPicotKeys.has(`${elementId}:${p.id}`))) word = 'fp';
          else if (joined) word = 'jp';
        }
        if (refs.length > 0) out.push(word + [...refs].sort().map(r => `//${refToLower(r)}`).join('') + '//');
        else if (joined || JOINING_TOKEN_RE.test(token)) out.push(`${word}(?)`);
        else out.push(word);
        mergeWithPrevious = false;
      }
    };

    try {
      const out: string[] = [];
      for (const part of splitNotationParts(body)) {
        const rep = part.repeat;
        if (!rep) { renderTokens(expandTokens(part.text), out); continue; }
        const innerTokens = expandTokens(rep.inner);
        const perRound = innerTokens.reduce((sum, tk) => sum + picotsInToken(tk), 0);
        const inGroup = picots.slice(next, next + perRound * rep.count);
        if (inGroup.length < perRound * rep.count) throw NOTATION_MISMATCH;
        if (isJoinedOrConnected(inGroup)) {
          // a join inside: written out in full, each picot with its own refs
          for (let k = 0; k < rep.count; k++) renderTokens(innerTokens, out);
        } else {
          // kept short, in the form it was typed: 3*(…), 3x(…), (…)x3, (…)*3
          const inner: string[] = [];
          const start = next;
          mergeWithPrevious = false;
          renderTokens(innerTokens, inner);
          mergeWithPrevious = false;
          next = start + perRound * rep.count;
          const sep = rep.prefixForm
            ? part.text[rep.countStr.length]
            : part.text[part.text.length - rep.countStr.length - 1];
          out.push(rep.prefixForm ? `${rep.countStr}${sep}(${inner.join('-')})` : `(${inner.join('-')})${sep}${rep.countStr}`);
        }
      }
      if (next !== picots.length) return null;
      return out.join('-');
    } catch (err) {
      if (err === NOTATION_MISMATCH) return null;
      throw err;
    }
  };

  const buildOutputNotation = (el: any, elementId: string): string => {
    if (el.isSplitRing) {
      const sides = splitRingSides(el);
      const a = annotateBody(elementId, sides.notationA.replace(NOTATION_PREFIX_RE, ''), byPosition(sides.picotsA));
      const b = annotateBody(elementId, sides.notationB.replace(NOTATION_PREFIX_RE, ''), byPosition(sides.picotsB));
      if (a !== null && b !== null) return `sr: ${a} / ${b}`;
    } else if (el.type === 'ring' || el.type === 'chain') {
      const m = (el.notation || '').match(NOTATION_PREFIX_RE);
      if (m) {
        const body = annotateBody(elementId, el.notation.slice(m[0].length), byPosition(el.picots || []));
        if (body !== null) return `${m[1].toLowerCase()}: ${body}`;
      }
    }
    return buildOutputNotationLegacy(el, elementId);
  };

  // ── Ordered elements ───────────────────────────────────────────────────
  const orderedElements = elements
    .filter(el => {
      if (el.isRepeat) return false; // repeat elements are excluded from output
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
        const typeLabel = el.type === 'ring' ? ringTypeLabel(el) : (el.isSplitChain ? 'SC' : 'CH');
        const hint = el.notation
          ? ' (' + el.notation.replace(NOTATION_PREFIX_RE, '').slice(0, 35) + ')' : '';
        return `  • ${typeLabel}${hint}${el.rw ? ' RW' : ''}`;
      });
      fallbackHeader = `⚠ ${t('patternOutUnnumbered')}\n${list.join('\n')}`;
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
      const gKey = (getRoundId(item.element) ?? '') + '|' + item.rawOrder;
      groupNumCount[gKey] = (groupNumCount[gKey] || 0) + 1;
    });
    Object.entries(groupNumCount).forEach(([k, count]) => {
      if (count > 1) {
        const [, num] = k.split('|');
        groupDupNums.push(num);
      }
    });
  }

  // ── Endpoint connection suffix ─────────────────────────────────────────
  // Appends //ref// for any start/end/anchor connections on the element.
  const buildEndpointSuffix = (el: any): string => {
    const endpointIds = ['__start__', '__end__', '__anchor__'];
    const refs: string[] = [];
    endpointIds.forEach(epId => {
      const key = `${el.id}:${epId}`;
      (picotConnectionMap[key] || []).forEach(ref => {
        if (!refs.includes(ref)) refs.push(ref);
      });
    });
    if (refs.length === 0) return '';
    return ' ' + refs.sort().map(r => `//${r.toLowerCase().replace('#', '')}//`).join('');
  };

  // ── Element line renderer ──────────────────────────────────────────────
  const renderElementLine = (item: any): string => {
    const el = item.element;
    const gKey = (getRoundId(el) ?? '') + '|' + item.rawOrder;
    const isDup = orderedElements.filter(x =>
      (getRoundId(x.element) ?? '') + '|' + x.rawOrder === gKey
    ).length > 1;
    const dupWarning = isDup ? ` ⚠${t('patternOutDuplicateMark')}` : '';
    if (el.type === 'line') return `${item.rawOrder}${dupWarning}. [${t('patternOutLine')}]`;
    const notationText = buildOutputNotation(el, el.id);
    const endpointSuffix = buildEndpointSuffix(el);
    return `${item.rawOrder}${dupWarning}. ${notationText}${el.rw ? ' RW' : ''}${endpointSuffix}`;
  };

  // ── Pattern body — grouped or flat ────────────────────────────────────
  const hasAnyGroup = orderedElements.some(item => getRoundId(item.element));
  let patternBody: string;

  if (hasAnyGroup) {
    const sections: string[] = [];
    for (const group of rounds) {
      const groupItems = orderedElements.filter(item => getRoundId(item.element) === group.id);
      if (groupItems.length === 0) continue;
      sections.push(`=== ${group.name} ===\n` + groupItems.map(renderElementLine).join('\n'));
    }
    const knownGroupIds = new Set(rounds.map(g => g.id));
    const ungroupedItems = orderedElements.filter(item =>
      !getRoundId(item.element) || !knownGroupIds.has(getRoundId(item.element))
    );
    if (ungroupedItems.length > 0) {
      sections.push(`=== ${t('tattingOrderUngrouped')} ===\n` + ungroupedItems.map(renderElementLine).join('\n'));
    }
    patternBody = sections.join('\n\n');
  } else {
    const patternLines = orderedElements.map(renderElementLine);
    if (groupDupNums.length > 0) {
      patternLines.unshift(`⚠ ${t('patternOutDuplicateWarning').replace('{list}', groupDupNums.join(', '))}`);
    }
    patternBody = patternLines.join('\n');
  }

  // ── Unnumbered block ───────────────────────────────────────────────────
  const unnumberedElements = elements.filter(el => {
    if (el.type === 'line') return false;
    if (el.isRepeat) return false;
    const num = el.orderNumber?.toString().trim();
    return !num || num === '';
  });

  const unnumberedBlock = unnumberedElements.length > 0
    ? (() => {
        const list = unnumberedElements.map(el => {
          const typeLabel = el.type === 'ring'
            ? ringTypeLabel(el)
            : (el.isSplitChain ? 'SC' : 'CH');
          const hint = el.notation
            ? ' (' + el.notation.replace(NOTATION_PREFIX_RE, '').slice(0, 35)
              + (el.notation.length > 40 ? '…' : '') + ')'
            : '';
          return `  • ${typeLabel}${hint}${el.rw ? ' RW' : ''}`;
        });
        return `\n\n⚠ ${t('patternOutUnnumbered')}\n${list.join('\n')}`;
      })()
    : '';

  const notesBlock = patternNotes && patternNotes.trim()
    ? `\n\n--- ${t('patternOutNotes')} ---\n${patternNotes.trim()}`
    : '';

  // ── Thread estimate ────────────────────────────────────────────────────
  const activePreset = threadPresets.find(p => p.id === activePresetId)
    || threadPresets[0]
    || DEFAULT_THREAD_PRESET;

  const perDsWorking = activePreset.ds20Working / 20;
  const perDsCore    = activePreset.ds20Core / 20;
  // Shuttle presets (session 59): a ring is made from the shuttle thread
  // alone (ds20Ring = all thread for a 20 DS ring), while a chain uses the
  // ball thread for its stitches (ds20Working) over the shuttle thread as
  // core (ds20Core). Needle presets keep the old model for everything:
  // working + core per stitch.
  const isShuttle = activePreset.technique === 'shuttle' && Number(activePreset.ds20Ring) > 0;
  const perDsRing = isShuttle ? Number(activePreset.ds20Ring) / 20 : 0;
  let shuttleTotal = 0, ballTotal = 0;
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

    const tokens = notation.replace(NOTATION_PREFIX_RE, '').split(/[,\s\-]+/);
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
      else if (t === 'rds') result.ds += n * 1.5;
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
      if (isShuttle) { ballTotal += dsUnits * perDsWorking; shuttleTotal += dsUnits * perDsCore; }
      countDS += Math.round(dsUnits);
      continue;
    }

    const s = countStitchType(el.notation || '');
    // Shuttle preset + ring: everything is shuttle thread, no separate core.
    const shuttleRing = isShuttle && !!el.isClosed;
    const addStitches = (mat: string, st: ReturnType<typeof countStitchType>) => {
      if (shuttleRing) {
        const mm = (st.ds + st.beadDs) * perDsRing + st.ss * perDsRing * 0.5;
        materialMm[mat] += mm; shuttleTotal += mm;
      } else {
        const work = st.ds * perDsWorking + st.ss * perSsWorking;
        const core = (st.ds + st.ss * 0.5 + st.beadDs) * perDsCore;
        materialMm[mat] += work; coreTotal += core;
        if (isShuttle) { ballTotal += work; shuttleTotal += core; }
      }
    };
    addStitches(matId, s);
    countDS += s.ds + s.beadDs;
    countSS += s.ss;

    const picotList = el.picots || [];
    for (const p of picotList) {
      if (p.beadType && !(p.beadType === 'bcp' && !p.beadSeq) && !(p.beadType === 'bcjp' && !p.beadSeq)) continue;
      if (p.isJoint) continue;
      const pLen = picotMm[p.length] || picotMm['regular'];
      materialMm[matId] += pLen;
      if (isShuttle) { if (shuttleRing) shuttleTotal += pLen; else ballTotal += pLen; }
      countPicots++;
    }

    if (el.isSplitRing && el.notationB) {
      const matIdB = el.materialIdB || matId;
      ensureMat(matIdB);
      const sB = countStitchType(el.notationB);
      addStitches(matIdB, sB);
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
      if (isShuttle) { if (el.isClosed) shuttleTotal += picotMm['joined']; else ballTotal += picotMm['joined']; }
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
    beadTotals.Y > 0 ? `Y (${t('patternOutBeadSmall')}) × ${beadTotals.Y}` : null,
    beadTotals.Z > 0 ? `Z (${t('patternOutBeadMedium')}) × ${beadTotals.Z}` : null,
    beadTotals.V > 0 ? `V (${t('patternOutBeadLarge')}) × ${beadTotals.V}` : null,
  ].filter(Boolean);

  const namedEntries = [...namedBeadCounts.values()]
    .sort((a, b) => b.count - a.count)
    .map(({ name, count }) => `  ${name} × ${count}`);

  const beadBlock = beadEntries.length > 0
    ? `\n\n--- ${t('patternOutBeads')} ---\n` +
      beadEntries.join('\n') +
      (namedEntries.length > 0 ? `\n\n${t('patternOutNamedBeads')}\n` + namedEntries.join('\n') : '')
    : '';

  // ── Thread block ───────────────────────────────────────────────────────
  const mmToM = (mm: number) => (mm / 1000).toFixed(2);

  const materialLines = Object.entries(materialMm)
    .filter(([, mm]) => mm > 0)
    .map(([id, mm]) => {
      const mat = materials.find(m => m.id === id);
      // Built-in default material: stored name is English data, shown translated.
      const name = id === 'default' ? t('materialDefaultName') : (mat ? mat.name : id);
      return `${name} ~ ${mmToM(mm)} m`;
    });

  const coreM = parseFloat(mmToM(coreTotal));
  const multiMat = Object.keys(materialMm).filter(id => (materialMm[id] || 0) > 0).length > 1;

  // Built-in preset keeps its translated name until the user renames it
  // (same rule as presetDisplayName in tattingindex.tsx).
  const presetName = activePreset.id === 'default' && activePreset.name === DEFAULT_THREAD_PRESET.name
    ? t('threadPresetDefaultName') : activePreset.name;

  // Shuttle preset: what to wind on the shuttle and what to take from the
  // ball, then the per-colour totals (visible stitches) when there are
  // several materials.
  const threadBlock = materialLines.length > 0 && isShuttle
    ? `\n\n--- ${t('patternOutThreadHeader').replace('{preset}', presetName)} ---` +
      `\n${t('patternOutThreadTails')}\n` +
      `\n${t('patternOutShuttleThread').replace('{m}', mmToM(shuttleTotal))}` +
      `\n${t('patternOutBallThread').replace('{m}', mmToM(ballTotal))}` +
      (multiMat ? `\n\n${t('patternOutByColour')}` + materialLines.map(l => `\n  ${l}`).join('') : '') +
      `\n\n${t('patternOutCounts').replace('{ds}', String(countDS)).replace('{ss}', String(countSS)).replace('{picots}', String(countPicots)).replace('{joined}', String(countJoined))}`
    : materialLines.length > 0
    ? `\n\n--- ${t('patternOutThreadHeader').replace('{preset}', presetName)} ---` +
      `\n${t('patternOutThreadTails')}\n` +
      materialLines.map(l => `\n${l}`).join('') +
      `\n\n${t('patternOutCoreNote')}` +
      (multiMat ? ` ${t('patternOutMultiMaterial')}` : '') +
      `\n${t('patternOutCoreThread').replace('{m}', String(coreM))}` +
      `\n\n${t('patternOutCounts').replace('{ds}', String(countDS)).replace('{ss}', String(countSS)).replace('{picots}', String(countPicots)).replace('{joined}', String(countJoined))}`
    : '';

  // ── Final assembly ─────────────────────────────────────────────────────
  const displayName = currentFilePath
    ? currentFilePath.split(/[\\\/]/).pop()?.replace(/\.(tatcad|json)$/i, '') ?? projectName
    : projectName;

  const text = fallbackHeader
    ? fallbackHeader + (threadBlock || '') + beadBlock + notesBlock
    : `${displayName.trim() || t('projectUntitled')}\n\n` + patternBody + unnumberedBlock + notesBlock + threadBlock + beadBlock;

  return { text, elementCount: orderedElements.length };
}

// Canonical project serializer — single source of truth for both manual save and autosave.
// Accepts all project data explicitly so it stays pure and testable.
// isAutoSave=true → writes 'autoSaved' timestamp key; false → writes 'created'.
export function serializeProject(data: {
  name: string;
  elements: any[]; picotConnections: any[]; camera: any; zoom: number; dsWidth: number;
  bgColor: string; gridEnabled: boolean; customColors: any[]; referenceImage: any;
  refImageProps: any; renderMode: string; patternNotes: string; materials: any[];
  orderGroups: any[]; beadLibrary: any[]; polarGrids: any[]; selectedPolarGridId: string | null;
  threadPresets: any[]; activePresetId: string;
  spatialGroups?: any[];
}, isAutoSave = false) {
  return {
    // 92 (session 63, review #3): spatialGroups — the group names and
    // colours; absent in older files (groups then fall back to "Group").
    // 91 (session 57): elements may carry endAllowance (ds); absent = 0
    version: 92,
    name: data.name,
    ...(isAutoSave
      ? { autoSaved: new Date().toISOString() }
      : { created: new Date().toISOString() }),
    elements:            data.elements,
    picotConnections:    data.picotConnections,
    camera:              data.camera,
    zoom:                data.zoom,
    dsWidth:             data.dsWidth,
    bgColor:             data.bgColor,
    gridEnabled:         data.gridEnabled,
    customColors:        data.customColors,
    referenceImage:      data.referenceImage,
    refImageProps:       data.refImageProps,
    renderMode:          data.renderMode,
    patternNotes:        data.patternNotes,
    materials:           data.materials,
    orderGroups:         data.orderGroups,
    beadLibrary:         data.beadLibrary,
    polarGrids:          data.polarGrids,
    selectedPolarGridId: data.selectedPolarGridId,
    activeThreadPreset:
      data.threadPresets.find(p => p.id === data.activePresetId)
      ?? data.threadPresets[0]
      ?? null,
    spatialGroups:       data.spatialGroups ?? [],
  };
}

// ── Group registry from a file (session 63, review #3) ──────────────────────
// Only well-formed entries are kept: a string id, a name (text, at most 200
// characters; empty → "Group" is shown) and a real colour (utils/safeColor).
// Anything else in a file is dropped. Older files have none → [].
export const normalizeSpatialGroups = (list: unknown): { id: string; name: string; color: string }[] => {
  if (!Array.isArray(list)) return [];
  const seen = new Set<string>();
  const out: { id: string; name: string; color: string }[] = [];
  for (const g of list) {
    if (!g || typeof g !== 'object') continue;
    const id = (g as any).id;
    if (typeof id !== 'string' || !id || seen.has(id)) continue;
    const name = typeof (g as any).name === 'string' ? (g as any).name.slice(0, 200) : '';
    const color = isSafeColor((g as any).color) ? String((g as any).color).trim() : '#888888';
    seen.add(id);
    out.push({ id, name, color });
  }
  return out;
};

// ── Unsaved check for settings outside Undo (session 63, review #2) ─────────
// Notes, materials, the reference image and its settings, background,
// thread size and preset, bead library: saved in the file, but changing
// them doesn't make an undo step, so the history-based check (rev) missed
// them — closing lost them without a warning. This key stands for all of
// them; the pattern is unsaved when it differs from the key of what was
// last opened / saved. `data` has the field names of serializeProject's
// output. refImageFp: the reference image's fingerprint when the caller
// already has it (a large data URL — hashed once per change, not per key).
// View settings (camera, zoom, grid, render mode) are left out on purpose.
export const projectSettingsKey = (data: {
  patternNotes?: any; materials?: any; referenceImage?: any; refImageProps?: any;
  bgColor?: any; beadLibrary?: any; dsWidth?: any; activeThreadPreset?: any;
}, refImageFp?: string): string => JSON.stringify([
  data.patternNotes ?? '',
  data.materials ?? null,
  refImageFp ?? referenceImageFingerprint(data.referenceImage),
  data.refImageProps ?? null,
  data.bgColor ?? null,
  data.beadLibrary ?? null,
  data.dsWidth ?? null,
  data.activeThreadPreset ?? null,
]);

export const referenceImageFingerprint = (img: any): string =>
  img ? fingerprintText(typeof img === 'string' ? img : JSON.stringify(img)) : '';

