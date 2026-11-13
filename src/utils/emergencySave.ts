// utils/emergencySave.ts
//
// Session 63 — code review #6 (a crash left a blank window that X wouldn't
// close). The crash screen (components/AppErrorBoundary.tsx) sits OUTSIDE
// the app, so it can't read the app's state. The app registers two
// functions here (tattingindex.tsx, the autosave effect) and leaves them
// registered when it goes away:
//   snapshot()  → the pattern as an autosave payload (the same data a save
//                 writes, plus the Resume fields), built from the app's refs
//                 — they hold the last state that was drawn successfully;
//   autosave()  → write that to the autosave now (same rules as the timer:
//                 retries without the reference image when storage is full).
// Both may throw; the crash screen catches.

type EmergencyHooks = {
  snapshot: () => any;
  autosave: () => void;
};

let hooks: EmergencyHooks | null = null;

export const registerEmergencyHooks = (h: EmergencyHooks): void => { hooks = h; };
export const getEmergencyHooks = (): EmergencyHooks | null => hooks;
