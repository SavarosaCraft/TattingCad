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

// Appends a { isJoint } entry to `out` for zero-width segments (picot or
// barrier), no-ops for runs. Shared by every transform that builds a
// resultZeroWidth list (addPicotsToRuns, previewFillDensity) so the "what
// counts as zero-width" rule lives in exactly one place.
function pushZeroWidth(out: Array<{ isJoint: boolean }>, seg: WizardSegment): void {
  if (seg.kind === 'picot' || seg.kind === 'barrier') out.push({ isJoint: !!seg.joined });
}

// Total ds across every 'run' segment — the element's stitch length as this
// module sees it. Exported so callers (the Scale UI, single- and
// multi-element) don't each re-derive it with their own reduce().
export function totalRunDs(segments: WizardSegment[]): number {
  return segments.reduce((sum, s) => sum + (s.kind === 'run' ? (s.ds || 0) : 0), 0);
}

// ── Clear unjoined picots ───────────────────────────────────────────────────
// Removes every plain picot token whose runtime picot is not joined. Joined
// picots and bead barriers are left exactly where they are, so their
// stitchesBefore position is unchanged — updateNotation's old-picot merge
// will match them back up by position.
export interface ClearResult {
  notation: string;
  // One entry per zero-width token (picot or barrier) in the RESULT
  // notation, in order — isJoint carried over for survivors. Feed this
  // straight back into analyzeNotation/compactRepeatedPicots as the "picots"
  // argument to auto-compact the result; it's not meant to be committed to
  // app state (updateNotation re-derives the real picots itself).
  resultZeroWidth: Array<{ isJoint: boolean }>;
}
export function clearUnjoinedPicots(notation: string, picots: any[] | undefined): ClearResult | null {
  const a = analyzeNotation(notation, picots);
  if (!a.supported) return null;

  const kept: WizardSegment[] = [];
  const resultZeroWidth: Array<{ isJoint: boolean }> = [];
  for (const seg of a.segments) {
    if (seg.kind === 'picot' && !seg.joined) continue;
    const last = kept[kept.length - 1];
    if (seg.kind === 'run' && last && last.kind === 'run') {
      last.ds = (last.ds || 0) + (seg.ds || 0);
      continue;
    }
    kept.push({ ...seg });
    if (seg.kind === 'picot' || seg.kind === 'barrier') resultZeroWidth.push({ isJoint: !!seg.joined });
  }
  return { notation: segmentsToNotation(a.type, kept), resultZeroWidth };
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
export interface AddResult {
  notation: string;
  // Same shape/purpose as ClearResult.resultZeroWidth — new picots are
  // always unjoined, carried-over ones keep their original isJoint.
  resultZeroWidth: Array<{ isJoint: boolean }>;
}
export function addPicotsToRuns(notation: string, picots: any[] | undefined, symmetric: boolean): AddResult | null {
  const a = analyzeNotation(notation, picots);
  if (!a.supported) return null;

  const zones = getProtectedZones(a.segments);
  const out: WizardSegment[] = [];
  const resultZeroWidth: Array<{ isJoint: boolean }> = [];
  const newPicot = (): WizardSegment => ({ kind: 'picot', raw: 'p', joined: false });
  const run = (ds: number): WizardSegment => ({ kind: 'run', raw: `${ds}ds`, ds });

  a.segments.forEach((seg, idx) => {
    if (seg.kind !== 'run' || (seg.ds || 0) < 2 || isRunProtected(a.segments, idx, zones)) {
      out.push({ ...seg }); pushZeroWidth(resultZeroWidth, seg); return;
    }
    const n = seg.ds as number;
    let newSegs: WizardSegment[];
    if (n % 2 === 0) {
      newSegs = [run(n / 2), newPicot(), run(n / 2)];
    } else if (!symmetric || n < 3) {
      const left = Math.floor(n / 2), right = n - left;
      newSegs = [run(left), newPicot(), run(right)];
    } else {
      const k = (n - 1) / 2;
      newSegs = [run(k), newPicot(), run(1), newPicot(), run(k)];
    }
    out.push(...newSegs);
    newSegs.forEach(seg => pushZeroWidth(resultZeroWidth, seg));
  });
  return { notation: segmentsToNotation(a.type, out), resultZeroWidth };
}

export function hasAddablePicotRuns(notation: string, picots: any[] | undefined): boolean {
  const a = analyzeNotation(notation, picots);
  if (!a.supported) return false;
  const zones = getProtectedZones(a.segments);
  return a.segments.some((s, idx) => s.kind === 'run' && (s.ds || 0) >= 2 && !isRunProtected(a.segments, idx, zones));
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
  // Same shape/purpose as ClearResult.resultZeroWidth — new picots are
  // always unjoined, carried-over ones keep their original isJoint.
  resultZeroWidth: Array<{ isJoint: boolean }>;
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
  const resultZeroWidth: Array<{ isJoint: boolean }> = [];
  let addedCount = 0;

  for (const seg of a.segments) {
    if (seg.kind !== 'run') { out.push({ ...seg }); pushZeroWidth(resultZeroWidth, seg); continue; }
    const n = seg.ds || 0;
    if (n <= g) { out.push({ ...seg }); continue; }

    let numPicots = Math.round(n / g) - 1;
    numPicots = Math.max(0, Math.min(n - 1, numPicots));
    if (numPicots <= 0) { out.push({ ...seg }); continue; }

    const parts = distributeEvenly(n, numPicots + 1);
    parts.forEach((partDs, idx) => {
      out.push({ kind: 'run', raw: `${partDs}ds`, ds: partDs });
      if (idx < parts.length - 1) {
        const p: WizardSegment = { kind: 'picot', raw: 'p', joined: false };
        out.push(p);
        pushZeroWidth(resultZeroWidth, p);
        addedCount++;
      }
    });
  }

  return { notation: segmentsToNotation(a.type, out), addedCount, resultZeroWidth };
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

// Runs compaction automatically on a just-transformed notation, right before
// it's committed. Compaction is always safe and lossless (see comment
// above), so there's no reason to make it a separate manual step for
// notation this tool just produced — the person only sees the readable
// grouped form, e.g. Fill Density's "11x(1ds-p)" instead of eleven spelled-
// out "1ds-p" copies. Falls back to the input notation unchanged if
// compaction can't run for some reason (shouldn't happen, since the caller
// already successfully analyzed this exact notation to build it).
export function autoCompact(notation: string, resultZeroWidth: Array<{ isJoint: boolean }>, minRepeat: number = DEFAULT_MIN_REPEAT): string {
  const result = compactRepeatedPicots(notation, resultZeroWidth, minRepeat);
  return result ? result.notation : notation;
}

// ── Length-aware scale ─────────────────────────────────────────────────────
// Scales the element proportionally: the new total ds is computed first
// (Math.round(totalDs * factor)), then each existing picot is placed at its
// original proportional position within the new total (picot.stitchesBefore /
// originalTotal * newTotal, rounded). Runs fall out as the gaps between
// consecutive picot positions.
//
// This gives correct results for uniform patterns like "6ds-p-6ds ÷2 → 3ds-p-3ds"
// and preserves the visual rhythm of irregular patterns like "3ds-p-6ds-p-9ds".
// Per-run scaling (the old approach) broke because rounding each run
// independently could give the wrong answer even for clean divisors (6ds ÷4
// rounds per-run to 2ds instead of the correct 1.5→1 being wrong, or being
// taken from 3ds not 6ds).
//
// Nudge rule: if two picots round to the same stitchesBefore position, each
// one after the first is nudged +1ds to keep them distinct. If the new total
// is so small that picots can't all fit with ≥1ds between them, `anyClamped`
// is set but we still produce the best-effort result (picots as close as
// possible without overlapping) rather than refusing.
//
// Connections are safe: since we never add, remove, or reorder picots,
// callers commit the result with { picotMatchMode: 'order' } which matches
// old↔new picots by sequential index regardless of stitchesBefore shift.
export interface RunScaleDetail {
  segmentIndex: number;
  originalDs: number;
  idealDs: number;
  actualDs: number;
  protectedRun: boolean;
  clamped: boolean;
}

export interface ScaleResult {
  notation: string;
  originalTotalDs: number;
  idealTotalDs: number;
  actualTotalDs: number;
  runs: RunScaleDetail[];
  anyClamped: boolean;
}

export function scaleNotation(notation: string, picots: any[] | undefined, scaleFactor: number): ScaleResult | null {
  const a = analyzeNotation(notation, picots);
  if (!a.supported) return null;
  if (!(scaleFactor > 0)) return null;

  const originalTotalDs = totalRunDs(a.segments);
  const newTotalDs = Math.max(1, Math.round(originalTotalDs * scaleFactor));

  // Collect zero-width segments (picots/barriers) in order, paired with
  // their original cumulative stitchesBefore position.
  interface ZwEntry { segIdx: number; raw: string; originalSb: number; }
  const zwEntries: ZwEntry[] = [];
  let cumDs = 0;
  a.segments.forEach((seg, idx) => {
    if (seg.kind === 'run') { cumDs += seg.ds || 0; return; }
    zwEntries.push({ segIdx: idx, raw: seg.raw, originalSb: cumDs });
  });

  // Compute each picot's new stitchesBefore proportionally.
  const newSbList: number[] = zwEntries.map(zw =>
    originalTotalDs > 0
      ? Math.round((zw.originalSb / originalTotalDs) * newTotalDs)
      : 0
  );

  // Nudge: ensure strictly increasing positions with minimum 1ds gap.
  // Work forward — each position must be > the previous one.
  for (let i = 1; i < newSbList.length; i++) {
    if (newSbList[i] <= newSbList[i - 1]) newSbList[i] = newSbList[i - 1] + 1;
  }
  // Also ensure the last picot leaves at least 1ds before the end.
  // (Work backward if the nudges pushed too far.)
  for (let i = newSbList.length - 1; i >= 0; i--) {
    const maxSb = newTotalDs - (newSbList.length - i); // at least 1ds for each remaining gap
    if (newSbList[i] > maxSb) newSbList[i] = Math.max(i > 0 ? newSbList[i - 1] + 1 : 0, maxSb);
  }

  // Build the output segment list from the new picot positions.
  const outParts: string[] = [];
  let prevSb = 0;
  const runs: RunScaleDetail[] = [];
  const zones = getProtectedZones(a.segments);

  zwEntries.forEach((zw, i) => {
    const runDs = newSbList[i] - prevSb;
    const originalRunDs = zw.originalSb - (i === 0 ? 0 : zwEntries[i - 1].originalSb);
    const idealDs = originalRunDs * scaleFactor;
    const protectedRun = isRunProtected(a.segments, zw.segIdx - 1, zones);
    const clamped = runDs !== Math.round(idealDs);
    runs.push({ segmentIndex: zw.segIdx - 1, originalDs: originalRunDs, idealDs, actualDs: runDs, protectedRun, clamped });
    if (runDs > 0) outParts.push(`${runDs}ds`);
    outParts.push(zw.raw);
    prevSb = newSbList[i];
  });

  // Trailing run (after last picot/barrier to end of element)
  const trailingDs = newTotalDs - prevSb;
  const originalTrailingDs = originalTotalDs - (zwEntries.length > 0 ? zwEntries[zwEntries.length - 1].originalSb : 0);
  const trailingIdeal = originalTrailingDs * scaleFactor;
  const trailingProtected = isRunProtected(a.segments, a.segments.length - 1, zones);
  runs.push({ segmentIndex: a.segments.length - 1, originalDs: originalTrailingDs, idealDs: trailingIdeal, actualDs: trailingDs, protectedRun: trailingProtected, clamped: trailingDs !== Math.round(trailingIdeal) });
  if (trailingDs > 0) outParts.push(`${trailingDs}ds`);

  const actualTotalDs = newSbList.reduce((sum, sb, i) => {
    const prev = i === 0 ? 0 : newSbList[i - 1];
    return sum + (sb - prev);
  }, 0) + trailingDs;

  return {
    notation: `${a.type}: ${outParts.join('-')}`,
    originalTotalDs,
    idealTotalDs: originalTotalDs * scaleFactor,
    actualTotalDs: newTotalDs,
    runs,
    anyClamped: runs.some(r => r.clamped),
  };
}

// "Common divisors/multiples" preset suggestions, categorised as exact vs
// rounded based on proportional placement (not per-run divisibility).
//
// A preset is "exact" when:
//   1. Math.round(totalDs * factor) == totalDs * factor (total is a whole ds)
//   2. Every picot's proportional position Math.round(sb/total * newTotal)
//      lands on a whole ds with no nudging needed (i.e. sb/total * newTotal
//      is already a whole number)
//   3. Every resulting run is ≥ 1ds (no zero-length gaps)
//
// This means "÷2" for "6ds-p-6ds" is exact (picot at 50% → 3ds, all runs=3),
// but "÷4" for "6ds-p-6ds" is rounded (picot at 50% of 6ds = 1.5ds → rounds
// to 2ds, leaving runs of 2 and 1 rather than the ideal 1.5/1.5).
function isExactPreset(totalDs: number, picotSbList: number[], factor: number): boolean {
  const newTotal = totalDs * factor;
  if (!Number.isInteger(newTotal)) return false;
  if (newTotal < 1) return false;
  let prevSb = 0;
  for (const sb of picotSbList) {
    const newSb = (sb / totalDs) * newTotal;
    if (!Number.isInteger(newSb)) return false;
    if (newSb - prevSb < 1) return false;
    prevSb = newSb;
  }
  // trailing run
  if (newTotal - prevSb < 1) return false;
  return true;
}

export interface ScalePreset {
  label: string;
  factor: number;
  resultingTotalDs: number;
  isRounded: boolean;
}

export interface ScalePresetRows {
  exact: ScalePreset[];
  rounded: ScalePreset[];
}

export function suggestScalePresets(totalDs: number, picots?: any[]): ScalePresetRows {
  const exact: ScalePreset[] = [];
  const rounded: ScalePreset[] = [];

  // Extract picot stitchesBefore positions for the exactness check.
  // If no picots provided, only the total divisibility matters.
  const sbList = (picots || []).map(p => p.stitchesBefore as number);

  for (const divisor of [2, 3, 4]) {
    const newTotal = totalDs / divisor;
    if (newTotal < 1) continue;
    const factor = 1 / divisor;
    const resultingTotalDs = Math.round(newTotal);
    if (isExactPreset(totalDs, sbList, factor)) {
      exact.push({ label: `:${divisor}`, factor, resultingTotalDs, isRounded: false });
    } else {
      rounded.push({ label: `:${divisor}`, factor, resultingTotalDs, isRounded: true });
    }
  }

  // Multiples: always exact since newSb = sb * multiplier is always a whole number
  for (const multiplier of [2, 3]) {
    exact.push({ label: `x${multiplier}`, factor: multiplier, resultingTotalDs: totalDs * multiplier, isRounded: false });
  }

  return { exact, rounded };
}

// Multi-element version, for batch-scaling a whole selection to one shared
// factor. A divisor is only offered if it divides EVERY element's total ds
// evenly — a preset that would leave rounding drift on some elements but not
// others isn't a clean "common divisor" for the group. There's no single
// "resulting total" to show across elements with different lengths, so this
// returns just the label/factor pair; the caller previews per-element totals
// itself via scaleNotation.
export interface MultiScalePreset {
  label: string; // e.g. "÷2", "×3"
  factor: number;
}

export function suggestScalePresetsMulti(totalDsList: number[]): MultiScalePreset[] {
  const presets: MultiScalePreset[] = [];
  if (totalDsList.length === 0) return presets;
  for (const divisor of [2, 3, 4]) {
    const allDivideEvenly = totalDsList.every(t => t % divisor === 0 && t / divisor >= 1);
    if (allDivideEvenly) presets.push({ label: `:${divisor}`, factor: 1 / divisor });
  }
  for (const multiplier of [2, 3]) {
    presets.push({ label: `x${multiplier}`, factor: multiplier });
  }
  return presets;
}
