// Frozen baselines, shared by the unit and the app tests.
//
// A baseline is a text file under a `baselines/` folder holding what the
// code produced when the baseline was made. A test fails when the code now
// produces something else — which is exactly what a refactor must not do.
//
//   - missing baseline            → written, and the test passes (first run)
//   - UPDATE_BASELINES=1          → rewritten (npm run test:update) — only
//                                   when the change is meant; review the diff
//   - line endings                → compared as LF, so a Windows checkout
//                                   (CRLF) doesn't fail
import fs from 'node:fs';
import path from 'node:path';

const lf = (text: string) => text.replace(/\r\n/g, '\n');

export interface BaselineResult { ok: boolean; created: boolean; message: string; }

export const checkBaseline = (file: string, actualText: string): BaselineResult => {
  const actual = lf(actualText);
  const update = process.env.UPDATE_BASELINES === '1';
  if (!fs.existsSync(file) || update) {
    const had = fs.existsSync(file) ? lf(fs.readFileSync(file, 'utf8')) : null;
    if (had !== actual) {
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, actual);
    }
    return { ok: true, created: had === null, message: had === null ? `baseline written: ${file}` : `baseline updated: ${file}` };
  }
  const expected = lf(fs.readFileSync(file, 'utf8'));
  if (expected === actual) return { ok: true, created: false, message: '' };
  // Say where they first differ — a full diff of a 100 kB SVG helps nobody.
  const a = expected.split('\n'), b = actual.split('\n');
  let i = 0; while (i < a.length && i < b.length && a[i] === b[i]) i++;
  const clip = (s: string | undefined) => s === undefined ? '(no such line)' : s.length > 300 ? s.slice(0, 300) + '…' : s;
  return {
    ok: false, created: false,
    message: `differs from baseline ${path.basename(file)} at line ${i + 1} (baseline ${a.length} lines, now ${b.length}):\n`
      + `  baseline: ${clip(a[i])}\n  now:      ${clip(b[i])}\n`
      + `If the change is meant: npm run test:update, then look at the diff of the baseline file.`,
  };
};
