// The whole trip as a drawing: lakes, the day lines, dashed cable-car/boat legs, huts and day
// numbers. Pure SVG from the GPX data — no map tiles, loads instantly.
// Two styles: "farbig" (a colour per day) and "mono" (black only; differences shown by line
// width and dash style, lakes hatched — used on the overview card).
import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { Karte } from "../content/model.ts";
import { kurzName, tagFarbe } from "../text.ts";
import { useWireframe } from "../wireframe.tsx";
import { GLAETTUNG, glaetten, mitte, pfad, type P } from "./glaetten.ts";

const X = (lon: number) => (lon * Math.PI) / 180;
const Y = (lat: number) => Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));

type Props = {
  karte: Karte;
  aktiv?: number | null; // highlighted day (colour: others turn grey; mono: it gets thicker)
  mini?: boolean; // small version for cards: no labels, no numbers
  stil?: "farbig" | "mono";
  onSelect?: (tag: number) => void;
  onHover?: (tag: number | null) => void;
  className?: string;
  kartenelemente?: boolean; // km grid, north arrow and scale bar, like a printed map
  maxHoehe?: number; // px; taller routes are scaled down to fit
  titel?: string; // small label in the top-left corner of the drawing (route and labels keep clear)
};

const R_ERDE = 6371000;
const STUFEN_KM = [0.25, 0.5, 1, 2, 5, 10, 20, 50];
const kmText = (k: number) => `${k.toLocaleString("de-DE")} km`;

export function RouteOutline({ karte, aktiv = null, mini = false, stil = "farbig", onSelect, onHover, className, kartenelemente = false, titel, maxHoehe }: Props) {
  const mono = stil === "mono";
  const schraffur = `schraffur${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const ref = useRef<HTMLDivElement>(null);
  const [breite, setBreite] = useState(360);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setBreite(Math.max(120, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Fit the routes into the width; 1 SVG unit = 1 CSS pixel so strokes and text stay crisp.
  // The small version leaves out variants and side trips, so it fits only what it draws.
  const [minLon, minLat, maxLon, maxLat] = useMemo(() => {
    if (!mini) return karte.bbox;
    const pts = [
      ...karte.etappen.flatMap((e) => e.linien.flat()),
      ...karte.fahrten.flatMap((f) => [f.von, f.nach]),
      ...karte.orte.map(({ ort }) => [ort.lon, ort.lat] as [number, number]),
    ];
    const lons = pts.map((p) => p[0]);
    const lats = pts.map((p) => p[1]);
    return [Math.min(...lons), Math.min(...lats), Math.max(...lons), Math.max(...lats)];
  }, [karte, mini]);
  // A printed-map look needs room in the corners for the north arrow and the scale bar.
  const padX = (X(maxLon) - X(minLon)) * (mini ? 0.06 : kartenelemente ? 0.14 : 0.1);
  const padY = (Y(maxLat) - Y(minLat)) * (mini ? 0.06 : kartenelemente ? 0.12 : 0.08);
  const geoBreite = X(maxLon) - X(minLon) + 2 * padX;
  const geoHoehe = Y(maxLat) - Y(minLat) + 2 * padY;
  const oben = titel ? 48 : 0; // extra room above the drawing for the title
  // Fill the width; a tall route that would get higher than maxHoehe is scaled down and centred.
  const s = maxHoehe && geoHoehe * (breite / geoBreite) + oben > maxHoehe ? (maxHoehe - oben) / geoHoehe : breite / geoBreite;
  const x0 = X(minLon) - padX - (breite / s - geoBreite) / 2;
  const y1 = Y(maxLat) + padY;
  const hoehe = Math.round(geoHoehe * s) + oben;
  const px = (lon: number) => +((X(lon) - x0) * s).toFixed(1);
  const py = (lat: number) => +((y1 - Y(lat)) * s + oben).toFixed(1);
  const d = (coords: [number, number][]) => coords.map(([lon, lat], i) => `${i ? "L" : "M"}${px(lon)},${py(lat)}`).join("");

  // Route lines in pixels, smoothed as set in the wireframe toolbar (lakes stay as they are).
  const { glaettung } = useWireframe();
  const linien = useMemo(() => {
    const g = GLAETTUNG[glaettung];
    const proj = (c: [number, number][]): P[] => c.map(([lon, lat]) => [(X(lon) - x0) * s, (y1 - Y(lat)) * s + oben]);
    const linie = (c: [number, number][]) => {
      const p = glaetten(proj(c), g);
      return { d: pfad(p, g != null), p };
    };
    // A day with a bus or taxi in between has several walking legs: one subpath each. The day
    // number goes on the longest leg.
    const laenge = (p: P[]) => p.reduce((sum, q, i) => (i ? sum + Math.hypot(q[0] - p[i - 1][0], q[1] - p[i - 1][1]) : 0), 0);
    const linien = (cs: [number, number][][]) => {
      const teile = cs.map(linie);
      const laengste = teile.reduce((a, b) => (laenge(b.p) > laenge(a.p) ? b : a));
      return { d: teile.map((t) => t.d).join(""), p: laengste.p };
    };
    return karte.etappen.map((e) => {
      const haupt = linien(e.linien);
      return {
        tag: e.tag,
        d: haupt.d,
        nummer: mitte(haupt.p),
        varianten: e.varianten.map((v) => ({ id: v.id, d: linien(v.linien).d })),
        abstecher: e.abstecher.map((a) => ({ id: a.id, d: linie(a.linie).d })),
      };
    });
    // x0, y1 and s follow from karte, breite and mini, so these are all the inputs.
  }, [karte, breite, mini, glaettung, oben, maxHoehe]);

  // Place labels so they stay inside the drawing and don't sit on a day number or on another
  // label: try right, left, above and below the point, take the one with the least overlap.
  type Box = { x0: number; y0: number; x1: number; y1: number };
  const ueberlappung = (a: Box, b: Box) => Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)) * Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0));
  const nummern: Box[] = linien.map((e) => ({ x0: e.nummer[0] - 11, y0: e.nummer[1] - 11, x1: e.nummer[0] + 11, y1: e.nummer[1] + 11 }));
  const titelBox: Box | null = titel ? { x0: 0, y0: 0, x1: 20 + titel.length * 10, y1: 50 } : null;
  const belegt: Box[] = titelBox ? [titelBox] : [];
  // Other place markers count as taken (with some room), so a label never ends right at another hut.
  const marker = karte.orte.map(({ ort }) => ({ id: ort.id, box: { x0: px(ort.lon) - 14, y0: py(ort.lat) - 9, x1: px(ort.lon) + 14, y1: py(ort.lat) + 9 } }));
  // Start and end are labelled first; a hut label that finds no free spot is left out (on wide
  // trips the huts of one valley sit almost on top of each other, the day numbers still show them).
  const reihenfolge = [...karte.orte].sort((a, b) => Number(a.rolle === "huette") - Number(b.rolle === "huette"));
  const labels = mini
    ? []
    : reihenfolge.flatMap(({ ort, rolle }) => {
        const x = px(ort.lon);
        const y = py(ort.lat);
        const text = kurzName(ort.name);
        const w = text.length * 7; // rough width of 12px semibold text
        const kandidaten = [
          { dx: 8, dy: 4, anker: "start" },
          { dx: -8, dy: 4, anker: "end" },
          { dx: 6, dy: -9, anker: "start" },
          { dx: -6, dy: -9, anker: "end" },
          { dx: 6, dy: 17, anker: "start" },
          { dx: -6, dy: 17, anker: "end" },
        ] as const;
        let beste: { k: (typeof kandidaten)[number]; box: Box; wert: number } | null = null;
        for (const [i, k] of kandidaten.entries()) {
          const x0 = k.anker === "start" ? x + k.dx : x + k.dx - w;
          const box = { x0, x1: x0 + w, y0: y + k.dy - 11, y1: y + k.dy + 3 };
          const draussen = Math.max(0, -box.x0) + Math.max(0, box.x1 - breite) + Math.max(0, -box.y0) + Math.max(0, box.y1 - hoehe);
          const andere = marker.filter((m) => m.id !== ort.id).map((m) => m.box);
          const wert = draussen * 50 + [...nummern, ...belegt, ...andere].reduce((sum, b) => sum + ueberlappung(box, b), 0) + i;
          if (!beste || wert < beste.wert) beste = { k, box, wert };
        }
        const k = beste!.k;
        if (rolle === "huette" && beste!.wert - kandidaten.indexOf(k) > 40) return [];
        belegt.push(beste!.box);
        return [{ ort, rolle, x, y, text, dx: k.dx, dy: k.dy, anker: k.anker }];
      });

  // Scale: in Web Mercator one pixel covers R·cos(lat)/s metres on the ground. The bar is about a
  // fifth of the width, rounded to a nice distance; the faint grid uses the same step.
  const mProPx = (R_ERDE * Math.cos((((minLat + maxLat) / 2) * Math.PI) / 180)) / s;
  const zielKm = (breite * 0.2 * mProPx) / 1000;
  const stufe = STUFEN_KM.reduce((a, b) => (Math.abs(Math.log(b / zielKm)) < Math.abs(Math.log(a / zielKm)) ? b : a));
  const stufePx = (stufe * 1000) / mProPx;
  const gitter = (() => {
    if (!kartenelemente) return { x: [] as number[], y: [] as number[] };
    const versatz = (v: number) => ((v % stufePx) + stufePx) % stufePx;
    const reihe = (start: number, bis: number) => Array.from({ length: Math.ceil((bis - start) / stufePx) }, (_, i) => +(start + i * stufePx).toFixed(1));
    return { x: reihe(versatz(-x0 * s), breite), y: reihe(versatz(y1 * s + oben), hoehe) };
  })();
  // North arrow and scale bar go into the top / bottom corner with the least drawing in it.
  const ecke = (() => {
    if (!kartenelemente) return { nord: [0, 0], massstab: [0, 0] };
    const punkte: P[] = [
      ...karte.etappen.flatMap((e) => [...e.linien, ...e.varianten.flatMap((v) => v.linien), ...e.abstecher.map((a) => a.linie)]).flat(),
      ...karte.orte.map(({ ort }) => [ort.lon, ort.lat] as [number, number]),
    ].map(([lon, lat]) => [px(lon), py(lat)]);
    const voll = (x: number, y: number, w: number, h: number) => punkte.filter(([a, b]) => a > x - 10 && a < x + w + 10 && b > y - 10 && b < y + h + 10).length;
    const rand = 14;
    const nw = 22, nh = 44; // north arrow box
    const mw = stufePx + 40, mh = 26; // scale bar box with its labels
    // The title sits top left, so the arrow only goes there without one.
    const nord: [number, number] = titel || voll(breite - rand - nw, rand, nw, nh) <= voll(rand, rand, nw, nh) ? [breite - rand - nw / 2, rand + 26] : [rand + nw / 2, rand + 26];
    const massstab: [number, number] = voll(rand, hoehe - rand - mh, mw, mh) <= voll(breite - rand - mw, hoehe - rand - mh, mw, mh) ? [rand, hoehe - rand - 6] : [breite - rand - stufePx - 34, hoehe - rand - 6];
    return { nord, massstab };
  })();

  const grau = "var(--linie-inaktiv)";
  // Mono: the highlighted day stays black, the others turn light grey.
  const farbe = (tag: number) => (aktiv == null || aktiv === tag ? (mono ? "currentColor" : tagFarbe(tag)) : mono ? "var(--stone-300)" : grau);
  // Mono shows the highlighted day by width alone: it gets thicker, the others thinner.
  const breiteLinie = (tag: number) => {
    if (mini) return aktiv == null || aktiv === tag ? 2.5 : 1.5;
    if (aktiv === tag) return 4.5;
    if (mono) return aktiv == null ? 2.75 : 1.75;
    return 3.5;
  };
  const hover = (tag: number | null) => (onHover ? () => onHover(tag) : undefined);

  return (
    <div ref={ref} className={`umriss ${mini ? "umriss-mini" : ""} ${mono ? "umriss-mono" : ""} ${kartenelemente ? "umriss-karte" : ""} ${className ?? ""}`}>
      <svg width={breite} height={hoehe} viewBox={`0 0 ${breite} ${hoehe}`} role="img" aria-label="Übersicht der ganzen Tour">
        {mono && (
          <defs>
            {/* Water as horizontal hatching, like a black-and-white map. */}
            <pattern id={schraffur} width={4} height={3.5} patternUnits="userSpaceOnUse">
              <line x1={0} y1={1.75} x2={4} y2={1.75} className="umriss-schraffur" />
            </pattern>
          </defs>
        )}
        {kartenelemente && (
          <g className="umriss-gitter" aria-hidden="true">
            {gitter.x.map((x) => (
              <line key={`x${x}`} x1={x} y1={0} x2={x} y2={hoehe} />
            ))}
            {gitter.y.map((y) => (
              <line key={`y${y}`} x1={0} y1={y} x2={breite} y2={y} />
            ))}
          </g>
        )}
        {karte.wasser.map((ring, i) => (
          <path key={i} d={`${d(ring)}Z`} className="umriss-wasser" style={mono ? { fill: `url(#${schraffur})` } : undefined} />
        ))}

        {karte.fahrten.map((f, i) => (
          <line key={i} x1={px(f.von[0])} y1={py(f.von[1])} x2={px(f.nach[0])} y2={py(f.nach[1])} className="umriss-fahrt" />
        ))}
        {!mini &&
          karte.fahrten
            .filter((f) => f.fern)
            .map((f, i) => {
              const x = px(f.nach[0]), y = py(f.nach[1]);
              const rechts = f.nach[0] >= f.von[0];
              return (
                <text key={`fern${i}`} x={x + (rechts ? 6 : -6)} y={y + 4} textAnchor={rechts ? "start" : "end"} className="umriss-label umriss-fern">
                  {rechts ? `${f.ziel} →` : `← ${f.ziel}`}
                </text>
              );
            })}

        {!mini &&
          linien.map((e) => (
            <g key={e.tag} className="umriss-tag">
              {e.varianten.map((v) => (
                <path key={v.id} d={v.d} className="umriss-variante" stroke={farbe(e.tag)} />
              ))}
              {e.abstecher.map((a) => (
                <path key={a.id} d={a.d} className="umriss-abstecher" stroke={farbe(e.tag)} />
              ))}
            </g>
          ))}

        {/* Main lines on top; the active day last so it is never covered. */}
        {[...linien]
          .sort((a, b) => Number(a.tag === aktiv) - Number(b.tag === aktiv))
          .map((e) => (
            <g
              key={e.tag}
              className={onSelect ? "umriss-klickbar" : undefined}
              onClick={onSelect ? () => onSelect(e.tag) : undefined}
              onMouseEnter={hover(e.tag)}
              onMouseLeave={hover(null)}
            >
              <path d={e.d} className="umriss-casing" />
              <path d={e.d} className="umriss-linie" stroke={farbe(e.tag)} strokeWidth={breiteLinie(e.tag)} />
              {onSelect && <path d={e.d} className="umriss-trefferflaeche" />}
            </g>
          ))}

        {karte.orte.map(({ ort, rolle }) => (
          <g key={ort.id + rolle} transform={`translate(${px(ort.lon)},${py(ort.lat)})`}>
            {rolle === "huette" ? <rect x={-4.5} y={-4.5} width={9} height={9} className="umriss-huette" /> : <circle r={4} className="umriss-start" />}
          </g>
        ))}
        {labels.map((l) => (
          <text key={l.ort.id + l.rolle} x={l.x + l.dx} y={l.y + l.dy} textAnchor={l.anker} className="umriss-label">
            {l.text}
          </text>
        ))}

        {!mini &&
          linien.map((e) => (
            <g
              key={e.tag}
              transform={`translate(${e.nummer[0].toFixed(1)},${e.nummer[1].toFixed(1)})`}
              className="umriss-nummer"
              onClick={onSelect ? () => onSelect(e.tag) : undefined}
              onMouseEnter={hover(e.tag)}
              onMouseLeave={hover(null)}
            >
              <circle r={mono ? 9 : 10} fill={farbe(e.tag)} />
              <text y={4}>{e.tag}</text>
            </g>
          ))}

        {/* Vertically centred on the compass beside it (N top to arrow foot = y 16…48). */}
        {titel && (
          <text x={20} y={37.5} className="umriss-titel">
            {titel}
          </text>
        )}
        {kartenelemente && (
          <>
            <g className="umriss-nord" transform={`translate(${ecke.nord[0]},${ecke.nord[1]})`} aria-label="Norden">
              <path d="M0,-12L6,8L0,4Z" className="voll" />
              <path d="M0,-12L-6,8L0,4Z" className="leer" />
              <text y={-16}>N</text>
            </g>
            <g className="umriss-massstab" transform={`translate(${ecke.massstab[0]},${ecke.massstab[1]})`} aria-label={`Maßstab: ${kmText(stufe)}`}>
              <rect x={0} y={0} width={stufePx / 2} height={4} className="voll" />
              <rect x={stufePx / 2} y={0} width={stufePx / 2} height={4} className="leer" />
              <text x={0} y={-5}>0</text>
              <text x={stufePx} y={-5} textAnchor="end">
                {kmText(stufe)}
              </text>
            </g>
          </>
        )}
      </svg>
    </div>
  );
}
