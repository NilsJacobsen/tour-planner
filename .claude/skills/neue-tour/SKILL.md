---
name: neue-tour
description: Plan a new multi-day hut trip for the Wandergruppe Jacobsen end to end — research, BRouter routes, German content files, photos, checks — and add it to the trip site (website/). Use when the user asks to plan, add or create a tour/Tour/trip/Etappe, or to rework an existing one.
---

# Neue Tour planen

You are the planner for an internal hiking group. A trip is "done" when the site shows it with
real routes, sourced facts, honest difficulty, good photos, and `npm run check` reports 0 errors.
Read `website/CLAUDE.md` (content, routing, look) before you start; all commands below run in
`website/`. The existing trips are the reference for tone and depth, starting with
`website/content/touren/pyrenaeen/` (loop by minibus, travel days in `plan`, cost estimate, flagged T4
summits, side trip). The earlier test trips (Königssee, E5) were removed; the pitfalls below still
name places from them.

## 0. Brief

Settle these with the user (ask only what you can't default):

| | Default |
|---|---|
| Region / idea | — (ask) |
| Days | — (ask) |
| Limits per day | max 17 km, 1100 Hm up, T3 (DAV red). Over it only as a flagged variant |
| Start / end | reachable by train + bus; loop or one-way with a way back |
| Nights | staffed huts (Halbpension); self-catering only if it's special, and say so |
| Season | July–September unless the user says otherwise |

If the user says "just plan it", pick the defaults and state them in your report.

## 1. Research (web search, official sources first)

- Find the classic route and the stage points: hut websites, Alpenverein (DAV/ÖAV/AVS), regional
  tourism sites, bergwelten.com, the OSM route relation for named trails.
- For every fact that can go stale, keep the URL and today's date (`quelle`, `geprueft`): hut
  season and booking, beds/Lager, timetables (bus, cable car, boat: first/last departure, Takt),
  closures and detours **for the planned year**, taxis. Unknown stays empty — never guess.
- Note the official numbers per stage (km, Hm, time). You'll compare BRouter's numbers to them.
- Look for what makes each day worth it: a lake, a viewpoint side trip, a gorge, a hut terrace.

## 2. Places (`content/allgemein/orte.yaml`)

Every hut, start, pass, viewpoint, lift and bus stop the trip names gets an entry (id, name,
typ, lat/lon from `node scripts/find.mjs "<name>"` or `scripts/huts.mjs`, official `hoehe`,
`web`, hut facts with `quelle` + `geprueft`). Reuse existing entries. Add a `bild` for every
overnight place (step 5).

## 3. Routes (BRouter)

One GPX per walking leg, written straight into the trip:

```sh
node scripts/route.mjs tag-1-<ziel> "<Titel>" <lat,lon> <via> … <lat,lon> --tour <slug>
```

- Via points on the trail itself (from the OSM relation or a trail junction), never on the hut node.
- Compare km / Hm / time with the official numbers (±10 %). A big gap means another path was taken:
  look at the route on the day page map (`npm run dev`, or a screenshot) and fix the via points.
- ⚠ warnings: via ferrata, T4+, faint trails. Never keep one silently. `--sac 4` only for a T4
  stretch you mean to take (the site then flags it); `--straight` only to bridge a short signed
  detour that OSM still tags as closed.
- Each day within the limits. If the classic stage is longer, split it, use a lift/bus leg, or offer
  the long way as `alternative`.
- Good trips also have: a `schlechtwetter` way where a pass is exposed, `abstecher` (evening side
  trips without packs), and transport legs with real timetables (`abfahrt`, `takt`).

## 4. Content (`content/touren/<slug>/`)

```sh
node scripts/neue-tour.mjs <slug> "<Titel>" --orte <start>,<nacht-1>,…,<ziel>
```

Fill every TODO (the check fails while one is left; and while it fails, the whole site shows the
error list, so finish or delete the folder before you stop). Lakes for the route drawing:
`node scripts/osm-wasser.mjs <slug> <süd,west,nord,ost> "<See>" …`.

Writing (German, du-Form, warm and concrete):
- `titel` short; `untertitel` one sentence that makes people want to come.
- "Darum diese Tour": 3–4 short paragraphs, day by day, places in **bold**.
- No numbers typed by hand (km, Hm, times, "an drei Tagen") — the site computes them.
- No superlatives without a source ("höchste", "steilste", "schönste").
- `anforderungen`, `schluesselstellen`, `notabstieg`: honest, specific, no drama.
- 3–5 `highlights`, each tied to a day; 4–6 FAQ the group will really ask.

## 5. Photos (Wikimedia Commons)

```sh
node scripts/commons.mjs suche "<Ort>" [--qualitaet] [--min 2400]   # look at every preview with Read
node scripts/commons.mjs hole "File:…" public/bilder/<slug>/<name>.jpg   # prints the bild entry
```

Quality bar: original ≥ 2400 px wide (hero ≥ 3000), sharp, straight horizon, no heavy HDR. One mood
across the set: natural summer/early-autumn daylight, blue or lightly clouded sky, calm and
documentary. No winter in the valleys, night or orange sunsets. The `motiv` must describe what the
photo really shows (it's the alt text) — "Die Gruppe am …" shots can't come from Commons, so take
the place and rewrite the motiv. Set `ausschnitt` (CSS object-position) if the subject is off-centre.
Hero = `bilder[0]`: wide, interest in the centre, calm lower half (it fades into the page).

## 6. Verify

1. `npm run check` → 0 errors. Every warning explained in your report or fixed.
2. `npm run check -- --ablauf` → read each day's clock times: start reachable from the night
   before; arrival at the hut by about 17:00; buffer before the last lift/boat/bus; waits that make
   sense.
3. Screenshots (dev server `npm run dev`, port 5174), phone first:
   `node scripts/screenshot.mjs /touren/<slug> out.png --mobile --full` and each
   `/touren/<slug>/etappe/<n>`. Look at them: no console errors, no horizontal overflow, photos fit.
4. Have the `tour-pruefer` agent review the trip with fresh eyes; fix what it finds.

## 7. Report to the user (German if they write German)

Lead with the result, then a table per day (from → to, km, ↑, time, grade, night), then caveats:
flagged stretches, timetables that still need confirming, facts left empty, photo compromises.
Don't commit or deploy unless asked.

## What makes a great trip

- Every day has a reason (a view, a lake, a gorge, a special hut) and the highlights say it.
- Days feel even; the hardest day isn't the first.
- Start and end by public transport, with concrete lines and times.
- Each exposed pass has a bad-weather plan or an escape route.
- Water, Einkehr and self-catering nights are clear before people pack.
- Difficulty is honest: hardest stretch named, T-grade and DAV colour, no "easy" where it isn't.

## Pitfalls we've hit

- BRouter snaps to the nearest way: a via point on a hut node pulled the route onto a via ferrata
  or a T4 spur (Similaunhütte, Braunschweiger Hütte). Put via points on the trail.
- `hiking-mountain` refuses T4 and `access=no`: a detour of kilometres means a refused way
  (Pitztaler Jöchl = T4 in OSM → `--sac 4` and flag it; Zams descent closed → official detour).
- A bridge or path crossing above another: check the track really uses the bridge (Holzgau).
- Waypoint order matters; a wrong order makes loops and doubles the distance.
- A summit node can sit on a harder ridge path: Monte Perdido's summit snapped onto 20 m of T6.
  Put the summit via a few metres down the normal route.
- Official tracks often exist as data: the Hautes-Pyrénées tourism sites run Geotrek
  (`geotrek65admin.openig.org/api/v2/trek/<id>/?format=json` → `geometry`). Take via points from
  them and compare the route against them, not just the km.
- Owner pitches can contain claims that don't hold (Pyrenees: "the sun sets into the sea at Sète";
  in September it sets over the Étang de Thau). Check them like any other fact and tell the owner.
- Official long-distance trail ≠ the tourist variant (E5 officially via Timmelsjoch; the hut
  variant via Similaun isn't in the ERA relation).
- Austrian/Italian signpost colours differ from the DAV ones; name the T-grade and the local rating.
- Timetables change every year: check the planned year, keep the source, prefer `takt` over a
  single departure.
- Nominatim max 1 request/s; Overpass is often busy (the scripts try mirrors); be gentle with
  brouter.de and Commons. User-Agent: "tour-planner-prototype (hobby project)".
