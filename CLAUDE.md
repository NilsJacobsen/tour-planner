# Wandergruppe Jacobsen – tour planner

Multi-day hut trips for an internal hiking group, planned by chatting with Claude Code and
published as a small German website. The owner talks to Claude in English or German; reply in
the language they write. The site itself is always German, du-Form.

## Where things are

- `website/` – the trip site (Vite, React, TypeScript; content as Markdown/YAML validated by zod)
  on :5174, plus the planner scripts: BRouter routing (`scripts/route.mjs`), place lookup
  (`find.mjs`, `huts.mjs`), photos (`commons.mjs`), new trips (`neue-tour.mjs`). Content rules,
  routing pitfalls, look and scripts: `website/CLAUDE.md`.
- `.claude/skills/neue-tour/` – the playbook for planning a new trip end to end (`/neue-tour`).
- `.claude/agents/tour-pruefer.md` – reviewer agent for a finished trip.
- `chat-context.md` – the original idea discussion (German, historical).

## The group and its decisions

- Internal group: no sign-up, no forms, no prices (a trip may show a rough cost estimate when the
  owner asks). "Selling" a trip means making people want to come.
- Planning limits per day (unless the owner says otherwise): max 17 km, 1100 Hm up, T3 (DAV red).
  Harder stretches only as flagged variants.
- Start and end by public transport; staffed huts by default.
- Numbers come from the GPX, never typed by hand. Facts that can go stale carry a source and a
  check date. Unknown stays empty.
- Look: Tailwind stone, La Belle Aurore titles, IBM Plex Sans/Mono, white cards, black route
  drawings (details in `website/CLAUDE.md` → Look).
- Don't commit or deploy unless the owner asks.

## Trips so far

- `pyrenaeen` – 7 walking days around Gavarnie, Vignemale, Ordesa and Monte Perdido (France/Spain), with
  travel days by minibus (`plan`) and a cost estimate (`kosten`). Harder on purpose: own limits
  25 km / 1600 Hm; Monte Perdido, the Brèche north side and the Taillon are T4 and flagged. Best in
  the first half of September (Brèche hut water, ice on the Brèche).

- `pyrenaeen-zug` – the train alternative from Munich: Fri to Paris (hotel), Sat TGV to Perpignan and
  Train Jaune to Eyne; 7 walking days Eyne → Núria (Puigmal) → Ulldeter → Mantet → Mariailles
  (Canigó, the Cheminée only as a flagged side trip) → Casteil; bus and train to Collioure, Sun TGV home.
  Group limits; best in the second half of September (fire map until mid-Sept, huts and Train Jaune
  until about 27 Sept).

- `pyrenaeen-quer` – the "best of" crossing by train: 8 walking days from Lac de Gaube/Vignemale over the Col des
  Mulets, the Faja de Pelay (Ordesa), the Brèche de Roland (Taillon as the one optional summit) and the Cirque de
  Gavarnie; then by train via Toulouse, Latour-de-Carol and the Núria rack railway; Núria → Coll de Núria → Train
  Jaune; last day on foot along the coast from Collioure to Banyuls. Own limits 20 km / 1300 Hm / T3 (owner allowed
  some harder days and short T4). Best in the first half of September.

The two earlier test trips (Königssee, E5) were removed on 2026-11-01. The group travels from Munich.

Status of all: planning; dates not set.
