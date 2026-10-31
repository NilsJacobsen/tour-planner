import type { Ort } from "../content/schema.ts";
import { hausBild } from "../content/model.ts";
import { datumKurz, meter, zahl } from "../format.ts";
import { VERSORGUNG } from "../text.ts";
import { Bild, Quelle } from "./basics.tsx";
import { Feld } from "../wireframe.tsx";

type Props = { ort: Ort; nacht?: number; datum?: string; hinweis?: string; feld?: string };

export function HutCard({ ort, nacht, datum, hinweis, feld = "orte[].huette" }: Props) {
  const h = ort.huette;
  // A night in the valley (Gasthof, Pension) is a place, not a hut: no hut facts expected.
  const tal = ort.typ !== "huette" && !h;
  const plaetze = [
    h?.plaetze?.zimmer && `${zahl(h.plaetze.zimmer)} Betten in Zimmern`,
    h?.plaetze?.lager && `${zahl(h.plaetze.lager)} Plätze im Lager`,
  ].filter(Boolean);
  return (
    <article className="huette">
      <Bild bild={ort.bild ?? hausBild(ort)} format="quer" className="huette-bild" />
      <div className="huette-text">
        <div className="eyebrow">
          {nacht ? `Nacht ${nacht}` : tal ? "Im Tal" : "Hütte"}
          {nacht && tal && " · im Tal"}
          {datum && ` · ${datumKurz(datum)}`}
        </div>
        <h3>{ort.name}</h3>
        <div className="huette-meta">
          {ort.hoehe != null && meter(ort.hoehe)}
          {h?.betreiber && ` · ${h.betreiber}`}
        </div>
        <Feld name={feld}>
          {h ? (
            <ul className="fakten">
              <li className={h.versorgung === "selbstversorger" ? "hervor" : undefined}>{VERSORGUNG[h.versorgung]}</li>
              {plaetze.length > 0 && <li>{plaetze.join(" · ")}</li>}
              {h.saison && <li>Geöffnet: {h.saison}</li>}
              {h.buchung && <li>Buchung: {h.buchung}</li>}
            </ul>
          ) : tal ? null : (
            <p>Keine Hüttendaten hinterlegt.</p>
          )}
        </Feld>
        {hinweis && <p className="hinweis-box">{hinweis}</p>}
        {ort.hinweis && <p className="klein">{ort.hinweis}</p>}
        <div className="huette-links">
          {ort.web && (
            <a href={ort.web} target="_blank" rel="noreferrer">
              {tal ? "Website" : "Website der Hütte"}
            </a>
          )}
          <Quelle url={ort.quelle} geprueft={ort.geprueft} />
        </div>
      </div>
    </article>
  );
}
