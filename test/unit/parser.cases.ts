// The notation table: what parseNotation makes of each notation TODAY
// (session 64 — recorded from the code, to be checked by the user; it is
// the starting point for the written notation spec, handoff Task 5).
//
//   stitches  = stitch SLOTS along the path (ds 1, ss/lss/rss 0.5,
//               rds/bds 1.5, a core bead / bead element 1), parseNotation's
//               stitchCount. null = the notation is refused.
//   count     = stitches a tatter makes (countActualStitches) — 12ss is 12.
//   picots    = one entry per picot / bead: at = stitchesBefore, plus only
//               the properties that differ from a plain picot.
//   valid     = isNotationValid (false = red glow).
//   note      = why the row is there.
export interface PicotSummary {
  at: number; size?: 'small' | 'large';
  joins?: true; guide?: true; guidePoint?: true; coreJoin?: true; arm?: true;
  bead?: string; beads?: string; beadSize?: string; core?: string;
}
export interface NotationCase {
  notation: string; type?: string; stitches: number | null; count?: number;
  picots?: PicotSummary[]; valid: boolean; splitChain?: true; note: string; group: string;
}

export const NOTATION_CASES: NotationCase[] = [
  // ── element prefixes ──────────────────────────────────────────────────
  { group: 'Element prefixes', notation: 'r: 6ds', type: 'r', stitches: 6, count: 6, picots: [], valid: true, note: 'ring' },
  { group: 'Element prefixes', notation: 'c: 5ds', type: 'c', stitches: 5, count: 5, picots: [], valid: true, note: 'chain' },
  { group: 'Element prefixes', notation: 'sc: 4ds-p-4ds', type: 'c', splitChain: true, stitches: 8, count: 8, picots: [{ at: 4 }], valid: true, note: 'split chain = a chain with the split-chain flag' },
  { group: 'Element prefixes', notation: 'sr: 3ds-p-3ds', type: 'sr', stitches: 6, count: 6, picots: [{ at: 3 }], valid: true, note: 'split ring — ONE side (side B is its own text)' },
  { group: 'Element prefixes', notation: 'jk: 12ss', type: 'jk', stitches: 6, count: 12, picots: [], valid: true, note: 'Josephine knot: 12 half stitches = 6 slots' },
  { group: 'Element prefixes', notation: 'jk: 4lss-4rss', type: 'jk', stitches: 4, count: 8, picots: [], valid: true, note: 'JK takes lss / rss too' },
  { group: 'Element prefixes', notation: 'jk: 6ds', stitches: null, count: 6, valid: false, note: 'JK refuses ds / rds / bds' },
  { group: 'Element prefixes', notation: 'fr: 4ds-p-4ds', type: 'r', stitches: 8, count: 8, picots: [{ at: 4 }], valid: true, note: 'floating ring = a plain ring' },
  { group: 'Element prefixes', notation: 'mr: 4ds-p-4ds', type: 'r', stitches: 8, count: 8, picots: [{ at: 4 }], valid: true, note: 'mock ring = a plain ring' },
  { group: 'Element prefixes', notation: 'R: 3DS-P-3DS', type: 'r', stitches: 6, count: 6, picots: [{ at: 3 }], valid: true, note: 'capitals are fine' },
  { group: 'Element prefixes', notation: 'r:3ds-p-3ds', type: 'r', stitches: 6, count: 6, picots: [{ at: 3 }], valid: true, note: 'no space after the colon' },
  { group: 'Element prefixes', notation: 'x: 3ds', stitches: null, valid: false, note: 'unknown prefix' },
  { group: 'Element prefixes', notation: '3ds-p-3ds', stitches: null, valid: false, note: 'no prefix' },
  { group: 'Element prefixes', notation: 'r:', stitches: null, valid: false, note: 'nothing after the prefix' },

  // ── stitches ──────────────────────────────────────────────────────────
  { group: 'Stitches', notation: 'r: ds-p-ds', type: 'r', stitches: 2, count: 2, picots: [{ at: 1 }], valid: true, note: 'no number = 1' },
  { group: 'Stitches', notation: 'r: 2rds-p-2bds', type: 'r', stitches: 6, count: 4, picots: [{ at: 3 }], valid: true, note: 'rds and bds are 1.5 slots each' },
  { group: 'Stitches', notation: 'r: 4ss-p-4ss', type: 'r', stitches: 4, count: 8, picots: [{ at: 2 }], valid: true, note: 'ss is half a slot' },
  { group: 'Stitches', notation: 'r: 3lss-3rss', type: 'r', stitches: 3, count: 6, picots: [], valid: true, note: 'lss / rss are half a slot' },
  { group: 'Stitches', notation: 'r: 3ds.p.3ds', type: 'r', stitches: 6, count: 6, picots: [{ at: 3 }], valid: true, note: 'a dot separates like a hyphen' },
  { group: 'Stitches', notation: 'r: 3 ds - p - 3 ds', type: 'r', stitches: 6, count: 6, picots: [{ at: 3 }], valid: true, note: 'spaces around tokens' },
  { group: 'Stitches', notation: 'r: 3ds--p-3ds', type: 'r', stitches: 6, count: 6, picots: [{ at: 3 }], valid: true, note: 'a doubled hyphen is ignored' },
  { group: 'Stitches', notation: 'r: 1.5ds', stitches: null, valid: true, note: 'no fractions (the dot is a separator)' },
  { group: 'Stitches', notation: 'r: 3ds-foo-3ds', stitches: null, valid: true, note: 'unknown token: refused by the parser (isNotationValid only checks neighbours)' },

  // ── picots ────────────────────────────────────────────────────────────
  { group: 'Picots', notation: 'r: 3ds-p-3ds', type: 'r', stitches: 6, count: 6, picots: [{ at: 3 }], valid: true, note: 'picot' },
  { group: 'Picots', notation: 'r: 3ds-sp-3ds-lp-3ds-cp-3ds', type: 'r', stitches: 12, count: 12, picots: [{ at: 3, size: 'small' }, { at: 6, size: 'large' }, { at: 9, size: 'small' }], valid: true, note: 'sp / cp small, lp large' },
  { group: 'Picots', notation: 'r: 3ds-jp-3ds', type: 'r', stitches: 6, count: 6, picots: [{ at: 3, joins: true }], valid: true, note: 'joining picot' },
  { group: 'Picots', notation: 'r: 3ds-jpg-3ds', type: 'r', stitches: 6, count: 6, picots: [{ at: 3, joins: true, guide: true }], valid: true, note: 'joining picot, guide' },
  { group: 'Picots', notation: 'r: 3ds-cj-3ds', type: 'r', stitches: 6, count: 6, picots: [{ at: 3, joins: true, coreJoin: true }], valid: true, note: 'core join' },
  { group: 'Picots', notation: 'r: 3ds-cjp-3ds', type: 'r', stitches: 6, count: 6, picots: [{ at: 3, joins: true, coreJoin: true, arm: true }], valid: true, note: 'core join with a picot arm' },
  { group: 'Picots', notation: 'r: 3ds-gp-3ds', type: 'r', stitches: 6, count: 6, picots: [{ at: 3, guide: true, guidePoint: true }], valid: true, note: 'guide point' },
  { group: 'Picots', notation: 'r: p-3ds', type: 'r', stitches: 3, count: 3, picots: [{ at: 0 }], valid: true, note: 'picot at the very start' },
  { group: 'Picots', notation: 'r: 3ds-p', type: 'r', stitches: 3, count: 3, picots: [{ at: 3 }], valid: true, note: 'picot at the very end' },
  { group: 'Picots', notation: 'r: 3ds-p-p-3ds', type: 'r', stitches: 6, count: 6, picots: [{ at: 3 }, { at: 3 }], valid: false, note: 'two picots side by side: parsed, but NOT valid (red)' },
  { group: 'Picots', notation: 'r: 3ds-2p-3ds', type: 'r', stitches: 6, count: 6, picots: [{ at: 3 }, { at: 3 }], valid: false, note: 'a counted picot (2p) = two side by side: not valid' },

  // ── beads ─────────────────────────────────────────────────────────────
  { group: 'Beads', notation: 'r: 3ds-bc:Y-3ds', type: 'r', stitches: 7, count: 6, picots: [{ at: 3, bead: 'bc', beadSize: 'Y' }], valid: true, note: 'core bead: takes one slot' },
  { group: 'Beads', notation: 'r: 3ds-bc:y-3ds', type: 'r', stitches: 7, count: 6, picots: [{ at: 3, bead: 'bc', beadSize: 'Y' }], valid: true, note: 'bead sizes in small letters' },
  { group: 'Beads', notation: 'r: 3ds-bc:YZ-3ds', type: 'r', stitches: 8, count: 6, picots: [{ at: 3, bead: 'bc', beadSize: 'Y' }, { at: 4, bead: 'bc', beadSize: 'Z' }], valid: true, note: 'core bead sequence: one slot per bead' },
  { group: 'Beads', notation: 'r: 3ds-bc:2Y1Z-3ds', type: 'r', stitches: 9, count: 6, picots: [{ at: 3, bead: 'bc', beadSize: 'Y' }, { at: 4, bead: 'bc', beadSize: 'Y' }, { at: 5, bead: 'bc', beadSize: 'Z' }], valid: true, note: 'counted bead sequence (2Y1Z = YYZ)' },
  { group: 'Beads', notation: 'r: 3ds-bc:Q-3ds', stitches: null, valid: true, note: 'bead sizes are Y, Z, V only' },
  { group: 'Beads', notation: 'r: 3ds-bcp:Y-3ds', type: 'r', stitches: 7, count: 6, picots: [{ at: 3, bead: 'bcp', core: 'Y' }], valid: true, note: 'core bead + picot' },
  { group: 'Beads', notation: 'r: 3ds-bcp:Y:ZZ-3ds', type: 'r', stitches: 7, count: 6, picots: [{ at: 3, bead: 'bcp', core: 'Y', beads: 'ZZ' }], valid: true, note: 'core bead + beaded picot' },
  { group: 'Beads', notation: 'r: 3ds-bcp:YY-3ds', stitches: null, valid: true, note: 'bcp takes ONE core bead' },
  { group: 'Beads', notation: 'r: 3ds-bcjp:Y-3ds', type: 'r', stitches: 7, count: 6, picots: [{ at: 3, bead: 'bcjp', core: 'Y', joins: true }], valid: true, note: 'core bead + joining picot (session 63)' },
  { group: 'Beads', notation: 'r: 3ds-bcjp:Y:ZZ-3ds', type: 'r', stitches: 7, count: 6, picots: [{ at: 3, bead: 'bcjp', core: 'Y', beads: 'ZZ', joins: true }], valid: true, note: 'core bead + joining picot with beads on the join' },
  { group: 'Beads', notation: 'r: 3ds-bcjp:Q-3ds', stitches: null, valid: true, note: 'bcjp: bad bead size' },
  { group: 'Beads', notation: 'r: 3ds-bcjp:-3ds', stitches: null, valid: true, note: 'bcjp: no bead' },
  { group: 'Beads', notation: 'r: 3ds-bcjp-3ds', stitches: null, valid: true, note: 'bcjp needs its core bead' },
  { group: 'Beads', notation: 'r: 3ds-bp:YZ-3ds', type: 'r', stitches: 6, count: 6, picots: [{ at: 3, bead: 'bp', beads: 'YZ' }], valid: true, note: 'beaded picot: no slot' },
  { group: 'Beads', notation: 'r: 3ds-bjp:YZ-3ds', type: 'r', stitches: 6, count: 6, picots: [{ at: 3, bead: 'bjp', beads: 'YZ', joins: true }], valid: true, note: 'beaded joining picot: no slot' },
  { group: 'Beads', notation: 'r: 3ds-sb:Y-3ds', type: 'r', stitches: 6, count: 6, picots: [{ at: 3, bead: 'sb', beads: 'Y' }], valid: true, note: 'suspended bead: no slot' },
  { group: 'Beads', notation: 'r: 3ds-be-3ds', type: 'r', stitches: 7, count: 6, picots: [{ at: 3, bead: 'be' }], valid: true, note: 'bead element: takes one slot' },
  { group: 'Beads', notation: 'r: 3ds-bp-3ds', type: 'r', stitches: 6, count: 6, picots: [{ at: 3, bead: 'default' }], valid: true, note: 'old-style bead picot (bp, bp1…bp5)' },
  { group: 'Beads', notation: 'r: 3ds-bp3-3ds', type: 'r', stitches: 6, count: 6, picots: [{ at: 3, bead: 'type3' }], valid: true, note: 'old-style bead picot, type 3' },
  { group: 'Beads', notation: 'r: 3ds-p-bc:Y-3ds', type: 'r', stitches: 7, count: 6, picots: [{ at: 3 }, { at: 3, bead: 'bc', beadSize: 'Y' }], valid: false, note: 'a picot next to a bead: not valid' },
  { group: 'Beads', notation: 'r: 3ds-be-p-3ds', type: 'r', stitches: 7, count: 6, picots: [{ at: 3, bead: 'be' }, { at: 4 }], valid: false, note: 'a bead element next to a picot: not valid' },

  // ── repeats ───────────────────────────────────────────────────────────
  { group: 'Repeats', notation: 'r: 3*(3ds-p)-3ds', type: 'r', stitches: 12, count: 12, picots: [{ at: 3 }, { at: 6 }, { at: 9 }], valid: true, note: 'n*(…)' },
  { group: 'Repeats', notation: 'r: 3x(3ds-p)-3ds', type: 'r', stitches: 12, count: 12, picots: [{ at: 3 }, { at: 6 }, { at: 9 }], valid: true, note: 'nx(…)' },
  { group: 'Repeats', notation: 'r: (3ds-p)x3-3ds', type: 'r', stitches: 12, count: 12, picots: [{ at: 3 }, { at: 6 }, { at: 9 }], valid: true, note: '(…)xn' },
  { group: 'Repeats', notation: 'r: (3ds-p)*3-3ds', type: 'r', stitches: 12, count: 12, picots: [{ at: 3 }, { at: 6 }, { at: 9 }], valid: true, note: '(…)*n' },
  { group: 'Repeats', notation: 'r: 2*(p)-3ds', type: 'r', stitches: 3, count: 3, picots: [{ at: 0 }, { at: 0 }], valid: false, note: 'a repeat that puts picots side by side: not valid' },
];

// Behaviour that looks like a slip rather than a rule. The tests pin it as
// it is today so a change is noticed; each one is a question for the user
// (see the session-64 handoff). When one is decided, move it to the table.
export const NOTATION_QUIRKS: NotationCase[] = [
  { group: 'To confirm', notation: 'r: 3ds-bjp-3ds', stitches: null, count: 6, valid: true, note: 'bare bjp (no beads) is refused, though it is in the picot lists' },
  { group: 'To confirm', notation: 'r: 0ds', type: 'r', stitches: 1, count: 1, picots: [], valid: true, note: '0ds counts as 1ds' },
  { group: 'To confirm', notation: 'r: 2ds-(p-2ds)', type: 'r', stitches: 4, count: 2, picots: [{ at: 2 }], valid: true, note: 'plain brackets: parsed as 4 stitches, but the stitch COUNT says 2' },
  { group: 'To confirm', notation: 'r: 2*(2ds-p-2*(1ds-p))-1ds', stitches: null, count: 5, valid: true, note: 'a repeat inside a repeat is refused (but passes isNotationValid)' },
  { group: 'To confirm', notation: 'r: 3d-p-3d', stitches: null, count: 0, valid: true, note: '"3d" is only understood after the input box tidies it to 3ds' },
  { group: 'To confirm', notation: 'r: ', type: 'r', stitches: 0, count: 0, picots: [], valid: true, note: 'a prefix and a space: an empty ring, valid' },
  { group: 'To confirm', notation: 'r: 3ds-bp-bp-3ds', type: 'r', stitches: 6, count: 6, picots: [{ at: 3, bead: 'default' }, { at: 3, bead: 'default' }], valid: true, note: 'two old-style bead picots side by side pass as valid' },
];
