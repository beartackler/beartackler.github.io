/**
 * The lantern.
 *
 * `light` is what the cursor is touching right now and fades on a half-life.
 * `ink` is what dwelling has burned in permanently. `lock` is the brief
 * scramble a cell runs through as it resolves.
 */

const HALF_LIFE = 2.2; // seconds for live light to halve
const BURN_RATE = 3.0;
const INK_MAX = 0.62; // burned-in text sits below live text, so it reads as settled
const LOCK_TIME = 0.22;
const REVEAL_INK = 0.95; // 'reveal' should read as a document, not as embers
const RESOLVE_LO = 0.28;

export class Field {
  light: Float32Array;
  ink: Float32Array;
  seed: Float32Array;
  /**
   * An extra intensity floor, written per frame by whatever else wants to glow
   * through the grid. The ikigai mark uses it, which keeps that feature out of
   * the lantern's physics entirely.
   */
  floor: Float32Array;
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
    this.light = new Float32Array(n);
    this.ink = new Float32Array(n);
    this.seed = new Float32Array(n);
    for (let i = 0; i < n; i++) this.seed[i] = Math.random();
    this.floor = new Float32Array(n);
    this.runLight = new Float32Array(runCount);
    this.runLive = new Float32Array(runCount);
    this.runLock = new Float32Array(runCount);
    this.runPrev = new Float32Array(runCount);
  }

  /**
   * Paints a soft radial pool centred on a fractional cell position. Distance
   * is measured in pixels so the pool is round on screen, not stretched by the
   * cell's aspect ratio.
   */
  stamp(colF: number, rowF: number, radius: number, aspect: number, strength = 1): void {
    const rRows = radius / aspect;
    const c0 = Math.max(0, Math.floor(colF - radius));
    const c1 = Math.min(this.cols - 1, Math.ceil(colF + radius));
    const r0 = Math.max(0, Math.floor(rowF - rRows));
    const r1 = Math.min(this.rows - 1, Math.ceil(rowF + rRows));
    const rr = radius * radius;

    for (let r = r0; r <= r1; r++) {
      const dy = (r - rowF) * aspect;
      for (let c = c0; c <= c1; c++) {
        const dx = c - colF;
        const d2 = dx * dx + dy * dy;
        if (d2 > rr) continue;
        const t = 1 - Math.sqrt(d2) / radius;
        const v = t * t * (3 - 2 * t) * strength;
        const i = r * this.cols + c;
        if (v > this.light[i]) this.light[i] = v;
      }
    }
  }

  step(dt: number, hasChar: (i: number) => boolean, burn: boolean, halfLife = HALF_LIFE): void {
    const keep = Math.pow(0.5, dt / halfLife);
    const { light, ink } = this;
    for (let i = 0; i < light.length; i++) {
      const next = light[i] * keep;
      light[i] = next;
      if (burn && next > 0.25 && ink[i] < INK_MAX && hasChar(i)) {
        ink[i] = Math.min(INK_MAX, ink[i] + next * next * dt * BURN_RATE);
      }
    }
  }

  /**
   * Rolls per-cell light up to per-word light. A word resolves on its
   * brightest cell, so touching any part of it brings the whole word into
   * focus rather than shearing it through the middle of the light.
   */
  resolveRuns(runId: Int32Array, dt: number): void {
    const { light, ink, runLight, runLive, runLock, runPrev } = this;
    runLight.fill(0);
    runLive.fill(0);

    for (let i = 0; i < runId.length; i++) {
      const r = runId[i];
      if (r < 0) continue;
      const live = light[i];
      if (live > runLive[r]) runLive[r] = live;
      const any = live > ink[i] ? live : ink[i];
      if (any > runLight[r]) runLight[r] = any;
    }

    for (let r = 0; r < runLight.length; r++) {
      if (runPrev[r] < RESOLVE_LO && runLight[r] >= RESOLVE_LO) runLock[r] = LOCK_TIME;
      else if (runLock[r] > 0) runLock[r] = Math.max(0, runLock[r] - dt);
      runPrev[r] = runLight[r];
    }
  }

  /**
   * Lights the type and only the type. Flooding the empty cells too would bury
   * the resume under full-screen haze, which is the opposite of what someone
   * pressing "reveal" is asking for.
   */
  /**
   * An expanding annulus. Used by the cold open to breathe rings of haze out
   * of the resting cursor, which teaches the mechanic without showing a word.
   */
  ring(
    colF: number,
    rowF: number,
    radius: number,
    thickness: number,
    aspect: number,
    strength: number,
  ): void {
    const reach = radius + thickness;
    const c0 = Math.max(0, Math.floor(colF - reach));
    const c1 = Math.min(this.cols - 1, Math.ceil(colF + reach));
    const r0 = Math.max(0, Math.floor(rowF - reach / aspect));
    const r1 = Math.min(this.rows - 1, Math.ceil(rowF + reach / aspect));

    for (let r = r0; r <= r1; r++) {
      const dy = (r - rowF) * aspect;
      for (let c = c0; c <= c1; c++) {
        const dx = c - colF;
        const t = 1 - Math.abs(Math.sqrt(dx * dx + dy * dy) - radius) / thickness;
        if (t <= 0) continue;
        const i = r * this.cols + c;
        const v = t * t * (3 - 2 * t) * strength;
        if (v > this.floor[i]) this.floor[i] = v;
      }
    }
  }

  revealAll(hasChar: (i: number) => boolean): void {
    for (let i = 0; i < this.light.length; i++) {
      if (!hasChar(i)) continue;
      this.light[i] = 1;
      this.ink[i] = REVEAL_INK;
    }
  }

  clear(): void {
    this.light.fill(0);
    this.ink.fill(0);
    this.runLock.fill(0);
    this.runPrev.fill(0);
  }
}

export { INK_MAX, RESOLVE_LO };
