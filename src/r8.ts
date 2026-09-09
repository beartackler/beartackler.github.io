/**
 * An Audi R8, built as geometry and rasterised into the character grid.
 *
 * The brief was that the car faces the camera and then turns to show its
 * exhausts, which rules out the obvious approach. Two hand-drawn ASCII frames
 * cross-faded would be a dissolve between two pictures, and a dissolve is
 * exactly the thing that reads as fake when the shape underneath is supposed
 * to be solid. So the car is a real mesh and the turn is a real camera: a
 * lofted body, four wheels, a z-buffer, and Gouraud shading resolved to the
 * page's own density ramp. Every pose is a pure function of the angle handed
 * in, which is what keeps act three reversible like the two before it.
 *
 * The body is a loft. Eighteen cross-sections down the length carry four width
 * controls each — floor, sill, shoulder, roof — and the shoulder is what makes
 * a car a car: the widest point sits at about half height, so the flanks fall
 * inward above it. That single parameter is most of the R8's stance.
 */

import { Sheet } from './atlas';
import type { Overlay } from './render';

/** Points sampled up one side of a cross-section. */
const RIB = 9;
/** Points around a closed section: up the right flank, down the left. */
const LOOP = RIB * 2;

/**
 * Cross-sections, front to rear, in car lengths.
 *
 * A real R8 is 4.43 m long, 1.94 wide and 1.24 tall, so in these units it is
 * 0.438 wide and 0.280 tall — barely a quarter as tall as it is long. Getting
 * that ratio right matters more than any amount of detail: a supercar read
 * from a silhouette is mostly the news that it is far too low.
 */
type Section = {
  x: number;
  /** Half-widths at floor, sill, shoulder and roof. */
  w: [number, number, number, number];
  zLow: number;
  zTop: number;
};

const BODY: Section[] = [
  { x: 0.000, w: [0.100, 0.135, 0.150, 0.105], zLow: 0.030, zTop: 0.092 },
  { x: 0.025, w: [0.140, 0.180, 0.200, 0.150], zLow: 0.018, zTop: 0.112 },
  { x: 0.060, w: [0.160, 0.198, 0.213, 0.172], zLow: 0.014, zTop: 0.130 },
  { x: 0.110, w: [0.168, 0.204, 0.218, 0.186], zLow: 0.020, zTop: 0.144 },
  { x: 0.180, w: [0.140, 0.178, 0.219, 0.192], zLow: 0.052, zTop: 0.150 },
  { x: 0.240, w: [0.140, 0.178, 0.219, 0.193], zLow: 0.052, zTop: 0.152 },
  { x: 0.320, w: [0.168, 0.202, 0.215, 0.188], zLow: 0.028, zTop: 0.156 },
  { x: 0.400, w: [0.166, 0.200, 0.213, 0.184], zLow: 0.028, zTop: 0.168 },
  // The windscreen. Roof half-width collapses from 0.184 to 0.120 over the
  // next two sections, which is the tumblehome — the glasshouse is far
  // narrower than the body, and that taper is most of what says "mid-engine".
  { x: 0.455, w: [0.166, 0.200, 0.212, 0.150], zLow: 0.028, zTop: 0.200 },
  { x: 0.520, w: [0.168, 0.202, 0.213, 0.120], zLow: 0.028, zTop: 0.243 },
  { x: 0.590, w: [0.170, 0.204, 0.214, 0.112], zLow: 0.028, zTop: 0.266 },
  { x: 0.655, w: [0.172, 0.206, 0.215, 0.112], zLow: 0.028, zTop: 0.268 },
  { x: 0.715, w: [0.176, 0.210, 0.218, 0.124], zLow: 0.028, zTop: 0.258 },
  { x: 0.775, w: [0.142, 0.182, 0.219, 0.152], zLow: 0.050, zTop: 0.234 },
  { x: 0.840, w: [0.142, 0.182, 0.219, 0.170], zLow: 0.052, zTop: 0.214 },
  { x: 0.900, w: [0.176, 0.210, 0.216, 0.178], zLow: 0.030, zTop: 0.202 },
  { x: 0.955, w: [0.166, 0.200, 0.208, 0.178], zLow: 0.030, zTop: 0.194 },
  { x: 1.000, w: [0.140, 0.176, 0.188, 0.164], zLow: 0.034, zTop: 0.184 },
];

/** Where the four width controls sit up the height of a section. */
const CONTROL = [0, 0.22, 0.55, 1];

/**
 * Wheels sit *outboard* of the tucked sills rather than inside the body.
 * A loft cannot cut an arch, so the arch is made the other way round: the
 * floor and sill half-widths pinch in at the two axle sections and the
 * section floor lifts, which leaves the tyre standing proud below the
 * shoulder line. Without it the wheels are sealed inside the bodywork and
 * the car reads as a boat.
 */
const AXLE_FRONT = 0.215;
const AXLE_REAR = 0.835;
const WHEEL_R = 0.0745;
const WHEEL_Y = 0.200;
const WHEEL_W = 0.048;

/**
 * The exhausts, which are the whole point of the pose.
 *
 * The V10 car puts two large oval tips at the outer ends of the rear valance
 * rather than in the middle, so the flames leave from far apart and low —
 * that spacing is the shot.
 */
const PIPES: [number, number, number][] = [
  [1.003, 0.148, 0.062],
  [1.003, -0.148, 0.062],
];

/** Materials, in the order the classifier tries them. */
const Mat = {
  Body: 0,
  Glass: 1,
  Vent: 2,
  Blade: 3,
  Lamp: 4,
  Tail: 5,
  Tyre: 6,
  Rim: 7,
} as const;

/** Albedo per material; the body is near-white because the reference car is. */
const ALBEDO = [0.86, 0.20, 0.07, 0.13, 0.95, 0.62, 0.10, 0.72];
/** How glossy each material is, which is what makes painted metal read as painted. */
const GLOSS = [0.85, 0.95, 0.05, 0.25, 0.9, 0.7, 0.04, 0.6];

type Mesh = {
  vx: Float32Array;
  vy: Float32Array;
  vz: Float32Array;
  nx: Float32Array;
  ny: Float32Array;
  nz: Float32Array;
  tri: Int32Array;
  mat: Uint8Array;
};

function build(): Mesh {
  const px: number[] = [];
  const py: number[] = [];
  const pz: number[] = [];
  const tri: number[] = [];
  const mat: number[] = [];

  const widthAt = (s: Section, v: number): number => {
    let k = 0;
    while (k < 2 && v > CONTROL[k + 1]) k++;
    const span = CONTROL[k + 1] - CONTROL[k];
    let t = (v - CONTROL[k]) / span;
    t = Math.min(1, Math.max(0, t));
    // Smoothstep between controls, so the flanks are round rather than creased.
    t = t * t * (3 - 2 * t);
    return s.w[k] + (s.w[k + 1] - s.w[k]) * t;
  };

  // ── Body loft ──
  for (const s of BODY) {
    for (let j = 0; j < LOOP; j++) {
      const right = j < RIB;
      const v = right ? j / (RIB - 1) : (LOOP - 1 - j) / (RIB - 1);
      const w = widthAt(s, v);
      px.push(s.x);
      py.push(right ? w : -w);
      pz.push(s.zLow + (s.zTop - s.zLow) * v);
    }
  }

  const face = (a: number, b: number, c: number, m: number) => {
    tri.push(a, b, c);
    mat.push(m);
  };

  /**
   * Adds a triangle wound so its normal points along the given direction.
   *
   * Winding is the one thing in a mesh that stays invisible until it is
   * wrong, and then it is wrong twice over: the face is back-face culled, and
   * its vertices average into a normal pointing into the body, so anything
   * that does survive is lit inside out. Stating which way is *out* and
   * letting the builder sort the order removes the whole class of bug — which
   * is how the wheels came to be sealed inside the bodywork.
   */
  const faceOut = (
    a: number, b: number, c: number, m: number,
    ox: number, oy: number, oz: number,
  ) => {
    const ux = px[b] - px[a], uy = py[b] - py[a], uz = pz[b] - pz[a];
    const wx = px[c] - px[a], wy = py[c] - py[a], wz = pz[c] - pz[a];
    const fx = uy * wz - uz * wy;
    const fy = uz * wx - ux * wz;
    const fz = ux * wy - uy * wx;
    if (fx * ox + fy * oy + fz * oz >= 0) face(a, b, c, m);
    else face(a, c, b, m);
  };

  /**
   * The wheel arches, punched straight out of the flanks.
   *
   * A loft is a closed tube, and the body's shoulder is wider than the tyre at
   * every height, so no amount of tucking the sills in will reveal a wheel —
   * it stays sealed inside the bodywork. Real arches are holes, so these are
   * holes: quads whose centre falls inside the wheel's own circle, on the
   * outer flank, are simply not built. The wheel fills the gap it leaves, and
   * the ragged edge of the opening reads as the arch lip.
   */
  const inArch = (x: number, y: number, z: number): boolean => {
    if (Math.abs(y) < 0.183) return false;
    for (const ax of [AXLE_FRONT, AXLE_REAR]) {
      if (Math.hypot(x - ax, z - WHEEL_R) < WHEEL_R * 0.99) return true;
    }
    return false;
  };

  const classify = (x: number, y: number, z: number): number => {
    const ay = Math.abs(y);
    // The side blade, behind the door. It is the one feature that identifies
    // an R8 from any angle, so it gets checked before anything else can claim
    // those cells.
    if (x > 0.635 && x < 0.725 && ay > 0.200 && z > 0.150 && z < 0.232) return Mat.Blade;
    // The roof panel is bodywork; only the screen, the side glass and the
    // engine window are glazed. Classifying the whole upper surface as glass
    // paints a blue slab from windscreen to tail.
    const roof = x > 0.545 && x < 0.745 && ay < 0.108 && z > 0.238;
    if (!roof) {
      if (x > 0.435 && x < 0.625 && z > 0.180) return Mat.Glass;
      if (x > 0.50 && x < 0.755 && ay > 0.095 && z > 0.190) return Mat.Glass;
      if (x > 0.715 && x < 0.800 && z > 0.196) return Mat.Glass;
    }
    if (x > 0.955 && z > 0.132 && z < 0.186) return Mat.Tail;
    if (x < 0.155 && x > 0.085 && z > 0.112 && z < 0.156 && ay > 0.10) return Mat.Lamp;
    // Single-frame grille, the outer front intakes, the side scoop ahead of
    // the rear wheel, and the diffuser: all the black holes in the bodywork.
    if (x < 0.075 && z < 0.080) return Mat.Vent;
    if (x < 0.095 && ay > 0.165 && z < 0.100) return Mat.Vent;
    if (x > 0.665 && x < 0.730 && ay > 0.203 && z > 0.085 && z < 0.145) return Mat.Vent;
    if (x > 0.945 && z < 0.078) return Mat.Vent;
    return Mat.Body;
  };

  for (let i = 0; i < BODY.length - 1; i++) {
    for (let j = 0; j < LOOP; j++) {
      const j2 = (j + 1) % LOOP;
      const a = i * LOOP + j;
      const b = i * LOOP + j2;
      const c = (i + 1) * LOOP + j2;
      const d = (i + 1) * LOOP + j;
      const mx = (px[a] + px[c]) / 2;
      const my = (py[a] + py[c]) / 2;
      const mz = (pz[a] + pz[c]) / 2;
      if (inArch(mx, my, mz)) continue;
      const m = classify(mx, my, mz);
      const axisZ = (BODY[i].zLow + BODY[i].zTop + BODY[i + 1].zLow + BODY[i + 1].zTop) / 4;
      faceOut(a, b, c, m, 0, my, mz - axisZ);
      faceOut(a, c, d, m, 0, my, mz - axisZ);
    }
  }

  // End caps, fanned from the centre of the first and last sections.
  for (const [idx, flip] of [
    [0, true],
    [BODY.length - 1, false],
  ] as [number, boolean][]) {
    const s = BODY[idx];
    const hub = px.length;
    px.push(s.x);
    py.push(0);
    pz.push((s.zLow + s.zTop) / 2);
    for (let j = 0; j < LOOP; j++) {
      const a = idx * LOOP + j;
      const b = idx * LOOP + ((j + 1) % LOOP);
      const m = classify(s.x, (py[a] + py[b]) / 2, (pz[a] + pz[b]) / 2);
      faceOut(hub, a, b, m, flip ? -1 : 1, 0, 0);
    }
  }

  // ── Spoiler ──
  // A thin slab across the rear deck. Small, but it breaks the fastback line
  // at exactly the point where a silhouette stops saying "coupe" and starts
  // saying "this one has a wing".
  {
    const x0 = 0.895;
    const x1 = 0.982;
    const zb = 0.208;
    const zt = 0.223;
    const wy = 0.205;
    const base = px.length;
    for (const [x, z] of [
      [x0, zb],
      [x1, zb],
      [x1, zt],
      [x0, zt],
    ]) {
      for (const y of [wy, -wy]) {
        px.push(x);
        py.push(y);
        pz.push(z);
      }
    }
    const q = (a: number, b: number, c: number, d: number, ox: number, oy: number, oz: number) => {
      faceOut(base + a, base + b, base + c, Mat.Blade, ox, oy, oz);
      faceOut(base + a, base + c, base + d, Mat.Blade, ox, oy, oz);
    };
    q(0, 2, 4, 6, 0, 1, 0);
    q(7, 5, 3, 1, 0, -1, 0);
    q(6, 4, 5, 7, 0, 0, 1);
    q(1, 3, 2, 0, 0, 0, -1);
    q(0, 6, 7, 1, -1, 0, 0);
    q(3, 5, 4, 2, 1, 0, 0);
  }

  // ── Wheels ──
  for (const ax of [AXLE_FRONT, AXLE_REAR]) {
    for (const side of [1, -1]) {
      const yOut = side * WHEEL_Y;
      const yIn = side * (WHEEL_Y - WHEEL_W);
      const base = px.length;
      const SEG = 16;
      for (let k = 0; k < SEG; k++) {
        const a = (k / SEG) * Math.PI * 2;
        const cx = ax + Math.cos(a) * WHEEL_R;
        const cz = WHEEL_R + Math.sin(a) * WHEEL_R;
        px.push(cx, cx);
        py.push(yOut, yIn);
        pz.push(cz, cz);
      }
      const hubOut = px.length;
      px.push(ax);
      py.push(yOut);
      pz.push(WHEEL_R);
      for (let k = 0; k < SEG; k++) {
        const o = base + k * 2;
        const o2 = base + ((k + 1) % SEG) * 2;
        // Tread faces out along the radius from the axle.
        const rx2 = (px[o] + px[o2]) / 2 - ax;
        const rz2 = (pz[o] + pz[o2]) / 2 - WHEEL_R;
        faceOut(o, o2, o2 + 1, Mat.Tyre, rx2, 0, rz2);
        faceOut(o, o2 + 1, o + 1, Mat.Tyre, rx2, 0, rz2);
        // The face alternates rim and shadow by segment, which at this
        // resolution is all a spoke can be — and is enough, because a wheel
        // that is a flat disc is the fastest way to make a car look like a
        // toy.
        faceOut(hubOut, o, o2, Mat.Rim, 0, side, 0);
      }
    }
  }

  // ── Exhaust tips ──
  for (const [ex, ey, ez] of PIPES) {
    const base = px.length;
    const SEG = 10;
    const rw = 0.030;
    const rh = 0.019;
    for (let k = 0; k < SEG; k++) {
      const a = (k / SEG) * Math.PI * 2;
      for (const depth of [0, -0.028]) {
        px.push(ex + depth);
        py.push(ey + Math.cos(a) * rw);
        pz.push(ez + Math.sin(a) * rh);
      }
    }
    for (let k = 0; k < SEG; k++) {
      const o = base + k * 2;
      const o2 = base + ((k + 1) % SEG) * 2;
      const oy2 = (py[o] + py[o2]) / 2 - ey;
      const oz2 = (pz[o] + pz[o2]) / 2 - ez;
      faceOut(o, o2, o2 + 1, Mat.Vent, 0, oy2, oz2);
      faceOut(o, o2 + 1, o + 1, Mat.Vent, 0, oy2, oz2);
    }
  }

  const n = px.length;
  const mesh: Mesh = {
    vx: Float32Array.from(px),
    vy: Float32Array.from(py),
    vz: Float32Array.from(pz),
    nx: new Float32Array(n),
    ny: new Float32Array(n),
    nz: new Float32Array(n),
    tri: Int32Array.from(tri),
    mat: Uint8Array.from(mat),
  };

  // Smooth vertex normals, accumulated from the faces that share them. Flat
  // shading on a loft this coarse reads as a faceted gemstone, not a panel.
  for (let t = 0; t < mesh.mat.length; t++) {
    const a = mesh.tri[t * 3];
    const b = mesh.tri[t * 3 + 1];
    const c = mesh.tri[t * 3 + 2];
    const ux = mesh.vx[b] - mesh.vx[a];
    const uy = mesh.vy[b] - mesh.vy[a];
    const uz = mesh.vz[b] - mesh.vz[a];
    const wx = mesh.vx[c] - mesh.vx[a];
    const wy = mesh.vy[c] - mesh.vy[a];
    const wz = mesh.vz[c] - mesh.vz[a];
    const fx = uy * wz - uz * wy;
    const fy = uz * wx - ux * wz;
    const fz = ux * wy - uy * wx;
    for (const v of [a, b, c]) {
      mesh.nx[v] += fx;
      mesh.ny[v] += fy;
      mesh.nz[v] += fz;
    }
  }
  for (let v = 0; v < n; v++) {
    const len = Math.hypot(mesh.nx[v], mesh.ny[v], mesh.nz[v]) || 1;
    mesh.nx[v] /= len;
    mesh.ny[v] /= len;
    mesh.nz[v] /= len;
  }
  return mesh;
}

const MESH = build();

/** Stable per-particle noise; see `flames`. */
function hash(n: number): number {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/** Camera distance in car lengths. A long lens; a short one bends the nose. */
const DIST = 4.6;

export type Pose = {
  /** 0 looks the car in the face, 180 is straight up its tail. */
  azimuth: number;
  elevation: number;
  /** Centre of the car on the plane, in cells. */
  cx: number;
  cy: number;
  /** Box the car is fitted inside, in cells and rows. */
  width: number;
  height: number;
  /** Cell height ÷ cell width. */
  aspect: number;
};

export type Emitter = { c: number; r: number; dc: number; dr: number; depth: number };

export class R8 {
  private sx = new Float32Array(MESH.vx.length);
  private sy = new Float32Array(MESH.vx.length);
  private sz = new Float32Array(MESH.vx.length);
  private lum = new Float32Array(MESH.vx.length);
  private depth: Float32Array;
  private hit: Float32Array;
  private hitMat: Uint8Array;

  constructor(
    private cols: number,
    private rows: number,
  ) {
    this.depth = new Float32Array(cols * rows);
    this.hit = new Float32Array(cols * rows);
    this.hitMat = new Uint8Array(cols * rows);
  }

  /**
   * Projects and shades every vertex, then fills triangles into a depth
   * buffer. Returns where the exhaust tips landed so the flames know where to
   * start and which way to point.
   */
  render(pose: Pose): Emitter[] {
    const { cols, rows } = this;
    const { vx, vy, vz, nx, ny, nz, tri, mat } = MESH;
    const n = vx.length;

    // +180 so that azimuth 0 puts the camera in front of the car. Without it
    // the eye lands at +x, which is the tail, and "head-on" shows the spoiler.
    const az = ((pose.azimuth + 180) * Math.PI) / 180;
    const el = (pose.elevation * Math.PI) / 180;
    const ca = Math.cos(az);
    const sa = Math.sin(az);
    const ce = Math.cos(el);
    const se = Math.sin(el);

    // Camera basis. `forward` runs from the eye to the car; `right` and `up`
    // complete it. Rotating the basis rather than the mesh keeps the geometry
    // untouched between frames.
    const ex = ca * ce * DIST;
    const ey = sa * ce * DIST;
    const ez = se * DIST + 0.11;
    const fx = -ca * ce;
    const fy = -sa * ce;
    const fz = -se;
    const rx = -sa;
    const ry = ca;
    const rz = 0;
    const ux = -ca * se;
    const uy = -sa * se;
    const uz = ce;

    // Key light rides with the camera, over its left shoulder and above. A
    // fixed world light swings the whole car into shadow halfway through the
    // turn, which is the one thing a turntable must not do.
    //
    // This is the vector from the surface *to* the light, so it runs back
    // toward the camera: `-forward`. Building it as `+forward` puts the lamp
    // underneath the car shining up, which lights the sills like a runway and
    // leaves the roof black.
    const lx = -fx * 0.45 + ux * 0.62 - rx * 0.65;
    const ly = -fy * 0.45 + uy * 0.62 - ry * 0.65;
    const lz = -fz * 0.45 + uz * 0.62 - rz * 0.65;
    const llen = Math.hypot(lx, ly, lz) || 1;
    const kx = lx / llen;
    const ky = ly / llen;
    const kz = lz / llen;

    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    for (let v = 0; v < n; v++) {
      const dx = vx[v] - 0.5 - ex;
      const dy = vy[v] - ey;
      const dz = vz[v] - ez;
      const cz = dx * fx + dy * fy + dz * fz;
      const cxv = dx * rx + dy * ry + dz * rz;
      const cyv = dx * ux + dy * uy + dz * uz;
      const inv = 1 / Math.max(0.05, cz);
      const px = cxv * inv;
      const py = cyv * inv;
      this.sx[v] = px;
      this.sy[v] = py;
      this.sz[v] = cz;
      if (px < minX) minX = px;
      if (px > maxX) maxX = px;
      if (py < minY) minY = py;
      if (py > maxY) maxY = py;

      // View vector, for the rim term.
      const vlen = Math.hypot(dx, dy, dz) || 1;
      const wx = dx / vlen;
      const wy = dy / vlen;
      const wz = dz / vlen;
      const nd = nx[v] * kx + ny[v] * ky + nz[v] * kz;
      const facing = -(nx[v] * wx + ny[v] * wy + nz[v] * wz);
      // Half-vector specular, plus a rim term that lights the silhouette.
      // Against a black page the rim is what separates the car from the
      // background at all; without it a dark flank simply is the background.
      const hx = kx - wx;
      const hy = ky - wy;
      const hz = kz - wz;
      const hlen = Math.hypot(hx, hy, hz) || 1;
      const spec = Math.pow(Math.max(0, (nx[v] * hx + ny[v] * hy + nz[v] * hz) / hlen), 22);
      // The rim was a broad wash that turned the whole lower flank into one
      // white sausage. A high exponent keeps it to the last cell or two of
      // the silhouette, which is the only place it has a job.
      const rim = Math.pow(Math.max(0, 1 - Math.abs(facing)), 6);
      // A weak bounce from below, standing in for the ground. Without it the
      // sills go to pure black and the car reads as floating.
      const bounce = Math.max(0, -nz[v]) * 0.12;
      this.lum[v] = Math.max(0, nd) * 0.95 + 0.07 + bounce + spec * 0.55 + rim * 0.3;
    }

    // Fit the projection inside a box in *both* axes. Scaling on width alone
    // blows the head-on car up to a shipping container — it is only 0.44 car
    // lengths wide, so matching a long side-on view's width makes it far
    // taller than the plane. Fitting the box also does the right thing for
    // free: the car looks long when it is side-on and compact when it is not,
    // which is exactly what a real turntable does.
    const spanX = Math.max(1e-4, maxX - minX);
    const spanY = Math.max(1e-4, maxY - minY);
    const scale = Math.min(pose.width / spanX, (pose.height * pose.aspect) / spanY);
    const midX = (minX + maxX) / 2;
    const midY = (minY + maxY) / 2;
    const toCol = (px: number) => pose.cx + (px - midX) * scale;
    const toRow = (py: number) => pose.cy - ((py - midY) * scale) / pose.aspect;

    for (let v = 0; v < n; v++) {
      this.sx[v] = toCol(this.sx[v]);
      this.sy[v] = toRow(this.sy[v]);
    }

    this.depth.fill(Infinity);
    this.hit.fill(0);

    for (let t = 0; t < mat.length; t++) {
      const a = tri[t * 3];
      const b = tri[t * 3 + 1];
      const c = tri[t * 3 + 2];
      const ax = this.sx[a];
      const ay = this.sy[a];
      const bx = this.sx[b];
      const by = this.sy[b];
      const cx2 = this.sx[c];
      const cy2 = this.sy[c];
      // Signed area doubles as the back-face test: the loft is wound
      // consistently, so anything facing away has the opposite sign.
      const area = (bx - ax) * (cy2 - ay) - (by - ay) * (cx2 - ax);
      if (area <= 0) continue;
      const m = mat[t];
      const albedo = ALBEDO[m];
      const gloss = GLOSS[m];

      const x0 = Math.max(0, Math.floor(Math.min(ax, bx, cx2)));
      const x1 = Math.min(cols - 1, Math.ceil(Math.max(ax, bx, cx2)));
      const y0 = Math.max(0, Math.floor(Math.min(ay, by, cy2)));
      const y1 = Math.min(rows - 1, Math.ceil(Math.max(ay, by, cy2)));
      if (x1 < x0 || y1 < y0) continue;

      const inv = 1 / area;
      for (let r = y0; r <= y1; r++) {
        const py = r + 0.5;
        for (let cl = x0; cl <= x1; cl++) {
          const pxv = cl + 0.5;
          const w0 = ((bx - ax) * (py - ay) - (by - ay) * (pxv - ax)) * inv;
          const w1 = ((cx2 - bx) * (py - by) - (cy2 - by) * (pxv - bx)) * inv;
          const w2 = 1 - w0 - w1;
          if (w0 < 0 || w1 < 0 || w2 < 0) continue;
          // Barycentric order: w1 belongs to a, w2 to b, w0 to c.
          const z = w1 * this.sz[a] + w2 * this.sz[b] + w0 * this.sz[c];
          const i = r * cols + cl;
          if (z >= this.depth[i]) continue;
          const l = w1 * this.lum[a] + w2 * this.lum[b] + w0 * this.lum[c];
          this.depth[i] = z;
          this.hit[i] = Math.min(1.35, albedo * (0.18 + l * 0.92) + l * gloss * 0.22);
          this.hitMat[i] = m;
        }
      }
    }

    // Where the pipes ended up, and which way "out of the pipe" points once
    // projected. The flames are aimed in screen space from these, so they
    // sweep round with the car for free.
    const out: Emitter[] = [];
    for (const [ex2, ey2, ez2] of PIPES) {
      const project = (x: number, y: number, z: number) => {
        const dx = x - 0.5 - ex;
        const dy = y - ey;
        const dz = z - ez;
        const cz = dx * fx + dy * fy + dz * fz;
        const invz = 1 / Math.max(0.05, cz);
        return {
          c: toCol((dx * rx + dy * ry + dz * rz) * invz),
          r: toRow((dx * ux + dy * uy + dz * uz) * invz),
          z: cz,
        };
      };
      const tip = project(ex2, ey2, ez2);
      const away = project(ex2 + 0.25, ey2, ez2 - 0.02);
      const dc = away.c - tip.c;
      const dr = away.r - tip.r;
      const len = Math.hypot(dc, dr) || 1;
      out.push({ c: tip.c, r: tip.r, dc: dc / len, dr: dr / len, depth: tip.z });
    }
    return out;
  }

  /** Raw shaded luminance per cell; dev preview only. */
  get luma(): Float32Array {
    return this.hit;
  }

  /** Material id per cell; dev preview only. */
  get material(): Uint8Array {
    return this.hitMat;
  }

  /** Depth at a cell, for testing whether a flame particle is behind the car. */
  depthAt(c: number, r: number): number {
    if (c < 0 || c >= this.cols || r < 0 || r >= this.rows) return Infinity;
    return this.depth[r * this.cols + c];
  }

  /**
   * Exhaust flames.
   *
   * The reference is a V10 on the overrun at night, and the surprise is that
   * the flames are not orange: unburnt fuel lighting off in the pipe burns
   * violet-white. That is a gift, because act two's plum is already violet —
   * so the fire carries the previous act's colour forward instead of asking
   * the page for a fourth anchor. Black, bone and plum still covers all of it.
   *
   * Particles are emitted in *screen* space along the direction the pipe is
   * pointing, which the renderer hands back already projected, so the plume
   * swings round with the car for nothing. Each one depth-tests against the
   * car, so while the R8 is still head-on its own bodywork hides the fire.
   */
  flames(
    out: Overlay,
    emitters: Emitter[],
    heat: number,
    time: number,
    prio: Uint8Array,
    level: number,
    sheets: { core: number; mid: number; deep: number },
  ): void {
    if (heat <= 0.01) return;
    const RAMP = ['@', '#', '*', '+', '=', ':', '.'].map((c) => c.charCodeAt(0));
    const COUNT = 340;
    const scale = this.cols / 120;
    const reach = (8 + 17 * heat) * scale;
    for (let e = 0; e < emitters.length; e++) {
      const em = emitters[e];
      // Perpendicular to the plume, for the spread.
      const qc = -em.dr;
      const qr = em.dc;
      for (let i = 0; i < COUNT; i++) {
        // Hashed rather than stored: the plume has to be identical on every
        // frame at a given scroll position, or scrubbing back and forth
        // reshuffles it and the reversibility the whole page runs on breaks.
        const h1 = hash(i * 2.17 + e * 91.3);
        const h2 = hash(i * 7.31 + e * 13.7);
        const h3 = hash(i * 3.91 + e * 51.1);
        const u = Math.pow(h1, 1.4);
        if (u > heat * 1.15) continue;
        const flick = Math.sin(time * (2.2 + h3 * 3.4) + h2 * 6.28);
        const len = u * reach;
        const off = ((h2 - 0.5) * (1.3 + u * 5.4) + flick * u * 1.9) * scale;
        const c = Math.round(em.c + em.dc * len + qc * off);
        const r = Math.round(em.r + em.dr * len + qr * off);
        if (c < 0 || c >= this.cols || r < 0 || r >= this.rows) continue;
        // Fire coming out of the back of a car that is facing us is behind it.
        if (em.depth - u * 0.3 >= this.depthAt(c, r)) continue;
        const fall = Math.pow(1 - u, 1.15);
        const a = Math.min(1, fall * (0.55 + 0.45 * flick) * heat * 1.6);
        if (a < 0.08) continue;
        const i2 = r * this.cols + c;
        if (prio[i2] > level) continue;
        out.char[i2] = RAMP[Math.min(RAMP.length - 1, Math.floor((1 - fall) * RAMP.length))];
        out.sheet[i2] = fall > 0.88 ? sheets.core : fall > 0.50 ? sheets.mid : sheets.deep;
        out.alpha[i2] = Math.max(out.alpha[i2], a);
        prio[i2] = level;
      }
    }
  }

  /** Writes the shaded car into the overlay through the page's density ramp. */
  paint(out: Overlay, ramp: number[], alpha: number, prio: Uint8Array, level: number): void {
    const cells = this.cols * this.rows;
    for (let i = 0; i < cells; i++) {
      const l = this.hit[i];
      if (l <= 0.02) continue;
      const m = this.hitMat[i];
      // Density carries the tone and the sheet carries the temperature. Doing
      // it with density alone loses the dark materials; doing it with colour
      // alone throws away the ramp the whole page is drawn with.
      const g = Math.min(ramp.length - 1, Math.floor(Math.pow(Math.min(1, l), 0.68) * ramp.length));
      const sheet =
        m === Mat.Lamp || l > 0.86
          ? Sheet.Display
          : l > 0.58
            ? Sheet.Ink
            : l > 0.32
              ? Sheet.Dim
              : Sheet.Muted;
      if (prio[i] > level) continue;
      out.char[i] = ramp[g];
      out.sheet[i] = sheet;
      out.alpha[i] = Math.min(1, alpha * (0.58 + 0.42 * Math.min(1, l)));
      prio[i] = level;
    }
  }
}
