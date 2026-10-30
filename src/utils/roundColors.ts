// utils/roundColors.ts
//
// Session 59. Tatting Order round colours are part of the colour theme
// (theme key `orderRoundColors`). The theme stores them as ONE string so the
// theme file stays flat ("key": "text" like every other key):
//
//   "#FFD700/#000000, #38BDF8/#003366, #F472B6/#5C0030, ..."
//
// one "fill/outline" pair per slot. Slot 0 = elements in no round (legacy
// gold); slot 1+ = Round 1, Round 2, … (wrapping round). Default = the
// built-in ORDER_GROUP_COLORS (render/svgExport.ts).
//
// Components deep in the property bar (RoundGroupPicker, TattingOrderModeBar)
// read the current pairs from RoundColorsContext; tattingindex.tsx provides
// it. NOT used for spatial GROUP colours — those are stored in the pattern
// file when a group is created, so they are pattern data, not theme.
import { createContext } from 'react';
import { ORDER_GROUP_COLORS } from '../render/svgExport';

export type RoundColorPair = [string, string];

export const DEFAULT_ROUND_COLORS_TEXT = ORDER_GROUP_COLORS.map(([f, s]) => `${f}/${s}`).join(', ');

/** Parse the theme string; any slot that isn't "fill/outline" is skipped.
 *  Falls back to the built-in palette when nothing usable is left. */
export const parseRoundColors = (text: unknown): RoundColorPair[] => {
  if (typeof text !== 'string') return ORDER_GROUP_COLORS;
  const pairs = text.split(',')
    .map(part => part.split('/').map(s => s.trim()))
    .filter(p => p.length === 2 && p[0] !== '' && p[1] !== '') as RoundColorPair[];
  return pairs.length > 0 ? pairs : ORDER_GROUP_COLORS;
};

export const RoundColorsContext = createContext<RoundColorPair[]>(ORDER_GROUP_COLORS);
