import React from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { listen } from '@tauri-apps/api/event';
import { getEmergencyHooks } from '../utils/emergencySave';
import { showSaveDialog, writeProjectFile } from '../tauri/file';

// ── Crash screen (session 63, code review #6) ───────────────────────────────
// Wraps the whole app (main.tsx). Before, an error while drawing unmounted
// everything: a blank window, and — because the app's own close listener
// went with it while src-tauri/lib.rs still blocks the close and asks the
// page — the X button did nothing.
// Now this screen shows instead, with:
//   Save a copy… — the last state that was drawn successfully
//                  (utils/emergencySave.ts) to a file the user picks;
//   Restart      — writes the autosave first, then reloads: the start
//                  screen offers "Resume";
//   Close        — closes the window (desktop app).
// It also takes over the close-requested event, so X closes again.
// Texts are built in (en / es / hu, chosen like the app: tcad_language):
// the app's own translations may be what broke.

const TEXTS: Record<string, Record<string, string>> = {
  en: {
    title: 'TattingCAD ran into a problem',
    body: 'Something went wrong while drawing the pattern. Your work up to just before the problem can still be saved.',
    saveCopy: 'Save a copy…', restart: 'Restart', close: 'Close',
    saved: 'Saved.', saveFailed: 'Could not save the copy.',
    restartHint: 'Restart keeps your work: choose “Resume” on the start screen.',
    details: 'Details',
  },
  es: {
    title: 'TattingCAD ha encontrado un problema',
    body: 'Algo ha fallado al dibujar el patrón. Todavía puedes guardar tu trabajo hasta justo antes del problema.',
    saveCopy: 'Guardar una copia…', restart: 'Reiniciar', close: 'Cerrar',
    saved: 'Guardado.', saveFailed: 'No se ha podido guardar la copia.',
    restartHint: 'Reiniciar conserva tu trabajo: elige «Continuar» en la pantalla de inicio.',
    details: 'Detalles',
  },
  hu: {
    title: 'A TattingCAD hibába ütközött',
    body: 'Hiba történt a minta rajzolása közben. A közvetlenül a hiba előtti munkáját még elmentheti.',
    saveCopy: 'Másolat mentése…', restart: 'Újraindítás', close: 'Bezárás',
    saved: 'Mentve.', saveFailed: 'A másolatot nem sikerült menteni.',
    restartHint: 'Az újraindítás megtartja a munkáját: a kezdőképernyőn válassza a „Folytatás” lehetőséget.',
    details: 'Részletek',
  },
};

const pickTexts = () => {
  let lang = 'en';
  try { lang = localStorage.getItem('tcad_language') || 'en'; } catch { /* storage blocked */ }
  return TEXTS[lang] || TEXTS.en;
};

const isTauri = () => !!(window as any).__TAURI_INTERNALS__;

interface Props { children: React.ReactNode; }
interface State { error: Error | null; status: string | null; }

export class AppErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null, status: null };
  private unlistenClose: (() => void) | null = null;

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error('[AppErrorBoundary] caught:', error, '\nComponent stack:', info.componentStack);
    // X closes again: the app's own close listener is gone with the app.
    if (isTauri() && !this.unlistenClose) {
      listen('close-requested', () => { getCurrentWindow().destroy(); })
        .then(fn => { this.unlistenClose = fn; })
        .catch(() => { /* not in the desktop app */ });
    }
  }

  componentWillUnmount() { this.unlistenClose?.(); }

  private saveCopy = async () => {
    const tx = pickTexts();
    try {
      const data = getEmergencyHooks()?.snapshot();
      if (!data) throw new Error('nothing to save');
      const base = String(data.name || 'Pattern').trim() || 'Pattern';
      const filePath = await showSaveDialog(`${base} (recovered)`, { title: tx.saveCopy.replace(/…$/, "") });
      if (!filePath) return;
      // A plain pattern file: without the autosave's Resume fields.
      const { _resumeFilePath, _resumeUnsaved, _resumeFileHash, autoSaved, ...fileData } = data;
      await writeProjectFile(filePath, { ...fileData, created: new Date().toISOString() });
      this.setState({ status: tx.saved });
    } catch (err) {
      console.error('[AppErrorBoundary] save a copy failed:', err);
      this.setState({ status: tx.saveFailed });
    }
  };

  private restart = () => {
    try { getEmergencyHooks()?.autosave(); } catch (err) { console.error('[AppErrorBoundary] autosave failed:', err); }
    window.location.reload();
  };

  private close = () => {
    if (isTauri()) getCurrentWindow().destroy();
    else window.close();
  };

  render() {
    if (!this.state.error) return this.props.children;
    const tx = pickTexts();
    const btn = 'px-4 py-2 rounded text-sm font-semibold text-white';
    return (
      <div role="alertdialog" aria-labelledby="crash-title"
        className="fixed inset-0 flex items-center justify-center bg-gray-900 p-4">
        <div className="w-full max-w-md rounded-lg bg-gray-800 border border-gray-600 p-6 flex flex-col gap-4">
          <h1 id="crash-title" className="text-lg font-bold text-white">{tx.title}</h1>
          <p className="text-sm text-gray-200">{tx.body}</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={this.saveCopy} className={`${btn} bg-blue-600 hover:bg-blue-500`}>{tx.saveCopy}</button>
            <button type="button" onClick={this.restart} className={`${btn} bg-gray-600 hover:bg-gray-500`}>{tx.restart}</button>
            {isTauri() && (
              <button type="button" onClick={this.close} className={`${btn} bg-gray-600 hover:bg-gray-500`}>{tx.close}</button>
            )}
          </div>
          <p className="text-xs text-gray-400">{tx.restartHint}</p>
          {this.state.status && <p className="text-sm text-amber-300" role="status">{this.state.status}</p>}
          <details className="text-xs text-gray-400">
            <summary className="cursor-pointer">{tx.details}</summary>
            <pre className="mt-2 whitespace-pre-wrap break-words">{String(this.state.error?.message || this.state.error)}</pre>
          </details>
        </div>
      </div>
    );
  }
}
