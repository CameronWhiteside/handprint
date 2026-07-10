// Zero-dependency terminal styling. Colors are stripped when NO_COLOR is set or
// nothing is a TTY (pipes, CI, agents), so logs stay clean everywhere.

const enabled = !process.env.NO_COLOR && (process.stdout.isTTY === true || process.stderr.isTTY === true);

const wrap =
  (open: number, close: number) =>
  (s: string): string =>
    enabled ? `\x1b[${open}m${s}\x1b[${close}m` : s;

export const bold = wrap(1, 22);
export const dim = wrap(2, 22);
export const italic = wrap(3, 23);
export const amber = wrap(33, 39); // brand accent
export const green = wrap(32, 39);
export const red = wrap(31, 39);
const blue = wrap(34, 39);

/** vision / choice / method get their own hue, matching the web treemap. */
export function markColor(type: string): (s: string) => string {
  if (type === 'vision') return blue;
  if (type === 'choice') return red; // orange-red
  if (type === 'method') return green; // green-yellow
  return dim;
}

export const sym = {
  hand: '✋',
  check: '✓',
  cross: '✗',
  dot: '·',
  arrow: '→',
  bullet: '•',
};

/** A unicode progress bar, e.g. bar(0.4) -> "█████████░░░░░░░░░░░░░". */
export function bar(fraction: number, width = 20): string {
  const f = Number.isFinite(fraction) ? Math.max(0, Math.min(1, fraction)) : 0;
  const filled = Math.round(f * width);
  return '█'.repeat(filled) + '░'.repeat(width - filled);
}
