# Website: the trip site of the Wandergruppe Jacobsen

German single-page app that presents the multi-day hut trips of the Wandergruppe Jacobsen. Real
content, styled after the owner's design (see "Look"); input for the final design in Figma.
Mobile first (390 px), then desktop. Internal group: no sign-up, no prices, no forms. `noindex` is set.

**Planning a new trip:** follow the `/neue-tour` skill (`.claude/skills/neue-tour/SKILL.md`), then
let the `tour-pruefer` agent review it.

## Run

- `npm run dev` → <http://localhost:5174>. `--host` to open it on a phone.
- `npm run check` → validates all content and prints a summary per trip (`-- --ablauf` adds each
  day's timeline). **Run it after every content edit.** Exits 1 on errors.
- `node scripts/screenshot.mjs <path> <out.png> [--mobile] [--full] [--element <css>] [--scroll #id+N] [--felder] [--wait ms]`
  (loads lazy photos for `--full`/`--element`; prints console errors and horizontal overflow)
- `node scripts/neue-tour.mjs <slug> "<Titel>" --orte start,nacht-1,…,ziel` → files for a new trip
  with every field explained. `npm run check` fails on any leftover `TODO`.
- `node scripts/commons.mjs suche "<Ort>"` / `hole "File:…" public/bilder/<slug>/<name>.jpg` →
  freely licensed photos from Wikimedia Commons with credit, licence and source.
- `node scripts/osm-wasser.mjs <slug> <süd,west,nord,ost> "<See>" …` → lake outlines.
- `npm run build` → static `dist/`, served by a Cloudflare Worker (`wrangler.jsonc`: static assets with SPA fallback; Cloudflare runs `npx wrangler deploy` after each push to `main`).

## Content (`content/`)

```text
allgemein/orte.yaml        places used by trips: huts, lifts, boat stops, viewpoints (shared)
allgemein/packliste.yaml   the packing list for all trips (/packliste); a trip's extras
                           (tour.md packliste.plus) are shown on the trip page
allgemein/info/*.md        info pages (/info/<name>)
touren/<slug>/tour.md      the trip: frontmatter + "Darum diese Tour" text
touren/<slug>/etappen/tag-N.md   one file per day: frontmatter + route description
touren/<slug>/routen/*.gpx       one GPX per variant and side trip
touren/<slug>/karte.geojson      lake outlines for the route drawing (scripts/osm-wasser.mjs)
```

The schema is `src/content/schema.ts` (zod). `src/content/model.ts` builds everything from the
files — the same code runs in the browser and in `npm run check`.

### A/B routes

- A day has `varianten` (exactly one `art: standard`, plus `alternative` or `schlechtwetter`) and
  optional `abstecher` (out-and-back side trips from a place).
- Each variant is a list of legs in order: walking legs (`gehen: <gpx>`, at least one) and transport
  (`fahrt`: bahn, schiff, bus, taxi) before, between or after them. So a cable-car start and a boat
  start share the same day, and so does walk → taxi → walk (E5, Holzgau → Madau). The model joins
  the walking legs into one track (`walk.teile` keeps them apart): km, Höhenmeter and times are the
  sums, the transfer counts with its `dauer` (needed for the clock times), maps and profiles draw
  each leg separately.
- Timetables: `abfahrt: "14:15"` is the departure we plan to take; the day waits for it (shown as
  waiting time, and a warning if we'd miss it). With `takt: 60` it is the first of a regular service
  and the next departure is taken. `bahn` = cable car or chairlift, `zug` = train.
- `wetter: schlechtwetter-tauglich` marks a standard route that is itself the bad-weather route.
- Route variants: `node scripts/route.mjs <file> "<title>" <lat,lon> … --tour <slug>` (one call per walking leg).

## Routing (BRouter) and places

- Coordinates: `node scripts/find.mjs "Pfeishütte" "Stempeljoch"` (Nominatim: lat,lon and height),
  `node scripts/huts.mjs 47.33,11.42 8` (huts within 8 km, Overpass). Never invent coordinates.
- One GPX per walking leg: `node scripts/route.mjs tag-1-<ziel> "<Titel>" <lat,lon> <via> … <lat,lon> --tour <slug>`
  (public brouter.de, profile `hiking-mountain`). It prints metres per SAC grade and a ⚠ for via
  ferratas, T4+ and faint trails; the GPX stores the grades (`<tp:section>`, `<tp:run>`) for the site.
  `--out <dir>` writes elsewhere, e.g. a scratch folder to try a route first.
- Via points (passes, junctions) force the intended trail. Put them **on the trail**, not on the hut
  or summit node: BRouter snaps to the nearest way, which may be a via ferrata or a T4 spur
  (happened at the Similaunhütte and below the Braunschweiger Hütte). For a marked long-distance
  trail, take via points from its OSM route relation (Overpass `relation[route=hiking][ref=E5]` →
  `way(r)` → `out geom`). For a better path, ask BRouter for `alternativeidx=1..3` with
  `format=geojson` and take a coordinate from the alternative that looks right.
- A huge detour (km instead of a pass) means the profile refuses a way: `hiking-mountain` stops at
  T3 and never uses `access=no`. `--sac 4` allows T4 for a stretch you mean to take (the site then
  flags it); a closed way needs the official detour (`--straight` only bridges a short signed gap).
- Never keep a ⚠ route without telling the owner. Compare km/Hm/time with the official stage
  numbers (hut or tourism site); a big gap means another trail was taken.
- DAV signpost colours in Germany: blue = T2, red = T3, black = T4–T6. Austria and South Tyrol use
  them differently — name the T-grade and the local rating.
- Be gentle with the free services: Nominatim max 1 request/s, no bulk routing on brouter.de,
  Overpass is often busy (the scripts try mirrors). User-Agent "tour-planner-prototype (hobby project)".

## Rules

- **Never type numbers by hand.** km, Höhenmeter, walking time, grades, clock times and totals are
  computed from the GPX. Text says "an mehreren Tagen", not "an drei Tagen".
- **Only sourced facts.** Hut seasons, places, timetables and rules get `quelle` (+ `geprueft`).
  Unknown stays empty; the page then shows a "fehlt" box, which is the content to-do list.
- Places are referenced by id from `orte.yaml`; coordinates come from OSM (`scripts/find.mjs`).
- Photos: `bilder` entries need a `motiv` (the shot list at /bildliste; also the alt text, so it
  must say what the photo shows). A real photo adds `src`, `credit`, `lizenz` and `quelle` (listed
  with links under "Quellen & Stand"); `ausschnitt` (CSS object-position) moves the crop. Files in
  `public/bilder/<slug>/`, hut and town photos as `bild` on the place in `orte.yaml`
  (`public/bilder/orte/`). Photo bar: Commons, original ≥ 2400 px, natural summer daylight, one
  calm mood across a trip.
- **Content errors block the whole site** (it shows the error list instead of the pages), so never
  leave a half-done trip behind.
- German UI, du-Form; numbers via `src/format.ts` (`8,3 km`, `1.099 Hm`).

## Look (from the owner's design — the trip hero is the baseline for every page)

- Colours: Tailwind **stone** only (`--stone-50…900` in `styles.css`); page background stone-100,
  cards white with a stone-200 border, no shadow, 12px radius. Colour only where it carries data:
  trail grades in the stage profile and grade bar, and limit warnings. Routes on maps are black.
- Fonts (Google Fonts): **La Belle Aurore** for page and tour titles (`h1`, tour cards, the
  "Jacobsen" wordmark under a small mono "WANDERGRUPPE"; header shows "←" back to the list), **IBM Plex Sans** for text and section headings (`h2`, `h3`), **IBM Plex Mono**
  for numbers, dates, times and small uppercase labels (like "ÜBERSICHT").
- Building blocks: numbers as one mono line (`.zahlen`, "9,9 km · ↑ 740 Hm · …"), key-value rows
  with a stone-300 rule (`.titel-werte`, `.tagesfakten`, `.praktisch`), small mono tags
  (`.etiketten`, `.badge`), the black day badge (`<TagNr>` / `.tag-badge`, same as on the route
  drawing), grades as plain text ("T3", "T3 (rot)"), black pill buttons (`.knopf`).
- Trip hero: full-bleed photo fading into the page, header on the photo, date in mono, script
  title, stats as mono rows. The overview card is a black "printed map" (`kartenelemente`):
  faint km grid, north arrow, scale bar, small legend (no frame lines around the map).

## Trip page

One layout: photo hero (title, numbers, overview card with route drawing and day profiles) →
section chips → "Darum diese Tour" with highlights → "Tag für Tag" as a table linking to each day →
"Ist das was für mich?" → Übernachtungen → Praktisches → FAQ → Quellen & Stand. (Earlier layout
experiments — map as hero, day cards, scroll story — were dropped on purpose; don't bring them back
without asking.)

## Dev helpers

`/bildliste` lists every photo still needed. `?felder=1` (or `screenshot.mjs --felder`) labels
every block with its schema field. The route drawing's smoothing is in
`src/components/glaetten.ts` (default "stark"; the real maps always stay exact).
