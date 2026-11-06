// utils/calcExpr.ts
//
// Session 60 — security hardening (Content Security Policy). The number
// boxes accept small sums ("45*2", "x+10", "(3+4)/2"). They used to be
// worked out with `new Function(...)`, which a strict Content Security
// Policy forbids (it counts as eval). This is a tiny calculator instead:
// numbers, + - * /, brackets, and a sign in front of a number or bracket.
// Nothing else is understood, so nothing else can run.

/** Work out a sum like "3 + 4*(2-1)". Returns null if it isn't one. */
export const evalArithmetic = (input: string): number | null => {
  const s = input.replace(/\s+/g, '');
  if (!s || s.length > 200) return null;
  let i = 0;

  const number = (): number | null => {
    const m = /^(?:\d+\.?\d*|\.\d+)/.exec(s.slice(i));
    if (!m) return null;
    i += m[0].length;
    return parseFloat(m[0]);
  };
  // factor := ('+'|'-') factor | number | '(' sum ')'
  const factor = (depth: number): number | null => {
    if (depth > 50) return null;
    const c = s[i];
    if (c === '+' || c === '-') {
      i++;
      const v = factor(depth + 1);
      return v === null ? null : (c === '-' ? -v : v);
    }
    if (c === '(') {
      i++;
      const v = sum(depth + 1);
      if (v === null || s[i] !== ')') return null;
      i++;
      return v;
    }
    return number();
  };
  // term := factor (('*'|'/') factor)*
  const term = (depth: number): number | null => {
    let v = factor(depth);
    while (v !== null && (s[i] === '*' || s[i] === '/')) {
      const op = s[i++];
      const r = factor(depth);
      if (r === null) return null;
      v = op === '*' ? v * r : v / r;
    }
    return v;
  };
  // sum := term (('+'|'-') term)*
  const sum = (depth: number): number | null => {
    let v = term(depth);
    while (v !== null && (s[i] === '+' || s[i] === '-')) {
      const op = s[i++];
      const r = term(depth);
      if (r === null) return null;
      v = op === '+' ? v + r : v - r;
    }
    return v;
  };

  const result = sum(0);
  if (result === null || i !== s.length || !isFinite(result)) return null;
  return result;
};
