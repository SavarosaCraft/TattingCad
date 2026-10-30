// components/ThemeEditor.tsx
//
// Session 59. Options → "Indicator colours…": a friendly editor for the
// colour theme (DEFAULT_THEME keys, hooks/useViewState.ts).
//
//  - Choices: Standard / Pastel (built-in), "My file" (a tatting-theme.json
//    next to the app, when present) and Custom. Only Custom can be edited;
//    the others show their colours read-only with "Copy to Custom". Custom
//    is saved in the app and kept when switching away; "+ Custom" makes it
//    from the active choice. Replacing an existing Custom asks first
//    (inline, no browser dialog). "Save as file…" writes it out as json.
//  - Sections with plain names; each colour has a swatch (native colour
//    picker), an opacity slider for the few rgba() keys, and (in Custom) a
//    ↺ button when it differs from the colour Custom started from.
//  - Round colours (one theme string, utils/roundColors.ts) as a list of
//    "Ungrouped / Round 1 / …" rows with number + outline swatches.
//  - Changes apply live and are saved by useViewState (tcad_theme).
//
// Labels reuse existing translation keys where the wording already fits
// (Ruler, Beading, Path edit, Zoom area, Polar/Linear/Spiral Array, Joined
// picot, Ungrouped, Round {n}, Opacity, Close, Cancel, Load Theme…, Reset
// Theme); the rest are theme* keys.
//
// Not listed: jpgArm / jpgArmSelected — kept in the theme for old files but
// nothing draws with them.
import React, { useState } from 'react';
import { Modal } from './Modal';
import { THEME_PRESETS, ThemePresetId, ThemeKey, CustomTheme, DEFAULT_THEME } from '../hooks/useViewState';
import { parseRoundColors } from '../utils/roundColors';

type Row = { key: ThemeKey; label: string; unit?: string };
type Section = { title: string; rows: Row[]; rounds?: boolean };

// title / label = translation keys
const SECTIONS: Section[] = [
  { title: 'themeSecPicots', rows: [
    { key: 'jpUnconnected', label: 'themeJpUnconnected' },
    { key: 'jpConnected', label: 'threadJoinedPicot' },
    { key: 'jpSelected', label: 'themeJpSelected' },
    { key: 'cjUnconnected', label: 'themeCjUnconnected' },
    { key: 'cjConnected', label: 'themeCjConnected' },
    { key: 'cjSelected', label: 'themeCjSelected' },
    { key: 'connectionLine', label: 'themeConnectionLine' },
    { key: 'connectionDot', label: 'themeConnectionDot' },
    { key: 'foldLine', label: 'themeFoldLine' },
    { key: 'gpDiamond', label: 'themeGuidePicot' },
    { key: 'markerOutline', label: 'themeMarkerOutline' },
  ] },
  { title: 'themeSecWarnings', rows: [
    { key: 'glowInvalid', label: 'themeGlowInvalid' },
    { key: 'glowTooShort', label: 'themeGlowTooShort' },
    { key: 'glowUnnumbered', label: 'themeGlowUnnumbered' },
  ] },
  { title: 'themeSecSelection', rows: [
    { key: 'selectionOutline', label: 'themeSelectionOutline' },
    { key: 'selectionFill', label: 'themeSelectionFill' },
    { key: 'pivotHandle', label: 'themePivot' },
    { key: 'handleBorder', label: 'themeHandleBorder' },
    { key: 'snapOuter', label: 'themeSnapOuter' },
    { key: 'snapInner', label: 'themeSnapInner' },
    { key: 'zoomRectOutline', label: 'toolLabelZoomRect' },
    { key: 'zoomRectFill', label: 'themeZoomRectFill' },
  ] },
  { title: 'toolLabelPathEdit', rows: [
    { key: 'handleStart', label: 'themeHandleStart' },
    { key: 'handleControl1', label: 'themeHandleControl1' },
    { key: 'handleControl2', label: 'themeHandleControl2' },
    { key: 'handleStroke', label: 'themeHandleStroke' },
    { key: 'pathGuide', label: 'themePathGuide' },
  ] },
  { title: 'toolLabelBeading', rows: [
    { key: 'beadAnchor', label: 'themeBeadAnchor' },
    { key: 'beadAnchorBeading', label: 'themeBeadAnchorBeading' },
    { key: 'beadAnchorSelected', label: 'themeBeadAnchorSelected' },
    { key: 'beadAnchorOutline', label: 'themeBeadAnchorOutline' },
    { key: 'beadMissing', label: 'themeBeadMissing' },
  ] },
  { title: 'themeSecPreviews', rows: [
    { key: 'previewPolar', label: 'polarArrayTitle' },
    { key: 'previewLinear', label: 'linearArrayTitle' },
    { key: 'previewSpiral', label: 'spiralArrayTitle' },
  ] },
  { title: 'toolLabelRuler', rows: [
    { key: 'rulerStart', label: 'themeRulerStart' },
    { key: 'rulerEnd', label: 'themeRulerEnd' },
    { key: 'rulerLocked', label: 'themeRulerLocked' },
    { key: 'rulerLabelBg', label: 'themeRulerLabelBg' },
    { key: 'rulerTextPx', label: 'themeRulerText', unit: 'px' },
    { key: 'rulerTextMm', label: 'themeRulerText', unit: 'mm' },
    { key: 'rulerTextCm', label: 'themeRulerText', unit: 'cm' },
    { key: 'rulerTextInch', label: 'themeRulerText', unit: 'in' },
    { key: 'rulerHint', label: 'themeRulerHint' },
  ] },
  { title: 'themeSecOrder', rounds: true, rows: [
    { key: 'orderRepeatText', label: 'themeRepeatText' },
    { key: 'orderRepeatOutline', label: 'themeRepeatOutline' },
  ] },
  { title: 'themeSecCanvas', rows: [
    { key: 'notationText', label: 'themeNotationText' },
    { key: 'notationOutline', label: 'themeNotationOutline' },
    { key: 'threadOutline', label: 'themeThreadOutline' },
    { key: 'gridLine', label: 'themeGridLine' },
    { key: 'gridLineLight', label: 'themeGridLineLight' },
  ] },
];

const PRESET_LABELS: Record<ThemePresetId, string> = { standard: 'themePresetStandard', pastel: 'themePresetPastel', file: 'themePresetFile', custom: 'themePresetCustom' };

// ── colour text ⇄ picker value (#rrggbb) + optional opacity ──────────────
const toHex2 = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
export const splitColor = (value: string): { hex: string; alpha: number | null } => {
  const v = (value || '').trim();
  const m = v.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/i);
  if (m) {
    return { hex: `#${toHex2(+m[1])}${toHex2(+m[2])}${toHex2(+m[3])}`, alpha: m[4] !== undefined ? Math.max(0, Math.min(1, +m[4])) : null };
  }
  if (/^#[0-9a-f]{3}$/i.test(v)) return { hex: `#${v[1]}${v[1]}${v[2]}${v[2]}${v[3]}${v[3]}`.toLowerCase(), alpha: null };
  if (/^#[0-9a-f]{6}$/i.test(v)) return { hex: v.toLowerCase(), alpha: null };
  return { hex: '#000000', alpha: null };
};
export const joinColor = (hex: string, alpha: number | null): string => {
  if (alpha === null) return hex.toUpperCase();
  const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${Math.round(alpha * 100) / 100})`;
};

interface ThemeEditorProps {
  show: boolean;
  onClose: () => void;
  theme: typeof DEFAULT_THEME;
  /** Full colour set of any choice (preview dots, Custom's starting colours). */
  themeFor: (p: ThemePresetId) => typeof DEFAULT_THEME;
  themePreset: ThemePresetId;
  setThemePreset: (p: ThemePresetId) => void;
  themeCustom: CustomTheme | null;
  copyThemeToCustom: (from: ThemePresetId) => void;
  setCustomThemeColors: (colors: CustomTheme['colors']) => void;
  /** A tatting-theme.json next to the app → offered as "My file". */
  hasThemeFile: boolean;
  onLoadFile: () => void;
  onSaveFile: () => void;
  t: (key: string) => string;
}

export const ThemeEditor: React.FC<ThemeEditorProps> = ({
  show, onClose, theme, themeFor, themePreset, setThemePreset, themeCustom, copyThemeToCustom,
  setCustomThemeColors, hasThemeFile, onLoadFile, onSaveFile, t,
}) => {
  // Which choice is waiting for "replace Custom?" confirmation.
  const [pendingCopy, setPendingCopy] = useState<ThemePresetId | null>(null);
  const editing = themePreset === 'custom' && !!themeCustom;
  const customColors = themeCustom?.colors ?? {};
  const editCount = Object.keys(customColors).length;
  const choices: ThemePresetId[] = [
    ...(Object.keys(THEME_PRESETS) as ThemePresetId[]),
    ...(hasThemeFile ? ['file' as const] : []),
    ...(themeCustom ? ['custom' as const] : []),
  ];

  const setColor = (key: ThemeKey, value: string) => {
    if (editing) setCustomThemeColors({ ...customColors, [key]: value });
  };
  const resetColor = (key: ThemeKey) => {
    const next = { ...customColors }; delete next[key]; setCustomThemeColors(next);
  };
  // Copy the shown choice into Custom; asks first if that would replace one.
  const copyToCustom = (from: ThemePresetId) => {
    if (themeCustom && editCount > 0) setPendingCopy(from);
    else { copyThemeToCustom(from); setPendingCopy(null); }
  };

  const swatch = (value: string, onChange: (v: string) => void, title: string) => {
    const { hex, alpha } = splitColor(value);
    return (
      <label className={`relative inline-block w-8 h-8 rounded border border-gray-500 overflow-hidden flex-shrink-0 ${editing ? 'cursor-pointer' : 'cursor-default'}`} title={title}
        style={{ backgroundImage: alpha !== null ? 'repeating-conic-gradient(#6b7280 0% 25%, #374151 0% 50%)' : undefined, backgroundSize: '10px 10px' }}>
        <span className="absolute inset-0" style={{ background: value }} />
        {editing && (
          <input type="color" value={hex} onChange={e => onChange(joinColor(e.target.value, alpha))}
            className="absolute inset-0 opacity-0 w-full h-full cursor-pointer" />
        )}
      </label>
    );
  };

  const resetButton = (visible: boolean, onClick: () => void) => (
    <button onClick={onClick} title={t('themeResetColor')} aria-label={t('themeResetColor')}
      className={`w-7 h-7 flex-shrink-0 rounded text-sm text-gray-300 hover:text-white hover:bg-gray-600 ${visible ? '' : 'invisible'}`}>↺</button>
  );

  const colorRow = (row: Row) => {
    const value = theme[row.key];
    const { hex, alpha } = splitColor(value);
    const label = t(row.label).replace('{unit}', row.unit ?? '');
    return (
      <div key={row.key} className="flex items-center gap-2 py-1">
        {swatch(value, v => setColor(row.key, v), label)}
        <span className="flex-1 text-sm text-gray-200 leading-tight">{label}</span>
        {alpha !== null && editing && (
          <input type="range" min={0} max={100} value={Math.round(alpha * 100)}
            onChange={e => setColor(row.key, joinColor(hex, +e.target.value / 100))}
            title={`${t('polarGridOpacityLabel')} ${Math.round(alpha * 100)}%`} aria-label={t('polarGridOpacityLabel')}
            className="w-20" />
        )}
        {resetButton(editing && row.key in customColors, () => resetColor(row.key))}
      </div>
    );
  };

  const rounds = parseRoundColors(theme.orderRoundColors);
  const setRound = (i: number, part: 0 | 1, v: string) => {
    const next = rounds.map(p => [...p] as [string, string]);
    next[i][part] = v;
    setColor('orderRoundColors', next.map(([f, s]) => `${f}/${s}`).join(', '));
  };

  const btn = 'px-3 py-1.5 rounded text-sm bg-gray-700 text-gray-200 hover:bg-gray-600';

  return (
    <Modal show={show} onClose={onClose} backdropZIndex={10020} wrapperZIndex={10021}
      contentClassName="flex flex-col"
      contentStyle={{ width: 'min(520px, 95vw)', maxHeight: '88dvh' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-gray-700">
        <h2 className="text-white font-semibold text-base">{t('themeEditorTitle')}</h2>
        <button onClick={onClose} className="text-gray-400 hover:text-white text-xl leading-none px-2" title={t('aboutClose')} aria-label={t('aboutClose')}>×</button>
      </div>

      {/* Choices */}
      <div className="px-5 py-3 border-b border-gray-700">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-gray-400 mr-1">{t('themePreset')}</span>
          {choices.map(p => (
            <button key={p} onClick={() => { setThemePreset(p); setPendingCopy(null); }}
              className={`px-3 py-1.5 rounded text-sm flex items-center gap-2 ${p === themePreset ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-200 hover:bg-gray-600'}`}>
              <span className="flex">
                {(['jpUnconnected', 'jpConnected', 'jpSelected'] as ThemeKey[]).map(k => (
                  <span key={k} className="w-2.5 h-2.5 rounded-full -mr-0.5 border border-gray-900" style={{ background: themeFor(p)[k] }} />
                ))}
              </span>
              {t(PRESET_LABELS[p])}
            </button>
          ))}
          {!themeCustom && (
            <button onClick={() => copyToCustom(themePreset)} title={t('themeCopyToCustom')}
              className="px-3 py-1.5 rounded text-sm border border-dashed border-gray-500 text-gray-200 hover:bg-gray-700">
              {t('themePresetCustomNew')}
            </button>
          )}
        </div>
        {!editing && (
          <div className="mt-3 flex items-center gap-2 flex-wrap text-sm text-gray-300">
            <span className="flex-1 min-w-[12rem]">{t('themeReadOnlyNote')}</span>
            <button onClick={() => copyToCustom(themePreset)} className="px-3 py-1 rounded bg-blue-600 text-white hover:bg-blue-700">
              {themeCustom ? t('themeReplaceCustom') : t('themeCopyToCustom')}
            </button>
          </div>
        )}
        {pendingCopy && (
          <div className="mt-3 p-2 rounded bg-gray-700 text-sm text-gray-200 flex items-center gap-2 flex-wrap">
            <span className="flex-1">{t('themeReplaceCustomConfirm').replace('{n}', String(editCount))}</span>
            <button onClick={() => { copyThemeToCustom(pendingCopy); setPendingCopy(null); }} className="px-3 py-1 rounded bg-blue-600 text-white">{t('themeReplace')}</button>
            <button onClick={() => setPendingCopy(null)} className="px-3 py-1 rounded bg-gray-600 text-white">{t('confirmCancel')}</button>
          </div>
        )}
      </div>

      {/* Colours */}
      <div className="flex-1 min-h-0 overflow-y-auto px-5 py-2">
        {SECTIONS.map(sec => (
          <section key={sec.title} className="py-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1">{t(sec.title)}</h3>
            {sec.rows.map(colorRow)}
            {sec.rounds && (
              <div className="mt-1">
                <div className="flex items-center gap-2 py-1">
                  <span className="flex-1 text-sm text-gray-200">{t('themeRoundColors')}</span>
                  {resetButton(editing && 'orderRoundColors' in customColors, () => resetColor('orderRoundColors'))}
                </div>
                <div className="grid gap-x-4 gap-y-1 pl-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))' }}>
                  {rounds.map(([fill, outline], i) => (
                    <div key={i} className="flex items-center gap-1.5">
                      {swatch(fill, v => setRound(i, 0, splitColor(v).hex.toUpperCase()), t('themeRoundFill'))}
                      {swatch(outline, v => setRound(i, 1, splitColor(v).hex.toUpperCase()), t('themeRoundOutline'))}
                      <span className="text-xs font-bold px-1 rounded" style={{ color: fill, WebkitTextStroke: `0.6px ${outline}` }}>
                        {i === 0 ? t('tattingOrderUngrouped') : t('tattingOrderRoundDefault').replace('{n}', String(i))}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        ))}
      </div>

      {/* Footer */}
      <div className="flex items-center gap-2 flex-wrap px-5 py-3 border-t border-gray-700">
        <button onClick={onLoadFile} className={btn}>{t('viewLoadTheme')}</button>
        {editing && <button onClick={onSaveFile} className={btn}>{t('themeSaveFile')}</button>}
        {editing && editCount > 0 && (
          <button onClick={() => setCustomThemeColors({})} className={btn}>
            {t('themeClearEdits').replace('{n}', String(editCount))}
          </button>
        )}
        <span className="flex-1" />
        <button onClick={onClose} className="px-4 py-1.5 rounded text-sm bg-blue-600 text-white hover:bg-blue-700">{t('themeDone')}</button>
      </div>
    </Modal>
  );
};
