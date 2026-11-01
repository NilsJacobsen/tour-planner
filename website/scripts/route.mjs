#!/usr/bin/env node
// Route one walking leg through BRouter and save it as GPX in a trip's routen/ folder.
//
// Usage:
//   node scripts/route.mjs <file-slug> "<title>" <lat,lon> <lat,lon> [...more waypoints]
//     --tour <trip-slug> | --out <dir>   [--profile hiking-mountain] [--sac 4] [--straight 3,4]
//
// Example: node scripts/route.mjs tag-2 "Tag 2" 42.77940,-0.12415 42.77929,-0.13135 42.79292,-0.14143 --tour pyrenaeen
//   → content/touren/pyrenaeen/routen/tag-2.gpx
//
// Waypoints are lat,lon (the order Google Maps / Nominatim show them).
// Profiles on brouter.de: hiking-mountain (default), trekking, shortest.
// --tour writes into content/touren/<trip>/routen/; --out writes into any folder (e.g. a scratch
// folder to try a route before it goes into the trip).
// --sac raises the hardest SAC grade the profile may use (hiking-mountain stops at T3, so a pass
// graded T4 makes it detour for kilometres). Only for a stretch you mean to take: the GPX then
// carries the higher grade and the trip site flags it against the group's limit.
// --straight draws the segments starting at these waypoint indices (0 = first) as straight lines,
// with elevation from the terrain model. Only to bridge a short gap BRouter can't route (say, a
// signed detour OSM still tags as closed): put the waypoints on the real path, close together.
// Those metres count as a path without grade.
//
// The GPX gets a <tp:difficulty> extension with metres per SAC grade (T1–T6), via ferrata,
// ungraded paths and roads (<tp:section>), plus where each grade lies along the track
// (<tp:run from to> as point indices). The day's grade is its hardest section.

import { writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const BROUTER = process.env.BROUTER_URL ?? "https://brouter.de/brouter";

const args = process.argv.slice(2);
const option = (name) => {
  const i = args.indexOf(name);
  return i === -1 ? undefined : args.splice(i, 2)[1];
};
const profile = option("--profile") ?? "hiking-mountain";
const sac = option("--sac");
const straight = option("--straight");
if (straight != null && !/^\d+(,\d+)*$/.test(straight)) {
  console.error(`--straight expects waypoint indices like 3,4,5, got ${straight}`);
  process.exit(1);
}
if (sac != null && !/^[1-6]$/.test(sac)) {
  console.error(`--sac expects 1–6 (T1–T6), got ${sac}`);
  process.exit(1);
}
const outArg = option("--out");
const tourArg = option("--tour");
if (!outArg && !tourArg) {
  console.error("Where should the GPX go? Add --tour <trip-slug> (its routen/ folder) or --out <dir>.");
  process.exit(1);
}
const tracksDir = outArg
  ? path.resolve(outArg)
  : path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "content", "touren", tourArg, "routen");

const [slug, title, ...points] = args;
if (!slug || !title || points.length < 2) {
  console.error(
    'Usage: node scripts/route.mjs <file-slug> "<title>" <lat,lon> <lat,lon> [...] --tour <trip-slug> | --out <dir> [--profile hiking-mountain] [--sac 4] [--straight 3,4]',
  );
  process.exit(1);
}
if (!/^[a-z0-9-]+$/.test(slug)) {
  console.error(`Slug must be lowercase letters, digits and dashes: ${slug}`);
  process.exit(1);
}

const waypoints = points.map((p) => {
  const [lat, lon] = p.split(",").map(Number);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
    console.error(`Bad waypoint "${p}", expected lat,lon`);
    process.exit(1);
  }
  return { lat, lon };
});

const lonlats = waypoints.map((w) => `${w.lon},${w.lat}`).join("|");
// GeoJSON instead of GPX: same track, plus the OSM tags of every way used,
// which gives us trail grades and lets us flag via ferratas.
const url =
  `${BROUTER}?lonlats=${lonlats}&profile=${encodeURIComponent(profile)}&alternativeidx=0&format=geojson` +
  (sac ? `&profile:SAC_scale_limit=${sac}` : "") +
  (straight ? `&straight=${straight}` : "");

const res = await fetch(url);
const body = await res.text();
let feature;
try {
  feature = JSON.parse(body).features[0];
} catch {
  // BRouter returns a plain-text reason, e.g. "from-position not mapped in existing datafile"
  console.error(`BRouter failed (${res.status}): ${body.trim().slice(0, 300)}`);
  process.exit(1);
}
const props = feature.properties;
const coords = feature.geometry.coordinates; // [lon, lat, ele]

// --- Trail difficulty (OSM sac_scale = SAC hiking scale T1–T6)
const SAC = {
  hiking: "T1",
  mountain_hiking: "T2",
  demanding_mountain_hiking: "T3",
  alpine_hiking: "T4",
  demanding_alpine_hiking: "T5",
  difficult_alpine_hiking: "T6",
};
const LABEL = {
  T1: "T1 hiking",
  T2: "T2 mountain hiking",
  T3: "T3 demanding mountain hiking",
  T4: "T4 alpine hiking",
  T5: "T5 demanding alpine hiking",
  T6: "T6 difficult alpine hiking",
  via_ferrata: "via ferrata",
  path: "path without grade",
  road: "road / track",
};
const [header, ...segments] = props.messages;
const tagsCol = header.indexOf("WayTags");
const distCol = header.indexOf("Distance");
const lonCol = header.indexOf("Longitude");
const latCol = header.indexOf("Latitude");
const meters = {};
let badVisibilityM = 0;

// Each message row is one stretch of way with the same tags; its Longitude/Latitude (in millionths
// of a degree) is where the stretch ends. Find that point in the track to know which points belong
// to which grade: runs of { cls, from, to } as point indices.
const runs = [];
let cursor = 0;
const endIndex = (lon, lat) => {
  let best = -1;
  let bestD = Infinity;
  for (let i = cursor; i < coords.length; i++) {
    const d = Math.abs(Math.round(coords[i][0] * 1e6) - lon) + Math.abs(Math.round(coords[i][1] * 1e6) - lat);
    if (d === 0) return i;
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
};

for (const seg of segments) {
  const tags = Object.fromEntries(seg[tagsCol].split(" ").map((kv) => kv.split("=")));
  const dist = Number(seg[distCol]);
  const cls =
    tags.highway === "via_ferrata" || tags.via_ferrata_scale
      ? "via_ferrata"
      : SAC[tags.sac_scale] ?? (tags.highway === "path" || tags.direct_segment ? "path" : "road");
  meters[cls] = (meters[cls] ?? 0) + dist;
  if (/bad|horrible|no/.test(tags.trail_visibility ?? "")) badVisibilityM += dist;

  const end = endIndex(Number(seg[lonCol]), Number(seg[latCol]));
  if (end > cursor) {
    const last = runs.at(-1);
    if (last && last.cls === cls) last.to = end;
    else runs.push({ cls, from: cursor, to: end });
    cursor = end;
  }
}
const grades = ["T1", "T2", "T3", "T4", "T5", "T6"].filter((g) => meters[g]);
const dayGrade = grades.at(-1) ?? null; // the day is as hard as its hardest section

// --- Write GPX
const escape = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const desc = `Routed via BRouter (${profile}${sac ? `, SAC limit T${sac}` : ""}${straight ? `, straight from waypoints ${straight}` : ""}) through ${waypoints.map((w) => `${w.lat},${w.lon}`).join(" → ")}`;
const trkpts = coords
  .map(([lon, lat, ele]) => `   <trkpt lat="${lat}" lon="${lon}">${ele != null ? `<ele>${ele}</ele>` : ""}</trkpt>`)
  .join("\n");
// <tp:section> = metres per grade (summary); <tp:run> = where each grade lies (point indices).
const difficulty = [
  ...Object.entries(meters).map(([cls, m]) => `    <tp:section class="${cls}" meters="${m}"/>`),
  ...runs.map((r) => `    <tp:run class="${r.cls}" from="${r.from}" to="${r.to}"/>`),
].join("\n");
const gpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx xmlns="http://www.topografix.com/GPX/1/1" xmlns:tp="urn:tour-planner:gpx:1" creator="tour-planner (BRouter)" version="1.1">
 <trk>
  <name>${escape(title)}</name>
  <desc>${escape(desc)}</desc>
  <extensions>
   <tp:difficulty grade="${dayGrade ?? ""}" source="OpenStreetMap sac_scale via BRouter">
${difficulty}
   </tp:difficulty>
  </extensions>
  <trkseg>
${trkpts}
  </trkseg>
 </trk>
</gpx>
`;

await mkdir(tracksDir, { recursive: true });
await writeFile(path.join(tracksDir, `${slug}.gpx`), gpx);

// --- Report
const mins = Math.round(Number(props["total-time"]) / 60);
console.log(`Saved ${path.relative(process.cwd(), path.join(tracksDir, `${slug}.gpx`))}`);
console.log(
  `  ${(Number(props["track-length"]) / 1000).toFixed(1)} km · ↑ ${props["filtered ascend"]} m · BRouter time ${Math.floor(mins / 60)}h ${mins % 60}m · ${coords.length} points`,
);
console.log(`  Day grade: ${dayGrade ?? "unknown (no graded paths)"}`);
for (const [cls, m] of Object.entries(meters).sort((a, b) => b[1] - a[1])) {
  console.log(`    ${String(m).padStart(6)} m  ${LABEL[cls]}`);
}
const warnings = [];
if (meters.via_ferrata) warnings.push(`${meters.via_ferrata} m of via ferrata`);
for (const g of ["T4", "T5", "T6"]) if (meters[g]) warnings.push(`${meters[g]} m of ${LABEL[g]}`);
if (badVisibilityM) warnings.push(`${badVisibilityM} m with bad trail visibility`);
if ((meters.path ?? 0) > 500) warnings.push(`${meters.path} m of paths without a grade in OSM — difficulty unknown`);
if (warnings.length) {
  console.log("  ⚠ CHECK BEFORE USING THIS ROUTE:");
  for (const w of warnings) console.log(`    ${w}`);
}
