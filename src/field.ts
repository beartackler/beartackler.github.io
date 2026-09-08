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
  lock: Float32Array;
  seed: Float32Array;

  constructor(
    public cols: number,
    public rows: number,
  ) {
    const n = cols * rows;
    this.light = new Float32Array(n);
    this.ink = new Float32Array(n);
    this.lock = new Float32Array(n);
    this.seed = new Float32Array(n);
    for (let i = 0; i < n; i++) this.seed[i] = Math.random();
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

  step(dt: number, hasChar: (i: number) => boolean): void {
    const keep = Math.pow(0.5, dt / HALF_LIFE);
    const { light, ink, lock } = this;
    for (let i = 0; i < light.length; i++) {
      const prev = light[i];
      const next = prev * keep;
      light[i] = next;

      if (prev < RESOLVE_LO && next >= RESOLVE_LO) lock[i] = LOCK_TIME;
      else if (lock[i] > 0) lock[i] = Math.max(0, lock[i] - dt);

      if (next > 0.25 && ink[i] < INK_MAX && hasChar(i)) {
        ink[i] = Math.min(INK_MAX, ink[i] + next * next * dt * BURN_RATE);
      }
    }
  }

  /**
   * Lights the type and only the type. Flooding the empty cells too would bury
   * the resume under full-screen haze, which is the opposite of what someone
   * pressing "reveal" is asking for.
   */
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
    this.lock.fill(0);
  }
}

export { INK_MAX, RESOLVE_LO };
