// parser.ts — Pure tatting notation parsing functions, no React dependencies
// All functions are stateless and side-effect free.
// The one exception is parseNotation which accepts an optional onError callback
// instead of calling setNotationError directly.

import { generateId } from '../utils/id';

// ── Token helpers ──────────────────────────────────────────────────────────

export const expandTokens = (pat: string): string[] => {
  const parts: string[] = [];
  let current = '';
  let depth = 0;
  for (const char of pat) {
    if (char === '(') depth++;
    if (char === ')') depth--;
    if ((char === '-' || char === '.') && depth === 0) {
      if (current.trim()) parts.push(current.trim());
      current = '';
    } else { current += char; }
  }
  if (current.trim()) parts.push(current.trim());
  const result: string[] = [];
  for (const part of parts) {
    const repeatMatch = part.match(/^(\d+)[x*]\((.+)\)$|^\((.+)\)[x*](\d+)$/i);
    if (repeatMatch) {
      const count = parseInt(repeatMatch[1] || repeatMatch[4]);
      const inner = repeatMatch[2] || repeatMatch[3];
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
    const match = notation.match(/^(r|c|sc|sr):\s*(.+)$/i);
    if (!match) return false;
    const pattern = match[2];
    const tokens = expandTokens(pattern);
    let prevZero = false;
    for (const token of tokens) {
      const t = token.toLowerCase().trim();
      if (/^\d+(p|sp|cp|lp|jp|jpg|bjp|cj|cjp|gp)$/i.test(t)) return false;
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
    const match = notation.match(/^(r|c|sc|sr|jk|fr):\s*(.+)$/i);
    if (!match) {
      if (!silent) onError?.('Invalid format');
      return null;
    }
    const type = match[1].toLowerCase();
    const isSplitChain = type === 'sc';
    const effectiveType = isSplitChain ? 'c' : type;
    const pattern = match[2];
    let totalDS = 0;
    const picots: ParsedPicot[] = [];
    let hasInvalidToken = false;

    const parts: string[] = [];
    let current = '';
    let depth = 0;
    for (let char of pattern) {
      if (char === '(') depth++;
      if (char === ')') depth--;
      if ((char === '-' || char === '.') && depth === 0) {
        if (current.trim()) parts.push(current.trim());
        current = '';
      } else { current += char; }
    }
    if (current.trim()) parts.push(current.trim());

    const processToken = (token: string, pos: number): number => {
      const repeatMatch = token.match(/^(\d+)[x*]\((.+)\)$|^\((.+)\)[x*](\d+)$/i);
      if (repeatMatch) {
        const count = parseInt(repeatMatch[1] || repeatMatch[4]);
        const innerParts = (repeatMatch[2] || repeatMatch[3]).split(/[-.]/).map(s => s.trim());
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
        const expandSeq = (seq: string): string[] => {
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
        const beads = expandSeq(rawSeq);
        beads.forEach((size, idx) => {
          picots.push({ id: generateId(), stitchesBefore: pos + idx, length: 'medium',
            isJoint: false, isGuide: false, isGuidePoint: false, beadType: 'bc', beadSize: size });
        });
        return pos + beads.length;
      }

      const tokenMatch = token.match(/^(\d+)?\s*(rds|ds|lss|rss|ss|sp|cp|p|lp|jp|jpg|cj|cjp|gp|bp|bp1|bp2|bp3|bp4|bp5|sP|cP|LP|Lp|lP|CP|SP|JP|JPG|CJ|CJP|Cj|Cjp|cJ|cJp|GP|Gp|gP|BP|Bp|bP|BP1|BP2|BP3|BP4|BP5|RDS|Rds|rDs|DS|Ds|dS|LSS|RSS|SS|P)$/i);
      if (!tokenMatch) {
        if (!silent) onError?.('Unknown element: ' + token);
        hasInvalidToken = true;
        return pos;
      }

      const num = parseInt(tokenMatch[1]) || 1;
      const el = tokenMatch[2].toLowerCase();
      if (el === 'ds') return pos + num;
      if (el === 'rds') return pos + num * 2;
      if (el === 'ss' || el === 'lss' || el === 'rss') return pos + num * 0.5;

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
    const match = notation.match(/^(r|c|sr|jk|fr):\s*(.+)$/i);
    if (!match) return notation;
    const type = match[1];
    const pattern = match[2];
    const parts: string[] = [];
    let current = '', depth = 0;
    for (let char of pattern) {
      if (char === '(') depth++;
      if (char === ')') depth--;
      if ((char === '-' || char === '.') && depth === 0) {
        if (current.trim()) parts.push(current.trim());
        current = '';
      } else { current += char; }
    }
    if (current.trim()) parts.push(current.trim());
    const processedParts = parts.reverse().map(part => {
      const repeatMatch = part.match(/^(\d+)[x*]\((.+)\)$|^\((.+)\)[x*](\d+)$/i);
      if (repeatMatch) {
        const count = repeatMatch[1] || repeatMatch[4];
        const innerParts = (repeatMatch[2] || repeatMatch[3]).split(/[-.]/).map(s => s.trim());
        const reversedInner = innerParts.reverse().join('-');
        return repeatMatch[1] ? `${count}x(${reversedInner})` : `(${reversedInner})x${count}`;
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
    const parts: string[] = [];
    let current = '', depth = 0;
    for (let char of pattern) {
      if (char === '(') depth++; if (char === ')') depth--;
      if ((char === '-' || char === '.') && depth === 0) { if (current.trim()) parts.push(current.trim()); current = ''; }
      else { current += char; }
    }
    if (current.trim()) parts.push(current.trim());

    const runs: { type: string; count: number }[] = [];
    let dsPosition = 0;
    const addRun = (type: string, n: number) => {
      if (runs.length > 0 && runs[runs.length - 1].type === type) runs[runs.length - 1].count += n;
      else runs.push({ type, count: n });
    };
    const processToken = (token: string) => {
      const repeatMatch = token.match(/^(\d+)[x*]\((.+)\)$|^\((.+)\)[x*](\d+)$/i);
      if (repeatMatch) {
        const repeatCount = parseInt(repeatMatch[1] || repeatMatch[4]);
        const innerParts = (repeatMatch[2] || repeatMatch[3]).split(/[-.]/).map(s => s.trim());
        for (let i = 0; i < repeatCount; i++) innerParts.forEach(p => processToken(p));
        return;
      }
      if (token.match(/^(sp|cp|p|lp|jp|jpg|cj|cjp|gp|sP|cP|LP|Lp|lP|CP|SP|JP|JPG|CJ|CJP|GP|Gp|gP|P)$/i)) return;
      if (token.match(/^bp:/i) || token.match(/^bjp:/i) || token.match(/^sb:/i)) return;
      if (token.match(/^bcp:/i)) { dsPosition += 1; return; }
      if (token.match(/^bcjp:/i)) { dsPosition += 1; return; }
      if (token.match(/^be$/i)) { dsPosition += 1; return; }
      const coreBeadMatch = token.match(/^bc:([YZVyzv0-9]+)$/i);
      if (coreBeadMatch) {
        const seq = coreBeadMatch[1].toUpperCase();
        let n = 0, i = 0;
        while (i < seq.length) {
          let cnt = 1;
          if (/\d/.test(seq[i])) { cnt = parseInt(seq[i]); i++; }
          if (i < seq.length && /[YZV]/i.test(seq[i])) { n += cnt; i++; } else { i++; }
        }
        dsPosition += n; return;
      }
      const match = token.match(/^(\d+)?\s*(rds|ds|lss|rss|ss|RDS|Rds|rDs|DS|Ds|dS|LSS|RSS|SS)$/i);
      if (!match) return;
      const num = parseInt(match[1]) || 1;
      const type = match[2].toLowerCase();
      const advance = type === 'rds' ? 2 : type === 'ds' ? 1 : 0.5;
      for (let i = 0; i < num; i++) {
        const stitchStart = dsPosition, stitchEnd = dsPosition + advance;
        if (stitchEnd > startDS && stitchStart < endDS) addRun(type, 1);
        dsPosition = stitchEnd;
      }
    };
    for (let part of parts) processToken(part);
    if (runs.length === 0) return '';
    const allBasic = runs.every(r => r.type === 'ds' || r.type === 'rds');
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
    const parts: string[] = [];
    let current = '', depth = 0;
    for (let char of pattern) {
      if (char === '(') depth++; if (char === ')') depth--;
      if ((char === '-' || char === '.') && depth === 0) { if (current.trim()) parts.push(current.trim()); current = ''; }
      else { current += char; }
    }
    if (current.trim()) parts.push(current.trim());
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
      const repeatMatch = token.match(/^(\d+)[x*]\((.+)\)$|^\((.+)\)[x*](\d+)$/i);
      if (repeatMatch) {
        const repeatCount = parseInt(repeatMatch[1] || repeatMatch[4]);
        const innerParts = (repeatMatch[2] || repeatMatch[3]).split(/[-.]/).map(s => s.trim());
        for (let i = 0; i < repeatCount; i++) innerParts.forEach(p => processToken(p));
        return;
      }
      if (token.match(/^(sp|cp|p|lp|jp|jpg|cj|cjp|gp|sP|cP|LP|Lp|lP|CP|SP|JP|JPG|CJ|CJP|GP|Gp|gP|P)$/i)) return;
      if (token.match(/^bp:/i) || token.match(/^bjp:/i) || token.match(/^sb:/i)) return;
      if (token.match(/^bcp:/i)) { dsPosition += 1; return; }
      if (token.match(/^bcjp:/i)) { dsPosition += 1; return; }
      if (token.match(/^be$/i)) { dsPosition += 1; return; }
      const coreBeadMatch = token.match(/^bc:([YZVyzv0-9]+)$/i);
      if (coreBeadMatch) {
        const seq = coreBeadMatch[1].toUpperCase();
        let n = 0, i = 0;
        while (i < seq.length) {
          let cnt = 1;
          if (/\d/.test(seq[i])) { cnt = parseInt(seq[i]); i++; }
          if (i < seq.length && /[YZV]/i.test(seq[i])) { n += cnt; i++; } else { i++; }
        }
        dsPosition += n; return;
      }
      const match = token.match(/^(\d+)?\s*(rds|ds|lss|rss|ss|RDS|Rds|rDs|DS|Ds|dS|LSS|RSS|SS)$/i);
      if (!match) return;
      const num = parseInt(match[1]) || 1;
      const type = match[2].toLowerCase();
      const advance = type === 'rds' ? 2 : type === 'ds' ? 1 : 0.5;
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
    const parts: string[] = [];
    let current = '', depth = 0;
    for (let char of pattern) {
      if (char === '(') depth++; if (char === ')') depth--;
      if ((char === '-' || char === '.') && depth === 0) { if (current.trim()) parts.push(current.trim()); current = ''; }
      else { current += char; }
    }
    if (current.trim()) parts.push(current.trim());
    const processToken = (token: string) => {
      const repeatMatch = token.match(/^(\d+)[x*]\((.+)\)$|^\((.+)\)[x*](\d+)$/i);
      if (repeatMatch) {
        const repeatCount = parseInt(repeatMatch[1] || repeatMatch[4]);
        const innerParts = (repeatMatch[2] || repeatMatch[3]).split(/[-.]/).map(s => s.trim());
        for (let i = 0; i < repeatCount; i++) for (let part of innerParts) processToken(part);
        return;
      }
      if (token.match(/^(sp|cp|p|lp|jp|jpg|cj|cjp|gp|sP|cP|LP|Lp|lP|CP|SP|JP|JPG|CJ|CJP|GP|Gp|gP|P)$/i)) return;
      if (token.match(/^bp:/i) || token.match(/^bjp:/i) || token.match(/^sb:/i)) return;
      if (token.match(/^bc:/i) || token.match(/^bcp:/i)) return;
      const match = token.match(/^(\d+)?\s*(rds|ds|lss|rss|ss|RDS|Rds|rDs|DS|Ds|dS|LSS|RSS|SS)$/i);
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
    const parts: string[] = [];
    let current = '', depth = 0;
    for (let char of pattern) {
      if (char === '(') depth++; if (char === ')') depth--;
      if ((char === '-' || char === '.') && depth === 0) { if (current.trim()) parts.push(current.trim()); current = ''; }
      else { current += char; }
    }
    if (current.trim()) parts.push(current.trim());
    let dsPosition = 0;
    const processToken = (token: string) => {
      const repeatMatch = token.match(/^(\d+)[x*]\((.+)\)$|^\((.+)\)[x*](\d+)$/i);
      if (repeatMatch) {
        const repeatCount = parseInt(repeatMatch[1] || repeatMatch[4]);
        const innerParts = (repeatMatch[2] || repeatMatch[3]).split(/[-.]/).map(s => s.trim());
        for (let i = 0; i < repeatCount; i++) for (let part of innerParts) processToken(part);
        return;
      }
      if (token.match(/^(sp|cp|p|lp|jp|jpg|cj|cjp|gp|sP|cP|LP|Lp|lP|CP|SP|JP|JPG|CJ|CJP|GP|Gp|gP|P)$/i)) return;
      if (token.match(/^bp:/i) || token.match(/^bjp:/i) || token.match(/^sb:/i)) return;
      if (token.match(/^bcp:/i)) { dsPosition += 1; return; }
      if (token.match(/^bcjp:/i)) { dsPosition += 1; return; }
      if (token.match(/^be$/i)) { dsPosition += 1; return; }
      const coreBeadSkipMatch = token.match(/^bc:([YZVyzv0-9]+)$/i);
      if (coreBeadSkipMatch) {
        const seq = coreBeadSkipMatch[1].toUpperCase();
        let n = 0, i = 0;
        while (i < seq.length) {
          let cnt = 1;
          if (/\d/.test(seq[i])) { cnt = parseInt(seq[i]); i++; }
          if (i < seq.length && /[YZV]/i.test(seq[i])) { n += cnt; i++; } else { i++; }
        }
        dsPosition += n; return;
      }
      const match = token.match(/^(\d+)?\s*(rds|ds|lss|rss|ss|RDS|Rds|rDs|DS|Ds|dS|LSS|RSS|SS)$/i);
      if (match) {
        const num = parseInt(match[1]) || 1;
        const type = match[2].toLowerCase();
        for (let i = 0; i < num; i++) {
          const stitchStartDS = dsPosition;
          const stitchEndDS = dsPosition + (type === 'ds' ? 1 : type === 'rds' ? 2 : 0.5);
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
      if (part.match(/^(sp|cp|p|lp|jp|jpg|cj|cjp|gp|sP|cP|LP|Lp|lP|CP|SP|JP|JPG|CJ|CJP|GP|Gp|gP|P)$/i)) continue;
      if (part.match(/^bp:/i) || part.match(/^bjp:/i) || part.match(/^sb:/i)) continue;
      if (part.match(/^bcp:/i)) { dsPosition += 1; continue; }
      if (part.match(/^bcjp:/i)) { dsPosition += 1; continue; }
      if (part.match(/^be$/i)) { dsPosition += 1; continue; }
      const coreBeadTypeMatch = part.match(/^bc:([YZVyzv0-9]+)$/i);
      if (coreBeadTypeMatch) {
        const seq = coreBeadTypeMatch[1].toUpperCase();
        let n = 0, si = 0;
        while (si < seq.length) {
          let cnt = 1;
          if (/\d/.test(seq[si])) { cnt = parseInt(seq[si]); si++; }
          if (si < seq.length && /[YZV]/i.test(seq[si])) { n += cnt; si++; } else { si++; }
        }
        dsPosition += n; continue;
      }
      const match = part.match(/^(\d+)?\s*(rds|ds|lss|rss|ss|RDS|Rds|rDs|DS|Ds|dS|LSS|RSS|SS)$/i);
      if (match) {
        const count = parseInt(match[1]) || 1;
        const type = match[2].toLowerCase();
        for (let i = 0; i < count; i++) {
          if (type === 'rds') { stitchMap[dsPosition] = 'rds'; stitchMap[dsPosition + 1] = 'rds-cont'; dsPosition += 2; }
          else if (type === 'ds') { stitchMap[dsPosition] = 'ds'; dsPosition += 1; }
          else if (type === 'ss') { stitchMap[dsPosition] = ['ss', 'ss']; dsPosition += 0.5; }
          else if (type === 'lss') { stitchMap[dsPosition] = ['lss', 'lss']; dsPosition += 0.5; }
          else if (type === 'rss') { stitchMap[dsPosition] = ['rss', 'rss']; dsPosition += 0.5; }
        }
      }
    }
  } catch (err) { console.error('Error parsing stitch types:', err); }
  cache?.set(notation, stitchMap);
  return stitchMap;
};
