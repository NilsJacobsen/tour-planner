// npm run check — validates all content with the same code the site uses (src/content/model.ts)
// and prints a short overview per trip. Exits with 1 if there are errors.
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildSite } from "../src/content/model.ts";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const files: Record<string, string> = {};
const walk = (dir: string) => {
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.(md|ya?ml|gpx|geojson)$/.test(name)) files[path.relative(root, p).split(path.sep).join("/")] = readFileSync(p, "utf8");
  }
};
walk(path.join(root, "content"));

const { site, issues } = buildSite(files);

// Placeholders from scripts/neue-tour.mjs: a trip isn't done while any "TODO" is left.
for (const [datei, inhalt] of Object.entries(files)) {
  if (!/\.(md|ya?ml)$/.test(datei)) continue;
  inhalt.split("\n").forEach((zeile, i) => {
    if (/\bTODO\b/.test(zeile)) issues.push({ level: "fehler", datei: `${datei}:${i + 1}`, text: `noch offen: ${zeile.trim().slice(0, 90)}` });
  });
}

const nf1 = new Intl.NumberFormat("de-DE", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const nf0 = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 0 });
const hhmm = (h: number) => {
  const m = Math.round(h * 60);
  return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}`;
};
const clock = (min: number) => {
  const m = Math.round(min / 5) * 5;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
};

for (const t of site.touren) {
  console.log(`\n${t.data.titel}  (${t.slug})`);
  for (const e of t.etappen) {
    for (const v of e.varianten) {
      const s = v.stats;
      const flags = v.grenzen.map((g) => `${g.status === "am" ? "am Limit" : "ÜBER LIMIT"}: ${g.was}`).join(", ");
      const mark = v === e.standard ? "Tag " + e.tag : "     ";
      console.log(
        `  ${mark} ${v.buchstabe} ${v.data.name.padEnd(36)} ${nf1.format(s.km).padStart(5)} km  ↑${nf0.format(s.up).padStart(5)}  ↓${nf0.format(s.down).padStart(5)}  ${hhmm(s.hours)} h  ${s.grade ?? "T?"}  an ${clock(v.ankunft)}${flags ? "  [" + flags + "]" : ""}`,
      );
    }
    for (const a of e.abstecher) {
      console.log(`         + Abstecher ${a.data.name.padEnd(26)} ${nf1.format(a.stats.km).padStart(5)} km  ↑${nf0.format(a.stats.up).padStart(5)}  ${hhmm(a.stats.hours)} h  ${a.stats.grade ?? "T?"}`);
    }
    // --ablauf: print each variant's timeline (clock times, km, heights, hard sections)
    if (process.argv.includes("--ablauf")) {
      for (const v of e.varianten) {
        console.log(`      ${v.buchstabe} Ablauf:`);
        for (const x of v.timeline) {
          if (x.typ === "fahrt") {
            const zeit = x.ab != null ? clock(x.ab) : "  ?  ";
            console.log(`        ${zeit}  ${x.fahrt.mittel} ${x.von.name} → ${x.nach.name}${x.an != null ? ` (an ${clock(x.an)})` : ""}${x.warten ? `, vorher ${x.warten} min warten` : ""}${x.puffer != null ? `, Puffer ${hhmm(x.puffer / 60)} h` : ""}`);
          } else if (x.typ === "abstecher") console.log(`               + ${x.abstecher.data.name}`);
          else console.log(`        ${clock(x.zeit)}  ${x.ort.name} · km ${nf1.format(x.km)} · ${x.hoehe != null ? nf0.format(x.hoehe) + " m" : "?"}${x.pause ? ` · ${x.pause} min Pause` : ""}`);
        }
        for (const h of v.schwer) console.log(`        ${h.cls} km ${nf1.format(h.vonKm)}–${nf1.format(h.bisKm)}`);
      }
    }
  }
  const s = t.summe;
  console.log(`  Summe: ${s.tage} Tage, ${nf1.format(s.km)} km, ↑${nf0.format(s.up)} m, ↓${nf0.format(s.down)} m, max. ${s.grade}, Kondition ${"●".repeat(t.kondition.stufe)}${"○".repeat(5 - t.kondition.stufe)} (Tag ${t.kondition.tag})`);
}

const errors = issues.filter((i) => i.level === "fehler");
const warnings = issues.filter((i) => i.level === "warnung");
if (issues.length) console.log("");
for (const i of [...errors, ...warnings]) console.log(`${i.level === "fehler" ? "✗ Fehler " : "⚠ Warnung"}  ${i.datei}: ${i.text}`);
console.log(`\n${errors.length} Fehler, ${warnings.length} Warnungen`);
process.exitCode = errors.length ? 1 : 0;
