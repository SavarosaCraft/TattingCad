// utils/uiZoom.ts
//
// Session 60. Large size scales dialogs, menus, toasts and canvas pop-ups
// with CSS `zoom` (index.css: .tcad-dialog / .tcad-zoom). The factor is the
// CSS variable --tcad-zoom on <html> — set only while html.tcad-ui-large is
// on AND the window is big enough (1.12 / 1.2); unset = 1. Code that places
// a zoomed box by measured pixels reads it here.
export const getUiZoom = (): number => {
  try {
    const v = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--tcad-zoom'));
    return v > 0 ? v : 1;
  } catch { return 1; }
};
