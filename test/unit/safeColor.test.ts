// utils/safeColor.ts — colours from pattern files (session 60 security fix;
// session 63 added spatialGroups).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { isSafeColor, safeColor, sanitizeProjectColors } from '../../src/utils/safeColor';

beforeEach(() => { vi.spyOn(console, 'warn').mockImplementation(() => {}); });

const GOOD = ['#fff', '#FFFF', '#1F2937', '#1f2937cc', 'rgb(1,2,3)', 'rgba(1, 2, 3, 0.5)', 'hsl(120, 50%, 50%)', 'hsla(120 50% 50% / 0.3)', 'red', 'transparent', 'currentColor', '  #abc  '];
const BAD = ['red"/><image href=x onerror="alert(1)">', '#12', '#12345', '#ggg', 'url(#a)', 'rgb(1,2,3);x', 'javascript:alert(1)', 'a b', 'ab', '', 'x'.repeat(65), 5, null, undefined, {}, ['#fff'], 'expression(alert(1))', 'rgb(calc(1))'];

describe('isSafeColor / safeColor', () => {
  it.each(GOOD)('accepts %j', v => { expect(isSafeColor(v)).toBe(true); });
  it.each(BAD)('refuses %j', v => { expect(isSafeColor(v)).toBe(false); });
  it('safeColor trims a real colour and replaces anything else', () => {
    expect(safeColor('  #abc ')).toBe('#abc');
    expect(safeColor('"><script>')).toBe('#888888');
    expect(safeColor(null, '#000')).toBe('#000');
  });
  it('a safe colour never contains a character that could end an attribute', () => {
    for (const v of GOOD) expect(safeColor(v)).not.toMatch(/["'<>=]/);
  });
});

describe('sanitizeProjectColors', () => {
  const X = 'red"/><image href=x onerror="alert(1)">';
  it('replaces every bad colour and counts them', () => {
    const data: any = {
      bgColor: X,
      elements: [{ color: X, colorB: X }, { color: '#123456' }, null, 'text'],
      materials: [{ color: X, stops: [{ color: X }, { color: '#fff' }] }, { color: 'blue' }],
      beadLibrary: [{ color: X }],
      polarGrids: [{ color: X }],
      spatialGroups: [{ id: 'g', name: 'G', color: X }],
      customColors: ['#fff', X, { color: '#000' }, { color: X }, 5],
    };
    expect(sanitizeProjectColors(data)).toBe(11);
    expect(data.bgColor).toBe('#1F2937');
    expect(data.elements[0]).toEqual({ color: '#FFFFFF', colorB: '#FFFFFF' });
    expect(data.elements[1].color).toBe('#123456');
    expect(data.materials[0]).toEqual({ color: '#FFFFFF', stops: [{ color: '#FFFFFF' }, { color: '#fff' }] });
    expect(data.beadLibrary[0].color).toBe('#888888');
    expect(data.polarGrids[0].color).toBe('#4B9FE1');
    expect(data.spatialGroups[0].color).toBe('#888888');
    expect(data.customColors).toEqual(['#fff', { color: '#000' }]);
    expect(JSON.stringify(data)).not.toContain('onerror');
  });
  it('does not touch a sound pattern, and copes with odd input', () => {
    const data: any = { bgColor: '#1F2937', elements: [{ color: '#fff' }], materials: [{ color: 'red', stops: [{ color: '#000' }] }], customColors: ['#abc'] };
    const before = JSON.stringify(data);
    expect(sanitizeProjectColors(data)).toBe(0);
    expect(JSON.stringify(data)).toBe(before);
    expect(sanitizeProjectColors(null)).toBe(0);
    expect(sanitizeProjectColors('x')).toBe(0);
    expect(sanitizeProjectColors({ elements: 'x', materials: 5 })).toBe(0);
  });
  it('a missing colour is left missing (not invented)', () => {
    const data: any = { elements: [{ id: 'a' }] };
    sanitizeProjectColors(data);
    expect(data.elements[0]).toEqual({ id: 'a' });
  });
});
