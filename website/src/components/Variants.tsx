// A/B: switch between the ways to walk a day, and compare them side by side.
import type { ReactNode } from "react";
import type { EtappeView, VarianteView } from "../content/model.ts";
import { dauer, hm, km, uhr } from "../format.ts";
import { ART, ENTSCHEIDUNG, MITTEL, WETTER } from "../text.ts";
import { GradeBadge, Quelle } from "./basics.tsx";

export function VariantSwitch({ e, aktiv, onWahl }: { e: EtappeView; aktiv: VarianteView; onWahl: (id: string) => void }) {
  if (e.varianten.length < 2) return null;
  return (
    <div className="varianten">
      <div className="segmente" role="tablist" aria-label="Wege an diesem Tag">
        {e.varianten.map((v) => (
          <button key={v.id} role="tab" aria-selected={v === aktiv} className={`segment ${v === aktiv ? "aktiv" : ""}`} onClick={() => onWahl(v.id)}>
            <span className="buchstabe">{v.buchstabe}</span>
            <span className="segment-name">{v.data.name}</span>
          </button>
        ))}
      </div>
      <VariantInfo v={aktiv} />
      <details className="vergleich">
        <summary>Wege vergleichen</summary>
        <CompareTable e={e} />
      </details>
    </div>
  );
}

export function VariantInfo({ v }: { v: VarianteView }) {
  return (
    <div className="variante-info">
      <ul className="badges">
        <li className={`badge art-${v.data.art}`}>{ART[v.data.art]}</li>
        {v.data.wetter && <li className={`badge wetter-${v.data.wetter}`}>{WETTER[v.data.wetter]}</li>}
        {v.data.entscheidung && <li className="badge">{ENTSCHEIDUNG[v.data.entscheidung]}</li>}
      </ul>
      {v.data.text && <p>{v.data.text}</p>}
      {v.data.wetterhinweis && <p className="klein">{v.data.wetterhinweis}</p>}
      <Quelle url={v.data.quelle} />
    </div>
  );
}

export function CompareTable({ e }: { e: EtappeView }) {
  const rows: [string, (v: VarianteView) => ReactNode][] = [
    ["Strecke", (v) => km(v.stats.km)],
    ["Bergauf", (v) => hm(v.stats.up)],
    ["Bergab", (v) => hm(v.stats.down)],
    ["Gehzeit", (v) => dauer(v.stats.hours)],
    ["Schwierigkeit", (v) => <GradeBadge grade={v.stats.grade} />],
    ["Fahrten", (v) => v.fahrten.map((f) => MITTEL[f.fahrt.mittel]).join(", ") || "–"],
    ["Ankunft", (v) => `ca. ${uhr(v.ankunft)}`],
    ["Wetter", (v) => (v.data.wetter ? WETTER[v.data.wetter] : "–")],
  ];
  return (
    <div className="tabelle-scroll">
      <table className="vergleich-tabelle">
        <thead>
          <tr>
            <th />
            {e.varianten.map((v) => (
              <th key={v.id}>
                <span className="buchstabe">{v.buchstabe}</span> {v.data.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(([label, f]) => (
            <tr key={label}>
              <th scope="row">{label}</th>
              {e.varianten.map((v) => (
                <td key={v.id}>{f(v)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
