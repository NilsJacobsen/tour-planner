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

- `rund-um-den-koenigssee` – 4-day loop in Nationalpark Berchtesgaden (reference trip: variants,
  side trips, boat, self-catering hut).
- `e5-oberstdorf-meran` – 6 days on the E5 (one-way; bus/taxi legs between walking legs; Pitztaler
  Jöchl is T4 in OSM and flagged).

- `pyrenaeen` – 7 walking days around Gavarnie, Vignemale, Ordesa and Monte Perdido (France/Spain), with
  travel days by minibus (`plan`) and a cost estimate (`kosten`). Harder on purpose: own limits
  25 km / 1600 Hm; Monte Perdido, the Brèche north side and the Taillon are T4 and flagged. Best in
  the first half of September (Brèche hut water, ice on the Brèche).

Status of all: planning; dates not set.
