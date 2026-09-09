/**
 * Exhaust flames, and the plume out of Pandora's jar — the same code twice.
 *
 * The reference is a V10 on the overrun at night, and the surprise is that the
 * flames are not orange: unburnt fuel lighting off in the pipe burns
 * violet-white. That is a gift, because act two's plum is already violet, so
 * the fire carries the previous scene's colour forward instead of asking the
 * page for a fourth anchor. Black, bone and plum still covers all of it.
 *
 * Its core is bone rather than white-hot for the same reason everything else
 * on this page is bone: against a night sky a white core is the hottest part
 * of a flame, but against a bone-white car it is invisible.
 *
 * Particles are hashed rather than stored. The whole page is a pure function
 * of scroll position, so a plume that remembered anything between frames would
 * reshuffle when you scrubbed backwards.
 */

import { Sheet } from './atlas';
import type { Overlay } from './render';

const RAMP = ['@', '#', '*', '+', '=', ':', '.'].map((c) => c.charCodeAt(0));

export type Emitter = {
  /** Where the plume starts, in cells. */
  c: number;
  r: number;
  /** Unit direction it travels, in cells. */
  dc: number;
  dr: number;
};

function hash(n: number): number {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

export type Palette = { core: number; mid: number; deep: number };

export const FIRE: Palette = { core: Sheet.Display, mid: Sheet.Bloom, deep: Sheet.BloomDeep };

/**
 * @param heat  0 is out, 1 is full. Fades the plume in without moving it.
 * @param time  Seconds; the only thing here that is not scroll-driven, and it
 *              is passed as 0 under reduced motion so the fire holds still.
 */
export function plume(
  out: Overlay,
  cols: number,
  rows: number,
  emitters: Emitter[],
  heat: number,
  time: number,
  prio: Uint8Array,
  level: number,
  sheets: Palette = FIRE,
  reach = 26,
  spread = 5.4,
): void {
  if (heat <= 0.01) return;
  const COUNT = 300;
  const len = (0.35 + 0.65 * heat) * reach;
  for (let e = 0; e < emitters.length; e++) {
    const em = emitters[e];
    // Perpendicular to the plume, for the spread.
    const qc = -em.dr;
    const qr = em.dc;
    for (let i = 0; i < COUNT; i++) {
      const h1 = hash(i * 2.17 + e * 91.3);
      const h2 = hash(i * 7.31 + e * 13.7);
      const h3 = hash(i * 3.91 + e * 51.1);
      const u = Math.pow(h1, 1.4);
      if (u > heat * 1.15) continue;
      const flick = Math.sin(time * (2.2 + h3 * 3.4) + h2 * 6.28);
      const off = (h2 - 0.5) * (1.2 + u * spread) + flick * u * 1.6;
      const c = Math.round(em.c + em.dc * u * len + qc * off);
      const r = Math.round(em.r + em.dr * u * len + qr * off);
      if (c < 0 || c >= cols || r < 0 || r >= rows) continue;
      const fall = Math.pow(1 - u, 1.15);
      const a = Math.min(1, fall * (0.55 + 0.45 * flick) * heat * 1.6);
      if (a < 0.08) continue;
      const k = r * cols + c;
      if (prio[k] > level) continue;
      out.char[k] = RAMP[Math.min(RAMP.length - 1, Math.floor((1 - fall) * RAMP.length))];
      out.sheet[k] = fall > 0.88 ? sheets.core : fall > 0.5 ? sheets.mid : sheets.deep;
      out.alpha[k] = Math.max(out.alpha[k], a);
      prio[k] = level;
    }
  }
}
