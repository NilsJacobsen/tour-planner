#!/usr/bin/env node
// List huts near a point via Overpass (OpenStreetMap).
//
// Usage: node scripts/huts.mjs <lat,lon> [radiusKm=8]
// Shows alpine huts (staffed) and wilderness huts / shelters (usually unstaffed).

const [point, radiusArg] = process.argv.slice(2);
const [lat, lon] = (point ?? "").split(",").map(Number);
if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
  console.error("Usage: node scripts/huts.mjs <lat,lon> [radiusKm]");
  process.exit(1);
}
const radius = Number(radiusArg ?? 8) * 1000;

const query = `[out:json][timeout:25];
nwr["tourism"~"^(alpine_hut|wilderness_hut)$"](around:${radius},${lat},${lon});
out center tags;`;

// The public Overpass servers are often busy, so try a few mirrors before giving up.
const SERVERS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
];
let elements;
const failures = [];
for (const [i, server] of SERVERS.entries()) {
  if (i > 0) await new Promise((r) => setTimeout(r, 1000));
  try {
    const res = await fetch(server, {
      method: "POST",
      headers: { "User-Agent": "tour-planner-prototype (hobby project)" },
      body: new URLSearchParams({ data: query }),
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    ({ elements } = await res.json());
    break;
  } catch (e) {
    failures.push(`${new URL(server).host}: ${e.message}`);
  }
}
if (!elements) {
  console.error(`All Overpass servers failed:\n  ${failures.join("\n  ")}`);
  process.exit(1);
}

const toRad = (d) => (d * Math.PI) / 180;
const distKm = (a, b) => {
  const h = Math.sin(toRad(b.lat - a.lat) / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(toRad(b.lon - a.lon) / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
};

const huts = elements
  .map((e) => ({ ...(e.center ?? e), tags: e.tags ?? {} }))
  .filter((h) => h.tags.name)
  .map((h) => ({ ...h, km: distKm({ lat, lon }, h) }))
  .sort((a, b) => a.km - b.km);

if (huts.length === 0) console.log("No named huts found.");
for (const h of huts) {
  const t = h.tags;
  const kind = t.tourism === "alpine_hut" ? "hut" : "shelter";
  const extra = [t.ele && `${t.ele} m`, t.operator, t.beds && `${t.beds} beds`, t.opening_hours, t.website ?? t["contact:website"]]
    .filter(Boolean)
    .join(" · ");
  console.log(`${h.km.toFixed(1).padStart(5)} km  ${h.lat.toFixed(5)},${h.lon.toFixed(5)}  [${kind}] ${t.name}${extra ? ` — ${extra}` : ""}`);
}
