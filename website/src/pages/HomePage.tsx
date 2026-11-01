import { Link } from "react-router";
import { site } from "../content/load.ts";
import { hm, km, zeitraumKurz } from "../format.ts";
import { STATUS } from "../text.ts";
import { Bild, GradeBadge } from "../components/basics.tsx";
import { Flagge } from "../components/Flagge.tsx";

export function HomePage() {
  return (
    <div className="seitenbreite abschnitt">
      <h1>Unsere Touren</h1>
      <ul className="touren-liste">
        {site.touren.map((t) => (
          <li key={t.slug} className="tour-karte">
            <Link to={`/touren/${t.slug}`} className="tour-karte-link">
              <div className="tour-karte-foto">
                <Bild bild={t.data.bilder[0]} format="quer" />
                <span className="tour-karte-gebirge">
                  <span className="flaggen">
                    {t.data.laender.map((l) => (
                      <Flagge key={l} land={l} />
                    ))}
                  </span>
                  {t.data.gebirge}
                </span>
              </div>
              <div className="tour-karte-text">
                <p className="titel-datum">
                  {t.data.termin ? zeitraumKurz(t.data.termin.von, t.data.termin.bis) : "Termin noch offen"}
                  {t.data.status !== "fix" && <span className="titel-status"> · {STATUS[t.data.status]}</span>}
                </p>
                <h2 className="titel-schrift">{t.data.titel}</h2>
                <p>{t.data.untertitel}</p>
                <ul className="zahlen">
                  <li>{t.summe.tage} Tage</li>
                  <li>{km(t.summe.km)}</li>
                  <li>↑ {hm(t.summe.up)}</li>
                  <li>
                    <GradeBadge grade={t.summe.grade} />
                  </li>
                </ul>
                <p className="klein">{t.data.region}</p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
