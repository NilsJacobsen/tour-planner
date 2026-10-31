import { Link, useParams } from "react-router";
import { site } from "../content/load.ts";
import { KONDITION, KONDITION_MAX } from "../content/model.ts";
import { zahl } from "../format.ts";
import { Kondition, Markdown } from "../components/basics.tsx";
import { NotFound } from "./NotFound.tsx";

export function InfoPage() {
  const { seite } = useParams();
  const page = seite ? site.info[seite] : undefined;
  if (!page) return <NotFound />;
  return (
    <div className="seitenbreite abschnitt info-seite">
      <h1>{page.titel}</h1>
      {page.kurz && <p className="lead">{page.kurz}</p>}
      <Markdown text={page.body} />
      {page.slug === "schwierigkeit" && <KonditionTabelle />}
      <p className="klein">
        Weitere Infos:{" "}
        {Object.values(site.info)
          .filter((p) => p.slug !== page.slug)
          .map((p, i) => (
            <span key={p.slug}>
              {i > 0 && " · "}
              <Link to={`/info/${p.slug}`}>{p.titel}</Link>
            </span>
          ))}
      </p>
    </div>
  );
}

// The fitness levels come from the code (src/content/model.ts), so the page always matches the rating.
function KonditionTabelle() {
  return (
    <table className="tabelle">
      <thead>
        <tr>
          <th>Kondition</th>
          <th>Gehzeit bis</th>
          <th>Bergauf bis</th>
          <th>Bergab bis</th>
        </tr>
      </thead>
      <tbody>
        {KONDITION.map((k) => (
          <tr key={k.stufe}>
            <td>
              <Kondition stufe={k.stufe} />
            </td>
            <td>{String(k.stunden).replace(".", ",")} h</td>
            <td>{zahl(k.hoch)} Hm</td>
            <td>{zahl(k.runter)} Hm</td>
          </tr>
        ))}
        <tr>
          <td>
            <Kondition stufe={KONDITION_MAX.stufe} />
          </td>
          <td colSpan={3}>mehr</td>
        </tr>
      </tbody>
    </table>
  );
}
