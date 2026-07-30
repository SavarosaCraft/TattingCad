// utils/elementUpdates.ts
//
// Helpers for the "patch matching elements" shape of setElements(prev =>
// prev.map(...)) that appears throughout tattingindex.tsx. These are pure
// (no React deps) per the geometry/domain rule in architecture.md, even
// though they live in utils/.
//
// `updates` may be a plain object (static patch) or a function of the
// current element (for patches that depend on the element being updated,
// e.g. toggling a boolean).
//
// IMPORTANT — these helpers are for plain property patches only. Do NOT use
// them for updates that touch `notation`, `paths`, or picot/bead structure —
// those must go through computeElementAfterNotationEdit / the Picot Wizard
// notation-update options / regenerateGhostArrays as documented in
// architecture.md, or they'll silently bypass those invariants.

type Updates<T> = Partial<T> | ((el: T) => Partial<T>);

function resolve<T>(updates: Updates<T>, el: T): Partial<T> {
  return typeof updates === 'function' ? (updates as (el: T) => Partial<T>)(el) : updates;
}

/** Patch the single element matching `id`, leave everything else untouched. */
export function updateElement<T extends { id: string }>(
  prev: T[],
  id: string,
  updates: Updates<T>
): T[] {
  return prev.map(el => (el.id === id ? { ...el, ...resolve(updates, el) } : el));
}

/** Patch every element whose id is in `ids` (Set or array — either works). */
export function updateSelected<T extends { id: string }>(
  prev: T[],
  ids: Set<string> | string[],
  updates: Updates<T>
): T[] {
  const isSelected = ids instanceof Set ? (id: string) => ids.has(id) : (id: string) => ids.includes(id);
  return prev.map(el => (isSelected(el.id) ? { ...el, ...resolve(updates, el) } : el));
}

/** Patch every element matching an arbitrary predicate (e.g. selection + type). */
export function updateWhere<T>(
  prev: T[],
  predicate: (el: T) => boolean,
  updates: Updates<T>
): T[] {
  return prev.map(el => (predicate(el) ? { ...el, ...resolve(updates, el) } : el));
}
