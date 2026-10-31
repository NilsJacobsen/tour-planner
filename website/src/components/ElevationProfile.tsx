// Elevation profile of one day, coloured by trail grade (from the GPX runs). On stage pages it
// can be scrubbed with mouse or finger to move a marker on the map; "mini" is the small version
// in stage cards. (The trip page uses the per-day profiles in Tagesprofile.tsx instead.)
// A day with several walking legs draws each leg on its own; a dotted line marks the transfer
// (bus, taxi, lift), whose height change is not walked.
import { useRef, type PointerEvent } from "react";
import type { Run } from "../content/gpx.ts";
import { km, meter } from "../format.ts";

type Props = {
  punkte: { dist: number; ele: number | null }[]; // dist in metres from the start
  runs?: Run[]; // point index ranges per grade
  teile?: { from: number; to: number }[]; // walking legs (point index ranges)
  wechsel?: { index: number; label: string }[]; // transfers: last point of a leg + what we ride
  farbe?: string;
  modus?: "voll" | "mini";
  hover?: number | null;
  onHover?: (i: number | null) => void;
  className?: string;
};

const W = 1000;
const H = 200;

export function ElevationProfile({ punkte, runs, teile, wechsel = [], farbe, modus = "voll", hover = null, onHover, className }: Props) {
  const overlay = useRef<HTMLDivElement>(null);
  const pts = punkte.filter((p) => p.ele != null) as { dist: number; ele: number }[];
  if (pts.length < 2) return null;

  const total = pts.at(-1)!.dist || 1;
  let lo = Math.min(...pts.map((p) => p.ele));
  let hi = Math.max(...pts.map((p) => p.ele));
  const pad = Math.max(40, (hi - lo) * 0.08);
  lo -= pad;
  hi += pad;
  const x = (dist: number) => (dist / total) * W;
  const y = (ele: number) => H - ((ele - lo) / (hi - lo)) * H;
  const lineD = (from: number, to: number) =>
    pts
      .slice(from, to + 1)
      .map((p, i) => `${i ? "L" : "M"}${x(p.dist).toFixed(1)},${y(p.ele).toFixed(1)}`)
      .join("");
  const areaD = (from: number, to: number) => `${lineD(from, to)}L${x(pts[to].dist).toFixed(1)},${H}L${x(pts[from].dist).toFixed(1)},${H}Z`;

  // Runs and legs refer to the original track points; when every point has an elevation the
  // indices match.
  const indizesOk = pts.length === punkte.length;
  const runsOk = runs && runs.length > 0 && indizesOk;
  const beine = indizesOk && teile && teile.length > 1 ? teile : [{ from: 0, to: pts.length - 1 }];
  const wechselOk = indizesOk ? wechsel.filter((w) => pts[w.index + 1]) : [];

  const indexAt = (clientX: number) => {
    const r = overlay.current!.getBoundingClientRect();
    const dist = Math.max(0, Math.min(1, (clientX - r.left) / r.width)) * total;
    let a = 0;
    let b = pts.length - 1;
    while (a < b) {
      const m = (a + b) >> 1;
      if (pts[m].dist < dist) a = m + 1;
      else b = m;
    }
    return a;
  };
  const move = (e: PointerEvent) => onHover?.(indexAt(e.clientX));

  const h = hover != null && pts[hover] ? pts[hover] : null;
  const maxEle = Math.max(...pts.map((p) => p.ele));
  const minEle = Math.min(...pts.map((p) => p.ele));

  return (
    <div className={`profil profil-${modus} ${className ?? ""}`}>
      {modus === "voll" && (
        <div className="profil-kopf">
          <span>
            {meter(minEle)} – {meter(maxEle)}
          </span>
          <span className="profil-readout" aria-live="polite">
            {h ? `km ${km(h.dist / 1000).replace(" km", "")} · ${meter(h.ele)}` : onHover ? "Zum Ablesen über das Profil fahren" : ""}
          </span>
        </div>
      )}
      <div className="profil-flaeche">
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
          {runsOk
            ? runs!.map((r, i) => <path key={i} d={areaD(r.from, Math.min(r.to, pts.length - 1))} className={`profil-run c-${r.cls}`} />)
            : beine.map((b) => <path key={b.from} d={areaD(b.from, b.to)} className="profil-area" style={farbe ? { fill: farbe } : undefined} />)}
          <path d={beine.map((b) => lineD(b.from, b.to)).join("")} className="profil-linie" vectorEffect="non-scaling-stroke" />
          {wechselOk.map((w) => (
            <line
              key={w.index}
              x1={x(pts[w.index].dist)}
              x2={x(pts[w.index].dist)}
              y1={y(pts[w.index].ele)}
              y2={y(pts[w.index + 1].ele)}
              className="profil-wechsel"
              vectorEffect="non-scaling-stroke"
            />
          ))}
          {h && <line x1={x(h.dist)} x2={x(h.dist)} y1={0} y2={H} className="profil-cursor" vectorEffect="non-scaling-stroke" />}
        </svg>
        {modus === "voll" &&
          wechselOk.map((w) => (
            <span key={w.index} className="profil-wechsel-label" style={{ left: `${(x(pts[w.index].dist) / W) * 100}%` }}>
              {w.label}
            </span>
          ))}
        {onHover && (
          <div
            ref={overlay}
            className="profil-overlay"
            onPointerMove={move}
            onPointerDown={move}
            onPointerLeave={(e) => e.pointerType === "mouse" && onHover(null)}
          />
        )}
      </div>
      {modus === "voll" && (
        <div className="profil-achse">
          <span>0 km</span>
          <span>{km(total / 1000)}</span>
        </div>
      )}
    </div>
  );
}
