// Smoothing for the route drawing (not for the maps, which stay exact).
// Works in screen pixels, so the result looks the same at any drawing size:
//   1. resample the line at a fixed step,
//   2. Gaussian blur along the line (first and last point stay put, so days still meet at the huts),
//   3. drop points that no longer matter,
//   4. draw centripetal Catmull–Rom curves through the rest instead of straight segments.

export type P = [number, number];

export type Glaettung = { schritt: number; sigma: number }; // both in px

export const GLAETTUNG = {
  aus: null,
  leicht: { schritt: 1.5, sigma: 2 },
  stark: { schritt: 1.5, sigma: 5 },
} as const satisfies Record<string, Glaettung | null>;
export type GlaettungsStufe = keyof typeof GLAETTUNG;

function resample(pts: P[], step: number): P[] {
  const out: P[] = [pts[0]];
  let rest = 0; // distance walked since the last emitted point
  for (let i = 1; i < pts.length; i++) {
    let [ax, ay] = pts[i - 1];
    const [bx, by] = pts[i];
    let seg = Math.hypot(bx - ax, by - ay);
    while (rest + seg >= step) {
      const t = (step - rest) / seg;
      ax += (bx - ax) * t;
      ay += (by - ay) * t;
      out.push([ax, ay]);
      seg = Math.hypot(bx - ax, by - ay);
      rest = 0;
    }
    rest += seg;
  }
  const last = pts[pts.length - 1];
  const prev = out[out.length - 1];
  if (prev[0] !== last[0] || prev[1] !== last[1]) out.push(last);
  return out;
}

// Gaussian blur along the line. The window shrinks symmetrically towards the ends, so the end
// points keep their exact position and the curve eases into them.
function blur(pts: P[], sigma: number): P[] {
  if (sigma <= 0 || pts.length < 3) return pts;
  const r = Math.ceil(sigma * 2.5);
  const w = Array.from({ length: 2 * r + 1 }, (_, k) => Math.exp(-((k - r) ** 2) / (2 * sigma * sigma)));
  return pts.map((_, i) => {
    const rr = Math.min(r, i, pts.length - 1 - i);
    let sx = 0;
    let sy = 0;
    let sw = 0;
    for (let k = -rr; k <= rr; k++) {
      const wk = w[k + r];
      sx += pts[i + k][0] * wk;
      sy += pts[i + k][1] * wk;
      sw += wk;
    }
    return [sx / sw, sy / sw];
  });
}

// Douglas–Peucker in pixels (also used for the deliberately angular day profiles).
export function simplify(pts: P[], tol: number): P[] {
  if (pts.length <= 2) return pts;
  const keep = new Uint8Array(pts.length);
  keep[0] = 1;
  keep[pts.length - 1] = 1;
  const stack: [number, number][] = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop()!;
    const [ax, ay] = pts[a];
    const [bx, by] = pts[b];
    const len2 = (bx - ax) ** 2 + (by - ay) ** 2;
    let maxD = 0;
    let idx = -1;
    for (let i = a + 1; i < b; i++) {
      const [x, y] = pts[i];
      const t = len2 ? Math.max(0, Math.min(1, ((x - ax) * (bx - ax) + (y - ay) * (by - ay)) / len2)) : 0;
      const d = Math.hypot(x - (ax + t * (bx - ax)), y - (ay + t * (by - ay)));
      if (d > maxD) {
        maxD = d;
        idx = i;
      }
    }
    if (idx > 0 && maxD > tol) {
      keep[idx] = 1;
      stack.push([a, idx], [idx, b]);
    }
  }
  return pts.filter((_, i) => keep[i]);
}

export function glaetten(pts: P[], g: Glaettung | null): P[] {
  if (!g || pts.length < 3) return pts;
  return simplify(blur(resample(pts, g.schritt), g.sigma / g.schritt), 0.3);
}

const f = (n: number) => +n.toFixed(1);

// SVG path: straight segments without smoothing, centripetal Catmull–Rom curves with it
// (centripetal = no loops or overshoot at sharp bends; same maths as d3's curveCatmullRom.alpha(0.5)).
export function pfad(p: P[], kurven: boolean): string {
  if (p.length === 0) return "";
  if (!kurven || p.length < 3) return p.map(([x, y], i) => `${i ? "L" : "M"}${f(x)},${f(y)}`).join("");
  let d = `M${f(p[0][0])},${f(p[0][1])}`;
  for (let i = 0; i < p.length - 1; i++) {
    const p0 = p[i - 1] ?? p[i];
    const p1 = p[i];
    const p2 = p[i + 1];
    const p3 = p[i + 2] ?? p2;
    const d01 = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]);
    const d12 = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
    const d23 = Math.hypot(p3[0] - p2[0], p3[1] - p2[1]);
    const [a01, a12, a23] = [Math.sqrt(d01), Math.sqrt(d12), Math.sqrt(d23)];
    let [c1x, c1y, c2x, c2y] = [p1[0], p1[1], p2[0], p2[1]];
    if (a01 > 1e-6) {
      const a = 2 * d01 + 3 * a01 * a12 + d12;
      const n = 3 * a01 * (a01 + a12);
      c1x = (p1[0] * a - p0[0] * d12 + p2[0] * d01) / n;
      c1y = (p1[1] * a - p0[1] * d12 + p2[1] * d01) / n;
    }
    if (a23 > 1e-6) {
      const b = 2 * d23 + 3 * a23 * a12 + d12;
      const m = 3 * a23 * (a23 + a12);
      c2x = (p2[0] * b + p1[0] * d23 - p3[0] * d12) / m;
      c2y = (p2[1] * b + p1[1] * d23 - p3[1] * d12) / m;
    }
    d += `C${f(c1x)},${f(c1y)} ${f(c2x)},${f(c2y)} ${f(p2[0])},${f(p2[1])}`;
  }
  return d;
}

// Point halfway along the line (for the day number badge), so it sits on the smoothed line.
export function mitte(p: P[]): P {
  let total = 0;
  for (let i = 1; i < p.length; i++) total += Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]);
  let walked = 0;
  for (let i = 1; i < p.length; i++) {
    const seg = Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]);
    if (walked + seg >= total / 2) {
      const t = seg ? (total / 2 - walked) / seg : 0;
      return [p[i - 1][0] + (p[i][0] - p[i - 1][0]) * t, p[i - 1][1] + (p[i][1] - p[i - 1][1]) * t];
    }
    walked += seg;
  }
  return p[0];
}
