/**
 * Pre-renders every glyph the page can show, once per colour, into offscreen
 * sprite sheets. The draw loop then does nothing but `drawImage`, which keeps
 * ~9,000 cells a frame comfortably inside a 16ms budget.
 */

export type Palette = {
  display: string;
  ink: string;
  dim: string;
  muted: string;
  glow: string;
  glowHot: string;
  bark: string;
  bloom: string;
  bloomDeep: string;
};

/** Index into `Atlas.sheets`. Tones 0–3 line up with layout.ts `Tone`. */
export const Sheet = {
  Display: 0,
  Ink: 1,
  Dim: 2,
  Muted: 3,
  Glow: 4,
  GlowHot: 5,
  Bark: 6,
  Bloom: 7,
  BloomDeep: 8,
} as const;

export class Atlas {
  readonly sheets: HTMLCanvasElement[] = [];
  /** charCode → column index within a sheet. */
  readonly slot = new Map<number, number>();
  /** Charset ordered light → heavy by measured ink coverage. */
  readonly ramp: number[] = [];
  readonly scramble: number[] = [];

  constructor(
    readonly cellW: number,
    readonly cellH: number,
    readonly dpr: number,
    fontPx: number,
    charset: number[],
    palette: Palette,
  ) {
    const codes = [...new Set(charset)].sort((a, b) => a - b);
    codes.forEach((c, i) => this.slot.set(c, i));

    const w = Math.round(cellW * dpr);
    const h = Math.round(cellH * dpr);
    const font = `${Math.round(fontPx * dpr)}px "Departure Mono", monospace`;
    const colours = [
      palette.display,
      palette.ink,
      palette.dim,
      palette.muted,
      palette.glow,
      palette.glowHot,
      palette.bark,
      palette.bloom,
      palette.bloomDeep,
    ];

    for (const colour of colours) {
      const cv = document.createElement('canvas');
      cv.width = w * codes.length;
      cv.height = h;
      const g = cv.getContext('2d')!;
      g.font = font;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillStyle = colour;
      codes.forEach((code, i) => {
        g.fillText(String.fromCharCode(code), i * w + w / 2, h / 2);
      });
      this.sheets.push(cv);
    }

    // The haze is built from punctuation only. Letters in the fringe read as
    // garbled *words* and fight the resolved type; punctuation reads as
    // texture, which is what a halftone needs to be.
    this.ramp = buildRamp(this.sheets[Sheet.Ink], codes.filter(isTexture), w, h);
    // The decode flicker, on the other hand, is made of Timur's own letters.
    this.scramble = codes.filter((c) => !isTexture(c) && c !== 32);
    if (this.scramble.length === 0) this.scramble = this.ramp;
  }

  sx(code: number): number {
    return (this.slot.get(code) ?? 0) * Math.round(this.cellW * this.dpr);
  }
}

function isTexture(code: number): boolean {
  if (code === 32) return false;
  return !/[\p{L}\p{N}]/u.test(String.fromCharCode(code));
}

/**
 * Orders characters by how much ink each one actually puts down at this size,
 * then samples an even spread. The ramp is measured from the rendered glyphs
 * rather than guessed, so it stays a true density scale in any font.
 */
function buildRamp(sheet: HTMLCanvasElement, codes: number[], w: number, h: number): number[] {
  const g = sheet.getContext('2d', { willReadFrequently: true })!;
  const weighed: { code: number; weight: number }[] = [];

  for (let i = 0; i < codes.length; i++) {
    const code = codes[i];
    if (code === 32) continue;
    const data = g.getImageData(i * w, 0, w, h).data;
    let sum = 0;
    for (let p = 3; p < data.length; p += 4) sum += data[p];
    if (sum > 0) weighed.push({ code, weight: sum / (w * h * 255) });
  }

  weighed.sort((a, b) => a.weight - b.weight);
  if (weighed.length === 0) return [46];

  const STEPS = 11;
  const out: number[] = [];
  for (let i = 0; i < STEPS; i++) {
    const idx = Math.round((i / (STEPS - 1)) * (weighed.length - 1));
    out.push(weighed[idx].code);
  }
  return out;
}
