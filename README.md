# tour-planner

Hiking app for the Wandergruppe Jacobsen: plan multi-day treks by chatting with Claude Code, publish
them as a static site. To plan a new trip, ask Claude Code (it follows `.claude/skills/neue-tour/`).

- `website/`: the trip site (German, mobile first) with the content, the planner scripts (BRouter
  routing, place lookup, photos) and the checks. See `website/CLAUDE.md`.
- `chat-context.md`: the original idea discussion (German).
