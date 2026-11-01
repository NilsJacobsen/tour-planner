// Small simplified country flags as SVG (emoji flags show up as two letters on Windows).
import type { Land } from "../content/schema.ts";

const NAME: Record<Land, string> = {
  de: "Deutschland",
  at: "Österreich",
  ch: "Schweiz",
  it: "Italien",
  fr: "Frankreich",
  es: "Spanien",
  ad: "Andorra",
  si: "Slowenien",
};

// Stripes as [colour, …]; "h" = horizontal, "v" = vertical. Coats of arms are left out.
const STREIFEN: Record<Exclude<Land, "ch">, { richtung: "h" | "v"; farben: string[]; anteile?: number[] }> = {
  de: { richtung: "h", farben: ["#000", "#dd0000", "#ffce00"] },
  at: { richtung: "h", farben: ["#c8102e", "#fff", "#c8102e"] },
  it: { richtung: "v", farben: ["#009246", "#fff", "#ce2b37"] },
  fr: { richtung: "v", farben: ["#002654", "#fff", "#ce1126"] },
  es: { richtung: "h", farben: ["#aa151b", "#f1bf00", "#aa151b"], anteile: [1, 2, 1] },
  ad: { richtung: "v", farben: ["#10069f", "#fedf00", "#d50032"] },
  si: { richtung: "h", farben: ["#fff", "#0000ff", "#ff0000"] },
};

export function Flagge({ land }: { land: Land }) {
  const w = 18, h = 12;
  let inhalt;
  if (land === "ch") {
    inhalt = (
      <>
        <rect width={w} height={h} fill="#da291c" />
        <path d="M7.5,2.5h3v2.5h2.5v3h-2.5v2.5h-3v-2.5h-2.5v-3h2.5z" fill="#fff" />
      </>
    );
  } else {
    const { richtung, farben, anteile = farben.map(() => 1) } = STREIFEN[land];
    const summe = anteile.reduce((a, b) => a + b, 0);
    let pos = 0;
    inhalt = farben.map((f, i) => {
      const anteil = anteile[i] / summe;
      const r = richtung === "v" ? { x: pos * w, y: 0, width: anteil * w + 0.01, height: h } : { x: 0, y: pos * h, width: w, height: anteil * h + 0.01 };
      pos += anteil;
      return <rect key={i} {...r} fill={f} />;
    });
    // Andorra without its coat of arms would look like Romania: hint at the shield.
    if (land === "ad") inhalt.push(<rect key="wappen" x={7.6} y={3.6} width={2.8} height={4} rx={0.8} fill="#c7a33b" stroke="#8a6d1d" strokeWidth={0.4} />);
  }
  return (
    <svg className="flagge" viewBox={`0 0 ${w} ${h}`} width={w} height={h} role="img" aria-label={NAME[land]}>
      <title>{NAME[land]}</title>
      {inhalt}
    </svg>
  );
}
