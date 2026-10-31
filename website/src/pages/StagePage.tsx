import { useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router";
import { site } from "../content/load.ts";
import type { EtappeView, TourView } from "../content/model.ts";
import { datumKurz, km, minuten, uhr } from "../format.ts";
import { CLASS_NAME, MIT, MITTEL } from "../text.ts";
import { Feld, Fehlt } from "../wireframe.tsx";
import { Bild, GradeMix, LazyMount, LimitChips, Markdown, Quelle, StatChips, TagNr } from "../components/basics.tsx";
import { ElevationProfile } from "../components/ElevationProfile.tsx";
import { HutCard } from "../components/HutCard.tsx";
import { RouteMap, type MapLinie, type MapPunkt } from "../components/RouteMap.tsx";
import { Timeline } from "../components/Timeline.tsx";
import { VariantSwitch } from "../components/Variants.tsx";
import { NotFound } from "./NotFound.tsx";

// Where a variant changes from walking to a bus, taxi or lift and back: labels for the profile.
const wechsel = (v: EtappeView["varianten"][number]) =>
  v.walk.teile.slice(0, -1).map((t, k) => ({
    index: t.to,
    label: [...new Set(v.fahrten.filter((f) => f.teil === k).map((f) => MITTEL[f.fahrt.mittel]))].join(" + ") || "Pause",
  }));

export function StagePage() {
  const { tour: slug, tag } = useParams();
  const tour = site.touren.find((t) => t.slug === slug);
  const e = tour?.etappen.find((x) => String(x.tag) === tag);
  if (!tour || !e) return <NotFound />;
  return <StageView key={`${tour.slug}-${e.tag}`} tour={tour} e={e} />;
}

function StageView({ tour, e }: { tour: TourView; e: EtappeView }) {
  const [params, setParams] = useSearchParams();
  const [hover, setHover] = useState<number | null>(null);
  const v = e.varianten.find((x) => x.id === params.get("variante")) ?? e.standard;
  const letzter = e.tag === tour.etappen.length;
  const farbe = "#1c1917"; // stone-900: routes are black on the grey map, like the overview

  const waehle = (id: string) => {
    const next = new URLSearchParams(params);
    if (id === e.standard.id) next.delete("variante");
    else next.set("variante", id);
    setParams(next, { replace: true });
    setHover(null);
  };

  // Map content: the chosen way bold, the other ways dashed, side trips dotted, transport legs grey.
  const { linien, punkte, fitCoords } = useMemo(() => {
    const coords = (pts: { lon: number; lat: number }[]) => pts.map((p) => [p.lon, p.lat] as [number, number]);
    // One line per walking leg, so a bus or taxi ride in between is not drawn as a walk.
    const teile = (x: (typeof e.varianten)[number]) => x.walk.teile.map((t) => coords(x.walk.points.slice(t.from, t.to + 1)));
    const linien: MapLinie[] = [];
    for (const x of e.varianten) {
      if (x === v) continue;
      teile(x).forEach((c, i) => linien.push({ id: `${x.id}-${i}`, coords: c, farbe, stil: "dashed", breite: 3, deckkraft: 0.65, z: 1 }));
    }
    for (const a of e.abstecher) linien.push({ id: a.data.id, coords: coords(a.walk.points), farbe, stil: "dotted", breite: 4, z: 1 });
    for (const f of v.fahrten) {
      linien.push({ id: `fahrt-${f.von.id}`, coords: [[f.von.lon, f.von.lat], [f.nach.lon, f.nach.lat]], farbe: "#57534e", stil: "dashed", breite: 2, z: 0 });
    }
    teile(v).forEach((c, i) => linien.push({ id: `${v.id}-${i}`, coords: c, farbe, stil: "solid", breite: 5, z: 2 }));

    const punkte: MapPunkt[] = [];
    for (const x of v.timeline) {
      if (x.typ === "fahrt" || x.typ === "abstecher") continue;
      const art: MapPunkt["art"] =
        x.ort.typ === "huette" ? "huette" : x.typ === "start" ? "start" : x.ort.typ === "aussicht" ? "aussicht" : "punkt";
      punkte.push({ id: `${x.typ}-${x.ort.id}`, lon: x.ort.lon, lat: x.ort.lat, label: x.ort.name.replace(/ \(.*\)$/, ""), art });
    }
    for (const a of e.abstecher) {
      const ziel = a.walk.points[Math.floor(a.walk.points.length / 2)];
      punkte.push({ id: `abstecher-${a.data.id}`, lon: ziel.lon, lat: ziel.lat, label: a.data.name, art: "aussicht" });
    }
    // Fit to every way of the day, so switching A/B keeps the comparison in view.
    const alle = [...e.varianten.flatMap((x) => coords(x.walk.points)), ...e.abstecher.flatMap((a) => coords(a.walk.points))];
    return { linien, punkte, fitCoords: alle };
  }, [e, v, farbe]);

  const hoverPunkt = hover != null ? v.walk.points[hover] : null;
  const highlights = tour.data.highlights.filter((h) => h.etappe === e.tag);
  const prev = tour.etappen.find((x) => x.tag === e.tag - 1);
  const next = tour.etappen.find((x) => x.tag === e.tag + 1);
  const nach = e.uebernachtung?.ort ?? e.nach;

  return (
    <div className="etappe-seite">
      <div className="topbar">
        <Link to={`/touren/${tour.slug}`}>← {tour.data.titel}</Link>
        <span>
          Tag {e.tag} von {tour.etappen.length}
        </span>
      </div>

      <header className="etappe-header seitenbreite">
        <Feld name="etappe.tag · tour.termin">
          <div className="eyebrow">
            <TagNr tag={e.tag} />
            Tag {e.tag}
            {e.datum ? ` · ${datumKurz(e.datum)}` : ""}
          </div>
        </Feld>
        <Feld name="etappe.titel">
          <h1>{e.data.titel}</h1>
        </Feld>
        <div className="etappe-strecke">
          {e.von.name.replace(/ \(.*\)$/, "")} → {nach.name}
        </div>
        <Feld name="etappe.kurz">
          <p className="lead">{e.data.kurz}</p>
        </Feld>
        <Feld name="abgeleitet: Uhrzeiten, Übernachtung">
          <dl className="tagesfakten">
            <div>
              <dt>Los geht's</dt>
              <dd>
                {uhr(v.tagesbeginn)}
                {v.tagesbeginn !== v.startZeit && v.fahrten[0] && <span className="klein"> {MIT[v.fahrten[0].fahrt.mittel]}</span>}
              </dd>
            </div>
            <div>
              <dt>{letzter ? `In ${v.fahrten.at(-1)?.von.name ?? nach.name}` : "Ankunft"}</dt>
              <dd>ca. {uhr(v.ankunft)}</dd>
            </div>
            {v.tagesende !== v.ankunft && (
              <div>
                <dt>
                  {e.nach.id === tour.etappen[0].von.id ? "Zurück in" : "In"} {e.nach.name}
                </dt>
                <dd>ca. {uhr(v.tagesende)}</dd>
              </div>
            )}
            {!letzter && e.uebernachtung && (
              <div>
                <dt>Heute Nacht</dt>
                <dd>
                  {e.uebernachtung.ort.name}
                  {e.uebernachtung.ort.huette?.versorgung === "selbstversorger" && <span className="badge hervor">Selbstversorger</span>}
                </dd>
              </div>
            )}
          </dl>
        </Feld>
        <Feld name="abgeleitet aus GPX: Strecke, Höhenmeter, Gehzeit, T">
          <StatChips stats={v.stats} extra={<LimitChips grenzen={v.grenzen} />} />
          <GradeMix meters={v.stats.meters} dominant={v.stats.dominant} kompakt />
        </Feld>
      </header>

      <div className="seitenbreite">
        <Feld name="etappe.varianten[]">
          <VariantSwitch e={e} aktiv={v} onWahl={waehle} />
        </Feld>
      </div>

      <section className="etappe-karte-bereich" aria-label="Karte und Höhenprofil">
        <LazyMount className="karte-rahmen karte-etappe">
          <RouteMap linien={linien} punkte={punkte} fit={{ key: `${e.tag}-${v.id}`, coords: fitCoords }} modus="kooperativ" hover={hoverPunkt} label={`Karte Tag ${e.tag}`} />
        </LazyMount>
        <div className="seitenbreite">
          <ElevationProfile punkte={v.walk.points} runs={v.walk.runs} teile={v.walk.teile} wechsel={wechsel(v)} hover={hover} onHover={setHover} farbe={farbe} />
          <GradeMix meters={v.stats.meters} dominant={v.stats.dominant} />
        </div>
      </section>

      <nav className="abschnitt-chips seitenbreite" aria-label="Abschnitte">
        <a href="#ablauf">Ablauf</a>
        <a href="#weg">Weg</a>
        <a href="#gut-zu-wissen">Gut zu wissen</a>
        <a href="#nacht">{letzter ? "Rückreise" : "Hütte"}</a>
        <a href="#gpx">GPX</a>
      </nav>

      <section id="ablauf" className="abschnitt seitenbreite">
        <h2>Ablauf</h2>
        <p className="klein">Reine Gehzeit nach der Faustregel des Alpenvereins, plus geplante Pausen. Antippen zeigt den Punkt auf der Karte.</p>
        <Feld name="abgeleitet: variante.wegpunkte[] + GPX">
          <Timeline v={v} aktiv={hover} onPunkt={setHover} />
        </Feld>
      </section>

      <section id="weg" className="abschnitt seitenbreite">
        <h2>Der Weg</h2>
        <Feld name="etappe (Text)">{e.body ? <Markdown text={e.body} /> : <Fehlt name="etappe (Text)" text="Wegbeschreibung" />}</Feld>
        {highlights.length > 0 && (
          <Feld name="tour.highlights[etappe]">
            <ul className="highlight-liste">
              {highlights.map((h) => (
                <li key={h.titel} className="highlight-karte">
                  <Bild bild={h.bild} />
                  <h3>{h.titel}</h3>
                  <p>{h.text}</p>
                </li>
              ))}
            </ul>
          </Feld>
        )}
        <Feld name="etappe.bilder[]">
          {e.data.bilder.length ? (
            <div className="bilder-reihe">
              {e.data.bilder.map((b, i) => (
                <Bild key={i} bild={b} />
              ))}
            </div>
          ) : (
            <Fehlt name="etappe.bilder" text="Fotos von diesem Tag" />
          )}
        </Feld>
      </section>

      <section id="gut-zu-wissen" className="abschnitt seitenbreite">
        <h2>Gut zu wissen</h2>
        <h3>Wo es anspruchsvoll wird</h3>
        <Feld name="abgeleitet aus GPX (tp:run)">
          {v.schwer.length ? (
            <ul className="schwer-liste">
              {v.schwer.map((s) => (
                <li key={s.from}>
                  <button className="schwer-knopf" onClick={() => setHover(s.from)}>
                    <span className="grade">{s.cls === "via_ferrata" ? "KS" : s.cls}</span> bei {km(s.vonKm).replace(" km", "")}–{km(s.bisKm)}
                    <span className="klein"> · {CLASS_NAME[s.cls]}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p>Keine Abschnitte schwerer als T2.</p>
          )}
        </Feld>
        <Feld name="etappe.schluesselstellen[]">
          {e.data.schluesselstellen.length ? (
            <ul className="schluesselstellen">
              {e.data.schluesselstellen.map((s) => (
                <li key={s.titel}>
                  <strong>{s.titel}:</strong> {s.text} <Quelle url={s.quelle} />
                </li>
              ))}
            </ul>
          ) : v.schwer.length ? (
            <Fehlt name="etappe.schluesselstellen" text="Beschreibung der anspruchsvollen Stellen" />
          ) : null}
        </Feld>
        <h3>Wasser</h3>
        <Feld name="etappe.wasserHinweis">
          {e.data.wasserHinweis ? <p>{e.data.wasserHinweis}</p> : <Fehlt name="etappe.wasserHinweis" text="Wo können wir Wasser auffüllen?" />}
        </Feld>
        <h3>Wenn es nicht weitergeht</h3>
        <Feld name="etappe.notabstieg">
          {e.data.notabstieg ? <Markdown text={e.data.notabstieg} /> : <Fehlt name="etappe.notabstieg" text="Notabstieg oder Abbruch" />}
        </Feld>
      </section>

      <section id="nacht" className="abschnitt seitenbreite">
        {letzter ? (
          <>
            <h2>Rückreise</h2>
            <Feld name="tour.rueckreise">
              {tour.data.rueckreise ? <Markdown text={tour.data.rueckreise} /> : <Fehlt name="tour.rueckreise" text="Rückreise" />}
            </Feld>
            {v.fahrten
              .filter((f) => f.wann === "nachher")
              .map((f) => (
                <p key={f.von.id} className="hinweis-box">
                  {MITTEL[f.fahrt.mittel]} ab {f.von.name}
                  {f.fahrt.letzte && <> · letzte Abfahrt {f.fahrt.letzte}</>}
                  {v.puffer && <> · bei Ankunft ca. {uhr(v.ankunft)} bleiben {minuten(v.puffer.minuten)} Puffer</>}
                </p>
              ))}
          </>
        ) : (
          <>
            <h2>Heute Nacht</h2>
            {e.uebernachtung ? (
              <HutCard ort={e.uebernachtung.ort} nacht={e.tag} datum={e.datum} hinweis={e.uebernachtung.hinweis} feld="etappe.uebernachtung → orte[]" />
            ) : (
              <Fehlt name="etappe.uebernachtung" text="Übernachtung" />
            )}
          </>
        )}
      </section>

      <section id="gpx" className="abschnitt seitenbreite">
        <h2>GPX zum Mitnehmen</h2>
        <ul className="downloads">
          {e.varianten.flatMap((x) =>
            x.gpx.map((g, i) => (
              <li key={`${x.id}-${g.datei}`}>
                <a href={g.url} download={`${tour.slug}-tag-${e.tag}-${x.id}${x.gpx.length > 1 ? `-teil-${i + 1}` : ""}.gpx`}>
                  Tag {e.tag} · {x.buchstabe} {x.data.name}
                  {x.gpx.length > 1 && ` · Teil ${i + 1} von ${x.gpx.length}`}
                </a>
              </li>
            )),
          )}
          {e.abstecher.map((a) => (
            <li key={a.data.id}>
              <a href={a.gpxUrl} download={`${tour.slug}-tag-${e.tag}-${a.data.id}.gpx`}>
                Abstecher {a.data.name}
              </a>
            </li>
          ))}
        </ul>
      </section>

      <nav className="bottombar" aria-label="Etappen">
        {prev ? <Link to={`/touren/${tour.slug}/etappe/${prev.tag}`}>‹ Tag {prev.tag}</Link> : <Link to={`/touren/${tour.slug}`}>‹ Übersicht</Link>}
        <Link to={`/touren/${tour.slug}#tag-fuer-tag`} className="bottombar-mitte">
          Alle Tage
        </Link>
        {next ? <Link to={`/touren/${tour.slug}/etappe/${next.tag}`}>Tag {next.tag} ›</Link> : <Link to={`/touren/${tour.slug}#praktisches`}>Praktisches ›</Link>}
      </nav>
    </div>
  );
}
