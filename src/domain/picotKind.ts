// domain/picotKind.ts
//
// Picot Edit mode: change the KIND of the selected picot(s) — p, lp, sp, gp,
// jpg, cj, cjp — by rewriting just those tokens in the notation. Pure
// functions, no React. Tests: test/unit/picotKind.test.ts.
//
// The app side (setPicotKind in tattingindex.tsx) feeds the result through
// computeElementAfterNotationEdit in 'order' mode, so picot ids and joins
// carry over exactly like any other notation edit. All seven kinds can hold
// a join (canHoldJoin), so no join is dropped by switching between them.
import { parseNotation, splitNotationParts, expandTokens } from './parser';

export type PicotKindToken = 'p' | 'lp' | 'sp' | 'gp' | 'jpg' | 'cj' | 'cjp';
export const PICOT_KIND_TOKENS: readonly PicotKindToken[] = ['p', 'lp', 'sp', 'gp', 'jpg', 'cj', 'cjp'];

// The kind of one parsed picot, or null when it is not one of the seven
// (a bead picot: bp, bjp:, bcjp:, bc:, be … — those belong to Beading mode).
// A joined plain picot (`jp`) counts as `p`: joined is a state, not a kind.
export const picotKindToken = (p: any): PicotKindToken | null => {
  if (!p || p.beadType) return null;
  if (p.isCoreJoin) return p.hasPicotArm ? 'cjp' : 'cj';
  if (p.isGuidePoint) return 'gp';
  if (p.isGuide) return 'jpg';
  if (p.length === 'large') return 'lp';
  if (p.length === 'small') return 'sp';
  return 'p';
};

// What the buttons need to know about the current selection.
export interface PicotKindSelection {
  active: PicotKindToken | null; // set when every selected picot has this kind
  canChange: boolean;            // false when any selected picot is a bead picot
}
export const picotKindSelectionInfo = (
  selected: { elementId: string; picotId: string }[],
  elements: any[]
): PicotKindSelection | null => {
  if (selected.length === 0) return null;
  const kinds: (PicotKindToken | null)[] = selected.map(sp => {
    const el = elements.find(e => e.id === sp.elementId);
    const p = el?.picots?.find((x: any) => x.id === sp.picotId);
    return picotKindToken(p);
  });
  const canChange = kinds.every(k => k !== null);
  const active = canChange && kinds.every(k => k === kinds[0]) ? kinds[0] : null;
  return { active, canChange };
};

const PLAIN_PICOT_RE = /^(\d+)?\s*(sp|cp|p|lp|jp|jpg|cj|cjp|gp)$/i;

const countPicots = (token: string): number | null => {
  const parsed = parseNotation(`r: ${token}`, true);
  return parsed ? parsed.picots.length : null;
};

// Rewrites the picots at the given indices (0-based, in the order the parser
// creates them) of a notation BODY (no `r:` prefix). A repeat group that
// contains a changed picot is written out; every other repeat stays as typed.
// `3p` that holds a changed picot is written out as p-p-p. Returns null when
// the body can't be read or a changed picot is not a plain picot token.
export const replacePicotKinds = (body: string, changes: Map<number, PicotKindToken>): string | null => {
  if (changes.size === 0) return body;
  const out: string[] = [];
  let cursor = 0;
  let failed = false;

  const handleToken = (tok: string) => {
    const n = countPicots(tok);
    if (n === null) { failed = true; return; }
    if (n === 0) { out.push(tok); return; }
    let hit = false;
    for (let i = 0; i < n; i++) if (changes.has(cursor + i)) hit = true;
    if (!hit) { out.push(tok); cursor += n; return; }
    const m = tok.match(PLAIN_PICOT_RE);
    if (!m) { failed = true; return; }
    const base = m[2].toLowerCase();
    for (let i = 0; i < n; i++) out.push(changes.get(cursor + i) ?? base);
    cursor += n;
  };

  for (const part of splitNotationParts(body)) {
    if (failed) break;
    if (!part.repeat) { handleToken(part.text); continue; }
    const inner = expandTokens(part.repeat.inner);
    let perRun = 0;
    for (const tok of inner) {
      const n = countPicots(tok);
      if (n === null) { failed = true; break; }
      perRun += n;
    }
    if (failed) break;
    const total = perRun * part.repeat.count;
    let hit = false;
    for (let i = 0; i < total; i++) if (changes.has(cursor + i)) hit = true;
    if (!hit) { out.push(part.text); cursor += total; continue; }
    for (let rep = 0; rep < part.repeat.count; rep++) for (const tok of inner) handleToken(tok);
  }

  if (failed) return null;
  for (const idx of changes.keys()) if (idx >= cursor) return null;
  return out.join('-');
};

export interface PicotKindPlan { notation: string; notationB: string | null }

// For one element: the new notation (and side B for a split ring) after
// setting `kind` on the picots with these ids. Returns null when nothing
// would change, or when it is not safe to rewrite (the element's picot list
// doesn't line up with its notation, or a chosen picot is a bead picot).
export const planPicotKindChange = (el: any, picotIds: string[], kind: PicotKindToken): PicotKindPlan | null => {
  const picots: any[] = el?.picots || [];
  const wanted = new Set(picotIds);
  const lines = (a: any[], b: any[]) => a.length === b.length && a.every((p, i) => picotKindToken(p) === picotKindToken(b[i]) && !!p.beadType === !!b[i].beadType);

  if (el.isSplitRing) {
    const bodyA = (el.notation || '').replace(/^sr:\s*/i, '');
    const bodyB = el.notationB || '';
    const parsedA = parseNotation(`sr: ${bodyA}`, true);
    const parsedB = parseNotation(`sr: ${bodyB}`, true);
    if (!parsedA || !parsedB) return null;
    const nA = parsedA.picots.length;
    // The element keeps side A reversed, then side B (computeElementAfterNotationEdit).
    const sideA = picots.slice(0, nA).reverse();
    const sideB = picots.slice(nA);
    if (picots.length !== nA + parsedB.picots.length) return null;
    if (!lines(sideA, parsedA.picots) || !lines(sideB, parsedB.picots)) return null;
    const changesA = new Map<number, PicotKindToken>();
    const changesB = new Map<number, PicotKindToken>();
    sideA.forEach((p, i) => { if (wanted.has(p.id) && picotKindToken(p) !== kind) changesA.set(i, kind); });
    sideB.forEach((p, i) => { if (wanted.has(p.id) && picotKindToken(p) !== kind) changesB.set(i, kind); });
    if (changesA.size === 0 && changesB.size === 0) return null;
    const newA = replacePicotKinds(bodyA, changesA);
    const newB = replacePicotKinds(bodyB, changesB);
    if (newA === null || newB === null) return null;
    return { notation: `sr: ${newA}`, notationB: newB };
  }

  const m = (el.notation || '').match(/^([a-z]+):\s*(.*)$/i);
  if (!m) return null;
  const parsed = parseNotation(el.notation, true);
  if (!parsed || !lines(picots, parsed.picots)) return null;
  const changes = new Map<number, PicotKindToken>();
  picots.forEach((p, i) => { if (wanted.has(p.id) && picotKindToken(p) !== kind) changes.set(i, kind); });
  if (changes.size === 0) return null;
  const body = replacePicotKinds(m[2], changes);
  if (body === null) return null;
  return { notation: `${m[1]}: ${body}`, notationB: null };
};

// Picot Edit mode draws each joinable picot as a marker whose SHAPE says the
// kind (components/PicotMarker.tsx) and whose colour says the state. Size is
// part of the kind for the plain picots: short < medium < long. Screen px at
// zoom 1 (divide by zoom); the medium one is bigger than the old uniform dot
// (4.5) so the short one — which keeps the old size — is not tiny. A selected
// marker is 6 / 4.5 larger, as before.
export const PICOT_MARKER_BASE_RADIUS: Record<PicotKindToken, number> = {
  sp: 4.5, p: 5.5, lp: 7, gp: 6.5, jpg: 5.5, cj: 5.5, cjp: 5.5,
};
export const picotMarkerRadius = (kind: PicotKindToken | null, selected: boolean, zoom: number): number =>
  (PICOT_MARKER_BASE_RADIUS[kind ?? 'p'] * (selected ? 6 / 4.5 : 1)) / zoom;
