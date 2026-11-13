// The fake Tauri layer the app tests inject before the page loads
// (window.__TAURI_INTERNALS__), ported from session 63's mockfs.py.
//
// The app then believes it is the desktop app: Save / Open go to an
// in-memory file system, dialogs answer what the test set, the window's
// close button and the clipboard can be driven. Everything lives on
// window.__t so a test can read and steer it:
//
//   __t.fs            { path: text }   the "disk"
//   __t.log           what happened, in order: 'openDialog', 'saveDialog',
//                     'ask', 'read <path>', 'write <path>',
//                     'autosave-at-write <n>', 'destroy autosave=<n>'
//   __t.dialogs       every dialog call: { cmd, options }
//   __t.openPath      what the next Open dialog returns (null = cancelled)
//   __t.savePath      what the next Save dialog returns
//   __t.ask           'Yes' | 'No' — answer to the close question
//   __t.clipboard     text the system clipboard holds
//   __t.failWrite     a RegExp source: writes to matching paths fail
//   __t.listeners     { event: [{ id, handler }] } — real unlisten support
//   __t.emit(event)   call the app's listeners for an event (close button)
//
// The "disk" and the log survive a page reload (the crash screen's
// Restart); the autosave is seeded only on the first load.
export interface MockOptions {
  fs?: Record<string, string>;
  /** The autosave a previous run left behind (raw JSON text), or null. */
  autosave?: string | null;
  language?: 'en' | 'es' | 'hu';
  clipboard?: string;
  /** localStorage entries to set before the app starts. */
  storage?: Record<string, string>;
}

export const AUTOSAVE_KEY = 'tatting-designer-autosave';

/** The script, as text, for page.addInitScript. */
export const tauriMockScript = (o: MockOptions = {}): string => `(() => {
  const OPT = ${JSON.stringify({ fs: o.fs ?? {}, autosave: o.autosave ?? null, language: o.language ?? 'en', clipboard: o.clipboard ?? '', storage: o.storage ?? {} })};
  const first = !sessionStorage.getItem('__t_seeded');
  try {
    if (first) {
      sessionStorage.setItem('__t_seeded', '1');
      localStorage.setItem('tcad_setup_seen', '1');          // no first-run setup screen
      localStorage.setItem('tcad_language', OPT.language);
      for (const k of Object.keys(OPT.storage)) localStorage.setItem(k, OPT.storage[k]);
      if (OPT.autosave) localStorage.setItem('${AUTOSAVE_KEY}', OPT.autosave);
      else localStorage.removeItem('${AUTOSAVE_KEY}');
      sessionStorage.setItem('__t_fs', JSON.stringify(OPT.fs));
      sessionStorage.setItem('__t_log', '[]');
    }
  } catch (e) {}
  const load = (k, d) => { try { return JSON.parse(sessionStorage.getItem(k)) ?? d; } catch (e) { return d; } };
  const autosaveCount = () => { try { return JSON.parse(localStorage.getItem('${AUTOSAVE_KEY}') || '{"elements":[]}').elements.length; } catch (e) { return -1; } };
  const t = window.__t = {
    fs: load('__t_fs', {}), log: load('__t_log', []), dialogs: [], listeners: {},
    openPath: null, savePath: null, ask: 'Yes', clipboard: OPT.clipboard, failWrite: null,
    emit(event, payload = null) {
      const list = (t.listeners[event] || []).slice();
      for (const l of list) window['_cb' + l.handler]({ event, id: l.id, payload });
      return list.length;
    },
  };
  const note = (line) => { t.log.push(line); try { sessionStorage.setItem('__t_log', JSON.stringify(t.log)); } catch (e) {} };
  const keepFs = () => { try { sessionStorage.setItem('__t_fs', JSON.stringify(t.fs)); } catch (e) {} };
  let nextListener = 1;
  const removeListener = (event, id) => { t.listeners[event] = (t.listeners[event] || []).filter(l => l.id !== id); };
  window.__TAURI_EVENT_PLUGIN_INTERNALS__ = { unregisterListener: removeListener };
  window.__TAURI_INTERNALS__ = {
    metadata: { currentWindow: { label: 'main' }, currentWebview: { label: 'main', windowLabel: 'main' } },
    transformCallback: (fn) => { const id = Math.floor(Math.random() * 1e9); window['_cb' + id] = fn; return id; },
    unregisterCallback: () => {},
    convertFileSrc: (p) => p,
    invoke: async (cmd, args, opts) => {
      if (cmd.startsWith('plugin:dialog|')) t.dialogs.push({ cmd, options: args && args.options });
      switch (cmd) {
        case 'plugin:dialog|open': note('openDialog'); return t.openPath || null;
        case 'plugin:dialog|save': note('saveDialog'); return t.savePath || null;
        case 'plugin:dialog|ask': case 'plugin:dialog|message': case 'plugin:dialog|confirm': note('ask'); return t.ask;
        case 'plugin:fs|write_text_file': {
          const p = decodeURIComponent((opts && opts.headers && opts.headers.path) || '');
          if (t.failWrite && new RegExp(t.failWrite, 'i').test(p)) { note('write-refused ' + p); throw 'Permission denied (os error 13)'; }
          t.fs[p] = new TextDecoder().decode(args); keepFs();
          note('write ' + p); note('autosave-at-write ' + autosaveCount());
          return null;
        }
        case 'plugin:fs|read_text_file': {
          note('read ' + args.path);
          if (!(args.path in t.fs)) throw 'No such file or directory (os error 2)';
          return Array.from(new TextEncoder().encode(t.fs[args.path]));
        }
        case 'plugin:fs|exists': return args && args.path in t.fs;
        case 'plugin:fs|write_file': case 'plugin:fs|mkdir': return null;   // thumbnails, folders
        case 'plugin:event|listen': { const id = nextListener++; (t.listeners[args.event] ||= []).push({ id, handler: args.handler }); return id; }
        case 'plugin:event|unlisten': removeListener(args.event, args.eventId); return null;
        case 'plugin:window|destroy': note('destroy autosave=' + autosaveCount()); return null;
        case 'plugin:clipboard-manager|read_text': return t.clipboard;
        case 'plugin:clipboard-manager|write_text': t.clipboard = (args && (args.text ?? '')) || ''; return null;
        case 'take_pending_files': return [];
        default: return null;
      }
    },
  };
})();`;
