/**
 * A 5-row, variable-width bitmap face whose "pixels" are grid cells.
 *
 * Every glyph is drawn out of ordinary characters, so the display type on the
 * page is literally the same material as the body text — one grid, one
 * alphabet, two scales.
 */

const G: Record<string, string[]> = {
  A: [' ### ', '#   #', '#####', '#   #', '#   #'],
  B: ['#### ', '#   #', '#### ', '#   #', '#### '],
  C: [' ####', '#    ', '#    ', '#    ', ' ####'],
  D: ['#### ', '#   #', '#   #', '#   #', '#### '],
  E: ['#####', '#    ', '#### ', '#    ', '#####'],
  F: ['#####', '#    ', '#### ', '#    ', '#    '],
  G: [' ####', '#    ', '#  ##', '#   #', ' ####'],
  H: ['#   #', '#   #', '#####', '#   #', '#   #'],
  I: ['###', ' # ', ' # ', ' # ', '###'],
  J: ['  ###', '    #', '    #', '#   #', ' ### '],
  K: ['#   #', '#  # ', '###  ', '#  # ', '#   #'],
  L: ['#    ', '#    ', '#    ', '#    ', '#####'],
  M: ['#   #', '## ##', '# # #', '#   #', '#   #'],
  N: ['#   #', '##  #', '# # #', '#  ##', '#   #'],
  O: [' ### ', '#   #', '#   #', '#   #', ' ### '],
  P: ['#### ', '#   #', '#### ', '#    ', '#    '],
  Q: [' ### ', '#   #', '#   #', '#  # ', ' ## #'],
  R: ['#### ', '#   #', '#### ', '#  # ', '#   #'],
  S: [' ####', '#    ', ' ### ', '    #', '#### '],
  T: ['#####', '  #  ', '  #  ', '  #  ', '  #  '],
  U: ['#   #', '#   #', '#   #', '#   #', ' ### '],
  V: ['#   #', '#   #', '#   #', ' # # ', '  #  '],
  W: ['#   #', '#   #', '# # #', '## ##', '#   #'],
  X: ['#   #', ' # # ', '  #  ', ' # # ', '#   #'],
  Y: ['#   #', ' # # ', '  #  ', '  #  ', '  #  '],
  Z: ['#####', '   # ', '  #  ', ' #   ', '#####'],
  '0': [' ### ', '#  ##', '# # #', '##  #', ' ### '],
  '1': ['  # ', ' ## ', '  # ', '  # ', ' ###'],
  '2': ['#### ', '    #', ' ### ', '#    ', '#####'],
  '3': ['#### ', '    #', ' ### ', '    #', '#### '],
  '4': ['#   #', '#   #', '#####', '    #', '    #'],
  '5': ['#####', '#    ', '#### ', '    #', '#### '],
  '6': [' ####', '#    ', '#### ', '#   #', ' ### '],
  '7': ['#####', '    #', '   # ', '  #  ', '  #  '],
  '8': [' ### ', '#   #', ' ### ', '#   #', ' ### '],
  '9': [' ### ', '#   #', ' ####', '    #', ' ### '],
  '.': [' ', ' ', ' ', ' ', '#'],
  '-': ['   ', '   ', '###', '   ', '   '],
  '/': ['    #', '   # ', '  #  ', ' #   ', '#    '],
  ' ': ['  ', '  ', '  ', '  ', '  '],
};

export const BLOCK_ROWS = 5;

/** Column gap between adjacent glyphs. */
const TRACKING = 1;

export function blockWidth(text: string): number {
  let w = 0;
  for (const ch of text.toUpperCase()) {
    const g = G[ch];
    if (!g) continue;
    w += g[0].length + TRACKING;
  }
  return Math.max(0, w - TRACKING);
}

/**
 * Expand `text` into 5 strings of the same length, ready to be stamped into
 * the grid one character per cell. Returns rows of '#' and ' '.
 */
export function blockRows(text: string): string[] {
  const rows = Array.from({ length: BLOCK_ROWS }, () => '');
  for (const ch of text.toUpperCase()) {
    const g = G[ch];
    if (!g) continue;
    for (let r = 0; r < BLOCK_ROWS; r++) {
      rows[r] += g[r] + ' '.repeat(TRACKING);
    }
  }
  return rows.map((r) => r.slice(0, Math.max(0, r.length - TRACKING)));
}

/**
 * How far a word's *optical* left edge sits inside its metric one.
 *
 * A word beginning `T` has ink at column 0 on its crossbar row and two cells
 * in on the four rows below it, so stacking it flush-left under a word
 * beginning `M` — which has ink at column 0 on every row — makes it look
 * indented, because the eye reads the mass rather than the metric edge. This
 * returns the inset most of the rows share, which is the column stacked lines
 * should be aligned on. Hanging the crossbar out past it is the correction a
 * typesetter would make by hand.
 */
export function opticalLead(rows: string[]): number {
  const counts = new Map<number, number>();
  for (const r of rows) {
    if (r.trim() === '') continue;
    const n = r.length - r.trimStart().length;
    counts.set(n, (counts.get(n) ?? 0) + 1);
  }
  if (counts.size === 0) return 0;
  // Most common inset wins; ties go to the smaller one.
  return [...counts].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0][0];
}

export function hasBlockGlyphs(text: string): boolean {
  return [...text.toUpperCase()].every((ch) => ch in G);
}
