// GPX parsing and route statistics. Pure TypeScript (no DOM), so it runs in the browser and in
// Node (`npm run check`).

export const T_GRADES = ["T1", "T2", "T3", "T4", "T5", "T6"] as const;
export type TGrade = (typeof T_GRADES)[number];
// Written by scripts/route.mjs: SAC grades from OSM sac_scale, plus via ferrata,
// paths without a grade, and roads/tracks.
export type GradeClass = TGrade | "via_ferrata" | "path" | "road";
export type Run = { cls: GradeClass; from: number; to: number };

export type Point = { lat: number; lon: number; ele: number | null; dist: number };

export type Track = {
  name: string;
  points: Point[];
  // Cumulative climb and descent up to each point (same filter as the totals), for partial times.
  upTo: number[];
  downTo: number[];
  distanceKm: number;
  ascentM: number;
  descentM: number;
  minEle: number | null;
  maxEle: number | null;
  hikingHours: number;
  grade: TGrade | null; // hardest T grade, as written by route.mjs
  meters: Partial<Record<GradeClass, number>>;
  runs: Run[];
  // Point ranges of the separate walking legs: one for a single GPX, several when a day's legs
  // (say, with a taxi in between) are joined by joinTracks.
  teile: { from: number; to: number }[];
};

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
const decode = (s: string) => s.replace(/&(amp|lt|gt|quot|apos);/g, (_, e: string) => ENTITIES[e]);
const attr = (attrs: string, name: string) =>
  attrs.match(new RegExp(`\\b${name}\\s*=\\s*["']([^"']*)["']`))?.[1];

const toRad = (d: number) => (d * Math.PI) / 180;
export function haversineM(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  const h =
    Math.sin(toRad(b.lat - a.lat) / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(toRad(b.lon - a.lon) / 2) ** 2;
  return 12_742_000 * Math.asin(Math.sqrt(h));
}

// Elevation from the terrain model jitters, so a climb or descent only counts once it exceeds
// this threshold. 10 m keeps us close to BRouter's own "filtered ascend", which the planner prints.
export const ELEVATION_THRESHOLD_M = 10;

function cumulativeClimb(points: Point[]) {
  const upTo: number[] = [];
  const downTo: number[] = [];
  let up = 0;
  let down = 0;
  let ref: number | null = null;
  for (const p of points) {
    if (p.ele != null) {
      if (ref == null) ref = p.ele;
      const diff = p.ele - ref;
      if (diff >= ELEVATION_THRESHOLD_M) {
        up += diff;
        ref = p.ele;
      } else if (diff <= -ELEVATION_THRESHOLD_M) {
        down -= diff;
        ref = p.ele;
      }
    }
    upTo.push(up);
    downTo.push(down);
  }
  return { upTo, downTo };
}

// DIN 33466 / Alpine club rule: 4 km/h on the flat, 300 m/h up, 500 m/h down;
// total = the larger part + half of the smaller part. Pure walking time, no breaks.
export function hikingTime(km: number, up: number, down: number) {
  const horizontal = km / 4;
  const vertical = up / 300 + down / 500;
  return Math.max(horizontal, vertical) + Math.min(horizontal, vertical) / 2;
}

// Walking time from the start of the track to point i. Grows monotonically along the track and
// equals the full stage time at the last point. Each walking leg is timed on its own.
export function hoursTo(track: Track, i: number) {
  let h = 0;
  for (const t of track.teile) {
    const j = Math.min(i, t.to);
    const a = track.points[t.from];
    const b = track.points[j];
    h += hikingTime((b.dist - a.dist) / 1000, track.upTo[j] - track.upTo[t.from], track.downTo[j] - track.downTo[t.from]);
    if (i <= t.to) break;
  }
  return h;
}

const gradeIndex = (g: TGrade | null) => (g ? T_GRADES.indexOf(g) : -1);

// The walking legs of one day as one track. Distance and climb carry on across a transfer
// without counting it, so km, Höhenmeter and times are the sums of the legs; `teile` keeps
// where each leg starts, for drawing them apart and for the timeline.
export function joinTracks(tracks: Track[]): Track {
  if (tracks.length === 1) return tracks[0];
  const points: Point[] = [];
  const upTo: number[] = [];
  const downTo: number[] = [];
  const runs: Run[] = [];
  const teile: Track["teile"] = [];
  const meters: Partial<Record<GradeClass, number>> = {};
  let grade: TGrade | null = null;
  let hikingHours = 0;
  let minEle: number | null = null;
  let maxEle: number | null = null;
  for (const t of tracks) {
    const off = points.length;
    const dist0 = points.at(-1)?.dist ?? 0;
    const up0 = upTo.at(-1) ?? 0;
    const down0 = downTo.at(-1) ?? 0;
    t.points.forEach((p, i) => {
      points.push({ ...p, dist: dist0 + p.dist });
      upTo.push(up0 + t.upTo[i]);
      downTo.push(down0 + t.downTo[i]);
    });
    for (const r of t.runs) runs.push({ cls: r.cls, from: r.from + off, to: r.to + off });
    for (const [k, m] of Object.entries(t.meters) as [GradeClass, number][]) meters[k] = (meters[k] ?? 0) + m;
    if (gradeIndex(t.grade) > gradeIndex(grade)) grade = t.grade;
    hikingHours += t.hikingHours;
    if (t.minEle != null) minEle = minEle == null ? t.minEle : Math.min(minEle, t.minEle);
    if (t.maxEle != null) maxEle = maxEle == null ? t.maxEle : Math.max(maxEle, t.maxEle);
    teile.push({ from: off, to: points.length - 1 });
  }
  return {
    name: tracks.map((t) => t.name).join(" + "),
    points,
    upTo,
    downTo,
    distanceKm: (points.at(-1)?.dist ?? 0) / 1000,
    ascentM: Math.round(upTo.at(-1) ?? 0),
    descentM: Math.round(downTo.at(-1) ?? 0),
    minEle,
    maxEle,
    hikingHours,
    grade,
    meters,
    runs,
    teile,
  };
}

export function parseGpx(xml: string): Track {
  const points: Point[] = [];
  for (const m of xml.matchAll(/<(trkpt|rtept)\b([^>]*?)(?:\/>|>([\s\S]*?)<\/\1>)/g)) {
    const lat = Number(attr(m[2], "lat"));
    const lon = Number(attr(m[2], "lon"));
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    const eleText = m[3]?.match(/<ele>([^<]*)<\/ele>/)?.[1];
    const eleNum = eleText != null && eleText.trim() !== "" ? Number(eleText) : NaN;
    const prev = points[points.length - 1];
    const p: Point = { lat, lon, ele: Number.isFinite(eleNum) ? eleNum : null, dist: 0 };
    p.dist = prev ? prev.dist + haversineM(prev, p) : 0;
    points.push(p);
  }

  const name = decode(xml.match(/<trk\b[^>]*>[\s\S]*?<name>([\s\S]*?)<\/name>/)?.[1]?.trim() ?? "");

  // <tp:difficulty grade="T3"> with <tp:section class meters/> and <tp:run class from to/>
  const meters: Partial<Record<GradeClass, number>> = {};
  const runs: Run[] = [];
  let grade: TGrade | null = null;
  const diff = xml.match(/<(?:[\w-]+:)?difficulty\b([^>]*)>([\s\S]*?)<\/(?:[\w-]+:)?difficulty>/);
  if (diff) {
    const g = attr(diff[1], "grade");
    grade = (T_GRADES as readonly string[]).includes(g ?? "") ? (g as TGrade) : null;
    for (const s of diff[2].matchAll(/<(?:[\w-]+:)?section\b([^>]*?)\/>/g)) {
      const cls = attr(s[1], "class") as GradeClass | undefined;
      const m = Number(attr(s[1], "meters"));
      if (cls && Number.isFinite(m)) meters[cls] = m;
    }
    for (const r of diff[2].matchAll(/<(?:[\w-]+:)?run\b([^>]*?)\/>/g)) {
      const cls = attr(r[1], "class") as GradeClass | undefined;
      const from = Number(attr(r[1], "from"));
      const to = Number(attr(r[1], "to"));
      if (cls && Number.isInteger(from) && Number.isInteger(to) && to <= points.length - 1) {
        runs.push({ cls, from, to });
      }
    }
  }

  const { upTo, downTo } = cumulativeClimb(points);
  const distanceKm = (points.at(-1)?.dist ?? 0) / 1000;
  const ascentM = Math.round(upTo.at(-1) ?? 0);
  const descentM = Math.round(downTo.at(-1) ?? 0);
  let minEle: number | null = null;
  let maxEle: number | null = null;
  for (const p of points) {
    if (p.ele == null) continue;
    minEle = minEle == null ? p.ele : Math.min(minEle, p.ele);
    maxEle = maxEle == null ? p.ele : Math.max(maxEle, p.ele);
  }

  return {
    name,
    points,
    upTo,
    downTo,
    distanceKm,
    ascentM,
    descentM,
    minEle,
    maxEle,
    hikingHours: hikingTime(distanceKm, upTo.at(-1) ?? 0, downTo.at(-1) ?? 0),
    grade,
    meters,
    runs,
    teile: [{ from: 0, to: Math.max(0, points.length - 1) }],
  };
}

// Index of the track point closest to a place, searching forward from `from` so that
// out-and-back routes keep their order.
export function nearestIndex(track: Track, lat: number, lon: number, from = 0) {
  let best = from;
  let bestD = Infinity;
  for (let i = from; i < track.points.length; i++) {
    const d = haversineM(track.points[i], { lat, lon });
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return { index: best, distM: bestD };
}
