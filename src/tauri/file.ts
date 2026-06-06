// file.ts — Tauri file system and dialog operations
// All Tauri-specific code lives here. The rest of the app imports from this
// module and stays unaware of Tauri's existence.
//
// THUMBNAIL SYSTEM
// Thumbnails are stored as PNG files next to the project file:
//   MyPattern.json  →  MyPattern_thumb.png
// The recent entry stores thumbPath. The dialog uses convertFileSrc(thumbPath).
// This avoids btoa issues, localStorage bloat, and lets file browsers show previews.
// Config required in tauri.conf.json:
//   "security": { "assetProtocol": { "enable": true, "scope": ["$DOCUMENT/**", "$HOME/**", ...] } }
// When ready to extract: everything from "── Thumbnail" onward is self-contained.

import { save as tauriSave, open as tauriOpen } from '@tauri-apps/plugin-dialog';
import { writeFile, readTextFile, writeTextFile } from '@tauri-apps/plugin-fs';
import { convertFileSrc } from '@tauri-apps/api/core';
import { writeText, readText } from '@tauri-apps/plugin-clipboard-manager';

// - clipboard
export const writeClipboardText = (text: string): Promise<void> => writeText(text);
export const readClipboardText = (): Promise<string> => readText();


// ── Dialogs ────────────────────────────────────────────────────────────────

export const showSaveDialog = async (defaultName: string): Promise<string | null> => {
  const filePath = await tauriSave({
    title: 'Save Project',
    defaultPath: `${defaultName.replace(/[^a-z0-9]/gi, '_')}.json`,
    filters: [{ name: 'TattingCAD Project', extensions: ['json'] }],
  });
  return filePath ?? null;
};

export const showOpenDialog = async (): Promise<string | null> => {
  const filePath = await tauriOpen({
    title: 'Open Project',
    filters: [{ name: 'TattingCAD Project', extensions: ['json'] }],
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
// MyPattern.json → MyPattern_thumb.png (same directory)
export const thumbPathFor = (projectPath: string): string => {
  if (!projectPath) return '';
  return normalizePath(projectPath).replace(/\.json$/i, '_thumb.png');
};

// Convert a thumbnail file path to an asset:// URL for use in <img src>.
// convertFileSrc requires forward slashes on Windows.
export const thumbSrcFor = (thumbPath: string): string => {
  if (!thumbPath) return '';
  try {
    return convertFileSrc(normalizePath(thumbPath).replace(/\\/g, '/'));
  } catch { return ''; }
};

// Normalise a raw localStorage entry — migrates legacy fields and cleans paths.
const normaliseEntry = (e: any): RecentEntry => {
  const filename = normalizePath(e.filename ?? e.path ?? e.filePath ?? e.file ?? '');
  const name = filename
    ? (filename.split(/[\\/]/).pop()?.replace(/\.json$/i, '') ?? e.name ?? 'Untitled')
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
    localStorage.setItem('tcad_recent_projects', JSON.stringify([entry, ...filtered].slice(0, 20)));
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
