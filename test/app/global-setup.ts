// Starts ONE Vite dev server for the whole app-test run, inside this
// process (no child process to leave behind), on a free port chosen by the
// system. Its address goes to the tests through TCAD_TEST_URL.
import { createServer, type ViteDevServer } from 'vite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

export default async function globalSetup() {
  // The app reads its language list from public/ (the help pages, samples
  // and colour catalogues live there too). Without it the language tests
  // would only time out, so say it plainly.
  if (!fs.existsSync(path.join(root, 'public', 'languages.json')))
    throw new Error(`The app tests need the project's public/ folder (public/languages.json was not found in ${root}).`);

  const server: ViteDevServer = await createServer({
    root,
    configFile: path.join(root, 'vite.config.ts'),
    logLevel: 'error',
    clearScreen: false,
    server: {
      port: 0,              // any free port
      strictPort: false,
      open: false,          // the project's config opens a browser tab; not here
      hmr: false,           // no live reload in the middle of a test
      watch: null,          // the files don't change during a run
      host: '127.0.0.1',
    },
  });
  await server.listen();
  const address = server.httpServer?.address();
  if (!address || typeof address === 'string') throw new Error('Vite did not report a port');
  process.env.TCAD_TEST_URL = `http://127.0.0.1:${address.port}/`;

  // Let Vite compile the app once before the first test asks for it, so the
  // first test isn't the slow one.
  try { await server.warmupRequest('/src/main.tsx'); } catch { /* the first test will do it */ }

  return async () => { await server.close(); };
}
