import { useState } from "react";
import { site } from "../content/load.ts";
import { Feld } from "../wireframe.tsx";

// One packing list for every hut trip (content/allgemein/packliste.yaml). A trip's own extras are
// listed on its page. Ticks are kept in this browser only.
const KEY = "packliste";

export function PacklistePage() {
  const [haken, setHaken] = useState<Set<string>>(() => {
    try {
      return new Set(JSON.parse(localStorage.getItem(KEY) ?? "[]") as string[]);
    } catch {
      return new Set();
    }
  });

  const speichern = (next: Set<string>) => {
    setHaken(next);
    try {
      localStorage.setItem(KEY, JSON.stringify([...next]));
    } catch {
      /* not available: ticks just won't survive a reload */
    }
  };
  const umschalten = (id: string) => {
    const next = new Set(haken);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    speichern(next);
  };
  const kategorien = site.packliste.kategorien;
  const alle = kategorien.flatMap((k) => k.items);
  const fertig = alle.filter((i) => haken.has(i.id)).length;

  return (
    <div className="seitenbreite abschnitt packliste">
      <h1>Packliste</h1>
      <p className="lead">
        Was in den Rucksack gehört, wenn wir mehrere Tage von Hütte zu Hütte gehen. Was eine Tour zusätzlich braucht, steht auf ihrer Seite unter
        „Praktisches“.
      </p>
      <div className="fortschritt" role="status">
        <span className="fortschritt-balken" style={{ width: `${(fertig / alle.length) * 100}%` }} />
        <span className="fortschritt-text">
          {fertig} von {alle.length} eingepackt
        </span>
      </div>
      {kategorien.map((k) => (
        <Feld key={k.id} name={`allgemein/packliste.yaml · ${k.id}`}>
          <section className="pack-kategorie">
            <h2>{k.titel}</h2>
            <ul>
              {k.items.map((i) => (
                <li key={i.id}>
                  <label>
                    <input type="checkbox" checked={haken.has(i.id)} onChange={() => umschalten(i.id)} />
                    <span>
                      {i.name}
                      {i.pflicht && <span className="badge">Pflicht</span>}
                      {i.hinweis && <small>{i.hinweis}</small>}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </section>
        </Feld>
      ))}
      {fertig > 0 && (
        <button className="knopf pack-zuruecksetzen" onClick={() => speichern(new Set())}>
          Alle Haken entfernen
        </button>
      )}
    </div>
  );
}
