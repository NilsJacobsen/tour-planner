// One small, deliberately angular elevation profile per day. All days share the same height
// scale, so they compare at a glance. Black only: the profile line is thick, the frame
// (down from the start, along the bottom, up to the end) thin. Each profile links to its day and
// carries the same day badge as the route drawing above it.
import { Link } from "react-router";
import type { TourView } from "../content/model.ts";
import { dauer, hm, km } from "../format.ts";
import { simplify, type P } from "./glaetten.ts";

const W = 100;
const H = 60;
const ECKIG = 1; // simplification tolerance in viewBox units: higher = fewer, longer segments

type Props = { tour: TourView; aktiv?: number | null; onAktiv?: (tag: number | null) => void };

export function Tagesprofile({ tour, aktiv = null, onAktiv }: Props) {
  const eles = tour.etappen.flatMap((e) => e.standard.walk.points.flatMap((p) => (p.ele == null ? [] : [p.ele])));
  const min = Math.min(...eles);
  const max = Math.max(...eles);
  // A little floor below the lowest point and headroom above the highest.
  const lo = min - (max - min) * 0.15;
  const hi = max + (max - min) * 0.05;
  const y = (ele: number) => H - ((ele - lo) / (hi - lo)) * H;

  return (
    <ol
      className={`tagesprofile ${tour.etappen.length > 4 ? "viele" : ""} ${aktiv != null ? "hat-aktiv" : ""}`}
      style={{ gridTemplateColumns: `repeat(${tour.etappen.length}, minmax(0, 1fr))` }}
      aria-label="Höhenprofil je Tag"
    >
      {tour.etappen.map((e) => {
        const walk = e.standard.walk;
        const total = walk.points.at(-1)!.dist || 1;
        // One line per walking leg; a bus or taxi in between shows as a fine dotted step.
        const beine = walk.teile
          .map((t) =>
            simplify(
              walk.points.slice(t.from, t.to + 1).flatMap((p) => (p.ele == null ? [] : [[(p.dist / total) * W, y(p.ele)] as P])),
              ECKIG,
            ),
          )
          .filter((l) => l.length > 1);
        const pfad = (l: P[]) => l.map(([x, yy], i) => `${i ? "L" : "M"}${x.toFixed(1)},${yy.toFixed(1)}`).join("");
        const d = beine.map(pfad).join("");
        const uebergaenge = beine.slice(1).map((l, i) => pfad([beine[i].at(-1)!, l[0]]));
        const [x0, y0] = beine[0][0];
        const [x1, y1] = beine.at(-1)!.at(-1)!;
        const s = e.standard.stats;
        return (
          <li key={e.tag} className={aktiv === e.tag ? "aktiv" : undefined}>
            <Link
              to={`/touren/${tour.slug}/etappe/${e.tag}`}
              className="tagesprofil"
              onMouseEnter={() => onAktiv?.(e.tag)}
              onMouseLeave={() => onAktiv?.(null)}
              onFocus={() => onAktiv?.(e.tag)}
              onBlur={() => onAktiv?.(null)}
              aria-label={`Tag ${e.tag}: ${km(s.km)}, ${hm(s.up)} bergauf, ${hm(s.down)} bergab, ${dauer(s.hours)}`}
            >
              <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
                <path d={`M${x0.toFixed(1)},${y0.toFixed(1)}V${H}H${x1.toFixed(1)}V${y1.toFixed(1)}`} className="tagesprofil-rahmen" vectorEffect="non-scaling-stroke" />
                <path d={d} className="tagesprofil-linie" vectorEffect="non-scaling-stroke" />
                {uebergaenge.map((u) => (
                  <path key={u} d={u} className="tagesprofil-fahrt" vectorEffect="non-scaling-stroke" />
                ))}
              </svg>
              <span className="tagesprofil-nr">{e.tag}</span>
            </Link>
          </li>
        );
      })}
    </ol>
  );
}
