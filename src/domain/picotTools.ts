// picotTools.ts — Picot Wizard: add / clear picots directly on notation text.
//
// Pure functions only. Callers hand the result to updateNotation(), which
// already owns re-parsing, path scaling, ghost regen, and the confirm-and-wipe
// dialog when the element has existing joins — this file doesn't duplicate any
// of that, it only computes the new notation string.
//
// SCOPE (v1 — "add" and "clear/reduce"): plain ds runs and plain picot tokens
// only. Split rings (dual A/B notation), rds/ss/lss/rss stitch types, and bead
// tokens (be, bc:, bp:, bjp:, sb:, bcp:) are out of scope — analyzeNotation
// reports `supported: false` for any of these rather than guessing. Fill
// density and length-aware scaling (which need the "protected zone" floor
// around joined end picots) are not implemented here; they're a separate,
// larger pass.

import { expandTokens, isZeroWidth } from './parser';

// Editable picot tokens — the ones this tool is allowed to add or remove.
// (jp/jpg/cj/cjp are included because a token typed as one of these is
// structurally identical to a plain "p" for run-splitting purposes; whether
// it's "joined" for our purposes comes from the runtime picot's isJoint flag,
// not from which of these token spellings was used.)
const EDITABLE_PICOT_RE = /^(sp|cp|p|lp|jp|jpg|cj|cjp|gp)$/i;
const DS_RE = /^(\d+)?\s*ds$/i;
const PREFIX_RE = /^(r|c|sc|sr):\s*/i;

export interface WizardSegment {
  kind: 'run' | 'picot' | 'barrier';
  raw: string;
  ds?: number;
  joined?: boolean;
}

export interface WizardAnalysis {
  supported: boolean;
  reason?: 'unparsable' | 'splitRing' | 'unsupportedToken' | 'picotMismatch';
  segments: WizardSegment[];
  type: string; // e.g. "r", "c" — original captured case
}

function splitPrefix(notation: string): { type: string; pattern: string } | null {
  const m = notation.match(PREFIX_RE);
  if (!m) return null;
  return { type: m[1], pattern: notation.slice(m[0].length) };
}

// Walks the notation into an alternating run/picot/barrier sequence, using
// el.picots (in token order) to know which zero-width tokens are currently
// joined. Bails with supported:false rather than guessing when it hits
// anything outside plain ds + plain picots.
export function analyzeNotation(notation: string, picots: any[] | undefined): WizardAnalysis {
  const split = splitPrefix(notation || '');
  if (!split) return { supported: false, reason: 'unparsable', segments: [], type: '' };
  if (/^sr$/i.test(split.type)) return { supported: false, reason: 'splitRing', segments: [], type: split.type };

  const tokens = expandTokens(split.pattern);
  const segments: WizardSegment[] = [];
  const picotList = picots || [];
  let zwIndex = 0;

  for (const token of tokens) {
    if (DS_RE.test(token)) {
      const m = token.match(/^(\d+)/);
      const n = m ? parseInt(m[1], 10) : 1;
      const last = segments[segments.length - 1];
      if (last && last.kind === 'run') last.ds = (last.ds || 0) + n;
      else segments.push({ kind: 'run', raw: token, ds: n });
      continue;
    }
    if (isZeroWidth(token)) {
      const picot = picotList[zwIndex];
      zwIndex++;
      if (EDITABLE_PICOT_RE.test(token)) {
        segments.push({ kind: 'picot', raw: token, joined: !!picot?.isJoint });
      } else {
        // Bead token — fixed barrier, not touched by add/clear.
        segments.push({ kind: 'barrier', raw: token });
      }
      continue;
    }
    // rds / ss / lss / rss / malformed — not handled by v1.
    return { supported: false, reason: 'unsupportedToken', segments: [], type: split.type };
  }

  if (zwIndex !== picotList.length) {
    // Our token<->picot pairing assumption doesn't hold for this element
    // (stale/mismatched picots array) — refuse rather than risk mislabeling
    // a joined picot as unjoined.
    return { supported: false, reason: 'picotMismatch', segments: [], type: split.type };
  }

  return { supported: true, segments, type: split.type };
}

function segmentsToNotation(type: string, segments: WizardSegment[]): string {
  const parts = segments.map(s => (s.kind === 'run' ? `${s.ds}ds` : s.raw));
  return `${type}: ${parts.join('-')}`;
}

// ── Clear unjoined picots ───────────────────────────────────────────────────
// Removes every plain picot token whose runtime picot is not joined. Joined
// picots and bead barriers are left exactly where they are, so their
// stitchesBefore position is unchanged — updateNotation's old-picot merge
// will match them back up by position.
export function clearUnjoinedPicots(notation: string, picots: any[] | undefined): string | null {
  const a = analyzeNotation(notation, picots);
  if (!a.supported) return null;

  const kept: WizardSegment[] = [];
  for (const seg of a.segments) {
    if (seg.kind === 'picot' && !seg.joined) continue;
    const last = kept[kept.length - 1];
    if (seg.kind === 'run' && last && last.kind === 'run') {
      last.ds = (last.ds || 0) + (seg.ds || 0);
      continue;
    }
    kept.push({ ...seg });
  }
  return segmentsToNotation(a.type, kept);
}

export function hasUnjoinedPicots(notation: string, picots: any[] | undefined): boolean {
  const a = analyzeNotation(notation, picots);
  if (!a.supported) return false;
  return a.segments.some(s => s.kind === 'picot' && !s.joined);
}

// ── Add picots ───────────────────────────────────────────────────────────
// Every ds run of 2 or more gets new plain "p" picot(s):
//   even N        -> N/2 - p - N/2                (one picot, centred)
//   odd N, asym   -> floor(N/2) - p - ceil(N/2)    (one picot, off-centre)
//   odd N, sym    -> k - p - 1 - p - k, N = 2k+1   (two picots, 1ds gap)
// Runs under 2ds are left untouched — there's no room for a new picot with
// at least 1ds on each side of it.
export function addPicotsToRuns(notation: string, picots: any[] | undefined, symmetric: boolean): string | null {
  const a = analyzeNotation(notation, picots);
  if (!a.supported) return null;

  const out: WizardSegment[] = [];
  const newPicot = (): WizardSegment => ({ kind: 'picot', raw: 'p', joined: false });
  const run = (ds: number): WizardSegment => ({ kind: 'run', raw: `${ds}ds`, ds });

  for (const seg of a.segments) {
    if (seg.kind !== 'run' || (seg.ds || 0) < 2) { out.push({ ...seg }); continue; }
    const n = seg.ds as number;
    if (n % 2 === 0) {
      out.push(run(n / 2), newPicot(), run(n / 2));
    } else if (!symmetric || n < 3) {
      const left = Math.floor(n / 2), right = n - left;
      out.push(run(left), newPicot(), run(right));
    } else {
      const k = (n - 1) / 2;
      out.push(run(k), newPicot(), run(1), newPicot(), run(k));
    }
  }
  return segmentsToNotation(a.type, out);
}

export function hasAddablePicotRuns(notation: string, picots: any[] | undefined): boolean {
  const a = analyzeNotation(notation, picots);
  if (!a.supported) return false;
  return a.segments.some(s => s.kind === 'run' && (s.ds || 0) >= 2);
}

// ── Protected zones ──────────────────────────────────────────────────────
// Rule: if the FIRST picot in the element is joined, and the run of ds
// between the very start of the element and that picot is <= 3ds, that
// leading run is "protected" — it can be compressed but never below 1ds,
// and the picot itself is never a candidate for removal. Same rule
// independently for the LAST picot and the trailing run at the end of the
// element.
//
// This has no effect on Add or Clear (neither of them ever shrinks a run),
// it exists for the compress-style operations that come next: Fill Density
// and Length-aware Scale. Both will call getProtectedZones() once per
// element and clampProtectedFloor() per run they're about to shrink.
//
// Barrier (bead) tokens before/after the first/last picot don't contribute
// ds distance in this calculation — beads are out of scope for this tool's
// ds arithmetic, same as everywhere else in this file.
const PROTECTED_ZONE_MAX_DS = 3;
const PROTECTED_ZONE_FLOOR_DS = 1;

export interface ProtectedZones {
  firstRunProtected: boolean;
  lastRunProtected: boolean;
  firstRunIndex: number; // index into segments[], -1 if there's no leading run
  lastRunIndex: number;  // index into segments[], -1 if there's no trailing run
}

function firstPicotIndex(segments: WizardSegment[]): number {
  return segments.findIndex(s => s.kind === 'picot');
}
function lastPicotIndex(segments: WizardSegment[]): number {
  for (let i = segments.length - 1; i >= 0; i--) if (segments[i].kind === 'picot') return i;
  return -1;
}
function firstRunIndex(segments: WizardSegment[]): number {
  return segments.findIndex(s => s.kind === 'run');
}
function lastRunIndex(segments: WizardSegment[]): number {
  for (let i = segments.length - 1; i >= 0; i--) if (segments[i].kind === 'run') return i;
  return -1;
}

export function getProtectedZones(segments: WizardSegment[]): ProtectedZones {
  const firstPicotIdx = firstPicotIndex(segments);
  const lastPicotIdx = lastPicotIndex(segments);
  const firstRunIdx = firstRunIndex(segments);
  const lastRunIdx = lastRunIndex(segments);

  let firstRunProtected = false;
  if (firstPicotIdx >= 0 && segments[firstPicotIdx].joined) {
    let ds = 0;
    for (let i = 0; i < firstPicotIdx; i++) if (segments[i].kind === 'run') ds += segments[i].ds || 0;
    firstRunProtected = ds <= PROTECTED_ZONE_MAX_DS;
  }

  let lastRunProtected = false;
  if (lastPicotIdx >= 0 && segments[lastPicotIdx].joined) {
    let ds = 0;
    for (let i = lastPicotIdx + 1; i < segments.length; i++) if (segments[i].kind === 'run') ds += segments[i].ds || 0;
    lastRunProtected = ds <= PROTECTED_ZONE_MAX_DS;
  }

  // A single picot in the whole element is simultaneously "first" and
  // "last" — the leading run and trailing run are still evaluated and
  // protected independently, which falls out naturally from the logic above.

  return {
    firstRunProtected,
    lastRunProtected,
    firstRunIndex: firstRunProtected ? firstRunIdx : -1,
    lastRunIndex: lastRunProtected ? lastRunIdx : -1,
  };
}

// Whether the run at `runIndex` (an index into `segments`) is protected.
export function isRunProtected(segments: WizardSegment[], runIndex: number, zones?: ProtectedZones): boolean {
  const z = zones || getProtectedZones(segments);
  return runIndex === z.firstRunIndex || runIndex === z.lastRunIndex;
}

// Clamps a proposed (compressed) ds value to the protected floor. Only
// meaningful when shrinking — callers should not use this to grow a run.
export function clampProtectedFloor(requestedDs: number, protectedRun: boolean): number {
  const floor = protectedRun ? PROTECTED_ZONE_FLOOR_DS : 0;
  return Math.max(floor, requestedDs);
}

// ── Fill density ───────────────────────────────────────────────────────────
// Subdivides every ds run in the element toward a target gap size, using new
// plain "p" picots distributed as evenly as possible within each run.
// targetGapDs = 1 is maximum density ("fills until 1ds-p minimum gap
// everywhere"); larger values leave sparser gaps. A run already at or below
// the target is left untouched.
//
// This only ever ADDS picots into the ds-only stretches between existing
// zero-width tokens (runs never contain an existing picot by construction —
// see analyzeNotation) — it never removes, moves, or re-touches anything
// that's already there. That means it can't violate a protected zone; the
// ordinary "no sub-run below 1ds" floor already provides the same safety
// protected zones give the (separate, compression-based) scale feature.
export interface FillDensityPreview {
  notation: string;
  addedCount: number;
}

// Splits `total` into `parts` pieces that are each either floor(total/parts)
// or ceil(total/parts), summing exactly to `total`.
function distributeEvenly(total: number, parts: number): number[] {
  const out: number[] = [];
  let prevCum = 0;
  for (let i = 1; i <= parts; i++) {
    const cum = Math.floor((total * i) / parts);
    out.push(cum - prevCum);
    prevCum = cum;
  }
  return out;
}

export function previewFillDensity(
  notation: string,
  picots: any[] | undefined,
  targetGapDs: number
): FillDensityPreview | null {
  const a = analyzeNotation(notation, picots);
  if (!a.supported) return null;
  const g = Math.max(1, Math.round(targetGapDs));

  const out: WizardSegment[] = [];
  let addedCount = 0;

  for (const seg of a.segments) {
    if (seg.kind !== 'run') { out.push({ ...seg }); continue; }
    const n = seg.ds || 0;
    if (n <= g) { out.push({ ...seg }); continue; }

    let numPicots = Math.round(n / g) - 1;
    numPicots = Math.max(0, Math.min(n - 1, numPicots));
    if (numPicots <= 0) { out.push({ ...seg }); continue; }

    const parts = distributeEvenly(n, numPicots + 1);
    parts.forEach((partDs, idx) => {
      out.push({ kind: 'run', raw: `${partDs}ds`, ds: partDs });
      if (idx < parts.length - 1) {
        out.push({ kind: 'picot', raw: 'p', joined: false });
        addedCount++;
      }
    });
  }

  return { notation: segmentsToNotation(a.type, out), addedCount };
}

// Above this gap size, previewFillDensity is a no-op for this element — used
// to size the slider's max so every position on it does something.
export function maxUsefulFillGap(notation: string, picots: any[] | undefined): number {
  const a = analyzeNotation(notation, picots);
  if (!a.supported) return 1;
  const longest = a.segments.reduce((m, s) => (s.kind === 'run' ? Math.max(m, s.ds || 0) : m), 1);
  return Math.max(1, longest - 1);
}

// ── Compact repeated picots ──────────────────────────────────────────────
// Folds runs of identical, consecutive, UNJOINED (run + picot) pairs into
// repeat-group syntax: N copies of "Xds-p" become "Nx(Xds-p)" (or "N*(...)"
// — both are valid, expandTokens accepts either). A joined picot is never
// folded into a group — it's a hard break, since a repeat group represents
// interchangeable copies and a joined picot is not interchangeable with the
// others. Any leftover partial run (e.g. a trailing "1ds" that isn't part of
// a full unit) is left as a plain token.
//
// This never changes any picot's position — repeat-group syntax expands to
// exactly the same flat tokens it was folded from — so it's inherently
// join-safe. (updateNotation will still show its confirm-and-wipe dialog if
// the element has any joins at all, same as every other Picot Wizard action,
// for consistency — it doesn't special-case "this particular edit happens to
// preserve everything.")
// A repeat-group ("Nx(...)") is shorter than the fully spelled-out form even
// at N=2 (e.g. "2*(2ds-p)" is 9 chars vs "2ds-p-2ds-p" at 11), so there's no
// reason to hold out for 3+ repeats — 2 is the natural floor (1 "repeat"
// isn't a repeat at all). This also matters for elements with a joined picot
// partway through: it splits the run in two, and each half needs to clear
// the threshold on its own, so a default any higher than 2 can silently
// leave an otherwise-compactable pattern untouched.
const DEFAULT_MIN_REPEAT = 2;

function foldRepeats(segments: WizardSegment[], minRepeat: number, symbol: 'x' | '*'): { parts: string[]; groupsCreated: number } {
  const parts: string[] = [];
  let groupsCreated = 0;
  let i = 0;
  while (i < segments.length) {
    const seg = segments[i];
    const next = segments[i + 1];
    if (seg.kind === 'run' && next && next.kind === 'picot' && !next.joined) {
      const unitDs = seg.ds as number;
      const unitRaw = next.raw;
      let count = 1;
      let j = i + 2;
      while (
        segments[j] && segments[j].kind === 'run' && segments[j].ds === unitDs &&
        segments[j + 1] && segments[j + 1].kind === 'picot' && segments[j + 1].raw === unitRaw && !segments[j + 1].joined
      ) {
        count++;
        j += 2;
      }
      if (count >= minRepeat) {
        parts.push(`${count}${symbol}(${unitDs}ds-${unitRaw})`);
        groupsCreated++;
        i = j;
        continue;
      }
      // Below threshold — emit just this one unit literally and let the
      // loop re-examine from i+2 (handles the rest of a short run one at a
      // time, and still finds a *different* repeated pattern starting there).
      parts.push(`${unitDs}ds`, unitRaw);
      i += 2;
      continue;
    }
    parts.push(seg.kind === 'run' ? `${seg.ds}ds` : seg.raw);
    i += 1;
  }
  return { parts, groupsCreated };
}

export interface CompactPreview {
  notation: string;
  groupsCreated: number;
}

export function compactRepeatedPicots(
  notation: string,
  picots: any[] | undefined,
  minRepeat: number = DEFAULT_MIN_REPEAT,
  symbol: 'x' | '*' = '*'
): CompactPreview | null {
  const a = analyzeNotation(notation, picots);
  if (!a.supported) return null;
  const { parts, groupsCreated } = foldRepeats(a.segments, minRepeat, symbol);
  return { notation: `${a.type}: ${parts.join('-')}`, groupsCreated };
}

export function hasCompactableGroups(notation: string, picots: any[] | undefined, minRepeat: number = DEFAULT_MIN_REPEAT): boolean {
  const a = analyzeNotation(notation, picots);
  if (!a.supported) return false;
  return foldRepeats(a.segments, minRepeat, '*').groupsCreated > 0;
}

// ── Length-aware scale ─────────────────────────────────────────────────────
// Resizes every ds run by `scaleFactor`, rounding each to the nearest whole
// ds. Picots, barriers, and their order are never touched — only the ds
// counts between them change. That means a picot's `stitchesBefore` DOES
// shift (unlike Clear/Add/Fill/Compact), so callers must commit the result
// with updateNotation's `picotMatchMode: 'order'` (not the default
// 'stitchesBefore') to keep IDs and joins attached to the right picot rather
// than losing them because nothing lines up by position anymore.
//
// Floor rule: every run has a hard floor of 1ds — 0ds isn't a logical
// result for a scale-down (it would put two picots literally on top of each
// other rather than adjacent). Runs flagged by getProtectedZones (the
// first/last run, when its adjacent end picot is joined and within 3ds of
// the edge) are still tracked and reported separately in each run's
// `protectedRun` flag, since that's useful context for the feasibility
// summary even though the numeric floor is now the same 1ds for every run.
export interface RunScaleDetail {
  segmentIndex: number;
  originalDs: number;
  idealDs: number;   // originalDs * scaleFactor, unrounded
  actualDs: number;  // after rounding + floor clamp
  protectedRun: boolean;
  clamped: boolean;  // true if the floor changed the rounded value
}

export interface ScaleResult {
  notation: string;
  originalTotalDs: number;
  idealTotalDs: number;   // originalTotalDs * scaleFactor, unrounded
  actualTotalDs: number;  // sum of actualDs across all runs
  runs: RunScaleDetail[];
  anyClamped: boolean;
}

export function scaleNotation(notation: string, picots: any[] | undefined, scaleFactor: number): ScaleResult | null {
  const a = analyzeNotation(notation, picots);
  if (!a.supported) return null;
  if (!(scaleFactor > 0)) return null;

  const zones = getProtectedZones(a.segments);
  const runs: RunScaleDetail[] = [];
  const outParts: string[] = [];
  let originalTotalDs = 0;
  let actualTotalDs = 0;

  a.segments.forEach((seg, idx) => {
    if (seg.kind !== 'run') {
      outParts.push(seg.raw);
      return;
    }
    const originalDs = seg.ds || 0;
    originalTotalDs += originalDs;
    const idealDs = originalDs * scaleFactor;
    const protectedRun = isRunProtected(a.segments, idx, zones);
    const rounded = Math.round(idealDs);
    const actualDs = Math.max(1, rounded);
    actualTotalDs += actualDs;
    runs.push({
      segmentIndex: idx,
      originalDs,
      idealDs,
      actualDs,
      protectedRun,
      clamped: actualDs !== rounded,
    });
    outParts.push(`${actualDs}ds`);
  });

  return {
    notation: `${a.type}: ${outParts.join('-')}`,
    originalTotalDs,
    idealTotalDs: originalTotalDs * scaleFactor,
    actualTotalDs,
    runs,
    anyClamped: runs.some(r => r.clamped),
  };
}

// "Common divisors/multiples" preset suggestions for a given total ds count —
// e.g. offering ÷2, ÷3, ×2, ×3 as quick-pick buttons. Only suggests factors
// that divide evenly (or multiply to a whole number), since those are the
// ones likely to scale cleanly without relying on rounding at all.
export interface ScalePreset {
  label: string;    // e.g. "÷2", "×3"
  factor: number;
  resultingTotalDs: number;
}

export function suggestScalePresets(totalDs: number): ScalePreset[] {
  const presets: ScalePreset[] = [];
  for (const divisor of [2, 3, 4]) {
    if (totalDs % divisor === 0 && totalDs / divisor >= 1) {
      presets.push({ label: `÷${divisor}`, factor: 1 / divisor, resultingTotalDs: totalDs / divisor });
    }
  }
  for (const multiplier of [2, 3]) {
    presets.push({ label: `×${multiplier}`, factor: multiplier, resultingTotalDs: totalDs * multiplier });
  }
  return presets;
}
