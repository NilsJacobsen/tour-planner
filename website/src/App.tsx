import { createBrowserRouter, Link, Navigate, Outlet, ScrollRestoration, useLocation } from "react-router";
import { RouterProvider } from "react-router/dom";
import { issues, site } from "./content/load.ts";
import { WireframeProvider } from "./wireframe.tsx";
import { HomePage } from "./pages/HomePage.tsx";
import { TripPage } from "./pages/TripPage.tsx";
import { StagePage } from "./pages/StagePage.tsx";
import { PacklistePage } from "./pages/PacklistePage.tsx";
import { InfoPage } from "./pages/InfoPage.tsx";
import { BildlistePage } from "./pages/DevPages.tsx";
import { NotFound } from "./pages/NotFound.tsx";

function Root() {
  const pfad = useLocation().pathname;
  const startseite = pfad === "/";
  // Day pages have their own bar back to the trip, so the site header would be a second bar.
  const etappe = /^\/touren\/[^/]+\/etappe\//.test(pfad);
  return (
    <WireframeProvider>
      <ScrollRestoration />
      {!etappe && (
        <header className="site-header">
          <Link to="/" className="marke" aria-label="Wandergruppe Jacobsen – alle Touren">
            {!startseite && (
              <span className="marke-pfeil" aria-hidden="true">
                ←
              </span>
            )}
            <span className="marke-text" aria-hidden="true">
              <span className="marke-gruppe">Wandergruppe</span>
              <span className="marke-name">Jacobsen</span>
            </span>
          </Link>
          <nav>
            <Link to="/info/schwierigkeit">Schwierigkeit</Link>
            <Link to="/info/notfall">Notfall</Link>
          </nav>
        </header>
      )}
      <main>
        <Outlet />
      </main>
      <footer className="site-footer">
        <div className="seitenbreite">
          <p>Interne Seite unserer Wandergruppe.</p>
          <p>
            <Link to="/packliste">Packliste</Link>
            {Object.values(site.info).map((p) => (
              <span key={p.slug}>
                {" · "}
                <Link to={`/info/${p.slug}`}>{p.titel}</Link>
              </span>
            ))}
          </p>
          <p className="klein">Kartendaten © OpenStreetMap-Mitwirkende · Kartendarstellung © OpenTopoMap (CC-BY-SA)</p>
        </div>
      </footer>
    </WireframeProvider>
  );
}

const router = createBrowserRouter([
  {
    path: "/",
    element: <Root />,
    children: [
      { index: true, element: <HomePage /> },
      { path: "touren/:tour", element: <TripPage /> },
      { path: "touren/:tour/etappe/:tag", element: <StagePage /> },
      { path: "packliste", element: <PacklistePage /> },
      // Old per-trip links: the packing list is the same for every trip now.
      { path: "touren/:tour/packliste", element: <Navigate to="/packliste" replace /> },
      { path: "info/:seite", element: <InfoPage /> },
      { path: "bildliste", element: <BildlistePage /> },
      { path: "*", element: <NotFound /> },
    ],
  },
]);

// Content errors stop the site and are listed instead (same messages as `npm run check`).
function ContentFehler() {
  return (
    <div className="seitenbreite abschnitt inhalt-fehler">
      <h1>Inhalte fehlerhaft</h1>
      <p>Diese Probleme müssen behoben werden (auch mit npm run check sichtbar):</p>
      <ul>
        {issues.map((i, n) => (
          <li key={n} className={i.level}>
            <strong>{i.level === "fehler" ? "Fehler" : "Warnung"}</strong> <code>{i.datei}</code>: {i.text}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function App() {
  if (issues.some((i) => i.level === "fehler")) return <ContentFehler />;
  return <RouterProvider router={router} />;
}
