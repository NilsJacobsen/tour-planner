// Page for the design work, not for the group: the shot list.
import { Link } from "react-router";
import { site } from "../content/load.ts";

export function BildlistePage() {
  return (
    <div className="seitenbreite abschnitt">
      <h1>Bildliste</h1>
      <p>Alle Fotos, die die Seiten brauchen – aus den Platzhaltern der Inhalte. Sobald ein Foto da ist, kommt es als <code>src</code> mit <code>credit</code> ins Bild-Feld.</p>
      {site.touren.map((t) => (
        <section key={t.slug}>
          <h2>{t.data.titel}</h2>
          <table className="tabelle">
            <thead>
              <tr>
                <th>Wo</th>
                <th>Motiv</th>
                <th>Format</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {t.bilder.map((b, i) => (
                <tr key={i}>
                  <td>
                    <Link to={b.link}>{b.wo}</Link>
                  </td>
                  <td>{b.bild.motiv}</td>
                  <td>{b.bild.format}</td>
                  <td>{b.bild.src ? (b.bild.credit ? "vorhanden" : "Credit fehlt") : "fehlt"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}
    </div>
  );
}
