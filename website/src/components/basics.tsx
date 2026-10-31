import { useEffect, useRef, useState, type ReactNode } from "react";
import { marked } from "marked";
import { Link } from "react-router";
import { T_GRADES, type GradeClass, type TGrade } from "../content/gpx.ts";
import { KONDITION, KONDITION_MAX, type LimitFlag, type Stats } from "../content/model.ts";
import type { Bild as BildT } from "../content/schema.ts";
import { dauer, hm, km } from "../format.ts";
import { CLASS_KURZ, CLASS_NAME, DAV_FARBE, GRADE_NAME } from "../text.ts";

const ASPECT = { quer: "3 / 2", hoch: "4 / 5", quadrat: "1 / 1", panorama: "21 / 9" } as const;

// Photo, or a placeholder that describes the shot we still need.
export function Bild({ bild, format, className }: { bild?: BildT; format?: keyof typeof ASPECT; className?: string }) {
  const f = format ?? bild?.format ?? "quer";
  if (bild?.src) {
    return <img className={`bild ${className ?? ""}`} src={bild.src} alt={bild.motiv} loading="lazy" style={{ aspectRatio: ASPECT[f], objectPosition: bild.ausschnitt }} />;
  }
  return (
    <div className={`bild bild-platzhalter ${className ?? ""}`} style={{ aspectRatio: ASPECT[f] }} role="img" aria-label={bild?.motiv ?? "Foto"}>
      <span className="bild-motiv">
        <span className="bild-kennung">Foto</span>
        {bild?.motiv ?? "Motiv noch offen"}
      </span>
    </div>
  );
}

// Content Markdown is our own (in the repo), so rendering it as HTML is safe.
export function Markdown({ text, className }: { text: string; className?: string }) {
  return <div className={`prosa ${className ?? ""}`} dangerouslySetInnerHTML={{ __html: marked.parse(text, { async: false }) as string }} />;
}

// Grade as plain text, like the hero: "T3", or "T3 (rot)" with the DAV signpost colour.
export function GradeBadge({ grade, mitFarbe = false }: { grade: TGrade | null; mitFarbe?: boolean }) {
  if (!grade) return <span className="grade" title="Keine Bewertung">T?</span>;
  const farbe = DAV_FARBE[grade];
  return (
    <span className="grade" title={`${grade} – ${GRADE_NAME[grade]}${farbe ? ` (DAV: ${farbe})` : ""}`}>
      {grade}
      {mitFarbe && farbe && ` (${farbe})`}
    </span>
  );
}

// The day badge used everywhere: black circle, white mono digit (same as on the route drawing).
export function TagNr({ tag, to }: { tag: number; to?: string }) {
  return to ? (
    <Link className="tag-badge" to={to} aria-label={`Tag ${tag}`}>
      {tag}
    </Link>
  ) : (
    <span className="tag-badge">{tag}</span>
  );
}

// "überwiegend T2 · 1,6 km T3" plus a bar of km per grade.
export function GradeMix({ meters, dominant, kompakt = false }: { meters: Stats["meters"]; dominant: TGrade | null; kompakt?: boolean }) {
  const order: GradeClass[] = ["road", "T1", "T2", "T3", "T4", "T5", "T6", "path", "via_ferrata"];
  const parts = order.filter((c) => (meters[c] ?? 0) > 0).map((c) => ({ c, m: meters[c]! }));
  const total = parts.reduce((s, p) => s + p.m, 0);
  const di = dominant ? T_GRADES.indexOf(dominant) : -1;
  // Every harder grade is listed, even a few metres: the badge shows the hardest one anyway.
  const haerter = T_GRADES.filter((g, i) => i > di && (meters[g] ?? 0) > 0);
  const kmText = (m: number) => (m < 100 ? "<0,1 km" : km(m / 1000));
  return (
    <div className="grademix">
      <div className="grademix-text">
        {dominant ? (
          <>
            überwiegend <strong>{dominant}</strong>
            {haerter.map((g) => (
              <span key={g}>
                {" "}
                · {kmText(meters[g]!)} <strong>{g}</strong>
              </span>
            ))}
            {(meters.via_ferrata ?? 0) > 0 && <span> · {kmText(meters.via_ferrata!)} Klettersteig</span>}
          </>
        ) : (
          "keine Bewertung"
        )}
      </div>
      {!kompakt && total > 0 && (
        <div className="grademix-bar" aria-hidden="true">
          {parts.map((p) => (
            <span key={p.c} className={`seg c-${p.c}`} style={{ flexGrow: p.m }} title={`${CLASS_NAME[p.c]}: ${km(p.m / 1000)}`} />
          ))}
        </div>
      )}
      {!kompakt && total > 0 && (
        <ul className="grademix-legende">
          {parts.map((p) => (
            <li key={p.c}>
              <span className={`swatch c-${p.c}`} /> {CLASS_KURZ[p.c]} {km(p.m / 1000)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function StatChips({ stats, extra }: { stats: Stats; extra?: ReactNode }) {
  return (
    <ul className="zahlen" aria-label="Kennzahlen">
      <li>{km(stats.km)}</li>
      <li>↑ {hm(stats.up)}</li>
      <li>↓ {hm(stats.down)}</li>
      <li title="Reine Gehzeit nach DIN 33466, ohne Pausen">{dauer(stats.hours)}</li>
      <li>
        <GradeBadge grade={stats.grade} />
      </li>
      {extra}
    </ul>
  );
}

export function LimitChips({ grenzen }: { grenzen: LimitFlag[] }) {
  const was = { km: "Strecke", hm: "Höhenmeter", T: "Schwierigkeit" } as const;
  return (
    <>
      {grenzen.map((g) => (
        <li key={g.was} className={`limit ${g.status}`} title={`Grenze der Planung: ${g.grenze}`}>
          {g.status === "am" ? "am Limit" : "über Limit"}: {was[g.was]}
        </li>
      ))}
    </>
  );
}

export function Kondition({ stufe, mitText = true }: { stufe: number; mitText?: boolean }) {
  const text = KONDITION.find((k) => k.stufe === stufe)?.text ?? KONDITION_MAX.text;
  return (
    <span className="kondition" title={`Kondition: ${stufe} von 5 – ${text}`}>
      <span aria-hidden="true">
        {"●".repeat(stufe)}
        <span className="aus">{"●".repeat(5 - stufe)}</span>
      </span>
      {mitText && <span className="kondition-text">{text}</span>}
    </span>
  );
}

export function Quelle({ url, geprueft }: { url?: string; geprueft?: string }) {
  if (!url) return null;
  const host = new URL(url).hostname.replace(/^www\./, "");
  return (
    <span className="quelle">
      Quelle:{" "}
      <a href={url} target="_blank" rel="noreferrer">
        {host}
      </a>
      {geprueft && <> · geprüft {new Date(`${geprueft}T12:00:00`).toLocaleDateString("de-DE")}</>}
    </span>
  );
}

// Renders children only once they come near the viewport (maps are heavy).
export function LazyMount({ children, className, minHeight }: { children: ReactNode; className?: string; minHeight?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [sichtbar, setSichtbar] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || sichtbar) return;
    const io = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && setSichtbar(true), {
      rootMargin: "400px 0px",
    });
    io.observe(el);
    return () => io.disconnect();
  }, [sichtbar]);
  return (
    <div ref={ref} className={className} style={{ minHeight }}>
      {sichtbar ? children : <div className="karte-laedt">Karte</div>}
    </div>
  );
}

export function InfoLink({ seite, children }: { seite: string; children: ReactNode }) {
  return (
    <Link className="info-link" to={`/info/${seite}`}>
      {children}
    </Link>
  );
}
