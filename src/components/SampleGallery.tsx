// components/SampleGallery.tsx
//
// Session 60. Sample patterns shipped with the app.
//
//  - Files live in public/Patterns/ next to a samples.json list:
//      { "samples": [ { "file": "X.json", "thumb": "X_thumb.png",
//                       "title": "…" | { "en": "…", "hu": "…" },
//                       "description": "…" | { … } } ] }
//    title / description may be plain text or one per language code
//    (English, then the first one, is the fallback).
//  - loadSampleList() is called once at start (tattingindex.tsx); when the
//    list is missing or empty every entry point (splash, File menu, hint)
//    stays hidden.
//  - Opening is done by the caller (openSample in tattingindex.tsx): the
//    pattern opens as an UNTITLED copy (applyProjectData with filePath
//    null), so Save asks where and the shipped file is never overwritten.
import React from 'react';
import { Modal } from './Modal';

export const SAMPLES_DIR = './Patterns/';

type Localized = string | Record<string, string>;
export interface SampleEntry {
  file: string;
  thumb?: string;
  title: Localized;
  description?: Localized;
}

/** Text for the current language: exact code, else English, else the first one. */
export const pickText = (v: Localized | undefined, lang: string): string => {
  if (!v) return '';
  if (typeof v === 'string') return v;
  return v[lang] ?? v.en ?? Object.values(v)[0] ?? '';
};

/** samples.json → valid entries ([] when missing or broken). */
export const loadSampleList = async (): Promise<SampleEntry[]> => {
  try {
    const res = await fetch(`${SAMPLES_DIR}samples.json`);
    if (!res.ok) return [];
    const data = await res.json();
    const list = Array.isArray(data) ? data : data?.samples;
    if (!Array.isArray(list)) return [];
    return list.filter((s: any) =>
      s && typeof s.file === 'string' && s.file.trim() !== ''
      && (typeof s.title === 'string' || (s.title && typeof s.title === 'object')));
  } catch { return []; }
};

export const sampleUrl = (name: string) => SAMPLES_DIR + encodeURIComponent(name);

interface SampleGalleryProps {
  show: boolean;
  onClose: () => void;
  samples: SampleEntry[];
  language: string;
  onOpen: (sample: SampleEntry) => void;
  t: (key: string) => string;
}

export const SampleGallery: React.FC<SampleGalleryProps> = ({ show, onClose, samples, language, onOpen, t }) => (
  <Modal show={show} onClose={onClose} backdropZIndex={10010} wrapperZIndex={10011}
    backdropClassName="bg-black bg-opacity-70"
    contentClassName="flex flex-col" contentStyle={{ width: 'min(720px, 96vw)', maxHeight: '90dvh' }}>
    <div className="flex items-start justify-between gap-3 px-5 pt-4 pb-3 border-b border-gray-700">
      <div>
        <h2 className="text-white font-semibold text-base">{t('samplesTitle')}</h2>
        <p className="text-gray-400 text-xs mt-1 leading-snug">{t('samplesIntro')}</p>
      </div>
      <button onClick={onClose} className="text-gray-400 hover:text-white text-xl leading-none px-2 -mr-2"
        title={t('aboutClose')} aria-label={t('aboutClose')}>×</button>
    </div>
    <div className="overflow-y-auto p-4">
      {samples.length === 0 ? (
        <p className="text-gray-400 text-sm">{t('samplesNone')}</p>
      ) : (
        <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
          {samples.map(s => {
            const title = pickText(s.title, language);
            const description = pickText(s.description, language);
            return (
              <button key={s.file} onClick={() => onOpen(s)}
                className="flex flex-col text-left rounded-lg overflow-hidden border border-gray-600 bg-gray-900 hover:border-blue-500 focus:border-blue-500 focus:outline-none transition-colors">
                <div className="w-full bg-gray-800 flex items-center justify-center" style={{ aspectRatio: '3 / 2' }}>
                  {s.thumb
                    ? <img src={sampleUrl(s.thumb)} alt="" className="w-full h-full object-contain" draggable={false}
                        onError={e => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden'; }} />
                    : null}
                </div>
                <div className="flex flex-col gap-1 px-3 py-2.5 flex-1">
                  <span className="text-white text-sm font-semibold leading-snug">{title}</span>
                  {description && <span className="text-gray-400 text-xs leading-snug">{description}</span>}
                  <span className="mt-auto pt-1.5 text-blue-400 text-xs font-semibold">{t('samplesOpen')} ›</span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  </Modal>
);
