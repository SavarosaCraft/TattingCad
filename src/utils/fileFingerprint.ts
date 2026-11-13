// utils/fileFingerprint.ts
//
// Session 63 — code review #4 ("Resume can write older work over a newer
// saved file"). A short fingerprint of a pattern file's text, taken when the
// app opens or saves that file and kept in the autosave
// (`_resumeFileHash`). After Resume, the first Save to the file reads it
// again: a different fingerprint means the file changed after this work was
// autosaved (a later Save that the autosave missed, another computer, a
// synced folder, another program) — and the user is asked before it is
// overwritten (useProjectFile.saveProject).
//
// Not security: a fast 53-bit hash (cyrb53) plus the text's length, only to
// tell "the same text" from "different text".

export const fingerprintText = (text: string): string => {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < text.length; i++) {
    const ch = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  const hash = 4294967296 * (2097151 & h2) + (h1 >>> 0);
  return `${text.length}:${hash.toString(36)}`;
};
