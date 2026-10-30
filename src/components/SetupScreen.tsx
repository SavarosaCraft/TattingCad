// components/SetupScreen.tsx
//
// Session 60. First-run setup screen: language, toolbar (Simple / Full),
// size (Normal / Large), background and indicator colours, on one screen.
//
//  - Shown once to everyone (fresh installs AND existing users) on the first
//    start of the version that has it; tattingindex.tsx remembers it with
//    localStorage `tcad_setup_seen`. Reopened from Options → Setup….
//  - It opens with the app's CURRENT settings, so Start or Skip without
//    changes keeps everything as it was. Fresh installs therefore see the
//    defaults (language from the computer, Simple, Normal, default
//    background, Standard — or "My file" when a tatting-theme.json is there).
//  - Every pick applies at once (live preview on the app behind) through the
//    same setters / storage keys the Options menu uses — nothing new is read
//    anywhere else.
//  - Start keeps the picks. Skip / ✕ / Escape put back only the settings the
//    user changed HERE (so a theme file that loads while the screen is open
//    isn't undone by Skip).
//  - No close on backdrop click: a stray tap shouldn't dismiss it.
import React, { useEffect, useRef, useState } from 'react';
import { Modal } from './Modal';
import type { ThemePresetId, DEFAULT_THEME } from '../hooks/useViewState';

type Setting = 'language' | 'toolbar' | 'size' | 'bg' | 'theme';

interface SetupScreenProps {
  show: boolean;
  /** Called after Start / Skip / ✕ (already applied or put back). */
  onDone: () => void;
  language: string;
  languages: Record<string, string>;
  setLanguage: (code: string) => void;
  toolbarMode: 'simple' | 'full';
  setToolbarMode: (m: 'simple' | 'full') => void;
  uiScale: string;
  setUiScale: (s: string) => void;
  bgColor: string;
  bgChoices: string[];
  setBgColor: (c: string) => void;
  themePreset: ThemePresetId;
  setThemePreset: (p: ThemePresetId) => void;
  themeFor: (p: ThemePresetId) => typeof DEFAULT_THEME;
  hasThemeFile: boolean;
  hasCustomTheme: boolean;
  t: (key: string) => string;
}

// Light backgrounds get dark outlines in the previews.
const isLight = (hex: string) => {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return false;
  const n = parseInt(m[1], 16);
  return (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) > 150;
};

const choiceClass = (selected: boolean) =>
  `rounded-lg border-2 px-3 py-2 text-sm text-left transition-colors ${
    selected ? 'border-blue-500 bg-gray-700 text-white' : 'border-gray-600 bg-gray-900 text-gray-300 hover:border-gray-400'
  }`;

// Tiny toolbar pictures: Simple = labelled rows, Full = 2-column icon grid.
const ToolbarPicture: React.FC<{ mode: 'simple' | 'full' }> = ({ mode }) => (
  <svg width="40" height="52" viewBox="0 0 40 52" aria-hidden="true" className="flex-shrink-0">
    <rect x="0.5" y="0.5" width="39" height="51" rx="4" fill="#111827" stroke="#4B5563" />
    {mode === 'simple'
      ? [0, 1, 2, 3, 4].map(i => (
          <g key={i}>
            <rect x="5" y={5 + i * 9} width="7" height="6" rx="1.5" fill="#60A5FA" />
            <rect x="15" y={7 + i * 9} width="19" height="2.5" rx="1" fill="#9CA3AF" />
          </g>
        ))
      : [0, 1, 2, 3, 4, 5].flatMap(r => [0, 1].map(c => (
          <rect key={`${r}-${c}`} x={7 + c * 15} y={4 + r * 7.6} width="11" height="5.6" rx="1.5" fill="#60A5FA" />
        )))}
  </svg>
);

export const SetupScreen: React.FC<SetupScreenProps> = ({
  show, onDone, language, languages, setLanguage, toolbarMode, setToolbarMode,
  uiScale, setUiScale, bgColor, bgChoices, setBgColor, themePreset, setThemePreset,
  themeFor, hasThemeFile, hasCustomTheme, t,
}) => {
  // Values when the screen opened, for the settings changed here.
  const original = useRef<{ language: string; toolbar: 'simple' | 'full'; size: string; bg: string; theme: ThemePresetId } | null>(null);
  const [changed, setChanged] = useState<Set<Setting>>(new Set());

  useEffect(() => {
    if (show) {
      original.current = { language, toolbar: toolbarMode, size: uiScale, bg: bgColor, theme: themePreset };
      setChanged(new Set());
    }
    // Only on open: later values are the user's picks.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show]);

  const mark = (s: Setting) => setChanged(prev => (prev.has(s) ? prev : new Set(prev).add(s)));

  const finish = () => {
    // Language may still be the computer's (never stored); keep what was shown.
    setLanguage(language);
    onDone();
  };
  const skip = () => {
    const o = original.current;
    if (o) {
      if (changed.has('language')) setLanguage(o.language);
      if (changed.has('toolbar')) setToolbarMode(o.toolbar);
      if (changed.has('size')) setUiScale(o.size);
      if (changed.has('bg')) setBgColor(o.bg);
      if (changed.has('theme')) setThemePreset(o.theme);
    }
    onDone();
  };

  // Escape = Skip. Capture phase + stop, so the app's own Escape handling
  // (which would close the splash underneath) doesn't also run.
  const skipRef = useRef(skip);
  skipRef.current = skip;
  useEffect(() => {
    if (!show) return;
    const h = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation(); e.preventDefault();
      skipRef.current();
    };
    document.addEventListener('keydown', h, true);
    return () => document.removeEventListener('keydown', h, true);
  }, [show]);

  const themeChoices: ThemePresetId[] = [
    'standard', 'pastel',
    ...(hasThemeFile ? ['file' as const] : []),
    ...(hasCustomTheme ? ['custom' as const] : []),
  ];
  const themeLabel = (p: ThemePresetId) =>
    p === 'standard' ? t('themePresetStandard')
      : p === 'pastel' ? t('setupThemePastel')
      : p === 'file' ? t('themePresetFile')
      : t('themePresetCustom');

  const light = isLight(bgColor);
  const sectionTitle = (key: string) => (
    <h3 className="text-gray-400 text-xs font-semibold uppercase tracking-wide mb-1.5">{t(key)}</h3>
  );

  return (
    <Modal show={show} onClose={() => { /* no backdrop close */ }}
      backdropZIndex={2147483633} wrapperZIndex={2147483634}
      backdropClassName="bg-black bg-opacity-50"
      contentClassName="flex flex-col"
      contentStyle={{ width: 'min(480px, 95vw)', maxHeight: '92dvh' }}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3 px-5 pt-4 pb-3 border-b border-gray-700">
        <div>
          <h2 className="text-white font-semibold text-lg leading-tight">{t('setupTitle')}</h2>
          <p className="text-gray-400 text-xs mt-1 leading-snug">{t('setupIntro')}</p>
        </div>
        <button onClick={skip} className="text-gray-400 hover:text-white text-xl leading-none px-2 -mr-2"
          title={t('setupSkip')} aria-label={t('setupSkip')}>×</button>
      </div>

      {/* Settings */}
      <div className="flex flex-col gap-4 px-5 py-4 overflow-y-auto">
        {Object.keys(languages).length > 1 && (
          <section>
            {sectionTitle('languagePickerLabel')}
            <select value={language}
              onChange={e => { setLanguage(e.target.value); mark('language'); }}
              className="w-full bg-gray-700 text-white text-sm rounded-lg px-3 py-2 border border-gray-600"
              style={{ cursor: 'pointer' }}>
              {Object.entries(languages).map(([code, label]) => (
                <option key={code} value={code}>{label}</option>
              ))}
            </select>
          </section>
        )}

        <section>
          {sectionTitle('setupToolbar')}
          <div className="grid grid-cols-2 gap-2">
            {(['simple', 'full'] as const).map(m => (
              <button key={m} onClick={() => { setToolbarMode(m); mark('toolbar'); }}
                className={`${choiceClass(toolbarMode === m)} flex items-center gap-3`} aria-pressed={toolbarMode === m}>
                <ToolbarPicture mode={m} />
                <span className="flex flex-col">
                  <span className="font-semibold">{t(m === 'simple' ? 'setupToolbarSimple' : 'setupToolbarFull')}</span>
                  <span className="text-xs text-gray-400 leading-snug">{t(m === 'simple' ? 'setupToolbarSimpleHint' : 'setupToolbarFullHint')}</span>
                </span>
              </button>
            ))}
          </div>
        </section>

        <section>
          {sectionTitle('setupSize')}
          <div className="grid grid-cols-2 gap-2">
            {(['normal', 'large'] as const).map(s => (
              <button key={s} onClick={() => { setUiScale(s); mark('size'); }}
                className={`${choiceClass(uiScale === s)} flex items-center gap-3`} aria-pressed={uiScale === s}>
                <span className="font-semibold w-8 text-center leading-none" style={{ fontSize: s === 'normal' ? 15 : 21 }} aria-hidden="true">Aa</span>
                <span className="font-semibold">{s === 'normal' ? t('uiScaleNormal') : t('optionsSizeLarge')}</span>
              </button>
            ))}
          </div>
        </section>

        <section>
          {sectionTitle('setupBackground')}
          <div className="flex flex-wrap gap-2">
            {bgChoices.map(c => {
              const selected = c.toLowerCase() === bgColor.toLowerCase();
              return (
                <button key={c} onClick={() => { setBgColor(c); mark('bg'); }}
                  className={`w-11 h-11 rounded-lg border-2 flex items-center justify-center ${selected ? 'border-blue-500' : 'border-gray-600 hover:border-gray-400'}`}
                  style={{ backgroundColor: c }} title={c} aria-label={c} aria-pressed={selected}>
                  <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true">
                    <circle cx="11" cy="11" r="7" fill="none" stroke={isLight(c) ? '#374151' : '#D1D5DB'} strokeWidth="2.5" />
                  </svg>
                </button>
              );
            })}
          </div>
        </section>

        <section>
          {sectionTitle('setupTheme')}
          <p className="text-gray-500 text-xs mb-1.5 -mt-0.5 leading-snug">{t('setupThemeHint')}</p>
          <div className="grid grid-cols-2 gap-2">
            {themeChoices.map(p => {
              const th = themeFor(p);
              const dots = [th.jpUnconnected, th.jpConnected, th.jpSelected, th.glowInvalid, th.glowTooShort];
              return (
                <button key={p} onClick={() => { setThemePreset(p); mark('theme'); }}
                  className={`${choiceClass(themePreset === p)} flex flex-col gap-1.5`} aria-pressed={themePreset === p}>
                  <span className="flex gap-1.5 rounded px-2 py-1.5 self-start" style={{ backgroundColor: bgColor }} aria-hidden="true">
                    {dots.map((d, i) => (
                      <span key={i} className="w-3.5 h-3.5 rounded-full"
                        style={{ background: d, boxShadow: `0 0 0 1px ${light ? 'rgba(0,0,0,0.45)' : 'rgba(0,0,0,0.6)'}` }} />
                    ))}
                  </span>
                  <span className="font-semibold leading-snug">{themeLabel(p)}</span>
                </button>
              );
            })}
          </div>
        </section>
      </div>

      {/* Footer */}
      <div className="flex items-center gap-2 px-5 py-3 border-t border-gray-700">
        <span className="flex-1 text-gray-500 text-xs leading-snug">{t('setupLaterHint')}</span>
        <button onClick={skip}
          className="px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-200 text-sm font-semibold">{t('setupSkip')}</button>
        <button onClick={finish}
          className="px-5 py-2 rounded-lg bg-blue-700 hover:bg-blue-600 text-white text-sm font-semibold">{t('setupStart')}</button>
      </div>
    </Modal>
  );
};
