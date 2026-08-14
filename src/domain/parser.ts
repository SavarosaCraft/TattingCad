// parser.ts — Pure tatting notation parsing functions, no React dependencies
// All functions are stateless and side-effect free.
// The one exception is parseNotation which accepts an optional onError callback
// instead of calling setNotationError directly.

import { generateId } from '../utils/id';

// ── Stitch width ────────────────────────────────────────────────────────────
// Single source of truth for "how many DS-equivalent units wide is this
// stitch type". Previously redeclared inline (as literal 1.5/0.5 ternaries)
// in ~5 places in this file and duplicated as 4 separate lookup tables in
// tattingindex.tsx — a plain width change meant a ten-site hunt, and the
// copies had already started to drift (see STITCH_X_EXTENTS in
// tattingindex.tsx). Import this everywhere a stitch's DS-equivalent width
// is needed instead of redeclaring it.
export const STITCH_WIDTH_DS: Record<string, number> = {
  ds: 1,
  ss: 0.5,
  lss: 0.5,
  rss: 0.5,
  rds: 1.5,
  bds: 1.5,
};

// ── Notation type prefix ────────────────────────────────────────────────────
// Single source of truth for which type prefixes ("r:", "c:", "sc:", ...) are
// recognized. Previously this alternation was retyped by hand in 4 places —
// isNotationValid, parseNotation, reverseNotation, normalizeNotationInput —
// and one of them (reverseNotation) had already drifted out of sync, silently
// missing 'sc' and making split-chain reversal a no-op. TYPE_PREFIX_RE
// requires content after the colon (used where "type: pattern" is being
// pulled apart); TYPE_PREFIX_ONLY_RE matches just the prefix, no content
// required (used where we only need to strip/identify the prefix itself).
const NOTATION_TYPES = 'r|c|sc|sr|jk|fr';
const TYPE_PREFIX_RE = new RegExp(`^(${NOTATION_TYPES}):\\s*(.+)$`, 'i');
const TYPE_PREFIX_ONLY_RE = new RegExp(`^(${NOTATION_TYPES}):\\s*`, 'i');

// A single stitch-type token: optional count prefix + one of the six stitch
// types. (The /i flag already makes this case-insensitive, so the explicit
// uppercase alternatives some copies of this regex used to carry — RDS, DS,
// dS, etc. — were always redundant; dropped here.) Was duplicated 5x across
// buildSegmentLabel, getSegmentRuns, countActualStitches, countStitchesInRange,
// and getStitchTypes.
const STITCH_TOKEN_RE = /^(\d+)?\s*(bds|rds|ds|lss|rss|ss)$/i;

// Bare picot tokens only (p, sp, cp, lp, jp, jpg, bjp, cj, cjp, gp — with an
// optional count prefix). Deliberately narrower than isZeroWidth: this used
// to be a near-copy of isZeroWidth's alternation, hand-retyped 5x across
// buildSegmentLabel, getSegmentRuns, countActualStitches, countStitchesInRange,
// getStitchTypes. It looked like a safe swap for isZeroWidth(token) directly,
// but isZeroWidth also matches 'be' and the 'bc:'/'bp:'/'bcp:'/'sb:'/'bjp:'
// prefixed forms (correctly, for its own validation use), and those forms
// have their own position-advancing handlers a few lines below this check in
// every one of these functions — routing them through isZeroWidth here would
// intercept them before they reach those handlers and silently stop
// dsPosition from advancing. Keep this regex scoped to bare picots only.
const PICOT_TOKEN_RE = /^(\d+)?(sp|cp|p|lp|jp|jpg|bjp|cj|cjp|gp)$/i;

// Split a pattern into top-level tokens on '-' or '.', ignoring separators
// inside parens (so repeat groups like "2x(2ds-p)" stay intact as one part
// until the caller decides to expand them). Was duplicated near-verbatim as
// an inline char-by-char loop in 6 places: expandTokens, parseNotation,
// reverseNotation, buildSegmentLabel, getSegmentRuns, countActualStitches,
// countStitchesInRange.
const splitTopLevelParts = (pattern: string): string[] => {
  const parts: string[] = [];
  let current = '';
  let depth = 0;
  for (const char of pattern) {
    if (char === '(') depth++;
    if (char === ')') depth--;
    if ((char === '-' || char === '.') && depth === 0) {
      if (current.trim()) parts.push(current.trim());
      current = '';
    } else { current += char; }
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
};

// Match a repeat-group token like "2x(2ds-p)" or "(2ds-p)x2", returning the
// repeat count and the un-split inner pattern string, or null if the token
// isn't a repeat group. Each caller still owns its own expansion/recursion
// (some split the inner string with a plain /[-.]/  split, expandTokens
// recurses through itself/splitTopLevelParts) — only the regex-match-and-
// extract step is shared here, since that's what was duplicated 7x.
const matchRepeatGroup = (token: string): { count: number; countStr: string; inner: string; prefixForm: boolean } | null => {
  const m = token.match(/^(\d+)[x*]\((.+)\)$|^\((.+)\)[x*](\d+)$/i);
  if (!m) return null;
  const countStr = m[1] || m[4];
  return { count: parseInt(countStr), countStr, inner: m[2] || m[3], prefixForm: !!m[1] };
};

// Expand a core-bead sequence like "3Y2Z" (a run-length-encoded string of
// bead sizes) into a flat array of one-letter sizes, e.g. "3Y2Z" -> ['Y','Y',
// 'Y','Z','Z']. Used both where the actual per-bead sizes matter (parseNotation,
// which creates one picot per bead) and where only the total count matters
// (buildSegmentLabel, getSegmentRuns, countStitchesInRange, getStitchTypes,
// which just need beads.length to advance dsPosition) — those 4 sites used
// to hand-roll their own counting-only copy of this exact walk.
const expandBeadSequence = (seq: string): string[] => {
  const out: string[] = [];
  let i = 0;
  while (i < seq.length) {
    let count = 1;
    if (/\d/.test(seq[i])) { count = parseInt(seq[i]); i++; }
    if (i < seq.length && /[YZV]/i.test(seq[i])) {
      for (let j = 0; j < count; j++) out.push(seq[i].toUpperCase());
      i++;
    } else { i++; }
  }
  return out;
};

// ── Token helpers ──────────────────────────────────────────────────────────


// Parens are only meaningful as repeat groups ("2x(...)" / "(...)x2"). A
// paren pair with no adjacent x/* multiplier is just visual grouping (e.g.
// "2ds-(p-2ds)" written for clarity) and should behave exactly as if the
// parens weren't there. Every parser below only knew the multiplier form,
// so bare grouping parens fell through as an "Unknown element" token and
// got the whole notation rejected. This walks the pattern once, keeps
// parens that have a real multiplier attached (recursing into their
// content so nested bare parens still get unwrapped), and deletes the
// parens themselves everywhere else.
const stripBareGroupingParens = (pat: string): string => {
  let result = '';
  let i = 0;
  while (i < pat.length) {
    if (pat[i] === '(') {
      let depth = 1, j = i + 1;
      while (j < pat.length && depth > 0) {
        if (pat[j] === '(') depth++;
        else if (pat[j] === ')') depth--;
        j++;
      }
      const closeIdx = j - 1; // index of the matching ')'
      const before = pat.slice(0, i);
      const after = pat.slice(closeIdx + 1);
      const hasMultiplier = /(\d+)[x*]$/i.test(before) || /^[x*](\d+)/i.test(after);
      const inner = stripBareGroupingParens(pat.slice(i + 1, closeIdx));
      result += hasMultiplier ? `(${inner})` : inner;
      i = closeIdx + 1;
    } else {
      result += pat[i];
      i++;
    }
  }
  return result;
};

const normalizePattern = (pat: string): string =>
  stripBareGroupingParens(
    pat.trim()
      .replace(/\bspaces?\b/gi, '-')
      .replace(/(\d)d(?=[^s]|$)/g, '$1ds')
      .replace(/[\s.\-]+/g, '-')
  );


export const expandTokens = (pat: string): string[] => {
	pat = normalizePattern(pat);
  const parts = splitTopLevelParts(pat);
  const result: string[] = [];
  for (const part of parts) {
    const repeatMatch = matchRepeatGroup(part);
    if (repeatMatch) {
      const { count, inner } = repeatMatch;
      for (let i = 0; i < count; i++) result.push(...expandTokens(inner));
    } else { result.push(part); }
  }
  return result;
};

export const isZeroWidth = (token: string): boolean => {
  const t = token.toLowerCase().trim();
  if (t === 'be') return true;
  if (t.startsWith('bc:') || t.startsWith('bp:') || t.startsWith('bcp:') || t.startsWith('sb:') || t.startsWith('bjp:')) return true;
  return /^(\d+)?(p|sp|cp|lp|jp|jpg|bjp|cj|cjp|gp)$/i.test(t);
};

// ── Notation validation ────────────────────────────────────────────────────

export const isNotationValid = (notation: string): boolean => {
  try {
    const match = notation.match(TYPE_PREFIX_RE);
    if (!match) return false;
    const type = match[1].toLowerCase();
    const pattern = match[2];
    const tokens = expandTokens(pattern);
    let prevZero = false;
    for (const token of tokens) {
      const t = token.toLowerCase().trim();
      if (/^\d+(p|sp|cp|lp|jp|jpg|bjp|cj|cjp|gp)$/i.test(t)) return false;
      // Josephine Knot is ss-only (lss/rss count as ss variants) — no ds/rds/bds.
      if (type === 'jk' && /^(\d+)?\s*(ds|rds|bds)$/i.test(t)) return false;
      const zw = isZeroWidth(token);
      if (zw && prevZero) return false;
      prevZero = zw;
    }
    return true;
  } catch { return true; }
};

// ── Main parser ────────────────────────────────────────────────────────────

export interface ParsedPicot {
  id: string;
  stitchesBefore: number;
  length: 'small' | 'medium' | 'large';
  isJoint: boolean;
  isGuide: boolean;
  isGuidePoint: boolean;
  beadType: string | null;
  isCoreJoin?: boolean;
  hasPicotArm?: boolean;
  beadSeq?: string;
  beadSize?: string;
  coreSize?: string;
  beStructure?: string;
  beIsJoint?: boolean;
  coreBeads?: (string | null)[];
  picotBeads?: (string | null)[];
}

export interface ParsedNotation {
  type: string;
  stitchCount: number;
  picots: ParsedPicot[];
  isSplitChain: boolean;
}

export const parseNotation = (
  notation: string,
  silent = false,
  onError?: (msg: string | null) => void
): ParsedNotation | null => {
  try {
    if (!silent) onError?.(null);
    const match = notation.match(TYPE_PREFIX_RE);
    if (!match) {
      if (!silent) onError?.('Invalid format');
      return null;
    }
    const type = match[1].toLowerCase();
    const isSplitChain = type === 'sc';
    const effectiveType = isSplitChain ? 'c' : (type === 'fr' ? 'r' : type);
    const pattern = stripBareGroupingParens(match[2]);
    let totalDS = 0;
    const picots: ParsedPicot[] = [];
    let hasInvalidToken = false;

    const parts = splitTopLevelParts(pattern);

    const processToken = (token: string, pos: number): number => {
      const repeatMatch = matchRepeatGroup(token);
      if (repeatMatch) {
        const { count, inner } = repeatMatch;
        const innerParts = inner.split(/[-.]/).map(s => s.trim());
        for (let i = 0; i < count; i++) for (let part of innerParts) pos = processToken(part, pos);
        return pos;
      }

      if (token.match(/^be$/i)) {
        picots.push({ id: generateId(), stitchesBefore: pos, length: 'medium', isJoint: false,
          isGuide: false, isGuidePoint: false, beadType: 'be', beStructure: 'core',
          beIsJoint: false, coreBeads: [null, null, null], picotBeads: [null, null, null] });
        return pos + 1;
      }

      const beadedJointPicotMatch = token.match(/^bjp:([YZVyzv0-9]+)$/i);
      if (beadedJointPicotMatch) {
        picots.push({ id: generateId(), stitchesBefore: pos, length: 'medium',
          isJoint: true, isGuide: false, isGuidePoint: false, beadType: 'bjp',
          beadSeq: beadedJointPicotMatch[1].toUpperCase() });
        return pos;
      }

      const beadedPicotMatch = token.match(/^bp:([YZVyzv0-9]+)$/i);
      if (beadedPicotMatch) {
        picots.push({ id: generateId(), stitchesBefore: pos, length: 'medium',
          isJoint: false, isGuide: false, isGuidePoint: false, beadType: 'bp',
          beadSeq: beadedPicotMatch[1].toUpperCase() });
        return pos;
      }

      const suspendedBeadMatch = token.match(/^sb:([YZVyzv0-9]+)$/i);
      if (suspendedBeadMatch) {
        picots.push({ id: generateId(), stitchesBefore: pos, length: 'medium',
          isJoint: false, isGuide: false, isGuidePoint: false, beadType: 'sb',
          beadSeq: suspendedBeadMatch[1].toUpperCase() });
        return pos;
      }

      const bcpPlainMatch = token.match(/^bcp:([YZVyzv])$/i);
      if (bcpPlainMatch) {
        picots.push({ id: generateId(), stitchesBefore: pos, length: 'medium',
          isJoint: false, isGuide: false, isGuidePoint: false, beadType: 'bcp',
          coreSize: bcpPlainMatch[1].toUpperCase(), beadSeq: undefined });
        return pos + 1;
      }

      const bcpMatch = token.match(/^bcp:([YZVyzv]):([YZVyzv0-9]+)$/i);
      if (bcpMatch) {
        picots.push({ id: generateId(), stitchesBefore: pos, length: 'medium',
          isJoint: false, isGuide: false, isGuidePoint: false, beadType: 'bcp',
          coreSize: bcpMatch[1].toUpperCase(), beadSeq: bcpMatch[2].toUpperCase() });
        return pos + 1;
      }

      const coreBeadMatch = token.match(/^bc:([YZVyzv0-9]+)$/i);
      if (coreBeadMatch) {
        const rawSeq = coreBeadMatch[1].toUpperCase();
        const beads = expandBeadSequence(rawSeq);
        beads.forEach((size, idx) => {
          picots.push({ id: generateId(), stitchesBefore: pos + idx, length: 'medium',
            isJoint: false, isGuide: false, isGuidePoint: false, beadType: 'bc', beadSize: size });
        });
        return pos + beads.length;
      }

      const tokenMatch = token.match(/^(\d+)?\s*(bds|rds|ds|lss|rss|ss|sp|cp|p|lp|jp|jpg|cj|cjp|gp|bp|bp1|bp2|bp3|bp4|bp5|sP|cP|LP|Lp|lP|CP|SP|JP|JPG|CJ|CJP|Cj|Cjp|cJ|cJp|GP|Gp|gP|BP|Bp|bP|BP1|BP2|BP3|BP4|BP5|RDS|Rds|rDs|DS|Ds|dS|LSS|RSS|SS|P)$/i);
      if (!tokenMatch) {
        if (!silent) onError?.('Unknown element: ' + token);
        hasInvalidToken = true;
        return pos;
      }

      const num = parseInt(tokenMatch[1]) || 1;
      const el = tokenMatch[2].toLowerCase();
      if (el === 'ds' || el === 'rds' || el === 'bds' || el === 'ss' || el === 'lss' || el === 'rss') {
        // Josephine Knot is ss-only (lss/rss count as ss variants) — reject ds/rds/bds.
        if (type === 'jk' && (el === 'ds' || el === 'rds' || el === 'bds')) {
          if (!silent) onError?.('Josephine Knot only accepts ss stitches: ' + token);
          hasInvalidToken = true;
          return pos;
        }
        return pos + num * STITCH_WIDTH_DS[el];
      }

      let size: 'small' | 'medium' | 'large' = 'medium';
      let isJoint = false, isGuide = false, isGuidePoint = false;
      let beadType: string | null = null;
      let isCoreJoin = false, hasPicotArm = false;

      if (el === 'jp') { isJoint = true; }
      else if (el === 'bjp') { isJoint = true; }
      else if (el === 'jpg') { isJoint = true; isGuide = true; }
      else if (el === 'cj') { isJoint = true; isCoreJoin = true; }
      else if (el === 'cjp') { isJoint = true; isCoreJoin = true; hasPicotArm = true; }
      else if (el === 'gp') { isGuidePoint = true; isGuide = true; }
      else if (el === 'bp') { beadType = 'default'; }
      else if (el === 'bp1') { beadType = 'type1'; }
      else if (el === 'bp2') { beadType = 'type2'; }
      else if (el === 'bp3') { beadType = 'type3'; }
      else if (el === 'bp4') { beadType = 'type4'; }
      else if (el === 'bp5') { beadType = 'type5'; }
      else if (el === 'lp') { size = 'large'; }
      else if (el === 'sp' || el === 'cp') { size = 'small'; }

      for (let i = 0; i < num; i++) {
        picots.push({ id: generateId(), stitchesBefore: pos, length: size,
          isJoint, isGuide, isGuidePoint, beadType,
          isCoreJoin: isCoreJoin || undefined, hasPicotArm: hasPicotArm || undefined });
      }
      return pos;
    };

    let position = 0;
    for (let part of parts) position = processToken(part, position);
    totalDS = position;
    if (hasInvalidToken) return null;
    return { type: effectiveType, stitchCount: totalDS, picots, isSplitChain };
  } catch (err) {
    if (!silent) onError?.('Parse error');
    return null;
  }
};

// ── Notation reversal ──────────────────────────────────────────────────────

export const reverseNotation = (notation: string): string => {
  try {
    const match = notation.match(TYPE_PREFIX_RE);
    if (!match) return notation;
    const type = match[1];
    const pattern = match[2];
    const parts = splitTopLevelParts(pattern);
    const processedParts = parts.reverse().map(part => {
      const repeatMatch = matchRepeatGroup(part);
      if (repeatMatch) {
        const { countStr, inner, prefixForm } = repeatMatch;
        const innerParts = inner.split(/[-.]/).map(s => s.trim());
        const reversedInner = innerParts.reverse().join('-');
        return prefixForm ? `${countStr}x(${reversedInner})` : `(${reversedInner})x${countStr}`;
      }
      return part;
    });
    return `${type}: ${processedParts.join('-')}`;
  } catch (err) {
    console.error('Error reversing notation:', err);
    return notation;
  }
};

// ── Segment label builder ──────────────────────────────────────────────────

export const buildSegmentLabel = (notation: string, startDS: number, endDS: number): string => {
  try {
    const pattern = notation.split(':').slice(1).join(':').trim();
    if (!pattern) return '';
    const parts = splitTopLevelParts(pattern);

    const runs: { type: string; count: number }[] = [];
    let dsPosition = 0;
    const addRun = (type: string, n: number) => {
      if (runs.length > 0 && runs[runs.length - 1].type === type) runs[runs.length - 1].count += n;
      else runs.push({ type, count: n });
    };
    const processToken = (token: string) => {
      const repeatMatch = matchRepeatGroup(token);
      if (repeatMatch) {
        const { count: repeatCount, inner } = repeatMatch;
        const innerParts = inner.split(/[-.]/).map(s => s.trim());
        for (let i = 0; i < repeatCount; i++) innerParts.forEach(p => processToken(p));
        return;
      }
      if (PICOT_TOKEN_RE.test(token)) return;
      if (token.match(/^bp:/i) || token.match(/^bjp:/i) || token.match(/^sb:/i)) return;
      if (token.match(/^bcp:/i)) { dsPosition += 1; return; }
      if (token.match(/^bcjp:/i)) { dsPosition += 1; return; }
      if (token.match(/^be$/i)) { dsPosition += 1; return; }
      const coreBeadMatch = token.match(/^bc:([YZVyzv0-9]+)$/i);
      if (coreBeadMatch) {
        dsPosition += expandBeadSequence(coreBeadMatch[1].toUpperCase()).length;
        return;
      }
      const match = token.match(STITCH_TOKEN_RE);
      if (!match) return;
      const num = parseInt(match[1]) || 1;
      const type = match[2].toLowerCase();
      const advance = STITCH_WIDTH_DS[type] ?? 0.5;
      for (let i = 0; i < num; i++) {
        const stitchStart = dsPosition, stitchEnd = dsPosition + advance;
        if (stitchEnd > startDS && stitchStart < endDS) addRun(type, 1);
        dsPosition = stitchEnd;
      }
    };
    for (let part of parts) processToken(part);
    if (runs.length === 0) return '';
    const allBasic = runs.every(r => r.type === 'ds' || r.type === 'rds' || r.type === 'bds');
    if (allBasic) return String(runs.reduce((s, r) => s + r.count, 0));
    return runs.map(r => {
      if (r.type === 'ds') return String(r.count);
      if (r.type === 'rds') return `${r.count}rds`;
      return `${r.count}${r.type}`;
    }).join('·');
  } catch (err) {
    console.error('buildSegmentLabel error:', err);
    return '';
  }
};

// ── Segment runs ────────────────────────────────────────────────────────────

export const getSegmentRuns = (notation: string, startDS: number, endDS: number) => {
  try {
    const pattern = notation.split(':').slice(1).join(':').trim();
    if (!pattern) return [];
    const parts = splitTopLevelParts(pattern);
    const runs: { type: string; count: number; runStartDS: number; runEndDS: number }[] = [];
    let dsPosition = 0;
    const addStitch = (type: string, stitchStart: number, stitchEnd: number) => {
      if (stitchEnd <= startDS || stitchStart >= endDS) return;
      const last = runs[runs.length - 1];
      if (last && last.type === type && Math.abs(last.runEndDS - stitchStart) < 1e-9) {
        last.count++; last.runEndDS = stitchEnd;
      } else { runs.push({ type, count: 1, runStartDS: stitchStart, runEndDS: stitchEnd }); }
    };
    const processToken = (token: string) => {
      const repeatMatch = matchRepeatGroup(token);
      if (repeatMatch) {
        const { count: repeatCount, inner } = repeatMatch;
        const innerParts = inner.split(/[-.]/).map(s => s.trim());
        for (let i = 0; i < repeatCount; i++) innerParts.forEach(p => processToken(p));
        return;
      }
      if (PICOT_TOKEN_RE.test(token)) return;
      if (token.match(/^bp:/i) || token.match(/^bjp:/i) || token.match(/^sb:/i)) return;
      if (token.match(/^bcp:/i)) { dsPosition += 1; return; }
      if (token.match(/^bcjp:/i)) { dsPosition += 1; return; }
      if (token.match(/^be$/i)) { dsPosition += 1; return; }
      const coreBeadMatch = token.match(/^bc:([YZVyzv0-9]+)$/i);
      if (coreBeadMatch) {
        dsPosition += expandBeadSequence(coreBeadMatch[1].toUpperCase()).length;
        return;
      }
      const match = token.match(STITCH_TOKEN_RE);
      if (!match) return;
      const num = parseInt(match[1]) || 1;
      const type = match[2].toLowerCase();
      const advance = STITCH_WIDTH_DS[type] ?? 0.5;
      for (let i = 0; i < num; i++) { addStitch(type, dsPosition, dsPosition + advance); dsPosition += advance; }
    };
    for (let part of parts) processToken(part);
    return runs.map(r => ({
      label: r.type === 'ds' ? String(r.count) : r.type === 'rds' ? `${r.count}rds` : `${r.count}${r.type}`,
      midDS: (r.runStartDS + r.runEndDS) / 2,
      startDS: r.runStartDS,
      endDS: r.runEndDS,
    }));
  } catch (err) {
    console.error('getSegmentRuns error:', err);
    return [];
  }
};

// ── Stitch counters ────────────────────────────────────────────────────────

export const countActualStitches = (notation: string): number => {
  let count = 0;
  try {
    const pattern = notation.split(':').slice(1).join(':').trim();
    if (!pattern) return 0;
    const parts = splitTopLevelParts(pattern);
    const processToken = (token: string) => {
      const repeatMatch = matchRepeatGroup(token);
      if (repeatMatch) {
        const { count: repeatCount, inner } = repeatMatch;
        const innerParts = inner.split(/[-.]/).map(s => s.trim());
        for (let i = 0; i < repeatCount; i++) for (let part of innerParts) processToken(part);
        return;
      }
      if (PICOT_TOKEN_RE.test(token)) return;
      if (token.match(/^bp:/i) || token.match(/^bjp:/i) || token.match(/^sb:/i)) return;
      if (token.match(/^bc:/i) || token.match(/^bcp:/i)) return;
      const match = token.match(STITCH_TOKEN_RE);
      if (match) count += parseInt(match[1]) || 1;
    };
    for (let part of parts) processToken(part);
  } catch (err) { console.error('Error counting stitches:', err); }
  return count;
};

export const countStitchesInRange = (notation: string, startDS: number, endDS: number): number => {
  let count = 0;
  try {
    const pattern = notation.split(':').slice(1).join(':').trim();
    if (!pattern) return 0;
    const parts = splitTopLevelParts(pattern);
    let dsPosition = 0;
    const processToken = (token: string) => {
      const repeatMatch = matchRepeatGroup(token);
      if (repeatMatch) {
        const { count: repeatCount, inner } = repeatMatch;
        const innerParts = inner.split(/[-.]/).map(s => s.trim());
        for (let i = 0; i < repeatCount; i++) for (let part of innerParts) processToken(part);
        return;
      }
      if (PICOT_TOKEN_RE.test(token)) return;
      if (token.match(/^bp:/i) || token.match(/^bjp:/i) || token.match(/^sb:/i)) return;
      if (token.match(/^bcp:/i)) { dsPosition += 1; return; }
      if (token.match(/^bcjp:/i)) { dsPosition += 1; return; }
      if (token.match(/^be$/i)) { dsPosition += 1; return; }
      const coreBeadSkipMatch = token.match(/^bc:([YZVyzv0-9]+)$/i);
      if (coreBeadSkipMatch) {
        dsPosition += expandBeadSequence(coreBeadSkipMatch[1].toUpperCase()).length;
        return;
      }
      const match = token.match(STITCH_TOKEN_RE);
      if (match) {
        const num = parseInt(match[1]) || 1;
        const type = match[2].toLowerCase();
        for (let i = 0; i < num; i++) {
          const stitchStartDS = dsPosition;
          const stitchEndDS = dsPosition + (STITCH_WIDTH_DS[type] ?? 0.5);
          if (stitchEndDS > startDS && stitchStartDS < endDS) count++;
          dsPosition = stitchEndDS;
        }
      }
    };
    for (let part of parts) processToken(part);
  } catch (err) { console.error('Error counting stitches in range:', err); }
  return count;
};

// ── Stitch type map ────────────────────────────────────────────────────────
// Returns a map from DS position → stitch type, used by realistic renderer

export const getStitchTypes = (
  notation: string,
  cache?: Map<string, Record<number, string | string[]>>
): Record<number, string | string[]> => {
  if (cache?.has(notation)) return cache.get(notation)!;
  const stitchMap: Record<number, string | string[]> = {};
  try {
    const parts = notation.split(':').slice(1).join(':').trim().split(/[,.\-]/).map(s => s.trim()) || [];
    let dsPosition = 0;
    for (let part of parts) {
      if (PICOT_TOKEN_RE.test(part)) continue;
      if (part.match(/^bp:/i) || part.match(/^bjp:/i) || part.match(/^sb:/i)) continue;
      if (part.match(/^bcp:/i)) { dsPosition += 1; continue; }
      if (part.match(/^bcjp:/i)) { dsPosition += 1; continue; }
      if (part.match(/^be$/i)) { dsPosition += 1; continue; }
      const coreBeadTypeMatch = part.match(/^bc:([YZVyzv0-9]+)$/i);
      if (coreBeadTypeMatch) {
        dsPosition += expandBeadSequence(coreBeadTypeMatch[1].toUpperCase()).length;
        continue;
      }
      const match = part.match(STITCH_TOKEN_RE);
      if (match) {
        const count = parseInt(match[1]) || 1;
        const type = match[2].toLowerCase();
        for (let i = 0; i < count; i++) {
          if (type === 'rds' || type === 'bds') { stitchMap[dsPosition] = 'rds'; stitchMap[dsPosition + 0.5] = 'rds-cont'; stitchMap[dsPosition + 1.0] = 'rds-cont'; dsPosition += STITCH_WIDTH_DS.rds; }
          else if (type === 'ds') { stitchMap[dsPosition] = 'ds'; dsPosition += STITCH_WIDTH_DS.ds; }
          else if (type === 'ss') { stitchMap[dsPosition] = ['ss', 'ss']; dsPosition += STITCH_WIDTH_DS.ss; }
          else if (type === 'lss') { stitchMap[dsPosition] = ['lss', 'lss']; dsPosition += STITCH_WIDTH_DS.lss; }
          else if (type === 'rss') { stitchMap[dsPosition] = ['rss', 'rss']; dsPosition += STITCH_WIDTH_DS.rss; }
        }
      }
    }
  } catch (err) { console.error('Error parsing stitch types:', err); }
  cache?.set(notation, stitchMap);
  return stitchMap;
  };
  export const normalizeNotationInput = (notation: string): string => {
  const match = notation.match(TYPE_PREFIX_ONLY_RE);
  if (!match) return notation;
  const prefix = match[0];
let pat = normalizePattern(notation.slice(prefix.length));
  return prefix.trimEnd().replace(/:$/, '') + ': ' + pat;
};
