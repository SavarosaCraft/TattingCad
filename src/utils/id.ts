// id.ts — Collision-safe ID generation
// Always use crypto.randomUUID(). Never use Date.now() or Math.random().

export const generateId = (): string => crypto.randomUUID();
