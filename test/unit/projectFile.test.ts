// domain/patternOutput.ts — the save format (serializeProject), the group
// registry from a file (review #3) and the settings key behind the unsaved
// star (review #2).
import { describe, it, expect } from 'vitest';
import { serializeProject, normalizeSpatialGroups, projectSettingsKey, referenceImageFingerprint } from '../../src/domain/patternOutput';

const project = (over: any = {}) => ({
  name: 'Snow', elements: [{ id: 'a' }], picotConnections: [], camera: { x: 1, y: 2 }, zoom: 1.5, dsWidth: 10,
  bgColor: '#1F2937', gridEnabled: true, customColors: [], referenceImage: null, refImageProps: { x: 0 },
  renderMode: 'schematic', patternNotes: 'notes', materials: [{ id: 'default', color: '#fff' }], orderGroups: [],
  beadLibrary: [], polarGrids: [], selectedPolarGridId: null,
  threadPresets: [{ id: 'p1', name: 'One' }, { id: 'p2', name: 'Two' }], activePresetId: 'p2',
  ...over,
});

describe('serializeProject', () => {
  it('writes file version 92 with every field, in a fixed order', () => {
    const out: any = serializeProject(project({ spatialGroups: [{ id: 'g1', name: 'Petals', color: '#ff0000' }] }));
    expect(out.version).toBe(92);
    expect(Object.keys(out)).toEqual(['version', 'name', 'created', 'elements', 'picotConnections', 'camera', 'zoom', 'dsWidth',
      'bgColor', 'gridEnabled', 'customColors', 'referenceImage', 'refImageProps', 'renderMode', 'patternNotes', 'materials',
      'orderGroups', 'beadLibrary', 'polarGrids', 'selectedPolarGridId', 'activeThreadPreset', 'spatialGroups']);
    expect(out.spatialGroups).toEqual([{ id: 'g1', name: 'Petals', color: '#ff0000' }]);
    expect(out.activeThreadPreset).toEqual({ id: 'p2', name: 'Two' });
    expect(Number.isNaN(Date.parse(out.created))).toBe(false);
  });
  it('an autosave carries autoSaved instead of created', () => {
    const out: any = serializeProject(project(), true);
    expect('autoSaved' in out).toBe(true);
    expect('created' in out).toBe(false);
  });
  it('no groups → an empty list; unknown preset → the first; no presets → null', () => {
    expect((serializeProject(project()) as any).spatialGroups).toEqual([]);
    expect((serializeProject(project({ activePresetId: 'gone' })) as any).activeThreadPreset).toEqual({ id: 'p1', name: 'One' });
    expect((serializeProject(project({ threadPresets: [] })) as any).activeThreadPreset).toBeNull();
  });
  it('survives a JSON round trip unchanged', () => {
    const out = serializeProject(project());
    expect(JSON.parse(JSON.stringify(out))).toEqual(out);
  });
});

describe('normalizeSpatialGroups', () => {
  it('keeps well-formed entries', () => {
    expect(normalizeSpatialGroups([{ id: 'a', name: 'Petals', color: ' #ff0000 ' }])).toEqual([{ id: 'a', name: 'Petals', color: '#ff0000' }]);
  });
  it('drops malformed entries and duplicate ids, replaces bad colours, trims long names', () => {
    const out = normalizeSpatialGroups([
      null, 'text', 5, {}, { id: 5, name: 'n' }, { id: '', name: 'n' },
      { id: 'a', name: 'First', color: 'red"/><x>' },
      { id: 'a', name: 'Duplicate', color: '#000' },
      { id: 'b', name: 7, color: '#000' },
      { id: 'c', name: 'x'.repeat(500), color: '#000', extra: 'dropped' },
    ]);
    expect(out).toEqual([
      { id: 'a', name: 'First', color: '#888888' },
      { id: 'b', name: '', color: '#000' },
      { id: 'c', name: 'x'.repeat(200), color: '#000' },
    ]);
  });
  it('anything that is not a list → []', () => {
    for (const v of [undefined, null, {}, 'x', 5]) expect(normalizeSpatialGroups(v)).toEqual([]);
  });
});

describe('projectSettingsKey (unsaved star for settings outside Undo)', () => {
  const base = { patternNotes: 'n', materials: [{ id: 'm', color: '#fff' }], referenceImage: 'data:image/png;base64,AAAA', refImageProps: { x: 1 }, bgColor: '#000', beadLibrary: [], dsWidth: 10, activeThreadPreset: { id: 'p' } };
  it('is the same for the same settings', () => {
    expect(projectSettingsKey(base)).toBe(projectSettingsKey(JSON.parse(JSON.stringify(base))));
  });
  it.each([
    ['patternNotes', 'other'], ['materials', [{ id: 'm', color: '#000' }]], ['referenceImage', 'data:image/png;base64,BBBB'],
    ['refImageProps', { x: 2 }], ['bgColor', '#111'], ['beadLibrary', [{ id: 'b' }]], ['dsWidth', 12], ['activeThreadPreset', { id: 'q' }],
  ])('changes when %s changes', (key, value) => {
    expect(projectSettingsKey({ ...base, [key]: value })).not.toBe(projectSettingsKey(base));
  });
  it('ignores view settings (camera, zoom, grid, render mode) and the elements', () => {
    expect(projectSettingsKey({ ...base, camera: { x: 9 }, zoom: 3, gridEnabled: false, renderMode: 'realistic', elements: [1] } as any)).toBe(projectSettingsKey(base));
  });
  it('missing notes count as empty notes', () => {
    expect(projectSettingsKey({ ...base, patternNotes: undefined })).toBe(projectSettingsKey({ ...base, patternNotes: '' }));
  });
  it('uses a given image fingerprint instead of hashing the image again', () => {
    expect(projectSettingsKey(base, referenceImageFingerprint(base.referenceImage))).toBe(projectSettingsKey(base));
    expect(referenceImageFingerprint(null)).toBe('');
  });
});
