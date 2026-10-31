// The day hour by hour: transport legs, waypoints with estimated clock times, side trips.
import type { VarianteView } from "../content/model.ts";
import { dauer, hm, km, meter, minuten, uhr } from "../format.ts";
import { MITTEL, ZEITPUNKT } from "../text.ts";
import { GradeBadge, Quelle } from "./basics.tsx";

type Props = { v: VarianteView; aktiv?: number | null; onPunkt?: (index: number) => void };

export function Timeline({ v, aktiv = null, onPunkt }: Props) {
  return (
    <ol className="ablauf">
      {v.timeline.map((x, i) => {
        if (x.typ === "fahrt") {
          return (
            <li key={i} className="ablauf-eintrag ablauf-fahrt">
              <span className="ablauf-zeit">{x.ab != null ? uhr(x.ab) : "–"}</span>
              <div className="ablauf-inhalt">
                <div className="ablauf-titel">
                  <span className="mittel">{MITTEL[x.fahrt.mittel]}</span> {x.von.name} → {x.nach.name}
                </div>
                <div className="ablauf-meta">
                  {x.fahrt.abfahrt && "Abfahrt laut Fahrplan · "}
                  {x.fahrt.dauer ? `etwa ${minuten(x.fahrt.dauer)} Fahrt` : "Fahrzeit noch offen"}
                  {x.an != null && ` · an ${uhr(x.an)}`}
                </div>
                {x.warten != null && x.warten >= 5 && <div className="ablauf-meta">Vorher {minuten(x.warten)} Zeit bis zur Abfahrt</div>}
                {x.fahrt.letzte && (
                  <div className="ablauf-meta">
                    Letzte Abfahrt {x.fahrt.letzte}
                    {x.puffer != null && <strong> · {minuten(x.puffer)} Puffer</strong>}
                  </div>
                )}
                {x.fahrt.hinweis && <p className="ablauf-hinweis">{x.fahrt.hinweis}</p>}
                <Quelle url={x.fahrt.quelle} geprueft={x.fahrt.geprueft} />
              </div>
            </li>
          );
        }
        if (x.typ === "abstecher") {
          const a = x.abstecher;
          return (
            <li key={i} className="ablauf-eintrag ablauf-abstecher">
              <span className="ablauf-zeit">+</span>
              <div className="ablauf-inhalt">
                <div className="ablauf-titel">
                  Abstecher {a.data.name} <span className="ablauf-wann">{ZEITPUNKT[a.data.zeitpunkt]}</span>
                  {a.data.empfohlen && <span className="badge">empfohlen</span>}
                </div>
                <div className="ablauf-meta">
                  hin und zurück {km(a.stats.km)} · ↑ {hm(a.stats.up)} · {dauer(a.stats.hours)} · <GradeBadge grade={a.stats.grade} />
                </div>
                {a.data.text && <p className="ablauf-hinweis">{a.data.text}</p>}
                <Quelle url={a.data.quelle} />
              </div>
            </li>
          );
        }
        const titel = x.typ === "start" ? "Start" : x.typ === "ziel" ? "Ankunft" : null;
        return (
          <li
            key={i}
            className={`ablauf-eintrag ablauf-${x.typ} ${aktiv === x.index ? "aktiv" : ""}`}
            onClick={onPunkt ? () => onPunkt(x.index) : undefined}
          >
            <span className="ablauf-zeit">{x.typ === "start" ? uhr(x.zeit) : `ca. ${uhr(x.zeit)}`}</span>
            <div className="ablauf-inhalt">
              <div className="ablauf-titel">
                {titel && <span className="ablauf-art">{titel}</span>}
                {x.ort.name}
              </div>
              <div className="ablauf-meta">
                km {km(x.km).replace(" km", "")}
                {x.hoehe != null && ` · ${meter(x.hoehe)}`}
                {x.einkehr && <span className="badge">Einkehr</span>}
                {x.wasser && <span className="badge">Wasser</span>}
                {x.pause ? <span className="badge">{minuten(x.pause)} Pause</span> : null}
              </div>
              {x.hinweis && <p className="ablauf-hinweis">{x.hinweis}</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
