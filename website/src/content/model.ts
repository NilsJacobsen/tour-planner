// Builds the whole site from raw content files: validates them against the schemas, resolves
// place references, parses GPX and derives every number. Pure (no DOM, no Vite), so the browser
// (src/content/load.ts) and `npm run check` (scripts/check.ts) use exactly the same code.
import YAML from "yaml";
import type { ZodType } from "zod";
import {
  haversineM,
  hoursTo,
  joinTracks,
  nearestIndex,
  parseGpx,
  T_GRADES,
  type GradeClass,
  type TGrade,
  type Track,
} from "./gpx.ts";
import {
  EtappeSchema,
  InfoSchema,
  OrteDateiSchema,
  PacklisteSchema,
  TourSchema,
  type AbstecherData,
  type Bild,
  type EtappeData,
  type Fahrt,
  type Ort,
  type PackItem,
  type Packliste,
  type TourData,
  type VarianteData,
} from "./schema.ts";

export type Files = Record<string, string>; // "content/…" path → file text
export type Issue = { level: "fehler" | "warnung"; datei: string; text: string };

export type Stats = {
  km: number;
  up: number;
  down: number;
  hours: number;
  minEle: number | null;
  maxEle: number | null;
  grade: TGrade | null; // hardest section
  dominant: TGrade | null; // grade with the most metres
  meters: Partial<Record<GradeClass, number>>;
};

export type LimitFlag = { was: "km" | "hm" | "T"; status: "am" | "ueber"; wert: number | string; grenze: number | string };

export type PunktEntry = {
  typ: "start" | "punkt" | "ziel";
  ort: Ort;
  zeit: number; // minutes since midnight
  km: number;
  hoehe: number | null;
  index: number; // track point
  hinweis?: string;
  pause?: number;
  einkehr: boolean;
  wasser: boolean;
};
export type FahrtEntry = {
  typ: "fahrt";
  fahrt: Fahrt;
  von: Ort;
  nach: Ort;
  wann: "vorher" | "zwischen" | "nachher";
  teil?: number;
  ab?: number;
  an?: number;
  warten?: number; // minutes waiting for the planned departure (fahrt.abfahrt)
  puffer?: number;
};
export type TimelineEntry = FahrtEntry | PunktEntry | { typ: "abstecher"; abstecher: AbstecherView };

export type HardSection = { cls: GradeClass; vonKm: number; bisKm: number; from: number; to: number };

export type VarianteView = {
  data: VarianteData;
  id: string;
  buchstabe: string; // A, B, … in the order of the content
  walk: Track; // all walking legs joined (see joinTracks); walk.teile tells them apart
  gpx: { datei: string; url?: string }[]; // one GPX per walking leg
  stats: Stats;
  // `teil`: for a transfer between walking legs, the leg it follows (0 = after the first).
  fahrten: { fahrt: Fahrt; von: Ort; nach: Ort; wann: "vorher" | "zwischen" | "nachher"; teil?: number }[];
  timeline: TimelineEntry[];
  startZeit: number; // first step on the trail
  tagesbeginn: number; // first departure if the day starts with transport, else startZeit
  ankunft: number; // end of the walk
  tagesende: number; // after transport legs
  puffer?: { minuten: number; fahrt: Fahrt; von: Ort };
  grenzen: LimitFlag[];
  schwer: HardSection[]; // T3+ and via ferrata stretches
};

export type AbstecherView = {
  data: AbstecherData;
  ab: Ort;
  walk: Track;
  gpxDatei: string;
  gpxUrl?: string;
  stats: Stats;
};

export type EtappeView = {
  data: EtappeData;
  tag: number;
  datum?: string;
  von: Ort;
  nach: Ort;
  varianten: VarianteView[];
  standard: VarianteView;
  abstecher: AbstecherView[];
  uebernachtung?: { ort: Ort; hinweis?: string };
  body: string;
  datei: string;
};

export type Karte = {
  etappen: {
    tag: number;
    linien: [number, number][][]; // one line per walking leg
    varianten: { id: string; linien: [number, number][][] }[];
    abstecher: { id: string; linie: [number, number][] }[];
  }[];
  // `fern`: a long transfer (e.g. down to the sea) drawn only as a short stub towards its destination,
  // so the walking route keeps its size; the destination's name labels the stub.
  fahrten: { mittel: Fahrt["mittel"]; von: [number, number]; nach: [number, number]; ziel: string; fern?: boolean }[];
  orte: { ort: Ort; rolle: "huette" | "start" | "ziel" }[];
  wasser: [number, number][][];
  bbox: [number, number, number, number];
};

export type TourView = {
  slug: string;
  data: TourData;
  body: string;
  etappen: EtappeView[];
  summe: { km: number; up: number; down: number; hours: number; tage: number; naechte: number; meters: Stats["meters"]; grade: TGrade | null; dominant: TGrade | null };
  kondition: { stufe: number; tag: number };
  huetten: { nacht: number; tag: number; ort: Ort; hinweis?: string }[];
  treffpunkt?: { ort: Ort; zeit?: string; hinweis?: string };
  karte: Karte;
  packliste: { id: string; titel: string; items: (PackItem & { extra: boolean })[] }[];
  quellen: { titel: string; url: string }[];
  bilder: { wo: string; bild: Bild; link: string }[];
};

export type InfoPage = { slug: string; titel: string; kurz?: string; body: string };

export type Site = {
  touren: TourView[];
  orte: Record<string, Ort>;
  packliste: Packliste;
  info: Record<string, InfoPage>;
};

// --- Fitness rating (Kondition), judged on the hardest standard day. Documented on /info/schwierigkeit.
// A day gets the first level whose limits it stays within; descent counts with higher limits.
export const KONDITION = [
  { stufe: 1, stunden: 3, hoch: 500, runter: 750, text: "leicht" },
  { stufe: 2, stunden: 4.5, hoch: 800, runter: 1200, text: "mittel" },
  { stufe: 3, stunden: 6, hoch: 1100, runter: 1650, text: "anspruchsvoll" },
  { stufe: 4, stunden: 7.5, hoch: 1400, runter: 2100, text: "sehr anspruchsvoll" },
] as const;
export const KONDITION_MAX = { stufe: 5, text: "extrem" } as const;

export function konditionStufe(s: { hours: number; up: number; down: number }) {
  for (const k of KONDITION) if (s.hours <= k.stunden && s.up <= k.hoch && s.down <= k.runter) return k.stufe;
  return KONDITION_MAX.stufe;
}

const gradeIndex = (g: string | null | undefined) => (g ? (T_GRADES as readonly string[]).indexOf(g) : -1);

function statsOf(t: Track): Stats {
  let dominant: TGrade | null = null;
  for (const g of T_GRADES) if ((t.meters[g] ?? 0) > (dominant ? (t.meters[dominant] ?? 0) : 0)) dominant = g;
  return {
    km: t.distanceKm,
    up: t.ascentM,
    down: t.descentM,
    hours: t.hikingHours,
    minEle: t.minEle,
    maxEle: t.maxEle,
    grade: t.grade,
    dominant,
    meters: t.meters,
  };
}

function hardSections(t: Track): HardSection[] {
  const hard = (c: GradeClass) => c === "via_ferrata" || gradeIndex(c) >= 2; // T3 and up
  const out: HardSection[] = [];
  for (const r of t.runs) {
    if (!hard(r.cls)) continue;
    const last = out.at(-1);
    const gapM = last ? t.points[r.from].dist - t.points[last.to].dist : Infinity;
    if (last && last.cls === r.cls && gapM < 150) last.to = r.to;
    else out.push({ cls: r.cls, from: r.from, to: r.to, vonKm: 0, bisKm: 0 });
  }
  return out
    .map((s) => ({ ...s, vonKm: t.points[s.from].dist / 1000, bisKm: t.points[s.to].dist / 1000 }))
    .filter((s) => (s.bisKm - s.vonKm) * 1000 >= 50);
}

const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

function addDays(iso: string, days: number) {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// Douglas–Peucker in metres; enough for the SVG outline (the maps use the full tracks).
export function simplify(coords: [number, number][], tolM: number): [number, number][] {
  if (coords.length <= 2) return coords;
  const kx = 111_320 * Math.cos((coords[0][1] * Math.PI) / 180);
  const ky = 110_540;
  const p = coords.map(([lon, lat]) => [lon * kx, lat * ky]);
  const keep = new Uint8Array(coords.length);
  keep[0] = 1;
  keep[coords.length - 1] = 1;
  const stack: [number, number][] = [[0, coords.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop()!;
    const [ax, ay] = p[a];
    const [bx, by] = p[b];
    const len2 = (bx - ax) ** 2 + (by - ay) ** 2;
    let maxD = 0;
    let idx = -1;
    for (let i = a + 1; i < b; i++) {
      const [x, y] = p[i];
      const tt = len2 ? Math.max(0, Math.min(1, ((x - ax) * (bx - ax) + (y - ay) * (by - ay)) / len2)) : 0;
      const d = Math.hypot(x - (ax + tt * (bx - ax)), y - (ay + tt * (by - ay)));
      if (d > maxD) {
        maxD = d;
        idx = i;
      }
    }
    if (idx > 0 && maxD > tolM) {
      keep[idx] = 1;
      stack.push([a, idx], [idx, b]);
    }
  }
  return coords.filter((_, i) => keep[i]);
}

const lineOf = (t: Track, tolM = 12): [number, number][] =>
  simplify(t.points.map((p) => [p.lon, p.lat] as [number, number]), tolM);
// One simplified line per walking leg, so a bus ride is not drawn as a walk.
const linesOf = (t: Track, tolM = 12): [number, number][][] =>
  t.teile.map((x) => simplify(t.points.slice(x.from, x.to + 1).map((p) => [p.lon, p.lat] as [number, number]), tolM));

const hhmm = (min: number) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(Math.round(min % 60)).padStart(2, "0")}`;

function splitFrontmatter(text: string): { data: unknown; body: string } {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) return { data: {}, body: text.trim() };
  return { data: YAML.parse(m[1]) ?? {}, body: m[2].trim() };
}

// Placeholder for a place without a photo yet (hut cards and the shot list share it).
export const hausBild = (o: Ort): Bild => ({ motiv: o.typ !== "huette" && !o.huette ? o.name : `${o.name} von außen`, format: "quer" });

export function buildSite(files: Files, urls: Record<string, string> = {}): { site: Site; issues: Issue[] } {
  const issues: Issue[] = [];
  const fehler = (datei: string, text: string) => issues.push({ level: "fehler", datei, text });
  const warnung = (datei: string, text: string) => issues.push({ level: "warnung", datei, text });

  // Parse a file with a schema; report every zod issue with its field path.
  function validate<T>(datei: string, schema: ZodType<T>, raw: unknown): T | null {
    const r = schema.safeParse(raw);
    if (r.success) return r.data;
    for (const i of r.error.issues) fehler(datei, `${i.path.map(String).join(".") || "(Datei)"}: ${i.message}`);
    return null;
  }
  function readYaml(datei: string): unknown {
    try {
      return YAML.parse(files[datei]);
    } catch (e) {
      fehler(datei, `YAML: ${(e as Error).message}`);
      return null;
    }
  }
  function readMd(datei: string): { data: unknown; body: string } | null {
    try {
      return splitFrontmatter(files[datei]);
    } catch (e) {
      fehler(datei, `Frontmatter: ${(e as Error).message}`);
      return null;
    }
  }

  // --- Global content
  const ORTE = "content/allgemein/orte.yaml";
  const orte: Record<string, Ort> = {};
  if (!(ORTE in files)) fehler(ORTE, "Datei fehlt");
  else {
    const parsed = validate(ORTE, OrteDateiSchema, readYaml(ORTE));
    for (const o of parsed?.orte ?? []) {
      if (orte[o.id]) fehler(ORTE, `Ort-ID doppelt: ${o.id}`);
      orte[o.id] = o;
    }
  }
  const PACK = "content/allgemein/packliste.yaml";
  const packliste: Packliste = (PACK in files && validate(PACK, PacklisteSchema, readYaml(PACK))) || { kategorien: [] };

  const info: Record<string, InfoPage> = {};
  for (const datei of Object.keys(files).filter((f) => /^content\/allgemein\/info\/[^/]+\.md$/.test(f))) {
    const md = readMd(datei);
    const data = md && validate(datei, InfoSchema, md.data);
    if (md && data) {
      const s = datei.split("/").pop()!.replace(/\.md$/, "");
      info[s] = { slug: s, ...data, body: md.body };
    }
  }

  const ort = (datei: string, id: string): Ort | null => {
    const o = orte[id];
    if (!o) fehler(datei, `Unbekannter Ort "${id}" (nicht in allgemein/orte.yaml)`);
    return o ?? null;
  };

  const gpxCache: Record<string, Track> = {};
  const track = (datei: string, path: string): Track | null => {
    if (!(path in files)) {
      fehler(datei, `GPX fehlt: ${path}`);
      return null;
    }
    gpxCache[path] ??= parseGpx(files[path]);
    if (gpxCache[path].points.length < 2) {
      fehler(path, "GPX enthält keine Trackpunkte");
      return null;
    }
    return gpxCache[path];
  };
  const near = (datei: string, t: Track, i: number, o: Ort, was: string) => {
    const d = Math.round(haversineM(t.points[i], o));
    if (d > 250) warnung(datei, `${was} liegt ${d} m von „${o.name}“ entfernt`);
  };

  // --- Trips
  const touren: TourView[] = [];
  const tourDateien = Object.keys(files).filter((f) => /^content\/touren\/[^/]+\/tour\.md$/.test(f));
  for (const tourDatei of tourDateien) {
    const slug = tourDatei.split("/")[2];
    const base = `content/touren/${slug}`;
    const md = readMd(tourDatei);
    const data = md && validate(tourDatei, TourSchema, md.data);
    if (!md || !data) continue;

    const etappen: EtappeView[] = [];
    const etappenDateien = Object.keys(files)
      .filter((f) => f.startsWith(`${base}/etappen/`) && f.endsWith(".md"))
      .sort();
    let defekt = 0; // stage files that failed; the chain checks below would only add noise
    for (const datei of etappenDateien) {
      const emd = readMd(datei);
      const e = emd && validate(datei, EtappeSchema, emd.data);
      if (!emd || !e) {
        defekt++;
        continue;
      }
      const von = ort(datei, e.von);
      const nach = ort(datei, e.nach);
      if (!von || !nach) {
        defekt++;
        continue;
      }

      const varianten: VarianteView[] = [];
      e.varianten.forEach((v, vi) => {
        // Walking legs (one GPX each) in order, with transport before, between and after them.
        const gehen = v.abschnitte.flatMap((a, ai) => ("gehen" in a ? [{ ai, name: a.gehen, datei: `${base}/routen/${a.gehen}` }] : []));
        const teile = gehen.map((g) => track(datei, g.datei));
        if (teile.some((t) => !t)) return;
        const walk = joinTracks(teile as Track[]);
        const ersterGehen = gehen[0].ai;
        const letzterGehen = gehen.at(-1)!.ai;

        const fahrten: VarianteView["fahrten"] = [];
        v.abschnitte.forEach((a, ai) => {
          if (!("fahrt" in a)) return;
          const fv = ort(datei, a.fahrt.von);
          const fn = ort(datei, a.fahrt.nach);
          if (!fv || !fn) return;
          const wann = ai < ersterGehen ? "vorher" : ai > letzterGehen ? "nachher" : "zwischen";
          // A transfer between two walking legs comes after leg number `teil`.
          const teil = wann === "zwischen" ? gehen.filter((g) => g.ai < ai).length - 1 : undefined;
          fahrten.push({ fahrt: a.fahrt, von: fv, nach: fn, wann, teil });
        });
        const vorher = fahrten.filter((f) => f.wann === "vorher");
        const nachher = fahrten.filter((f) => f.wann === "nachher");
        const zwischen = (k: number) => fahrten.filter((f) => f.teil === k);
        const walkStart = vorher.at(-1)?.nach ?? von;
        const walkEnd = nachher[0]?.von ?? nach;

        // Each walking leg should start and end at the stage's places or at the transport stops.
        gehen.forEach((g, k) => {
          const t = teile[k]!;
          const davor = k === 0 ? vorher.at(-1) : zwischen(k - 1).at(-1);
          const danach = k === gehen.length - 1 ? nachher[0] : zwischen(k)[0];
          const startOrt = davor?.nach ?? (k === 0 ? von : null);
          const endOrt = danach?.von ?? (k === gehen.length - 1 ? nach : null);
          if (startOrt) near(datei, t, 0, startOrt, `Start von ${g.name}`);
          if (endOrt) near(datei, t, t.points.length - 1, endOrt, `Ende von ${g.name}`);
          if (!startOrt) {
            const d = Math.round(haversineM(teile[k - 1]!.points.at(-1)!, t.points[0]));
            if (d > 250) warnung(datei, `${g.name} beginnt ${d} m vom Ende von ${gehen[k - 1].name} – fehlt eine Fahrt dazwischen?`);
          }
        });

        // Timeline: transport before (counted back from the start), the walking legs with their
        // waypoints and the transfers between them, transport after (with the buffer to the last
        // departure).
        const startZeit = toMin(v.start ?? e.start);
        const timeline: TimelineEntry[] = [];
        const ersteAbfahrt = (f: (typeof fahrten)[number], ab: number | undefined) => {
          if (ab != null && f.fahrt.erste && ab < toMin(f.fahrt.erste)) {
            warnung(datei, `${f.von.name} → ${f.nach.name}: geplant ab ${hhmm(ab)}, die erste Fahrt ist laut Fahrplan um ${f.fahrt.erste}`);
          }
        };
        // When to leave on a transport leg: when we get there, or later if we plan to take a
        // particular departure (then we wait). Missing it is a content error worth a warning.
        // With a `takt` (regular service), `abfahrt` is the first departure and we take the next one.
        const abfahrtAb = (f: (typeof fahrten)[number], bereit: number) => {
          if (!f.fahrt.abfahrt) return { ab: bereit, warten: 0 };
          let plan = toMin(f.fahrt.abfahrt);
          if (f.fahrt.takt) {
            while (plan < bereit) plan += f.fahrt.takt;
            if (f.fahrt.letzte && plan > toMin(f.fahrt.letzte)) warnung(datei, `${f.von.name}: gegen ${hhmm(bereit)} fährt nichts mehr (letzte Abfahrt ${f.fahrt.letzte})`);
          } else if (plan < bereit) {
            warnung(datei, `${f.von.name}: Abfahrt ${f.fahrt.abfahrt} geplant, wir sind aber erst gegen ${hhmm(bereit)} dort`);
          }
          const ab = Math.max(plan, bereit);
          return { ab, warten: Math.round(ab - bereit) };
        };
        if (vorher[0]?.fahrt.abfahrt) {
          // Planned departures: count forward from the first one.
          let bereit = toMin(vorher[0].fahrt.abfahrt);
          for (const f of vorher) {
            const { ab, warten } = abfahrtAb(f, bereit);
            const an = f.fahrt.dauer != null ? ab + f.fahrt.dauer : undefined;
            ersteAbfahrt(f, ab);
            timeline.push({ typ: "fahrt", ...f, ab, an, warten: warten || undefined });
            bereit = an ?? ab;
          }
          if (bereit > startZeit) warnung(datei, `Start um ${hhmm(startZeit)}, aber ${walkStart.name} erreichen wir erst um ${hhmm(bereit)}`);
        } else {
          // Otherwise count back from the start of the walk.
          let t: number | undefined = startZeit;
          for (const f of [...vorher].reverse()) {
            const an: number | undefined = t;
            const ab: number | undefined = an != null && f.fahrt.dauer != null ? an - f.fahrt.dauer : undefined;
            ersteAbfahrt(f, ab);
            timeline.unshift({ typ: "fahrt", ...f, ab, an });
            t = ab;
          }
        }
        const punkt = (typ: PunktEntry["typ"], o: Ort, index: number, zeit: number, extra: Partial<PunktEntry> = {}) =>
          timeline.push({
            typ,
            ort: o,
            zeit,
            index,
            km: walk.points[index].dist / 1000,
            hoehe: o.hoehe ?? walk.points[index].ele,
            einkehr: false,
            wasser: false,
            ...extra,
          });

        // Waypoints along the joined track, searched in the order they are listed.
        const wps: { wp: VarianteData["wegpunkte"][number]; o: Ort; index: number }[] = [];
        let from = 0;
        for (const wp of v.wegpunkte) {
          const o = ort(datei, wp.ort);
          if (!o) continue;
          const { index, distM } = nearestIndex(walk, o.lat, o.lon, from);
          if (distM > 300) warnung(datei, `Wegpunkt „${o.name}“ liegt ${Math.round(distM)} m neben ${gehen.map((g) => g.name).join(" + ")}`);
          from = index;
          wps.push({ wp, o, index });
        }

        punkt("start", walkStart, 0, startZeit);
        let pausen = 0; // breaks and transfers so far, in minutes
        const zeitBei = (index: number) => startZeit + hoursTo(walk, index) * 60 + pausen;
        let w = 0;
        walk.teile.forEach((teil, k) => {
          for (; w < wps.length && wps[w].index <= teil.to; w++) {
            const { wp, o, index } = wps[w];
            punkt("punkt", o, index, zeitBei(index), { hinweis: wp.hinweis, pause: wp.pause, einkehr: wp.einkehr, wasser: wp.wasser });
            pausen += wp.pause ?? 0;
          }
          const zw = k < walk.teile.length - 1 ? zwischen(k) : [];
          if (!zw.length) return;
          // Transfer to the next walking leg: where we get on, the ride(s), where we start walking again.
          const davor = timeline.at(-1);
          if (!(davor && davor.typ !== "fahrt" && davor.typ !== "abstecher" && davor.ort.id === zw[0].von.id)) {
            punkt("punkt", zw[0].von, teil.to, zeitBei(teil.to));
          }
          for (const f of zw) {
            const bereit = zeitBei(teil.to);
            const { ab, warten } = abfahrtAb(f, bereit);
            if (f.fahrt.dauer == null) warnung(datei, `${f.von.name} → ${f.nach.name}: ohne dauer stimmen die Uhrzeiten danach nicht`);
            const p = f.fahrt.letzte ? toMin(f.fahrt.letzte) - bereit : undefined;
            if (p != null && p < 60) warnung(datei, `Nur ${p} min Puffer bis zur letzten Abfahrt ab ${f.von.name}`);
            ersteAbfahrt(f, ab);
            timeline.push({ typ: "fahrt", ...f, ab, an: ab + (f.fahrt.dauer ?? 0), warten: warten || undefined, puffer: p });
            pausen += warten + (f.fahrt.dauer ?? 0);
          }
          const weiter = walk.teile[k + 1].from;
          punkt("punkt", zw.at(-1)!.nach, weiter, zeitBei(weiter));
        });
        const ankunft = startZeit + walk.hikingHours * 60 + pausen;
        punkt("ziel", walkEnd, walk.points.length - 1, ankunft);

        let ende = ankunft;
        let puffer: VarianteView["puffer"];
        for (const f of nachher) {
          const { ab, warten } = abfahrtAb(f, ende);
          const an = f.fahrt.dauer != null ? ab + f.fahrt.dauer : undefined;
          // The buffer counts from when we arrive at the stop, not from a planned later departure.
          const p = f.fahrt.letzte ? toMin(f.fahrt.letzte) - ende : undefined;
          if (p != null && !puffer) puffer = { minuten: p, fahrt: f.fahrt, von: f.von };
          if (p != null && p < 60) warnung(datei, `Nur ${p} min Puffer bis zur letzten Abfahrt ab ${f.von.name}`);
          ersteAbfahrt(f, ab);
          timeline.push({ typ: "fahrt", ...f, ab, an, warten: warten || undefined, puffer: p });
          ende = an ?? ab;
        }

        const stats = statsOf(walk);
        const grenzen: LimitFlag[] = [];
        const g = data.grenzen;
        const flag = (was: LimitFlag["was"], wert: number, grenze: number) => {
          if (wert > grenze) grenzen.push({ was, status: "ueber", wert, grenze });
          else if (wert >= grenze * 0.95) grenzen.push({ was, status: "am", wert, grenze });
        };
        flag("km", stats.km, g.kmProTag);
        flag("hm", stats.up, g.hmProTag);
        if (gradeIndex(stats.grade) > gradeIndex(g.maxT)) grenzen.push({ was: "T", status: "ueber", wert: stats.grade!, grenze: g.maxT });
        for (const l of grenzen.filter((l) => l.status === "ueber")) {
          warnung(datei, `Variante „${v.name}“ über dem Limit: ${l.was} ${l.wert} > ${l.grenze}`);
        }
        if (stats.meters.via_ferrata) warnung(datei, `Variante „${v.name}“ enthält ${stats.meters.via_ferrata} m Klettersteig`);

        varianten.push({
          data: v,
          id: v.id,
          buchstabe: String.fromCharCode(65 + vi),
          walk,
          gpx: gehen.map((x) => ({ datei: x.datei, url: urls[x.datei] })),
          stats,
          fahrten,
          timeline,
          startZeit,
          tagesbeginn: (timeline[0]?.typ === "fahrt" ? timeline[0].ab : undefined) ?? startZeit,
          ankunft,
          tagesende: ende,
          puffer,
          grenzen,
          schwer: hardSections(walk),
        });
      });
      const standard = varianten.find((v) => v.data.art === "standard");
      if (!standard) continue;

      const abstecher: AbstecherView[] = [];
      for (const a of e.abstecher) {
        const ab = ort(datei, a.ab);
        const gpxDatei = `${base}/routen/${a.gpx}`;
        const walk = track(datei, gpxDatei);
        if (!ab || !walk) continue;
        near(datei, walk, 0, ab, `Start von ${a.gpx}`);
        near(datei, walk, walk.points.length - 1, ab, `Ende von ${a.gpx}`);
        abstecher.push({ data: a, ab, walk, gpxDatei, gpxUrl: urls[gpxDatei], stats: statsOf(walk) });
      }
      // Side trips appear in each variant's timeline after the place they start from.
      for (const v of varianten) {
        for (const a of abstecher) {
          const at = v.timeline.findLastIndex((x) => x.typ !== "fahrt" && x.typ !== "abstecher" && x.ort.id === a.ab.id);
          if (at === -1) warnung(datei, `Abstecher „${a.data.name}“: ${a.ab.name} liegt nicht auf Variante „${v.data.name}“`);
          else v.timeline.splice(at + 1, 0, { typ: "abstecher", abstecher: a });
        }
      }

      const ue = e.uebernachtung ? ort(datei, e.uebernachtung.ort) : null;
      etappen.push({
        data: e,
        tag: e.tag,
        von,
        nach,
        varianten,
        standard,
        abstecher,
        uebernachtung: ue ? { ort: ue, hinweis: e.uebernachtung?.hinweis } : undefined,
        body: emd.body,
        datei,
      });
    }
    etappen.sort((a, b) => a.tag - b.tag);

    // Lints across stages (only when every stage file could be read)
    etappen.forEach((e, i) => {
      if (data.termin) e.datum = addDays(data.termin.von, e.tag - 1);
      if (defekt) return;
      if (e.tag !== i + 1) fehler(e.datei, `Tag ${e.tag} erwartet als Tag ${i + 1} (Tage müssen lückenlos sein)`);
      const next = etappen[i + 1];
      if (next && e.nach.id !== next.von.id) {
        fehler(next.datei, `Tag ${next.tag} beginnt in „${next.von.name}“, Tag ${e.tag} endet aber in „${e.nach.name}“`);
      }
    });
    if (data.plan && !defekt) {
      const imPlan = data.plan.tage.flatMap((t) => (t.etappe != null ? [t.etappe] : []));
      for (const n of imPlan) if (!etappen.some((e) => e.tag === n)) fehler(tourDatei, `plan: Tag ${n} gibt es nicht`);
      for (const e of etappen) {
        const k = imPlan.filter((n) => n === e.tag).length;
        if (k !== 1) warnung(tourDatei, `plan: Tag ${e.tag} kommt ${k}× vor (erwartet 1×)`);
      }
    }
    if (data.termin && etappen.length) {
      const last = addDays(data.termin.von, etappen.length - 1);
      if (last !== data.termin.bis) warnung(tourDatei, `termin.bis ist ${data.termin.bis}, nach ${etappen.length} Tagen wäre es ${last}`);
    }

    // Totals over the standard routes
    const meters: Stats["meters"] = {};
    let km = 0, up = 0, down = 0, hours = 0;
    let hardest = { stufe: 0, tag: 1, hours: 0 };
    for (const e of etappen) {
      const s = e.standard.stats;
      km += s.km;
      up += s.up;
      down += s.down;
      hours += s.hours;
      for (const [k, m] of Object.entries(s.meters)) meters[k as GradeClass] = (meters[k as GradeClass] ?? 0) + (m ?? 0);
      // Hardest day: highest fitness level; among equal levels the longest walking time.
      const stufe = konditionStufe(s);
      if (stufe > hardest.stufe || (stufe === hardest.stufe && s.hours > hardest.hours)) hardest = { stufe, tag: e.tag, hours: s.hours };
    }
    let grade: TGrade | null = null;
    let dominant: TGrade | null = null;
    for (const g of T_GRADES) {
      if (meters[g]) grade = g;
      if ((meters[g] ?? 0) > (dominant ? (meters[dominant] ?? 0) : 0)) dominant = g;
    }

    const huetten = etappen
      .filter((e) => e.uebernachtung)
      .map((e) => ({ nacht: e.tag, tag: e.tag, ort: e.uebernachtung!.ort, hinweis: e.uebernachtung!.hinweis }));

    // Outline for the SVG drawing: simplified lines, transport legs, huts, lakes.
    const karte: Karte = { etappen: [], fahrten: [], orte: [], wasser: [], bbox: [180, 90, -180, -90] };
    for (const e of etappen) {
      karte.etappen.push({
        tag: e.tag,
        linien: linesOf(e.standard.walk),
        varianten: e.varianten.filter((v) => v !== e.standard).map((v) => ({ id: v.id, linien: linesOf(v.walk) })),
        abstecher: e.abstecher.map((a) => ({ id: a.data.id, linie: lineOf(a.walk, 8) })),
      });
      // Rides in a row (bus, change, bus) become one line from the first stop to the last: the
      // drawing shows where we ride, not where we change.
      for (const [i, f] of e.standard.fahrten.entries()) {
        const vorige = e.standard.fahrten[i - 1];
        const letzte = karte.fahrten.at(-1);
        if (vorige && letzte && vorige.wann === f.wann && vorige.teil === f.teil) {
          letzte.nach = [f.nach.lon, f.nach.lat];
          letzte.ziel = f.nach.name;
        } else karte.fahrten.push({ mittel: f.fahrt.mittel, von: [f.von.lon, f.von.lat], nach: [f.nach.lon, f.nach.lat], ziel: f.nach.name });
      }
    }
    // A one-way trip also marks where it ends. A last night at the finish shows only as the finish.
    const ziel = etappen.at(-1)?.nach;
    const einweg = ziel && etappen.length && ziel.id !== etappen[0].von.id ? ziel : null;
    // A hut we sleep in twice (a summit day from the same hut) is drawn once.
    for (const h of huetten) {
      if (h.ort.id !== einweg?.id && !karte.orte.some((o) => o.ort.id === h.ort.id)) karte.orte.push({ ort: h.ort, rolle: "huette" });
    }
    // A start that is also a night stop is drawn once, as the hut.
    if (etappen.length && !karte.orte.some((o) => o.ort.id === etappen[0].von.id)) karte.orte.push({ ort: etappen[0].von, rolle: "start" });
    if (einweg) karte.orte.push({ ort: einweg, rolle: "ziel" });
    const extend = (lon: number, lat: number) => {
      karte.bbox = [Math.min(karte.bbox[0], lon), Math.min(karte.bbox[1], lat), Math.max(karte.bbox[2], lon), Math.max(karte.bbox[3], lat)];
    };
    for (const e of karte.etappen) for (const [lon, lat] of [...e.linien.flat(), ...e.varianten.flatMap((v) => v.linien.flat())]) extend(lon, lat);
    // Transfers that end far outside the walking area (more than half its size away) become a short
    // stub, and a finish out there is not drawn as a place.
    const [w0, s0, e0, n0] = karte.bbox;
    const kx = Math.cos(((s0 + n0) / 2) * (Math.PI / 180));
    const spanne = Math.max((e0 - w0) * kx, n0 - s0);
    const weitWeg = ([lon, lat]: [number, number]) =>
      Math.max(w0 - lon, lon - e0, 0) * kx > spanne / 2 || Math.max(s0 - lat, lat - n0, 0) > spanne / 2;
    for (const f of karte.fahrten) {
      if (weitWeg(f.nach)) {
        const dx = (f.nach[0] - f.von[0]) * kx, dy = f.nach[1] - f.von[1];
        const len = Math.hypot(dx, dy) || 1;
        const stub = spanne * 0.18;
        f.nach = [f.von[0] + (dx / len) * stub / kx, f.von[1] + (dy / len) * stub];
        f.fern = true;
      }
      extend(...f.von);
      extend(...f.nach);
    }
    karte.orte = karte.orte.filter((o) => !(o.rolle === "ziel" && weitWeg([o.ort.lon, o.ort.lat])));
    const geo = `${base}/karte.geojson`;
    if (geo in files) {
      try {
        const fc = JSON.parse(files[geo]) as { features: { geometry: { type: string; coordinates: number[][][] | number[][][][] } }[] };
        for (const f of fc.features) {
          const polys = f.geometry.type === "Polygon" ? [f.geometry.coordinates as number[][][]] : (f.geometry.coordinates as number[][][][]);
          for (const poly of polys) karte.wasser.push(poly[0].map(([lon, lat]) => [lon, lat] as [number, number]));
        }
      } catch (err) {
        fehler(geo, `GeoJSON: ${(err as Error).message}`);
      }
    }

    // Packing list: base list minus `ohne`, plus the trip's own items.
    const tp = data.packliste;
    const liste = packliste.kategorien.map((k) => ({
      id: k.id,
      titel: k.titel,
      items: k.items.filter((i) => !tp.ohne.includes(i.id)).map((i) => ({ ...i, extra: false })),
    }));
    for (const id of tp.ohne) {
      if (!packliste.kategorien.some((k) => k.items.some((i) => i.id === id))) warnung(tourDatei, `packliste.ohne: unbekannter Eintrag "${id}"`);
    }
    for (const p of tp.plus) {
      const k = liste.find((k) => k.id === p.kategorie);
      if (!k) fehler(tourDatei, `packliste.plus: unbekannte Kategorie "${p.kategorie}"`);
      else k.items.push({ ...p, extra: true });
    }

    // Sources of everything shown for this trip.
    const quellen = new Map<string, string>();
    const q = (url: string | undefined, titel: string) => url && !quellen.has(url) && quellen.set(url, titel);
    const genutzt = new Set<Ort>();
    for (const e of etappen) {
      genutzt.add(e.von).add(e.nach);
      if (e.uebernachtung) genutzt.add(e.uebernachtung.ort);
      for (const v of e.varianten) {
        q(v.data.quelle, `${v.data.name} (Tag ${e.tag})`);
        for (const f of v.fahrten) {
          genutzt.add(f.von).add(f.nach);
          q(f.fahrt.quelle, `${f.von.name} → ${f.nach.name}`);
        }
        for (const x of v.timeline) if (x.typ === "punkt") genutzt.add(x.ort);
      }
      for (const a of e.abstecher) q(a.data.quelle, `Abstecher ${a.data.name}`);
      for (const s of e.data.schluesselstellen) q(s.quelle, `${s.titel} (Tag ${e.tag})`);
    }
    for (const o of genutzt) q(o.quelle, o.name);

    // Old facts: anything checked more than a year before the trip's last update.
    for (const o of genutzt) {
      if (o.geprueft && addDays(o.geprueft, 365) < data.stand) warnung(ORTE, `${o.name}: zuletzt geprüft ${o.geprueft}`);
    }

    // Shot list
    const bilder: TourView["bilder"] = [];
    const link = `/touren/${slug}`;
    data.bilder.forEach((b, i) => bilder.push({ wo: `Titelbild ${i + 1}`, bild: b, link }));
    for (const h of data.highlights) if (h.bild) bilder.push({ wo: `Highlight · ${h.titel}`, bild: h.bild, link });
    for (const e of etappen) e.data.bilder.forEach((b, i) => bilder.push({ wo: `Tag ${e.tag} · Bild ${i + 1}`, bild: b, link: `${link}/etappe/${e.tag}` }));
    for (const h of huetten) bilder.push({ wo: `Nacht ${h.nacht} · ${h.ort.name}`, bild: h.ort.bild ?? hausBild(h.ort), link: `${link}#huetten` });
    for (const b of bilder) if (b.bild.src && !b.bild.credit) warnung(tourDatei, `Bild ohne credit: ${b.bild.src}`);

    if (data.treffpunkt) ort(tourDatei, data.treffpunkt.ort);
    for (const h of data.highlights) if (h.ort) ort(tourDatei, h.ort);

    touren.push({
      slug,
      data,
      body: md.body,
      etappen,
      summe: { km, up, down, hours, tage: etappen.length, naechte: huetten.length, meters, grade, dominant },
      kondition: { stufe: hardest.stufe, tag: hardest.tag },
      huetten,
      treffpunkt: data.treffpunkt && orte[data.treffpunkt.ort] ? { ...data.treffpunkt, ort: orte[data.treffpunkt.ort] } : undefined,
      karte,
      packliste: liste,
      quellen: [...quellen].map(([url, titel]) => ({ url, titel })),
      bilder,
    });
  }

  return { site: { touren, orte, packliste, info }, issues };
}
