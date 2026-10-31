#!/usr/bin/env node
// Look up coordinates for a place, hut or summit via Nominatim (OpenStreetMap).
//
// Usage: node scripts/find.mjs "Pfeishütte" [more queries...]
// Nominatim allows max 1 request per second, so queries run one after another.

const UA = "tour-planner-prototype (hobby project)";
const queries = process.argv.slice(2);
if (queries.length === 0) {
  console.error('Usage: node scripts/find.mjs "<place name>" [...]');
  process.exit(1);
}

for (const [i, q] of queries.entries()) {
  if (i > 0) await new Promise((r) => setTimeout(r, 1100));
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=3&extratags=1`;
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  const hits = res.ok ? await res.json() : [];
  console.log(`\n${q}`);
  if (hits.length === 0) console.log("  (no results)");
  for (const h of hits) {
    const ele = h.extratags?.ele ? ` · ${h.extratags.ele} m` : "";
    console.log(`  ${Number(h.lat).toFixed(5)},${Number(h.lon).toFixed(5)}  [${h.type}${ele}] ${h.display_name}`);
  }
}
