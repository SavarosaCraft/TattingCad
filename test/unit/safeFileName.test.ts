// tauri/file.ts safeFileName — review #16 (default file names keep spaces
// and accents; only characters a file name can't hold become "_").
import { describe, it, expect } from 'vitest';
import { safeFileName } from '../../src/tauri/file';

describe('safeFileName', () => {
  it.each([
    ['Snow flake', 'Snow flake'],
    ['a/b\\c:d*e?f"g<h>i|j', 'a_b_c_d_e_f_g_h_i_j'],
    ['Csipke…  ', 'Csipke…'],
    ['name. . ', 'name'],
    ['', 'Pattern'],
    ['   ', 'Pattern'],
    ['tab\there', 'tab_here'],
    ['Hópehely ñ', 'Hópehely ñ'],
    ['...', 'Pattern'],
    ['line\nbreak', 'line_break'],
  ])('%j → %j', (input, expected) => { expect(safeFileName(input)).toBe(expected); });
  it('uses the given fallback, and copes with a missing name', () => {
    expect(safeFileName('', 'Theme')).toBe('Theme');
    expect(safeFileName(undefined as any)).toBe('Pattern');
    expect(safeFileName(null as any)).toBe('Pattern');
  });
});
