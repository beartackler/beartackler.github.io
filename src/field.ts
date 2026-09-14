/**
 * The lantern.
 *
 * Three channels, because one was not enough to describe a light.
 *
 * `beam` is the bright pool the cursor is pushing around right now. It is
 * brief on purpose: a fifth of a second half-life, so the glare is only ever
 * where the cursor *is*.
 *
 * `trail` is the afterglow. It charges to a fraction of the beam and lets go
 * slowly, which is what a phosphor does — luminance drops most of the way at
 * once and then lingers. That split is the whole reason a stroke now has a
 * head and a tail instead of being one migrating blob: with a single decay
 * rate the cell you left a second ago is exactly as bright as the one under
 * the cursor, and a sweep reads as a smear.
 *
 * `ink` is what dwelling has burned in permanently. `lock` is the brief
 * scramble a word runs through as it resolves.
 */

/** The live pool. Short, so the bright part of the lantern stays under the cursor. */
const BEAM_HALF = 0.2;
/** The afterglow. Long, so what you swept stays readable while you read on. */
const TRAIL_HALF = 1.7;
/** How much of the beam the afterglow holds on to. */
const TAIL = 0.75;

const BURN_RATE = 4.6;
/** Below this the beam is developing nothing; it is just light. */
const BURN_LO = 0.16;
const INK_MAX = 0.62; // burned-in text sits below live text, so it reads as settled
const LOCK_TIME = 0.34;
const REVEAL_INK = 0.95; // 'reveal' should read as a document, not as embers
const RESOLVE_LO = 0.28;

/**
 * The grain the halftone fringe is jittered with.
 *
 * It used to be `Math.random()` per cell, which is white noise: it clumps at
 * low frequencies, so the fringe came out blotchy — patches of dense glyphs
 * beside patches of nothing, at a scale big enough to read as a stain rather
 * than as grain.
 *
 * The obvious fix is a low-discrepancy sequence, and it is a trap. R2 and
 * friends are *structured*, and the fringe multiplies the noise against a
 * smooth radial field, which turns that structure into a moiré: a pool of
 * light lit by R2 comes out ruled with diagonal stripes of repeating glyphs.
 * Ordered noise is for thresholding, not for modulating.
 *
 * So: white noise with its low frequencies taken out. Blur a copy, subtract
 * it, and rank the result back onto an even spread of [0,1). What is left has
 * no clumps and no lattice, which is the whole of what this needs to be.
 */
function blueNoise(cols: number, rows: number): Float32Array {
  const n = cols * rows;
  const white = new Float32Array(n);
  for (let i = 0; i < n; i++) white[i] = Math.random();
  const blur = new Float32Array(n);
  const tmp = new Float32Array(n);
  tmp.set(white);
  for (let pass = 0; pass < 2; pass++) {
    for (let r = 0; r < rows; r++) {
      const row = r * cols;
      for (let c = 0; c < cols; c++) {
        const i = row + c;
        blur[i] =
          tmp[row + (c === 0 ? cols - 1 : c - 1)] * 0.25 +
          tmp[i] * 0.5 +
          tmp[row + (c === cols - 1 ? 0 : c + 1)] * 0.25;
      }
    }
    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < rows; r++) {
        const i = r * cols + c;
        tmp[i] =
          blur[(r === 0 ? rows - 1 : r - 1) * cols + c] * 0.25 +
          blur[i] * 0.5 +
          blur[(r === rows - 1 ? 0 : r + 1) * cols + c] * 0.25;
      }
    }
  }
  const high = new Float32Array(n);
  for (let i = 0; i < n; i++) high[i] = white[i] - tmp[i];
  // Rank, so the result is uniform however the high-pass skewed it.
  const order = new Int32Array(n);
  for (let i = 0; i < n; i++) order[i] = i;
  const sorted = Array.from(order).sort((a, b) => high[a] - high[b]);
  const out = new Float32Array(n);
  for (let k = 0; k < n; k++) out[sorted[k]] = (k + 0.5) / n;
  return out;
}

export class Field {
  beam: Float32Array;
  trail: Float32Array;
  ink: Float32Array;
  seed: Float32Array;
  /** A second, decorrelated grain for the alpha dither. See `Renderer.push`. */
  dither: Float32Array;
  /** An extra intensity floor, written per frame by whatever else wants to glow
   * through the grid. The ikigai mark uses it, which keeps that feature out of
   * the lantern's physics entirely. */
  floor: Float32Array;
  /** Spill from resolved type into the space around it. See `halate`. */
  halo: Float32Array;
  private haloTmp: Float32Array;
  /** Brightest cell in each word, including burned-in ink. */
  runLight: Float32Array;
  /** Brightest *live* cell in each word; burned-in words read dimmer. */
  runLive: Float32Array;
  /** Countdown of the decode scramble, per word. */
  runLock: Float32Array;
  private runPrev: Float32Array;

  constructor(
    public cols: number,
    public rows: number,
    runCount: number,
  ) {
    const n = cols * rows;
    this.beam = new Float32Array(n);
    this.trail = new Float32Array(n);
    this.ink = new Float32Array(n);
    this.seed = blueNoise(cols, rows);
    // The same field turned through half a turn: still blue, and correlated
    // with the original nowhere but its own centre. Two generators would do
    // as well and cost twice as much.
    this.dither = new Float32Array(n);
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++)
        this.dither[r * cols + c] = this.seed[(rows - 1 - r) * cols + (cols - 1 - c)];
    this.floor = new Float32Array(n);
    this.halo = new Float32Array(n);
    this.haloTmp = new Float32Array(n);
    this.runLight = new Float32Array(runCount);
    this.runLive = new Float32Array(runCount);
    this.runLock = new Float32Array(runCount);
    this.runPrev = new Float32Array(runCount);
  }

  /** What the lantern is worth at this cell: the beam, or what it left behind. */
  lit(i: number): number {
    return this.beam[i] > this.trail[i] ? this.beam[i] : this.trail[i];
  }

  /**
   * Paints a soft pool centred on a fractional cell position. Distance is
   * measured in pixels so the pool is round on screen, not stretched by the
   * cell's aspect ratio.
   *
   * `dirC`/`dirR` are the unit direction of travel and `stretch` how far the
   * pool is drawn out along it — area-preserving, so a flick narrows into a
   * comet as it lengthens and a cursor at rest stays a circle. A moving light
   * that keeps a perfect disc reads as a stencil sliding over the page; the
   * elongation is what makes it read as a light being *carried*.
   */
  stamp(
    colF: number,
    rowF: number,
    radius: number,
    aspect: number,
    strength = 1,
    dirC = 0,
    dirR = 0,
    stretch = 1,
  ): void {
    const long = radius * stretch;
    const wide = radius / stretch;
    // Conservative box: the ellipse never leaves the circle of its long axis.
    const rRows = long / aspect;
    const c0 = Math.max(0, Math.floor(colF - long));
    const c1 = Math.min(this.cols - 1, Math.ceil(colF + long));
    const r0 = Math.max(0, Math.floor(rowF - rRows));
    const r1 = Math.min(this.rows - 1, Math.ceil(rowF + rRows));
    const along2 = long * long;
    const across2 = wide * wide;
    for (let r = r0; r <= r1; r++) {
      const dy = (r - rowF) * aspect;
      for (let c = c0; c <= c1; c++) {
        const dx = c - colF;
        const u = dx * dirC + dy * dirR;
        const v = dy * dirC - dx * dirR;
        const d2 = (u * u) / along2 + (v * v) / across2;
        if (d2 > 1) continue;
        const t = 1 - Math.sqrt(d2);
        const val = t * t * (3 - 2 * t) * strength;
        const i = r * this.cols + c;
        if (val > this.beam[i]) this.beam[i] = val;
      }
    }
  }

  step(dt: number, hasChar: (i: number) => boolean, burn: boolean): void {
    const keepBeam = Math.pow(0.5, dt / BEAM_HALF);
    const keepTrail = Math.pow(0.5, dt / TRAIL_HALF);
    const { beam, trail, ink } = this;
    for (let i = 0; i < beam.length; i++) {
      const next = beam[i] * keepBeam;
      beam[i] = next;
      const held = trail[i] * keepTrail;
      const charge = next * TAIL;
      trail[i] = held > charge ? held : charge;
      if (burn && next > BURN_LO && ink[i] < INK_MAX && hasChar(i)) {
        ink[i] = Math.min(INK_MAX, ink[i] + next * next * dt * BURN_RATE);
      }
    }
  }

  /**
   * Spills resolved type into the space around it.
   *
   * Without this the resume arrives as crisp white rules pasted on top of a
   * field it has no relationship to. Real type on a lit page bleeds — a print
   * halates, a phosphor blooms — and the spill is what bonds the two layers
   * together. Two separable three-tap passes over the plane: a few tens of
   * thousands of multiplies, which is nothing next to the draw.
   */
  halate(runId: Int32Array, chars: Uint16Array): void {
    const { halo, haloTmp, runLight, cols } = this;
    const n = halo.length;
    for (let i = 0; i < n; i++) {
      if (chars[i] === 0) {
        haloTmp[i] = 0;
        continue;
      }
      const k = runId[i];
      haloTmp[i] = k < 0 ? 0 : runLight[k];
    }
    // Horizontal, then vertical — one pair, so the spill hugs the type. Two
    // pairs reach far enough to fill the gap between two lines of the resume,
    // and a bed of haze that touches everything is not a halo, it is fog.
    {
      for (let r = 0; r < this.rows; r++) {
        const row = r * cols;
        let prev = 0;
        for (let c = 0; c < cols; c++) {
          const i = row + c;
          const cur = haloTmp[i];
          const next = c + 1 < cols ? haloTmp[i + 1] : 0;
          halo[i] = prev * 0.26 + cur * 0.48 + next * 0.26;
          prev = cur;
        }
      }
      for (let c = 0; c < cols; c++) {
        let prev = 0;
        for (let r = 0; r < this.rows; r++) {
          const i = r * cols + c;
          const cur = halo[i];
          const next = r + 1 < this.rows ? halo[i + cols] : 0;
          haloTmp[i] = prev * 0.26 + cur * 0.48 + next * 0.26;
          prev = cur;
        }
      }
    }
    halo.set(haloTmp);
  }

  /** Rolls per-cell light up to per-word light. A word resolves on its
   * brightest cell, so touching any part of it brings the whole word into
   * focus rather than shearing it through the middle of the light. */
  resolveRuns(runId: Int32Array, dt: number): void {
    const { beam, trail, ink, runLight, runLive, runLock, runPrev } = this;
    runLight.fill(0);
    runLive.fill(0);
    for (let i = 0; i < runId.length; i++) {
      const r = runId[i];
      if (r < 0) continue;
      const live = beam[i];
      if (live > runLive[r]) runLive[r] = live;
      // Held on the afterglow, not the beam: a word you swept past has to stay
      // readable for as long as it takes to read it, and the beam is gone in a
      // fifth of a second by design.
      let any = live > trail[i] ? live : trail[i];
      if (ink[i] > any) any = ink[i];
      if (any > runLight[r]) runLight[r] = any;
    }
    for (let r = 0; r < runLight.length; r++) {
      if (runPrev[r] < RESOLVE_LO && runLight[r] >= RESOLVE_LO) runLock[r] = LOCK_TIME;
      else if (runLock[r] > 0) runLock[r] = Math.max(0, runLock[r] - dt);
      runPrev[r] = runLight[r];
    }
  }

  /** An expanding annulus. Used by the cold open to breathe rings of haze out
   * of the resting cursor, which teaches the mechanic without showing a word. */
  ring(
    colF: number,
    rowF: number,
    radius: number,
    thickness: number,
    aspect: number,
    strength: number,
  ): void {
    const rr = radius + thickness;
    const rRows = rr / aspect;
    const c0 = Math.max(0, Math.floor(colF - rr));
    const c1 = Math.min(this.cols - 1, Math.ceil(colF + rr));
    const r0 = Math.max(0, Math.floor(rowF - rRows));
    const r1 = Math.min(this.rows - 1, Math.ceil(rowF + rRows));
    for (let r = r0; r <= r1; r++) {
      const dy = (r - rowF) * aspect;
      for (let c = c0; c <= c1; c++) {
        const dx = c - colF;
        const d = Math.abs(Math.hypot(dx, dy) - radius) / thickness;
        if (d >= 1) continue;
        const t = 1 - d;
        const v = t * t * (3 - 2 * t) * strength;
        const i = r * this.cols + c;
        if (v > this.floor[i]) this.floor[i] = v;
      }
    }
  }

  revealAll(hasChar: (i: number) => boolean): void {
    for (let i = 0; i < this.beam.length; i++) {
      if (!hasChar(i)) continue;
      this.beam[i] = 1;
      this.trail[i] = 1;
      this.ink[i] = REVEAL_INK;
    }
  }

  clear(): void {
    this.beam.fill(0);
    this.trail.fill(0);
    this.ink.fill(0);
    this.halo.fill(0);
    this.runLock.fill(0);
    this.runPrev.fill(0);
  }
}

export { INK_MAX, LOCK_TIME, RESOLVE_LO };
