// npm run test:update — rewrites the frozen baselines (unit + app) from what
// the code produces NOW. Only for a change that is meant: read the diff of
// the baseline files afterwards. Works the same on Windows, macOS and Linux
// (an inline VAR=1 in package.json would not).
import { spawnSync } from 'node:child_process';
const env = { ...process.env, UPDATE_BASELINES: '1' };
const run = (cmd) => spawnSync(cmd, { stdio: 'inherit', shell: true, env }).status ?? 1;
const unit = run('npx vitest run');
const app = run('npx playwright test test/app/baselines');
process.exit(unit || app);
