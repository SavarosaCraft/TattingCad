// file.ts — Tauri file system and dialog operations
// All Tauri-specific code lives here. The rest of the app imports from this
// module and stays unaware of Tauri's existence.

import { save as tauriSave, open as tauriOpen } from '@tauri-apps/plugin-dialog';
import { writeTextFile, readTextFile } from '@tauri-apps/plugin-fs';

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
  filename: string;
  thumbnail: string;
  savedAt: string;
}

export const addToRecents = (name: string, filename: string, thumbnail: string): void => {
  try {
    const raw = localStorage.getItem('tcad_recent_projects');
    const list: RecentEntry[] = raw ? JSON.parse(raw) : [];
    const filtered = list.filter(e => e.filename !== filename);
    const entry: RecentEntry = {
      id: Date.now().toString(),
      name,
      filename,
      thumbnail,
      savedAt: new Date().toISOString(),
    };
    localStorage.setItem('tcad_recent_projects', JSON.stringify([entry, ...filtered].slice(0, 20)));
  } catch (_) {}
};

export const getRecents = (): RecentEntry[] => {
  try {
    const raw = localStorage.getItem('tcad_recent_projects');
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
};

// ── Thumbnail generator ────────────────────────────────────────────────────
// Pure function — dsWidth passed explicitly, no state dependency

export const generateThumbnail = (els: any[], dsWidth: number): string => {
  if (!els || els.length === 0) return '';
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const expand = (x: number, y: number) => {
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
  };
  els.forEach(el => {
    if (el.isClosed && el.shapeStyle === 'circle') {
      const r = (el.stitchCount * dsWidth) / (2 * Math.PI);
      expand(el.center.x - r, el.center.y - r);
      expand(el.center.x + r, el.center.y + r);
    } else if (el.paths?.length > 0) {
      el.paths.forEach(p => {
        expand(p.x, p.y); expand(p.endX, p.endY);
        if (p.type === 'cubic') { expand(p.control1X, p.control1Y); expand(p.control2X, p.control2Y); }
        else { expand(p.controlX, p.controlY); }
      });
    }
  });
  if (!isFinite(minX)) return '';
  const pad = 16, W = 300, H = 200;
  const srcW = maxX - minX + pad * 2, srcH = maxY - minY + pad * 2;
  const scale = Math.min(W / srcW, H / srcH);
  const offX = (W - srcW * scale) / 2 - (minX - pad) * scale;
  const offY = (H - srcH * scale) / 2 - (minY - pad) * scale;
  const tx = (x: number) => (x * scale + offX).toFixed(1);
  const ty = (y: number) => (y * scale + offY).toFixed(1);
  const paths = els.map(el => {
    if (el.isClosed && el.shapeStyle === 'circle') {
      const r = ((el.stitchCount * dsWidth) / (2 * Math.PI) * scale).toFixed(1);
      return `<circle cx="${tx(el.center.x)}" cy="${ty(el.center.y)}" r="${r}" fill="none" stroke="#a78bfa" stroke-width="1.5"/>`;
    }
    if (!el.paths?.length) return '';
    const d = el.paths.map(p =>
      p.type === 'cubic'
        ? `M${tx(p.x)},${ty(p.y)} C${tx(p.control1X)},${ty(p.control1Y)} ${tx(p.control2X)},${ty(p.control2Y)} ${tx(p.endX)},${ty(p.endY)}`
        : `M${tx(p.x)},${ty(p.y)} Q${tx(p.controlX)},${ty(p.controlY)} ${tx(p.endX)},${ty(p.endY)}`
    ).join(' ');
    const stroke = el.type === 'ring' ? '#a78bfa' : '#34d399';
    return `<path d="${d}" fill="none" stroke="${stroke}" stroke-width="1.5"/>`;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><rect width="${W}" height="${H}" fill="#1f2937"/>${paths}</svg>`;
};
