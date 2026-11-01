#!/usr/bin/env node
// Find and fetch freely licensed photos on Wikimedia Commons for the trip pages.
//
// Search (prints candidates, saves 600 px previews to look at before choosing):
//   node scripts/commons.mjs suche "Refugio de Góriz" [--min 2400] [--anzahl 12] [--qualitaet] [--vorschau <dir>]
//     --min       smallest original width in px (default 2400; portraits: use the long side)
//     --qualitaet only Quality/Featured/Valued images
//     --vorschau  folder for the previews (default: a temp folder, printed at the end)
//
// Fetch one (downloads a 1600 px version into public/, compresses it, prints the `bild` entry):
//   node scripts/commons.mjs hole "File:Lago Helado.jpg" public/bilder/pyrenaeen/lago-helado.jpg [--breite 1600]
//
// Only CC0, public domain, CC BY and CC BY-SA pass (no NC/ND, no "fair use"). The printed entry has
// credit, lizenz and quelle (the file page), which the site lists under "Quellen & Stand".
// Be gentle with the API: requests run one after another with a pause, and send our User-Agent.

import { mkdir, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import os from "node:os";
import path from "node:path";

const API = "https://commons.wikimedia.org/w/api.php";
const UA = "tour-planner-prototype (hobby project)";
const pause = () => new Promise((r) => setTimeout(r, 700));

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(name);
  if (i === -1) return false;
  args.splice(i, 1);
  return true;
};
const option = (name) => {
  const i = args.indexOf(name);
  return i === -1 ? undefined : args.splice(i, 2)[1];
};

async function api(params) {
  const url = `${API}?${new URLSearchParams({ format: "json", formatversion: "2", ...params })}`;
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`Commons API ${res.status}`);
  await pause();
  return res.json();
}

async function laden(url, ziel) {
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`Download ${res.status}: ${url}`);
  await mkdir(path.dirname(ziel), { recursive: true });
  await writeFile(ziel, Buffer.from(await res.arrayBuffer()));
  await pause();
}

const text = (html = "") =>
  html
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();

// Commons sometimes repeats the name ("Unknown authorUnknown author").
const einmal = (s) => (s.length % 2 === 0 && s.slice(0, s.length / 2) === s.slice(s.length / 2) ? s.slice(0, s.length / 2) : s);

// CC0, PD, CC BY x.y, CC BY-SA x.y — never NC or ND.
const lizenzOk = (l) => /^(cc0|public domain|pd\b|cc by(-sa)? \d)/i.test(l) && !/\b(nc|nd)\b/i.test(l);

const format = (w, h) => (w / h > 2.1 ? "panorama" : w / h > 1.15 ? "quer" : w / h < 0.87 ? "hoch" : "quadrat");

function info(seite) {
  const ii = seite.imageinfo?.[0];
  if (!ii) return null;
  const m = ii.extmetadata ?? {};
  return {
    titel: seite.title,
    breite: ii.width,
    hoehe: ii.height,
    lizenz: text(m.LicenseShortName?.value),
    autor: einmal(text(m.Artist?.value) || text(m.Credit?.value) || "unbekannt"),
    beschreibung: text(m.ImageDescription?.value).slice(0, 140),
    seite: ii.descriptionurl,
    thumb: ii.thumburl,
    kategorien: text(m.Categories?.value),
  };
}

async function suche() {
  const min = Number(option("--min") ?? 2400);
  const anzahl = Number(option("--anzahl") ?? 12);
  const qualitaet = flag("--qualitaet");
  const vorschau = option("--vorschau") ?? path.join(os.tmpdir(), `commons-vorschau-${Date.now()}`);
  const begriffe = args.join(" ");
  if (!begriffe) throw new Error('Suchbegriffe fehlen: node scripts/commons.mjs suche "Funtensee"');
  const q = qualitaet ? `${begriffe} incategory:Quality_images|Featured_pictures_on_Wikimedia_Commons|Valued_images` : begriffe;
  const data = await api({
    action: "query",
    generator: "search",
    gsrnamespace: "6",
    gsrsearch: q,
    gsrlimit: "50",
    prop: "imageinfo",
    iiprop: "url|size|extmetadata",
    iiurlwidth: "600",
  });
  const treffer = (data.query?.pages ?? [])
    .map(info)
    .filter((x) => x && /\.(jpe?g|png|webp|tiff?)$/i.test(x.titel))
    .filter((x) => lizenzOk(x.lizenz) && Math.max(x.breite, x.hoehe) >= min)
    .slice(0, anzahl);
  if (!treffer.length) {
    console.log(`Nichts gefunden (Lizenz frei, mind. ${min} px). Andere Begriffe, Englisch oder --min senken?`);
    return;
  }
  await mkdir(vorschau, { recursive: true });
  for (const [i, t] of treffer.entries()) {
    const datei = path.join(vorschau, `${String(i + 1).padStart(2, "0")}.jpg`);
    await laden(t.thumb, datei);
    console.log(`\n${i + 1}. ${t.titel}`);
    console.log(`   ${t.breite}×${t.hoehe} · ${format(t.breite, t.hoehe)} · ${t.lizenz} · ${t.autor}`);
    if (t.beschreibung) console.log(`   ${t.beschreibung}`);
    console.log(`   Vorschau: ${datei}`);
  }
  console.log(`\nVorschauen in ${vorschau} – ansehen, bevor du eins nimmst.`);
}

async function hole() {
  const breite = Number(option("--breite") ?? 1600);
  const [titel, ziel] = args;
  if (!titel || !ziel) throw new Error('node scripts/commons.mjs hole "File:…" public/bilder/<tour>/<name>.jpg');
  const data = await api({
    action: "query",
    titles: titel.startsWith("File:") ? titel : `File:${titel}`,
    prop: "imageinfo",
    iiprop: "url|size|extmetadata",
    iiurlwidth: String(breite),
  });
  const t = info(data.query.pages[0]);
  if (!t) throw new Error(`Datei nicht gefunden: ${titel}`);
  if (!lizenzOk(t.lizenz)) throw new Error(`Lizenz passt nicht: ${t.lizenz}`);
  await laden(t.thumb, ziel);
  // Commons rounds thumbnails up to fixed widths (e.g. 1920), so scale down and re-encode on macOS
  // (sips; "normal" quality ≈ 300–500 KB at 1600 px). Elsewhere the file stays as delivered.
  try {
    execFileSync("sips", ["-Z", String(breite), "-s", "formatOptions", "normal", ziel, "--out", ziel], { stdio: "ignore" });
  } catch {}
  const src = "/" + path.relative(path.resolve("public"), path.resolve(ziel)).split(path.sep).join("/");
  console.log(`Gespeichert: ${ziel} (Original ${t.breite}×${t.hoehe})\n`);
  console.log(`- src: ${src}`);
  console.log(`  motiv: TODO – was das Foto wirklich zeigt (ist auch der Alt-Text)`);
  console.log(`  format: ${format(t.breite, t.hoehe)}`);
  console.log(`  credit: ${t.autor} (Wikimedia Commons)`);
  console.log(`  lizenz: ${t.lizenz}`);
  console.log(`  quelle: ${t.seite}`);
}

const befehl = args.shift();
try {
  if (befehl === "suche") await suche();
  else if (befehl === "hole") await hole();
  else {
    console.error('Usage: node scripts/commons.mjs suche "<Begriffe>" [--min 2400] [--qualitaet]\n       node scripts/commons.mjs hole "File:…" <ziel.jpg>');
    process.exit(1);
  }
} catch (e) {
  console.error(e.message);
  process.exit(1);
}
