// German labels for the content model's enum values and recurring UI words.
import type { GradeClass, TGrade } from "./content/gpx.ts";

export const ART = {
  standard: "Geplante Route",
  alternative: "Alternative",
  schlechtwetter: "Schlechtwetter-Route",
} as const;

export const WETTER = {
  "nur-stabil": "Nur bei stabilem Wetter",
  "schlechtwetter-tauglich": "Auch bei schlechtem Wetter",
} as const;

export const ENTSCHEIDUNG = {
  vorab: "Wir entscheiden vor der Tour",
  vorabend: "Wir entscheiden am Vorabend",
  "vor-ort": "Wir entscheiden unterwegs",
} as const;

export const ZEITPUNKT = {
  unterwegs: "unterwegs",
  nachmittags: "am Nachmittag",
  abends: "am Abend",
  morgens: "am Morgen",
} as const;

export const MITTEL = { bahn: "Seilbahn", zug: "Zug", schiff: "Schiff", bus: "Bus", taxi: "Taxi" } as const;
export const MIT = { bahn: "mit der Seilbahn", zug: "mit dem Zug", schiff: "mit dem Schiff", bus: "mit dem Bus", taxi: "mit dem Taxi" } as const;

export const VERSORGUNG = {
  bewirtschaftet: "Bewirtschaftet – Essen gibt es auf der Hütte",
  selbstversorger: "Selbstversorgerhütte – Essen selbst mitbringen",
} as const;

export const STATUS = { planung: "In Planung", fix: "Steht fest", vorbei: "Rückblick" } as const;

export const GRADE_NAME: Record<TGrade, string> = {
  T1: "Wandern",
  T2: "Bergwandern",
  T3: "Anspruchsvolles Bergwandern",
  T4: "Alpinwandern",
  T5: "Anspruchsvolles Alpinwandern",
  T6: "Schwieriges Alpinwandern",
};

// Colour dot on German Alpine club signposts (DAV): blue = T2, red = T3, black = T4–T6.
export const DAV_FARBE: Record<TGrade, string | null> = {
  T1: null,
  T2: "blau",
  T3: "rot",
  T4: "schwarz",
  T5: "schwarz",
  T6: "schwarz",
};

export const CLASS_NAME: Record<GradeClass, string> = {
  ...GRADE_NAME,
  via_ferrata: "Klettersteig",
  path: "Pfad ohne Bewertung",
  road: "Fahrweg / Straße",
};
export const CLASS_KURZ: Record<GradeClass, string> = {
  T1: "T1",
  T2: "T2",
  T3: "T3",
  T4: "T4",
  T5: "T5",
  T6: "T6",
  via_ferrata: "Klettersteig",
  path: "ohne Bewertung",
  road: "Fahrweg",
};

// Short place names for labels: "Refuge de la Brèche de Roland (Les Sarradets)" → "Refuge de la Brèche de Roland".
export const kurzName = (name: string) => name.replace(/ \(.*\)$/, "").replace(/ (am|an der|in der|im) .*$/, "");

// Line colours per day (the only colours in the wireframe besides the grades).
export const TAG_FARBEN = ["#e8590c", "#1c7ed6", "#2b8a3e", "#ae3ec9", "#f59f00", "#0c8599", "#c2255c"];
export const tagFarbe = (tag: number) => TAG_FARBEN[(tag - 1) % TAG_FARBEN.length];
