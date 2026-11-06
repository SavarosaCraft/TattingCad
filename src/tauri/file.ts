// file.ts — Tauri file system and dialog operations
// All Tauri-specific code lives here. The rest of the app imports from this
// module and stays unaware of Tauri's existence.
//
// THUMBNAIL SYSTEM
// Thumbnails are stored as PNG files next to the project file:
//   MyPattern.tatcad (or old .json)  →  MyPattern_thumb.png
// The recent entry stores thumbPath. The dialog uses convertFileSrc(thumbPath).
// This avoids btoa issues, localStorage bloat, and lets file browsers show previews.
// Config required in tauri.conf.json:
//   "security": { "assetProtocol": { "enable": true, "scope": ["$DOCUMENT/**", "$HOME/**", ...] } }
// When ready to extract: everything from "── Thumbnail" onward is self-contained.

import { save as tauriSave, open as tauriOpen } from '@tauri-apps/plugin-dialog';
import { writeFile, readTextFile, writeTextFile, exists } from '@tauri-apps/plugin-fs';
import { convertFileSrc } from '@tauri-apps/api/core';
import { writeText, readText } from '@tauri-apps/plugin-clipboard-manager';

// - clipboard
export const writeClipboardText = (text: string): Promise<void> => writeText(text);
export const readClipboardText = (): Promise<string> => readText();


// ── Dialogs ────────────────────────────────────────────────────────────────

// Session 60: pattern files are ".tatcad" on desktop (same JSON inside —
// only the name changed, so the system can give them TattingCAD's icon and
// open them with the app). Old ".json" patterns still open and keep their
// name when saved again; Save As offers ".tatcad".
// Android saves ".tatcad" too (see showSaveDialog) and opens any file (see
// showOpenDialog) — its pickers work by MIME type, not extension.
export const PATTERN_EXT = 'tatcad';
const isAndroid = () => typeof navigator !== 'undefined' && /android/i.test(navigator.userAgent || '');
/** "MyPattern.tatcad" / "MyPattern.json" → "MyPattern" */
export const stripPatternExt = (name: string): string => name.replace(/\.(tatcad|json)$/i, '');

/**
 * Android hands files over as content:// addresses. Some carry the file
 * name (…/document/primary%3ADownload%2FSnowflake.tatcad → "Snowflake"),
 * some only an id (…/document/msf%3A1234 → ""). "" = no name in it.
 */
export const patternNameFromUri = (uri: string): string => {
  let last = uri.split('/').pop() || '';
  try { last = decodeURIComponent(last); } catch { /* keep as is */ }
  const base = last.split(/[\\/:]/).pop() || '';
  return /\.(tatcad|json)$/i.test(base) ? stripPatternExt(base) : '';
};

const isContentUri = (p: string): boolean => /^content:\/\//i.test(p || '');

/**
 * Session 61: the file's name as shown to people (Recent list, window title),
 * WITH its extension: "C:\\x\\Snow.tatcad" → "Snow.tatcad". For an Android
 * content:// address the name is decoded out of it ("…%2FSnow.tatcad" →
 * "Snow.tatcad"); "" when the address carries no name (…/msf%3A1234) — the
 * caller then uses the pattern's own name. Before, Android showed the raw
 * address piece ("raw%3A%2Fstorage%2F…").
 */
export const fileBaseName = (path: string): string => {
  if (!path) return '';
  if (isContentUri(path)) {
    const name = patternNameFromUri(path);
    if (!name) return '';
    let last = path.split('/').pop() || '';
    try { last = decodeURIComponent(last); } catch { /* keep as is */ }
    return last.split(/[\\/:]/).pop() || '';
  }
  return path.split(/[\\/]/).pop() || '';
};

/** Name without extension, or `fallback` when the path gives none. */
export const fileDisplayName = (path: string, fallback: string): string =>
  stripPatternExt(fileBaseName(path)) || fallback;

export const showSaveDialog = async (defaultName: string): Promise<string | null> => {
  // Android (session 60, 1.4): .tatcad too. Its save dialog needs a MIME
  // type, and Android knows none for .tatcad — "application/octet-stream"
  // (any file) makes it keep the name exactly as given instead of adding
  // or swapping an extension. (A filter value with "/" is passed to
  // Android as a MIME type by the dialog plugin.)
  const filePath = await tauriSave({
    title: 'Save Project',
    defaultPath: `${defaultName.replace(/[^a-z0-9]/gi, '_')}.${PATTERN_EXT}`,
    filters: [{ name: 'TattingCAD Pattern', extensions: [isAndroid() ? 'application/octet-stream' : PATTERN_EXT] }],
  });
  return filePath ?? null;
};

export const showOpenDialog = async (): Promise<string | null> => {
  // Android: no filter. Its picker filters by MIME type, and a .tatcad has
  // none it knows, so with the .json filter a .tatcad couldn't be picked
  // (tested on a phone). Any file can be chosen; one that isn't a pattern
  // gets the normal "couldn't open" message.
  const filePath = await tauriOpen({
    title: 'Open Project',
    ...(isAndroid() ? {} : { filters: [{ name: 'TattingCAD Pattern', extensions: [PATTERN_EXT, 'json'] }] }),
  });
  if (!filePath || typeof filePath !== 'string') return null;
  return filePath;
};

export const showSaveSvgDialog = async (defaultName: string): Promise<string | null> => {
  const filePath = await tauriSave({
    title: 'Export SVG',
    defaultPath: `${defaultName}.svg`,
    filters: [{ name: 'SVG Image', extensions: ['svg'] }],
  });
  return filePath ?? null;
};

// Session 59: Options → Indicator colours… → Save as file…
export const showSaveThemeDialog = async (): Promise<string | null> => {
  const filePath = await tauriSave({
    title: 'Save Theme',
    defaultPath: 'tatting-theme.json',
    filters: [{ name: 'TattingCAD Theme', extensions: ['json'] }],
  });
  return filePath ?? null;
};

// ── File I/O ───────────────────────────────────────────────────────────────

export const writeProjectFile = async (filePath: string, data: object): Promise<void> => {
  await writeTextFile(filePath, JSON.stringify(data, null, 2));
};

export const writeTextToFile = async (filePath: string, text: string): Promise<void> => {
  await writeTextFile(filePath, text);
};

export const readProjectFile = async (filePath: string): Promise<any> => {
  const text = await readTextFile(filePath);
  return JSON.parse(text);
};

// Checks whether a file still exists on disk. Used by the Recent Projects
// dialog to flag entries whose project file has been moved or deleted,
// before the user clicks Load and hits a "file not found" error — mirrors
// the existing thumbnail <img onError> fallback, but for the project file
// itself rather than just its preview image. Returns false on any error
// (permission issues, malformed path, etc.) rather than throwing, since a
// failed existence check should be treated the same as "can't confirm this
// file is there" for UI purposes.
export const checkFileExists = async (filePath: string): Promise<boolean> => {
  if (!filePath) return false;
  // Session 61 — Android: a saved file is a content:// address, which the
  // file system's exists() doesn't understand (it always said "missing", so
  // Recent showed every Android entry as File missing with Load greyed).
  // Reading it is the real test: it fails if the file is gone OR the app
  // may no longer open it. Patterns are small; the list holds at most 20.
  if (isContentUri(filePath)) {
    try { await readTextFile(filePath); return true; } catch { return false; }
  }
  try {
    return await exists(filePath);
  } catch (err) {
    console.warn('[checkFileExists] failed for', filePath, err);
    return false;
  }
};

// ── Recent projects (localStorage) ────────────────────────────────────────

export interface RecentEntry {
  id: string;
  name: string;
  filename: string;    // absolute path to the .json file
  thumbPath: string;   // absolute path to the _thumb.png file ('' if none)
  savedAt: string;
}

// Normalize path separators — cleans double-escaped backslashes that can appear
// when old entries were written by JSON.stringify and re-read inconsistently.
const normalizePath = (p: string): string => p ? p.replace(/\\\\/g, '\\') : '';

// Derive the thumbnail path from the project path.
// MyPattern.tatcad / MyPattern.json → MyPattern_thumb.png (same directory)
export const thumbPathFor = (projectPath: string): string => {
  if (!projectPath) return '';
  return normalizePath(projectPath).replace(/\.(tatcad|json)$/i, '_thumb.png');
};

// Convert a thumbnail file path to an asset:// URL for use in <img src>.
// convertFileSrc requires forward slashes on Windows.
export const thumbSrcFor = (thumbPath: string): string => {
  if (!thumbPath) return '';
  // Session 61: on Android the thumbnail is kept as a small PNG data URL in
  // the Recent entry itself (see generateThumbnailPng) — use it as it is.
  if (/^data:image\/png;base64,/i.test(thumbPath)) return thumbPath;
  try {
    return convertFileSrc(normalizePath(thumbPath).replace(/\\/g, '/'));
  } catch { return ''; }
};

// Normalise a raw localStorage entry — migrates legacy fields and cleans paths.
const normaliseEntry = (e: any): RecentEntry => {
  const filename = normalizePath(e.filename ?? e.path ?? e.filePath ?? e.file ?? '');
  const name = filename
    ? fileDisplayName(filename, e.name || 'Untitled')
    : (e.name ?? 'Untitled');
  return {
    id:        e.id        ?? Date.now().toString(),
    name,
    filename,
    thumbPath: normalizePath(e.thumbPath ?? thumbPathFor(filename)),
    savedAt:   e.savedAt   ?? new Date().toISOString(),
  };
};

export const addToRecents = (name: string, filename: string, thumbPath: string): void => {
  try {
    const cleanFilename  = normalizePath(filename);
    const cleanThumbPath = normalizePath(thumbPath);
    const raw = localStorage.getItem('tcad_recent_projects');
    const list: any[] = raw ? JSON.parse(raw) : [];
    const filtered = list.filter(e =>
      normalizePath(e.filename ?? e.path ?? e.filePath ?? e.file ?? '') !== cleanFilename
    );
    const entry: RecentEntry = {
      id: Date.now().toString(), name,
      filename: cleanFilename, thumbPath: cleanThumbPath,
      savedAt: new Date().toISOString(),
    };
    try {
      localStorage.setItem('tcad_recent_projects', JSON.stringify([entry, ...filtered].slice(0, 20)));
    } catch {
      // Session 61: storage full (Android keeps thumbnails in the list) —
      // keep the entry, drop the thumbnails rather than lose the Recent list.
      const lean = [entry, ...filtered].slice(0, 20).map(e =>
        /^data:/i.test(e.thumbPath ?? '') ? { ...e, thumbPath: '' } : e);
      localStorage.setItem('tcad_recent_projects', JSON.stringify(lean));
    }
  } catch (_) {}
};

export const getRecents = (): RecentEntry[] => {
  try {
    const raw = localStorage.getItem('tcad_recent_projects');
    if (!raw) return [];
    const normalised = (JSON.parse(raw) as any[]).map(normaliseEntry);
    localStorage.setItem('tcad_recent_projects', JSON.stringify(normalised));
    return normalised;
  } catch { return []; }
};

// ── Thumbnail — PNG file ───────────────────────────────────────────────────
// Renders pattern elements to an offscreen canvas and writes a PNG file next
// to the project. Returns the absolute thumb path on success, '' on failure.

const THUMB_W = 300;
const THUMB_H = 200;
const THUMB_PAD = 16;

export const generateThumbnailPng = async (
  els: any[],
  dsWidth: number,
  projectPath: string
): Promise<string> => {
  console.log('[thumbnail] called, els:', els?.length, 'path:', projectPath);
  if (!els?.length || !projectPath) {
    console.warn('[thumbnail] skipped — no elements or no path');
    return '';
  }

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const expand = (x: number, y: number) => {
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
  };

  for (const el of els) {
    if (el.type === 'ghost' && !el.isBoundary) continue;
    if (el.isClosed && el.shapeStyle === 'circle') {
      const r = (el.stitchCount * dsWidth) / (2 * Math.PI);
      expand(el.center.x - r, el.center.y - r);
      expand(el.center.x + r, el.center.y + r);
    } else if (el.paths?.length) {
      for (const p of el.paths) {
        expand(p.x, p.y); expand(p.endX, p.endY);
        if (p.type === 'cubic') { expand(p.control1X, p.control1Y); expand(p.control2X, p.control2Y); }
        else { expand(p.controlX ?? p.x, p.controlY ?? p.y); }
      }
    }
  }

  if (!isFinite(minX)) return '';

  const srcW  = maxX - minX + THUMB_PAD * 2;
  const srcH  = maxY - minY + THUMB_PAD * 2;
  const scale = Math.min(THUMB_W / srcW, THUMB_H / srcH);
  const offX  = (THUMB_W - srcW * scale) / 2 - (minX - THUMB_PAD) * scale;
  const offY  = (THUMB_H - srcH * scale) / 2 - (minY - THUMB_PAD) * scale;
  const tx = (x: number) => x * scale + offX;
  const ty = (y: number) => y * scale + offY;

  const canvas = document.createElement('canvas');
  canvas.width = THUMB_W; canvas.height = THUMB_H;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    console.warn('[thumbnail] canvas 2d context unavailable');
    return '';
  }
  console.log('[thumbnail] rendering for:', projectPath);
  ctx.fillStyle = '#1f2937';
  ctx.fillRect(0, 0, THUMB_W, THUMB_H);
  ctx.lineWidth = 1.5;

  for (const el of els) {
    if (el.type === 'ghost' && !el.isBoundary) continue;
    ctx.strokeStyle = el.type === 'ring' ? '#a78bfa' : '#34d399';

    if (el.isClosed && el.shapeStyle === 'circle') {
      const r = (el.stitchCount * dsWidth) / (2 * Math.PI) * scale;
      ctx.beginPath();
      ctx.arc(tx(el.center.x), ty(el.center.y), r, 0, Math.PI * 2);
      ctx.stroke();
      continue;
    }
    if (!el.paths?.length) continue;
    for (const p of el.paths) {
      ctx.beginPath();
      ctx.moveTo(tx(p.x), ty(p.y));
      if (p.type === 'cubic') {
        ctx.bezierCurveTo(tx(p.control1X), ty(p.control1Y), tx(p.control2X), ty(p.control2Y), tx(p.endX), ty(p.endY));
      } else {
        ctx.quadraticCurveTo(tx(p.controlX ?? p.x), ty(p.controlY ?? p.y), tx(p.endX), ty(p.endY));
      }
      ctx.stroke();
    }
  }

  // Session 61 — Android: Save gives a content:// address, not a path. A
  // "_thumb.png" next to it can't be created (Android doesn't allow writing
  // a new file at a made-up address), so thumbnails never appeared there.
  // Keep the picture in the Recent entry instead, as a data URL (~10–30 KB;
  // the Recent list holds at most 20). The page's policy allows data: images.
  if (isAndroid() || /^content:\/\//i.test(projectPath)) {
    try { return canvas.toDataURL('image/png'); } catch { return ''; }
  }

  // Never write over the pattern itself: a path without a .tatcad / .json
  // ending would give a "thumbnail path" equal to the pattern's own path.
  const thumbTarget = thumbPathFor(projectPath);
  if (!/_thumb\.png$/i.test(thumbTarget) || thumbTarget === normalizePath(projectPath)) {
    console.warn('[thumbnail] skipped — no thumbnail name for', projectPath);
    return '';
  }

  return new Promise<string>(resolve => {
    canvas.toBlob(async blob => {
      if (!blob) {
        console.warn('[thumbnail] canvas.toBlob returned null - canvas may be tainted or empty');
        resolve(''); return;
      }
      console.log('[thumbnail] blob size:', blob.size, 'writing to:', thumbPathFor(projectPath));
      try {
        const thumbPath = thumbPathFor(projectPath);
        await writeFile(thumbPath, new Uint8Array(await blob.arrayBuffer()));
        console.log('[thumbnail] written OK:', thumbPath);
        resolve(thumbPath);
      } catch (err) {
        console.warn('[thumbnail] failed to write:', err);
        resolve('');
      }
    }, 'image/png');
  });
};
