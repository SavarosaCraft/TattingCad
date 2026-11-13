// picotTools.ts — Picot Wizard: add / clear picots directly on notation text.
//
// Pure functions only. Callers hand the result to updateNotation(), which
// already owns re-parsing, path scaling, ghost regen, and the confirm-and-wipe
// dialog when the element has existing joins — this file doesn't duplicate any
// of that, it only computes the new notation string.
//
// SCOPE: every stitch type (ds, ss, lss, rss, rds, bds) and plain picot
// tokens; split rings one side at a time (session 60). Bead tokens (be, bc:,
// bp:, bjp:, sb:, bcp:, bcjp:) are fixed "barriers" — never added, removed or moved
// past. A bead sequence (bc:YZ — one token, one picot per bead) is refused
// ("picotMismatch") rather than guessed at.
//
// Session 62 (review H7): a run keeps its stitches IN ORDER (2ds, 3rds,
// 1ss …) and every action writes them back with their own types. It used to
// keep one ds total per run and write "Nds", which turned half stitches into
// ds (r: 2ss-3ds-p-3ds → Clear → r: 7ds), gave fractions the parser rejects
// (1ss → "9.5ds"), and refused rds/bds outright. Rules that cut a run (Add,
// Fill, Scale) count STITCHES, not length (user's decision): a cut falls
// between stitches only, "4rds" → "2rds-p-2rds". For ds-only notation a
// stitch count and a length are the same number, so the output there is
// exactly what it was.

import { expandTokens, isZeroWidth, isNotationValid, splitRingSideAPosition, parseNotation, STITCH_WIDTH_DS } from './parser';

// Editable picot tokens — the ones this tool is allowed to add or remove.
// (jp/jpg/cj/cjp are included because a token typed as one of these is
// structurally identical to a plain "p" for run-splitting purposes; whether
// it's "joined" for our purposes comes from the runtime picot's isJoint flag,
// not from which of these token spellings was used.)
const EDITABLE_PICOT_RE = /^(sp|cp|p|lp|jp|jpg|cj|cjp|gp)$/i;
// Any stitch token: optional count + one of the six stitch types (same
// alternation as the parser's STITCH_TOKEN_RE).
const STITCH_RE = /^(\d+)?\s*(bds|rds|ds|lss|rss|ss)$/i;
const PREFIX_RE = /^(r|c|sc|sr|jk|fr|mr):\s*/i;

// One stitch token of a run: `n` stitches of `type` (lower case).
export interface WizardStitch { type: string; n: number; }

export interface WizardSegment {
  kind: 'run' | 'picot' | 'barrier';
  raw: string;
  // run only — ds: LENGTH in ds widths (rds/bds 1.5, ss/lss/rss 0.5);
  // count: number of stitches; stitches: the stitch tokens in order.
  ds?: number;
  count?: number;
  stitches?: WizardStitch[];
  joined?: boolean;
}

// ── Stitch lists (session 62) ─────────────────────────────────────────────
const stitchWidth = (type: string): number => STITCH_WIDTH_DS[type] ?? 1;
const stitchesCount = (st: WizardStitch[]): number => st.reduce((s, x) => s + x.n, 0);
const stitchesLength = (st: WizardStitch[]): number => st.reduce((s, x) => s + x.n * stitchWidth(x.type), 0);

// Appends `add` to `into`, joining a stitch of the same type at the seam
// (2ds + 3ds → 5ds). Zero counts are dropped.
function appendStitches(into: WizardStitch[], add: WizardStitch[]): WizardStitch[] {
  for (const s of add) {
    if (s.n <= 0) continue;
    const last = into[into.length - 1];
    if (last && last.type === s.type) last.n += s.n;
    else into.push({ type: s.type, n: s.n });
  }
  return into;
}

function makeRun(stitches: WizardStitch[]): WizardSegment {
  const st = appendStitches([], stitches);
  return { kind: 'run', raw: stitchesText(st), ds: stitchesLength(st), count: stitchesCount(st), stitches: st };
}

// "2ds-1rds" — the text of a run, every token with its count.
function stitchesText(st: WizardStitch[]): string {
  return st.map(s => `${s.n}${s.type}`).join('-');
}

// Cuts a run's stitches after `k` stitches. A token the cut falls inside is
// split ("4rds" at 2 → "2rds" | "2rds").
function cutStitches(st: WizardStitch[], k: number): [WizardStitch[], WizardStitch[]] {
  const left: WizardStitch[] = [], right: WizardStitch[] = [];
  let left_n = k;
  for (const s of st) {
    if (left_n >= s.n) { left.push({ ...s }); left_n -= s.n; }
    else if (left_n > 0) { left.push({ type: s.type, n: left_n }); right.push({ type: s.type, n: s.n - left_n }); left_n = 0; }
    else right.push({ ...s });
  }
  return [left, right];
}

// Splits a run into pieces of the given stitch counts (summing to its count).
function splitRun(seg: WizardSegment, pieces: number[]): WizardSegment[] {
  let rest = seg.stitches || [];
  return pieces.map(k => {
    const [left, right] = cutStitches(rest, k);
    rest = right;
    return makeRun(left);
  });
}

// Merges two runs (Clear: the picot between them was removed).
function joinRuns(a: WizardSegment, b: WizardSegment): WizardSegment {
  return makeRun(appendStitches(appendStitches([], a.stitches || []), b.stitches || []));
}

const runsEqual = (a: WizardSegment, b: WizardSegment): boolean =>
  a.kind === 'run' && b.kind === 'run' && stitchesText(a.stitches || []) === stitchesText(b.stitches || []);

export interface WizardAnalysis {
  supported: boolean;
  reason?: 'unparsable' | 'splitRing' | 'unsupportedToken' | 'picotMismatch' | 'invalid';
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
  // Review #21 (session 63): notation the editor marks invalid (red glow —
  // e.g. two picots side by side) is refused, not guessed at: the tools
  // would otherwise "fix" it in ways nobody asked for (Scale put a stitch
  // between the two picots). The panel says to fix the notation first.
  if (!isNotationValid(notation)) return { supported: false, reason: 'invalid', segments: [], type: split.type };
  // Session 60: split rings ARE supported now — the Picot Tools panel hands
  // each side over separately as "sr: <side>" with that side's picots (see
  // GeneralElementPropertyBar.tsx), so one side is just a plain run of ds +
  // picots like any ring. ('splitRing' stays in the reason type for callers
  // that still check it.)

  const tokens = expandTokens(split.pattern);
  const segments: WizardSegment[] = [];
  const picotList = picots || [];
  let zwIndex = 0;

  for (const token of tokens) {
    const st = STITCH_RE.exec(token);
    if (st) {
      // Session 62: any stitch type, kept as itself in the current run.
      const stitch = { type: st[2].toLowerCase(), n: st[1] ? parseInt(st[1], 10) : 1 };
      const last = segments[segments.length - 1];
      if (last && last.kind === 'run') segments[segments.length - 1] = joinRuns(last, makeRun([stitch]));
      else segments.push(makeRun([stitch]));
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
    // Malformed / unknown token — not handled by the Wizard.
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

// Session 60. A split ring as two independent "sides" for the Picot Tools.
// The element stores its picots as [...side A reversed, ...side B]
// (computeElementAfterNotationEdit in tattingindex.tsx): side A's
// stitchesBefore are measured from the split (countA - original), and B's
// are offset by countA. Side A's picots are the FIRST n entries, n = the
// number of zero-width tokens in A's notation — split by count, not by
// position: a picot at the very start of side A is stored exactly at the
// split (stitchesBefore === splitPosition), which a position test would put
// on side B. Each side comes back as "sr: <pattern>" with its own picots in
// notation order, ready for analyzeNotation and the transforms.
export function splitRingSides(el: any): { notationA: string; notationB: string; picotsA: any[]; picotsB: any[] } {
  const notationA = el?.notation || '';
  const notationB = `sr: ${el?.notationB || ''}`;
  const all: any[] = el?.picots || [];
  const split = splitPrefix(notationA);
  // Session 62: count side A's picots the way they are STORED — one per
  // parsed picot. A bead sequence (bc:YZ, bc:2Y) is one token but one
  // picot per bead, so counting tokens put side A's extra beads on side B.
  const parsedA = split ? parseNotation(notationA, true) : null;
  const countA = parsedA ? parsedA.picots.length
    : split ? expandTokens(split.pattern).filter(tok => isZeroWidth(tok)).length : 0;
  const splitPos = el?.splitPosition || Math.floor((el?.stitchCount || 0) / 2);
  const picotsA = all.slice(0, countA)
    // Session 62: shared formula — slot beads take one stitch off (H5).
    .map(p => ({ ...p, stitchesBefore: splitRingSideAPosition(p, splitPos) }))
    .reverse();
  const picotsB = all.slice(countA)
    .map(p => ({ ...p, stitchesBefore: p.stitchesBefore - splitPos }));
  return { notationA, notationB, picotsA, picotsB };
}

function segmentsToNotation(type: string, segments: WizardSegment[]): string {
  const parts = segments.map(s => (s.kind === 'run' ? stitchesText(s.stitches || []) : s.raw)).filter(Boolean);
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

// Session 62: total STITCHES across every run — what Scale works in (the
// multi-element Scale's common-divisor presets use this). Same number as
// totalRunDs for ds-only notation.
export function totalRunStitches(segments: WizardSegment[]): number {
  return segments.reduce((sum, s) => sum + (s.kind === 'run' ? (s.count || 0) : 0), 0);
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
      kept[kept.length - 1] = joinRuns(last, seg);
      continue;
    }
    kept.push(seg.kind === 'run' ? makeRun(seg.stitches || []) : { ...seg });
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
// Every run of 2 or more STITCHES gets new plain "p" picot(s):
//   even N        -> N/2 - p - N/2                (one picot, centred)
//   odd N, asym   -> floor(N/2) - p - ceil(N/2)    (one picot, off-centre)
//   odd N, sym    -> k - p - 1 - p - k, N = 2k+1   (two picots, 1-stitch gap)
// Runs under 2 stitches are left untouched — there's no room for a new picot
// with at least one stitch on each side of it. Counted in stitches of
// whatever type (session 62): "4rds" -> "2rds-p-2rds".
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
  // pieces of this run, in stitches, with a new picot between each
  const withPicots = (seg: WizardSegment, pieces: number[]): WizardSegment[] =>
    splitRun(seg, pieces).flatMap((r, i) => (i === 0 ? [r] : [newPicot(), r]));

  a.segments.forEach((seg, idx) => {
    if (seg.kind !== 'run' || (seg.count || 0) < 2 || isRunProtected(a.segments, idx, zones)) {
      out.push({ ...seg }); pushZeroWidth(resultZeroWidth, seg); return;
    }
    const n = seg.count as number;
    let newSegs: WizardSegment[];
    if (n % 2 === 0) {
      newSegs = withPicots(seg, [n / 2, n / 2]);
    } else if (!symmetric || n < 3) {
      const left = Math.floor(n / 2), right = n - left;
      newSegs = withPicots(seg, [left, right]);
    } else {
      const k = (n - 1) / 2;
      newSegs = withPicots(seg, [k, 1, k]);
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
  return a.segments.some((s, idx) => s.kind === 'run' && (s.count || 0) >= 2 && !isRunProtected(a.segments, idx, zones));
}

// ── Protected zones ──────────────────────────────────────────────────────
// Rule: if the FIRST picot in the element is joined, and the run between the
// very start of the element and that picot is <= 3 stitches (session 62:
// counted in stitches, as everywhere in this file — the same as 3ds for ds),
// that leading run is "protected" — it can be compressed but never below 1,
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
    for (let i = 0; i < firstPicotIdx; i++) if (segments[i].kind === 'run') ds += segments[i].count || 0;
    firstRunProtected = ds <= PROTECTED_ZONE_MAX_DS;
  }

  let lastRunProtected = false;
  if (lastPicotIdx >= 0 && segments[lastPicotIdx].joined) {
    let ds = 0;
    for (let i = lastPicotIdx + 1; i < segments.length; i++) if (segments[i].kind === 'run') ds += segments[i].count || 0;
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
    // Session 62: in stitches of any type (the gap is "every g stitches").
    const n = seg.count || 0;
    if (n <= g) { out.push({ ...seg }); continue; }

    let numPicots = Math.round(n / g) - 1;
    numPicots = Math.max(0, Math.min(n - 1, numPicots));
    if (numPicots <= 0) { out.push({ ...seg }); continue; }

    const parts = splitRun(seg, distributeEvenly(n, numPicots + 1));
    parts.forEach((part, idx) => {
      out.push(part);
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
  const longest = a.segments.reduce((m, s) => (s.kind === 'run' ? Math.max(m, s.count || 0) : m), 1);
  return Math.max(1, longest - 1);
}

// ── Compact repeated picots ──────────────────────────────────────────────
// Folds runs of identical, consecutive (run + picot) pairs into
// repeat-group syntax: N copies of "Xds-p" become "Nx(Xds-p)" (or "N*(...)"
// — both are valid, expandTokens accepts either). Any leftover partial run
// (e.g. a trailing "1ds" that isn't part of a full unit) is left as a plain
// token.
// Session 60 (user's decision): joined picots are grouped too. Joins are not
// written in the notation — "p" is "p" whether joined or not — so grouping
// them changes no picot and keeps every join; it used to be a hard break,
// which left e.g. a ring with 4 of 5 picots joined with nothing to group.
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
// isn't a repeat at all).
const DEFAULT_MIN_REPEAT = 2;

function foldRepeats(segments: WizardSegment[], minRepeat: number, symbol: 'x' | '*'): { parts: string[]; groupsCreated: number } {
  const parts: string[] = [];
  let groupsCreated = 0;
  let i = 0;
  while (i < segments.length) {
    const seg = segments[i];
    const next = segments[i + 1];
    if (seg.kind === 'run' && next && next.kind === 'picot') {
      // Session 62: a run matches only with the very same stitches
      // ("2rds" ≠ "2ds", "1ds-1rds" ≠ "1rds-1ds").
      const unitText = stitchesText(seg.stitches || []);
      const unitRaw = next.raw;
      let count = 1;
      let j = i + 2;
      while (
        segments[j] && runsEqual(segments[j], seg) &&
        segments[j + 1] && segments[j + 1].kind === 'picot' && segments[j + 1].raw === unitRaw
      ) {
        count++;
        j += 2;
      }
      if (count >= minRepeat) {
        parts.push(`${count}${symbol}(${unitText}-${unitRaw})`);
        groupsCreated++;
        i = j;
        continue;
      }
      // Below threshold — emit just this one unit literally and let the
      // loop re-examine from i+2 (handles the rest of a short run one at a
      // time, and still finds a *different* repeated pattern starting there).
      parts.push(unitText, unitRaw);
      i += 2;
      continue;
    }
    parts.push(seg.kind === 'run' ? stitchesText(seg.stitches || []) : seg.raw);
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

// Session 60. The opposite of Group: writes every repeat group out in full,
// e.g. "r: 3*(3ds-p)-3ds" -> "r: 3ds-p-3ds-p-3ds-p-3ds". Both spellings
// ("3x(...)" / "3*(...)" and "(...)x3") and nested groups are expanded by the
// parser's own expandTokens, so the result is exactly the token list the app
// already works from. Like Group it never moves a picot (same tokens, same
// order), so it is join-safe. Ds runs that end up side by side are added
// together ("2*(3ds-p-3ds)" -> "3ds-p-6ds-p-3ds"), which is the same stitch
// count. Returns null when there is no repeat group to expand.
// Callers must NOT run autoCompact on the result — that would group it again.
const REPEAT_GROUP_RE = /\d+\s*[x*]\s*\(|\)\s*[x*]\s*\d+/i;

export function hasRepeatGroups(notation: string): boolean {
  const split = splitPrefix(notation || '');
  return !!split && REPEAT_GROUP_RE.test(split.pattern);
}

export function expandRepeatGroups(notation: string): string | null {
  const split = splitPrefix(notation || '');
  if (!split || !REPEAT_GROUP_RE.test(split.pattern)) return null;
  // Session 62: stitches of the same type that end up side by side are added
  // together, for every stitch type (was ds only: "2*(p-2rds)-2rds" kept
  // "2rds-2rds"). Other stitches are no longer passed through as typed —
  // each comes back as count + type ("rds" → "1rds"), as ds always did.
  const parts: string[] = [];
  let pending: WizardStitch[] = [];
  const flush = () => { if (pending.length) { parts.push(stitchesText(pending)); pending = []; } };
  for (const token of expandTokens(split.pattern)) {
    const m = STITCH_RE.exec(token);
    if (m) { appendStitches(pending, [{ type: m[2].toLowerCase(), n: m[1] ? parseInt(m[1], 10) : 1 }]); continue; }
    flush();
    parts.push(token);
  }
  flush();
  return `${split.type}: ${parts.join('-')}`;
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
// Session 62 (review H7): Scale works in STITCHES — totals, picot positions
// and the nudge rule — and each new run keeps the stitch types of the run it
// came from: "2rds-p-6ds" ×2 → "4rds-p-12ds", ÷2 → "1rds-p-3ds". A run of
// several types keeps them in order, each given its share ("2ds-2rds" ÷2 →
// "1ds-1rds"). A gap that had no stitches (two picots side by side) and
// gets one from the nudge rule gets ds (ss on a Josephine knot — the old
// "jk" special case, now just the stitch type of the runs). For ds-only
// notation this is exactly the old result. RunScaleDetail's *Ds fields are
// stitch counts; ScaleResult's *TotalDs are LENGTHS (rds 1.5, ss 0.5), which
// is what the panel shows ("→ 4.5ds").
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
  originalStitches: number;
  actualStitches: number;
  runs: RunScaleDetail[];
  anyClamped: boolean;
}

// One run's stitches scaled to `newCount` stitches, types kept in order:
// each token's share by cumulative rounding, so the shares add up to exactly
// newCount. `fallback` is the type for a run that had no stitches.
function scaleStitches(st: WizardStitch[], newCount: number, fallback: string): WizardStitch[] {
  if (newCount <= 0) return [];
  const oldCount = stitchesCount(st);
  if (oldCount <= 0) return [{ type: fallback, n: newCount }];
  const out: WizardStitch[] = [];
  let cumOld = 0, prevNew = 0;
  for (const s of st) {
    cumOld += s.n;
    const cumNew = Math.round((cumOld * newCount) / oldCount);
    appendStitches(out, [{ type: s.type, n: cumNew - prevNew }]);
    prevNew = cumNew;
  }
  return out;
}

function scaleSegments(type: string, segments: WizardSegment[], scaleFactor: number): ScaleResult {
  const originalTotal = totalRunStitches(segments);
  const newTotal = Math.max(1, Math.round(originalTotal * scaleFactor));

  // Collect zero-width segments (picots/barriers) in order, paired with
  // their original position in stitches.
  interface ZwEntry { segIdx: number; raw: string; originalSb: number; }
  const zwEntries: ZwEntry[] = [];
  let cum = 0;
  segments.forEach((seg, idx) => {
    if (seg.kind === 'run') { cum += seg.count || 0; return; }
    zwEntries.push({ segIdx: idx, raw: seg.raw, originalSb: cum });
  });

  // Compute each picot's new position proportionally.
  const newSbList: number[] = zwEntries.map(zw =>
    originalTotal > 0
      ? Math.round((zw.originalSb / originalTotal) * newTotal)
      : 0
  );

  // Review #21 (session 63): a picot (or bead) at the very end stays at the
  // very end — "c: 6ds-p" ×2 → "c: 12ds-p", not "11ds-p-1ds". (One at the
  // very start already stays there: 0 scales to 0.) Valid notation has no
  // other zero gaps (two picots side by side are refused above).
  const endPinned = zwEntries.length > 0 && originalTotal > 0
    && zwEntries[zwEntries.length - 1].originalSb === originalTotal;
  if (endPinned) newSbList[newSbList.length - 1] = newTotal;
  const trailingGap = endPinned ? 0 : 1;

  // Nudge: ensure strictly increasing positions with minimum 1-stitch gap.
  // Work forward — each position must be > the previous one.
  for (let i = 1; i < newSbList.length; i++) {
    if (newSbList[i] <= newSbList[i - 1]) newSbList[i] = newSbList[i - 1] + 1;
  }
  // Also ensure the last picot leaves at least 1 stitch before the end
  // (none if it was AT the end — review #21).
  // (Work backward if the nudges pushed too far.)
  for (let i = newSbList.length - 1; i >= 0; i--) {
    const maxSb = newTotal - trailingGap - (newSbList.length - 1 - i); // 1 stitch for each remaining inner gap
    if (newSbList[i] > maxSb) newSbList[i] = Math.max(i > 0 ? newSbList[i - 1] + 1 : 0, maxSb);
  }

  const fallback = /^jk$/i.test(type) ? 'ss' : 'ds';
  const runAt = (idx: number): WizardSegment | null => {
    const s = segments[idx];
    return s && s.kind === 'run' ? s : null;
  };

  const outParts: string[] = [];
  let actualLength = 0;
  const addRun = (template: WizardSegment | null, runCount: number) => {
    const st = scaleStitches(template?.stitches || [], runCount, fallback);
    if (st.length) { outParts.push(stitchesText(st)); actualLength += stitchesLength(st); }
  };
  let prevSb = 0;
  const runs: RunScaleDetail[] = [];
  const zones = getProtectedZones(segments);

  zwEntries.forEach((zw, i) => {
    const runCount = newSbList[i] - prevSb;
    const originalRun = zw.originalSb - (i === 0 ? 0 : zwEntries[i - 1].originalSb);
    const idealDs = originalRun * scaleFactor;
    const protectedRun = isRunProtected(segments, zw.segIdx - 1, zones);
    const clamped = runCount !== Math.round(idealDs);
    runs.push({ segmentIndex: zw.segIdx - 1, originalDs: originalRun, idealDs, actualDs: runCount, protectedRun, clamped });
    addRun(runAt(zw.segIdx - 1), runCount);
    outParts.push(zw.raw);
    prevSb = newSbList[i];
  });

  // Trailing run (after last picot/barrier to end of element)
  const trailing = newTotal - prevSb;
  const originalTrailing = originalTotal - (zwEntries.length > 0 ? zwEntries[zwEntries.length - 1].originalSb : 0);
  const trailingIdeal = originalTrailing * scaleFactor;
  const trailingProtected = isRunProtected(segments, segments.length - 1, zones);
  runs.push({ segmentIndex: segments.length - 1, originalDs: originalTrailing, idealDs: trailingIdeal, actualDs: trailing, protectedRun: trailingProtected, clamped: trailing !== Math.round(trailingIdeal) });
  addRun(runAt(segments.length - 1), trailing);

  const originalLength = totalRunDs(segments);
  return {
    notation: `${type}: ${outParts.join('-')}`,
    originalTotalDs: originalLength,
    idealTotalDs: originalLength * scaleFactor,
    actualTotalDs: actualLength,
    originalStitches: originalTotal,
    actualStitches: newTotal,
    runs,
    anyClamped: runs.some(r => r.clamped),
  };
}

export function scaleNotation(notation: string, picots: any[] | undefined, scaleFactor: number): ScaleResult | null {
  const a = analyzeNotation(notation, picots);
  if (!a.supported) return null;
  if (!(scaleFactor > 0)) return null;
  return scaleSegments(a.type, a.segments, scaleFactor);
}

// "Common divisors/multiples" preset suggestions, categorised as exact vs
// rounded.
//
// A preset is "exact" when, on every side:
//   1. the new total (in stitches) is a whole number, at least 1
//   2. every picot's proportional position lands on a whole stitch with no
//      nudging needed
//   3. every resulting run is ≥ 1 stitch (no zero-length gaps)
//   4. (session 62) every stitch token scales to a whole number — so a run
//      of several types keeps exactly its proportions
//
// This means "÷2" for "6ds-p-6ds" is exact (picot at 50% → 3ds, all runs=3),
// but "÷4" for "6ds-p-6ds" is rounded (picot at 50% of 6ds = 1.5ds → rounds
// to 2ds, leaving runs of 2 and 1 rather than the ideal 1.5/1.5).
//
// Session 62: takes the analysed sides (one for a ring or chain, two for a
// split ring — each side scales on its own, exactly as Apply does) and works
// in stitches like Scale itself; resultingTotalDs is the LENGTH Apply gives.
// It used to take one total and the picots' stored positions: in length, and
// for a split ring with side B's positions restarting at 0, so a split ring
// with picots on both sides never got an exact preset.
function isExactSide(segments: WizardSegment[], factor: number): boolean {
  const total = totalRunStitches(segments);
  const newTotal = total * factor;
  if (!Number.isInteger(newTotal)) return false;
  if (newTotal < 1) return false;
  // Review #21 (session 63): a gap that was 0 to begin with (a picot at the
  // very start or very end) stays 0 — that's exact, not a squeezed gap.
  let pos = 0, prevSb = 0, prevPos = 0;
  for (const seg of segments) {
    if (seg.kind === 'run') {
      if ((seg.stitches || []).some(s => !Number.isInteger(s.n * factor))) return false;
      pos += seg.count || 0;
      continue;
    }
    const newSb = pos * factor;
    if (!Number.isInteger(newSb)) return false;
    if (pos - prevPos > 0 && newSb - prevSb < 1) return false;
    prevSb = newSb; prevPos = pos;
  }
  // trailing run
  if (total - prevPos > 0 && newTotal - prevSb < 1) return false;
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

export function suggestScalePresets(sides: Array<{ type: string; segments: WizardSegment[] }>): ScalePresetRows {
  const exact: ScalePreset[] = [];
  const rounded: ScalePreset[] = [];
  const totalStitches = sides.reduce((sum, s) => sum + totalRunStitches(s.segments), 0);
  // (a side with no stitches — an unsupported one comes with no segments —
  // adds nothing, as before)
  const resultLength = (factor: number) =>
    sides.reduce((sum, s) => sum + (totalRunStitches(s.segments) > 0 ? scaleSegments(s.type, s.segments, factor).actualTotalDs : 0), 0);

  for (const divisor of [2, 3, 4]) {
    if (totalStitches / divisor < 1) continue;
    const factor = 1 / divisor;
    const preset = { label: `:${divisor}`, factor, resultingTotalDs: resultLength(factor) };
    if (sides.every(s => isExactSide(s.segments, factor))) {
      exact.push({ ...preset, isRounded: false });
    } else {
      rounded.push({ ...preset, isRounded: true });
    }
  }

  // Multiples: always exact since every count × a whole multiplier is whole
  for (const multiplier of [2, 3]) {
    exact.push({ label: `x${multiplier}`, factor: multiplier, resultingTotalDs: resultLength(multiplier), isRounded: false });
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
