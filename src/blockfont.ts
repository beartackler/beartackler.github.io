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
 *
 * Stacked lines are aligned flush on column 0, and should stay that way. A
 * word beginning `T` has ink at column 0 only on its crossbar row, so under a
 * word beginning `M` it can look indented — but hanging the crossbar out to
 * align the stem instead is a 2-of-5-cell overhang, and that reads much more
 * plainly as a mistake. Overhang correction is a smooth-type refinement; on a
 * face whose pixels are grid cells, the metric box *is* the alignment.
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

export function hasBlockGlyphs(text: string): boolean {
  return [...text.toUpperCase()].every((ch) => ch in G);
}
