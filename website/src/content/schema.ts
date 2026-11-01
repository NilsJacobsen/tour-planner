// The content model. Every content file is validated against these schemas, in the browser and
// in `npm run check`. Field names are German because the content is German; derived numbers
// (km, Höhenmeter, Gehzeit, grades, clock times) are never part of the content — they come from GPX.
import { z } from "zod";

const datum = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Datum als JJJJ-MM-TT");
const uhrzeit = z.string().regex(/^([01]?\d|2[0-3]):[0-5]\d$/, "Uhrzeit als HH:MM (in Anführungszeichen)");
export const slug = z.string().regex(/^[a-z0-9-]+$/, "nur a–z, 0–9 und -");
const ortRef = slug; // id of an entry in allgemein/orte.yaml
const markdown = z.string();
const quelle = z.url().optional(); // where a fact comes from
const geprueft = datum.optional(); // when that fact was last checked

// --- Images (placeholders until real photos exist; `motiv` doubles as the shot list)
export const BildSchema = z.object({
  src: z.string().optional(),
  motiv: z.string(),
  format: z.enum(["quer", "hoch", "quadrat", "panorama"]).default("quer"),
  credit: z.string().optional(),
  lizenz: z.string().optional(),
  ausschnitt: z.string().optional(), // CSS object-position when cropped, e.g. "right center" or "center top"
  quelle: z.url().optional(), // page of the photo (e.g. on Wikimedia Commons), linked in the credits
});

// --- Global: places (huts, lifts, boat stops, viewpoints…), reused across trips
export const OrtSchema = z.object({
  id: slug,
  name: z.string(),
  typ: z.enum(["huette", "alm", "bahn", "schiff", "gipfel", "aussicht", "ort", "see", "pass", "parkplatz"]),
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
  hoehe: z.number().optional(), // official height in m (sign or source), not the terrain model
  web: z.url().optional(),
  telefon: z.string().optional(),
  hinweis: z.string().optional(),
  bild: BildSchema.optional(), // photo of the place from outside (hut cards)
  huette: z
    .object({
      betreiber: z.string().optional(),
      saison: z.string().optional(),
      versorgung: z.enum(["bewirtschaftet", "selbstversorger"]),
      plaetze: z.object({ zimmer: z.number().optional(), lager: z.number().optional() }).optional(),
      buchung: z.string().optional(),
    })
    .optional(),
  quelle,
  geprueft,
});
export const OrteDateiSchema = z.object({ orte: z.array(OrtSchema) });

// --- Global: base packing list
const PackItemSchema = z.object({
  id: slug,
  name: z.string(),
  hinweis: z.string().optional(),
  pflicht: z.boolean().default(false),
});
export const PacklisteSchema = z.object({
  kategorien: z.array(z.object({ id: slug, titel: z.string(), items: z.array(PackItemSchema) })),
});

// --- Global: info pages (Markdown with a title)
export const InfoSchema = z.object({ titel: z.string(), kurz: z.string().optional() });

// --- Trip
export const LAENDER = ["de", "at", "ch", "it", "fr", "es", "ad", "si"] as const;
export type Land = (typeof LAENDER)[number];

export const TourSchema = z.object({
  titel: z.string(),
  untertitel: z.string(),
  gebirge: z.string(), // mountain range, shown as a tag on the trip card (e.g. "Pyrenäen")
  laender: z.array(z.enum(LAENDER)).min(1), // countries the trip walks through, in order: flags in that tag
  region: z.string(),
  status: z.enum(["planung", "fix", "vorbei"]),
  stand: datum, // last content update, shown as "Stand"
  termin: z.object({ von: datum, bis: datum }).optional(),
  terminHinweis: z.string().optional(),
  // The owner's planning limits; routes get "am Limit" / "über Limit" flags against them.
  grenzen: z.object({
    kmProTag: z.number(),
    hmProTag: z.number(),
    maxT: z.enum(["T1", "T2", "T3", "T4", "T5", "T6"]),
  }),
  treffpunkt: z.object({ ort: ortRef, zeit: uhrzeit.optional(), hinweis: z.string().optional() }).optional(),
  anreise: markdown.optional(),
  rueckreise: markdown.optional(),
  bilder: z.array(BildSchema).default([]),
  highlights: z
    .array(
      z.object({
        titel: z.string(),
        text: z.string(),
        ort: ortRef.optional(),
        etappe: z.number().int().optional(),
        bild: BildSchema.optional(),
      }),
    )
    .default([]),
  anforderungen: markdown.optional(),
  // The whole trip including travel days (shown above the day table). Walking days point to their
  // stage with `etappe`; travel and rest days have their own titel.
  plan: z
    .object({
      hinweis: markdown.optional(), // e.g. how many days off work you need
      tage: z
        .array(
          z
            .object({
              wochentag: z.string(), // "Fr", "Sa" … (the date isn't fixed yet)
              etappe: z.number().int().optional(),
              titel: z.string().optional(),
              text: z.string().optional(),
              nacht: z.string().optional(), // for travel days, e.g. "Camping"; walking days show their hut
              link: z.url().optional(),
            })
            .refine((t) => t.etappe != null || t.titel, { message: "titel fehlt (oder etappe angeben)" }),
        )
        .min(1),
    })
    .optional(),
  // A rough cost estimate per person (the group shares costs; nothing is booked or paid here).
  kosten: z
    .object({
      hinweis: z.string().optional(),
      posten: z.array(z.object({ name: z.string(), betrag: z.number() })).min(1),
    })
    .optional(),
  faq: z.array(z.object({ frage: z.string(), antwort: markdown })).default([]),
  packliste: z
    .object({
      plus: z.array(PackItemSchema.extend({ kategorie: slug })).default([]),
      ohne: z.array(slug).default([]),
    })
    .default({ plus: [], ohne: [] }),
});

// --- Stage
export const FahrtSchema = z.object({
  mittel: z.enum(["bahn", "zug", "schiff", "bus", "taxi"]), // bahn = cable car or chairlift
  von: ortRef,
  nach: ortRef,
  dauer: z.number().optional(), // minutes
  abfahrt: uhrzeit.optional(), // the departure we plan to take (timetable); the day waits for it
  takt: z.number().int().positive().optional(), // minutes between departures: with abfahrt as the first, we take the next one
  erste: uhrzeit.optional(), // first departure
  letzte: uhrzeit.optional(), // last departure
  hinweis: z.string().optional(),
  quelle,
  geprueft,
});

const WegpunktSchema = z.object({
  ort: ortRef,
  hinweis: z.string().optional(),
  pause: z.number().optional(), // minutes spent here
  einkehr: z.boolean().default(false),
  wasser: z.boolean().default(false),
});

// One way to walk the day. Legs in order: walking legs (one GPX file in routen/ each) and
// transport legs (cable car, boat, bus, taxi) before, between or after them. Alternatives share
// the stage's start and end.
export const VarianteSchema = z
  .object({
    id: slug,
    name: z.string(),
    art: z.enum(["standard", "alternative", "schlechtwetter"]),
    text: z.string().optional(),
    wetter: z.enum(["nur-stabil", "schlechtwetter-tauglich"]).optional(),
    wetterhinweis: z.string().optional(),
    entscheidung: z.enum(["vorab", "vorabend", "vor-ort"]).optional(),
    start: uhrzeit.optional(), // overrides the stage start
    abschnitte: z.array(z.union([z.object({ gehen: z.string() }), z.object({ fahrt: FahrtSchema })])).min(1),
    wegpunkte: z.array(WegpunktSchema).default([]),
    quelle,
  })
  .refine((v) => v.abschnitte.some((a) => "gehen" in a), {
    message: "mindestens ein gehen-Abschnitt (GPX) pro Variante",
    path: ["abschnitte"],
  });

export const AbstecherSchema = z.object({
  id: slug,
  name: z.string(),
  ab: ortRef, // where it starts (and ends: out and back)
  zeitpunkt: z.enum(["unterwegs", "nachmittags", "abends", "morgens"]),
  gpx: z.string(),
  text: z.string().optional(),
  empfohlen: z.boolean().default(false),
  quelle,
});

export const EtappeSchema = z
  .object({
    tag: z.number().int().min(1),
    titel: z.string(),
    kurz: z.string(),
    von: ortRef,
    nach: ortRef,
    start: uhrzeit, // first step on the trail
    varianten: z.array(VarianteSchema).min(1),
    abstecher: z.array(AbstecherSchema).default([]),
    uebernachtung: z.object({ ort: ortRef, hinweis: z.string().optional() }).optional(),
    schluesselstellen: z.array(z.object({ titel: z.string(), text: z.string(), quelle })).default([]),
    wasserHinweis: z.string().optional(),
    notabstieg: markdown.optional(),
    bilder: z.array(BildSchema).default([]),
  })
  .refine((e) => e.varianten.filter((v) => v.art === "standard").length === 1, {
    message: "genau eine Variante mit art: standard",
    path: ["varianten"],
  });

export type Bild = z.infer<typeof BildSchema>;
export type Ort = z.infer<typeof OrtSchema>;
export type Packliste = z.infer<typeof PacklisteSchema>;
export type PackItem = z.infer<typeof PackItemSchema>;
export type TourData = z.infer<typeof TourSchema>;
export type Fahrt = z.infer<typeof FahrtSchema>;
export type VarianteData = z.infer<typeof VarianteSchema>;
export type AbstecherData = z.infer<typeof AbstecherSchema>;
export type EtappeData = z.infer<typeof EtappeSchema>;
