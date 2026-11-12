// refImage.ts — keeps the reference image small enough for the autosave.
//
// Session 62 (review M6). The reference image is kept as a data URL inside
// the project, so it goes into every autosave — and localStorage holds only
// about 5 MB in all. A 10 MB photo (the upload limit) is ~13 MB as text, so
// the autosave silently stopped working. Nobody needs that much to trace
// over: the image is drawn into a 1000 × 1000 box on the canvas, so 2048 px
// on the longest side is plenty. The box doesn't depend on the image's
// pixel size, so shrinking never moves or resizes it on the canvas.
//
// Opaque images become JPEG; an image with any transparency stays PNG (a
// JPEG would turn the transparent parts black). If the result is still over
// the budget, quality and then size step down until it fits.

export const REF_IMAGE_MAX_SIDE = 2048;
// Data-URL characters (~1.1 MB of image) — leaves room in the ~5 MB
// localStorage for the pattern itself, the Recent list and the rest.
export const REF_IMAGE_BUDGET = 1_500_000;

export interface ShrinkResult {
  src: string;
  changed: boolean;
  width: number;   // pixel size of the image as returned
  height: number;
}

const loadImage = (src: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('image did not load'));
    img.src = src;
  });

/**
 * Returns the image reduced to fit REF_IMAGE_MAX_SIDE and REF_IMAGE_BUDGET,
 * or the same src (changed: false) when it already fits or can't be read.
 */
export async function shrinkReferenceImage(src: string | null | undefined): Promise<ShrinkResult> {
  const unchanged = (w = 0, h = 0): ShrinkResult => ({ src: src || '', changed: false, width: w, height: h });
  if (!src || !/^data:image\//i.test(src)) return unchanged();
  let img: HTMLImageElement;
  try { img = await loadImage(src); } catch { return unchanged(); }
  const w0 = img.naturalWidth, h0 = img.naturalHeight;
  if (!w0 || !h0) return unchanged();
  if (Math.max(w0, h0) <= REF_IMAGE_MAX_SIDE && src.length <= REF_IMAGE_BUDGET) return unchanged(w0, h0);

  const draw = (side: number) => {
    const k = Math.min(1, side / Math.max(w0, h0));
    const w = Math.max(1, Math.round(w0 * k)), h = Math.max(1, Math.round(h0 * k));
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, w, h);
    return { canvas, ctx, w, h };
  };

  // Transparency check on the first (largest) drawing.
  const first = draw(REF_IMAGE_MAX_SIDE);
  if (!first) return unchanged(w0, h0);
  let hasAlpha = false;
  try {
    const data = first.ctx.getImageData(0, 0, first.w, first.h).data;
    for (let i = 3; i < data.length; i += 4) if (data[i] < 255) { hasAlpha = true; break; }
  } catch { /* can't read pixels — treat as opaque */ }

  let best: ShrinkResult | null = null;
  for (const side of [REF_IMAGE_MAX_SIDE, 1600, 1280, 1024]) {
    const d = side === REF_IMAGE_MAX_SIDE ? first : draw(side);
    if (!d) break;
    for (const q of hasAlpha ? [1] : [0.85, 0.75]) {
      const out = hasAlpha ? d.canvas.toDataURL('image/png') : d.canvas.toDataURL('image/jpeg', q);
      if (!best || out.length < best.src.length) best = { src: out, changed: true, width: d.w, height: d.h };
      if (out.length <= REF_IMAGE_BUDGET) return pickSmaller(best, src, w0, h0);
    }
  }
  return best ? pickSmaller(best, src, w0, h0) : unchanged(w0, h0);
}

// Never hand back something bigger than what came in at the same pixel size
// (an image that was only too heavy, not too big, and doesn't compress).
function pickSmaller(r: ShrinkResult, src: string, w0: number, h0: number): ShrinkResult {
  if (r.width === w0 && r.height === h0 && r.src.length >= src.length) {
    return { src, changed: false, width: w0, height: h0 };
  }
  return r;
}
