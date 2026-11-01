#!/usr/bin/env node
// Fetch lake outlines from OpenStreetMap for a trip's route drawing and save them as
// content/touren/<tour>/karte.geojson (outer rings only, simplified).
//
// Usage: node scripts/osm-wasser.mjs <tour> <süd,west,nord,ost> "<Name>" ["<Name>" ...]
// Example: node scripts/osm-wasser.mjs pyrenaeen 42.63,-0.17,42.80,0.05 "Barage d'Ossoue"

import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const [tour, bbox, ...names] = process.argv.slice(2);
if (!tour || !bbox || names.length === 0) {
  console.error('Usage: node scripts/osm-wasser.mjs <tour> <süd,west,nord,ost> "<Name>" [...]');
  process.exit(1);
}
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const out = path.join(root, "content", "touren", tour, "karte.geojson");

const esc = (s) => s.replace(/[\\^$.*+?()[\]{}|]/g, "\\$&");
const query = `[out:json][timeout:60];
nwr["natural"="water"]["name"~"^(${names.map(esc).join("|")})$"](${bbox});
out geom;`;

// The public Overpass servers are often busy, so try a few mirrors.
const SERVERS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
];
let elements;
for (const server of SERVERS) {
  try {
    const res = await fetch(server, {
      method: "POST",
      headers: { "User-Agent": "tour-planner-prototype (hobby project)" },
      body: new URLSearchParams({ data: query }),
      signal: AbortSignal.timeout(90000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    ({ elements } = await res.json());
    break;
  } catch (e) {
    console.error(`${new URL(server).host}: ${e.message}`);
  }
}
if (!elements) process.exit(1);

const key = (p) => `${p[0]},${p[1]}`;
const toCoords = (geometry) => geometry.map((g) => [g.lon, g.lat]);

// Join the outer ways of a multipolygon into closed rings.
function rings(ways) {
  const pending = ways.map((w) => [...w]);
  const result = [];
  while (pending.length) {
    let ring = pending.shift();
    let grew = true;
    while (key(ring[0]) !== key(ring.at(-1)) && grew) {
      grew = false;
      for (let i = 0; i < pending.length; i++) {
        const w = pending[i];
        if (key(w[0]) === key(ring.at(-1))) ring = [...ring, ...w.slice(1)];
        else if (key(w.at(-1)) === key(ring.at(-1))) ring = [...ring, ...[...w].reverse().slice(1)];
        else continue;
        pending.splice(i, 1);
        grew = true;
        break;
      }
    }
    if (key(ring[0]) === key(ring.at(-1))) result.push(ring);
    else console.error("Skipping an outer ring that does not close");
  }
  return result;
}

// Douglas–Peucker in metres, keeps the file small.
function simplify(coords, tolM = 8) {
  if (coords.length <= 3) return coords;
  const kx = 111320 * Math.cos((coords[0][1] * Math.PI) / 180);
  const ky = 110540;
  const p = coords.map(([lon, lat]) => [lon * kx, lat * ky]);
  const keep = new Uint8Array(coords.length);
  keep[0] = keep[coords.length - 1] = 1;
  const stack = [[0, coords.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    const [ax, ay] = p[a];
    const [bx, by] = p[b];
    const len2 = (bx - ax) ** 2 + (by - ay) ** 2;
    let maxD = 0;
    let idx = -1;
    for (let i = a + 1; i < b; i++) {
      const [x, y] = p[i];
      const t = len2 ? Math.max(0, Math.min(1, ((x - ax) * (bx - ax) + (y - ay) * (by - ay)) / len2)) : 0;
      const d = Math.hypot(x - (ax + t * (bx - ax)), y - (ay + t * (by - ay)));
      if (d > maxD) [maxD, idx] = [d, i];
    }
    if (idx > 0 && maxD > tolM) {
      keep[idx] = 1;
      stack.push([a, idx], [idx, b]);
    }
  }
  return coords.filter((_, i) => keep[i]).map(([lon, lat]) => [+lon.toFixed(5), +lat.toFixed(5)]);
}

const features = [];
for (const e of elements) {
  let outer = [];
  if (e.type === "way" && e.geometry) outer = [toCoords(e.geometry)];
  if (e.type === "relation") {
    outer = rings(e.members.filter((m) => m.type === "way" && m.role === "outer" && m.geometry).map((m) => toCoords(m.geometry)));
  }
  if (!outer.length) continue;
  features.push({
    type: "Feature",
    properties: { name: e.tags.name, osm: `${e.type}/${e.id}` },
    geometry: { type: "MultiPolygon", coordinates: outer.map((r) => [simplify(r)]) },
  });
  console.log(`${e.tags.name}: ${outer.length} ring(s), ${outer.reduce((n, r) => n + simplify(r).length, 0)} points`);
}

await writeFile(
  out,
  JSON.stringify({ type: "FeatureCollection", attribution: "© OpenStreetMap-Mitwirkende, ODbL", features }) + "\n",
);
console.log(`Saved ${path.relative(process.cwd(), out)}`);
