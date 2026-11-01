#!/usr/bin/env node
// Create the files for a new trip, with every field explained, ready to fill in.
//
// Usage: node scripts/neue-tour.mjs <slug> "<Titel>" --orte start,nacht-1,nacht-2,…,ziel
//   --orte  place ids from content/allgemein/orte.yaml, in order: where day 1 starts, then where
//           each night is spent, then where the last day ends (a loop ends where it started).
//           So a 3-day loop with 2 huts: --orte gavarnie,refuge-bayssellance,refuge-oulettes-de-gaube,gavarnie
//
// Writes content/touren/<slug>/tour.md, etappen/tag-N.md and an empty routen/ folder. It refuses
// to overwrite an existing trip. Until every TODO is filled and the GPX exist, `npm run check`
// fails — and while it fails, the site shows the error list instead of the pages. Finish the trip
// (or delete the folder) before you stop.

import { mkdir, writeFile, access } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const args = process.argv.slice(2);
const option = (name) => {
  const i = args.indexOf(name);
  return i === -1 ? undefined : args.splice(i, 2)[1];
};
const orte = option("--orte")?.split(",").map((s) => s.trim());
const [slug, titel] = args;
if (!slug || !titel || !orte || orte.length < 2 || !/^[a-z0-9-]+$/.test(slug)) {
  console.error('Usage: node scripts/neue-tour.mjs <slug> "<Titel>" --orte start,nacht-1,…,ziel');
  console.error("  slug: lowercase-with-dashes, e.g. stubaier-hoehenweg");
  process.exit(1);
}

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "content", "touren", slug);
try {
  await access(root);
  console.error(`${root} gibt es schon – nichts geschrieben.`);
  process.exit(1);
} catch {}

const tage = orte.length - 1;
const heute = new Date().toISOString().slice(0, 10);

const tour = `---
# Trip page. Field reference: src/content/schema.ts (TourSchema). Example: the Pyrenees trip (content/touren/pyrenaeen).
titel: "${titel}"
untertitel: TODO – ein Satz, der Lust macht (wird unter dem Titel und auf der Startseite gezeigt)
region: TODO – Gebirgsgruppe(n) · Land
status: planung # planung | fix | vorbei
stand: "${heute}" # date of the last content update
# termin: { von: "2027-07-12", bis: "2027-07-15" } # once the date is set
terminHinweis: TODO – wann im Jahr die Tour geht (Hüttensaison, Schnee, Fahrpläne) mit Grund

# The group's limits; days above them are flagged on the site. Owner default: 17 km, 1100 Hm, T3.
grenzen:
  kmProTag: 17
  hmProTag: 1100
  maxT: T3

treffpunkt:
  ort: ${orte[0]} # place id from orte.yaml
  zeit: "TODO" # "09:15" – so that the first lift/bus/boat is reached
  hinweis: TODO – wo genau, und warum diese Uhrzeit

anreise: |
  TODO – mit Bahn und Bus (konkrete Linien, Takt, Quelle), danach mit dem Auto (Parken, Kosten).

rueckreise: |
  TODO – vom Ziel zurück zum Start oder nach Hause.

# Photos: first = big hero photo. Find them with: node scripts/commons.mjs suche "<Ort>"
bilder:
  - motiv: TODO – Titelbild, das die ganze Tour zeigt (breit, ruhige untere Bildhälfte)
    format: hoch

# 3–5 moments that make people want to come. etappe = the day it happens.
highlights:
  - titel: TODO
    text: TODO – ein, zwei Sätze, konkret und belegbar
    etappe: 1
    bild:
      motiv: TODO

anforderungen: |
  TODO – was man können und mitbringen muss: Trittsicherheit, Schwindelfreiheit, Kondition,
  Selbstversorgerhütten, lange Abstiege. Ehrlich, ohne Panik.

faq:
  - frage: TODO – die Fragen, die in der Gruppe wirklich kommen (Hüttenschlafsack? Handyempfang? Schlechtes Wetter?)
    antwort: TODO

# Extras for this trip on top of content/allgemein/packliste.yaml (kategorie = a category id there).
packliste:
  plus: []
  ohne: []
---

TODO – "Darum diese Tour": 3–4 kurze Absätze, Tag für Tag erzählt, warm und konkret, du-Form.
Wichtige Orte **fett**. Keine Zahlen von Hand (die kommen aus den GPX), keine Superlative ohne Quelle.
`;

const etappe = (tag) => {
  const von = orte[tag - 1];
  const nach = orte[tag];
  const letzter = tag === tage;
  return `---
# Day ${tag}. Field reference: src/content/schema.ts (EtappeSchema).
tag: ${tag}
titel: TODO – kurz und bildhaft ("Über den Col des Mulets nach Spanien")
kurz: TODO – ein, zwei Sätze, was der Tag bringt
von: ${von}
nach: ${nach}
start: "TODO" # "09:30" = first step on the trail (after any lift/bus before it)

varianten:
  - id: standard
    name: TODO – Name des Wegs
    art: standard # exactly one standard; others: alternative | schlechtwetter
    text: TODO – wie der Weg verläuft, in einem Satz
    quelle: TODO – URL der Wegbeschreibung (Hütte, Alpenverein, Tourismus)
    abschnitte:
      # walking legs (GPX from: node scripts/route.mjs tag-${tag} "…" <lat,lon> … --tour ${slug})
      - gehen: tag-${tag}.gpx
      # transport before, between or after walking, e.g.:
      # - fahrt: { mittel: bahn, von: <ort>, nach: <ort>, dauer: 10, abfahrt: "09:00", takt: 30, quelle: <url>, geprueft: "${heute}" }
    wegpunkte: [] # - { ort: <id>, einkehr: true, pause: 30, wasser: true, hinweis: … }

abstecher: [] # - { id, name, ab: <ort>, zeitpunkt: abends, gpx: tag-${tag}-<name>.gpx, text, empfohlen: true }
${
  letzter
    ? "# Last day: no uebernachtung unless the group stays at the finish.\n"
    : `
uebernachtung:
  ort: ${nach}
  # hinweis: z. B. Selbstversorger, Halbpension, Reservierung
`
}
schluesselstellen: [] # - { titel, text, quelle } – the tricky bits, honestly

wasserHinweis: TODO – wo man Wasser auffüllen kann

notabstieg: TODO – wie man von unterwegs abbricht (nächster Ort, Bus, Bahn)

bilder:
  - motiv: TODO – das typische Bild dieses Tages
---

TODO – Wegbeschreibung: 2–3 Absätze in du-Form, der Weg in der Reihenfolge, Orte **fett**.
`;
};

await mkdir(path.join(root, "etappen"), { recursive: true });
await mkdir(path.join(root, "routen"), { recursive: true });
await writeFile(path.join(root, "tour.md"), tour);
for (let t = 1; t <= tage; t++) await writeFile(path.join(root, "etappen", `tag-${t}.md`), etappe(t));

console.log(`Angelegt: content/touren/${slug}/ mit tour.md, ${tage} Etappen und routen/.`);
console.log("Fehlende Orte in content/allgemein/orte.yaml eintragen (Koordinaten: node scripts/find.mjs "<Name>").");
console.log("Dann TODOs füllen, GPX routen und npm run check, bis es 0 Fehler meldet.");
