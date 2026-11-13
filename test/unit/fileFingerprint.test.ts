// utils/fileFingerprint.ts — review #4 ("the file has changed" check).
import { describe, it, expect } from 'vitest';
import { fingerprintText } from '../../src/utils/fileFingerprint';
import { makeRng } from './helpers/patterns';

describe('fingerprintText', () => {
  it('is stable: the same text always gives the same fingerprint', () => {
    // Fixed values — an autosave written by one version must still match
    // after an update, or every Resume would ask "the file has changed".
    expect(fingerprintText('{"version":92}')).toMatchInlineSnapshot(`"14:1kw37s6uvum"`);
    expect(fingerprintText('TattingCAD')).toMatchInlineSnapshot(`"10:2q20q6iw4l"`);
  });
  it('starts with the text length', () => {
    expect(fingerprintText('abc').startsWith('3:')).toBe(true);
    expect(fingerprintText('é').startsWith('1:')).toBe(true);
  });
  it('changes with any one-character edit (2,000 random texts)', () => {
    const { int } = makeRng(99);
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789{}[]":, .-';
    for (let k = 0; k < 2000; k++) {
      const len = int(1, 200);
      let text = ''; for (let i = 0; i < len; i++) text += chars[int(0, chars.length - 1)];
      const at = int(0, len - 1);
      const other = text[at] === 'a' ? 'b' : 'a';
      const edited = text.slice(0, at) + other + text.slice(at + 1);
      expect(fingerprintText(edited), `case ${k}`).not.toBe(fingerprintText(text));
      expect(fingerprintText(text + ' '), `case ${k} (+space)`).not.toBe(fingerprintText(text));
    }
  });
  it('tells apart texts of the same length with swapped characters', () => {
    expect(fingerprintText('ab')).not.toBe(fingerprintText('ba'));
  });
});
