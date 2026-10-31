import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { site } from "../content/load.ts";
import { konditionStufe, type TourView } from "../content/model.ts";
import { dauer, datumLang, euro, hm, km, zeitraum, zeitraumKurz } from "../format.ts";
import { DAV_FARBE, GRADE_NAME, MITTEL, STATUS, VERSORGUNG } from "../text.ts";
import { Feld, Fehlt } from "../wireframe.tsx";
import { Bild, GradeBadge, GradeMix, InfoLink, Kondition, Markdown, TagNr } from "../components/basics.tsx";
import { HutCard } from "../components/HutCard.tsx";
import { RouteOutline } from "../components/RouteOutline.tsx";
import { StageChips } from "../components/StageChips.tsx";
import { Tagesprofile } from "../components/Tagesprofile.tsx";
import { NotFound } from "./NotFound.tsx";

export function TripPage() {
  const { tour: slug } = useParams();
  const tour = site.touren.find((t) => t.slug === slug);
  if (!tour) return <NotFound />;
  return (
    <div className="tour-seite">
      <FotoHero tour={tour} />
      <AbschnittNav />
      <Darum tour={tour} />
      <TagFuerTag tour={tour} />
      <FuerMich tour={tour} />
      <Huetten tour={tour} />
      <Praktisches tour={tour} />
      <Faq tour={tour} />
      <Quellen tour={tour} />
    </div>
  );
}

// --- Hero
function TitelBlock({ tour }: { tour: TourView }) {
  const d = tour.data;
  const s = tour.summe;
  const farbe = s.grade ? DAV_FARBE[s.grade] : null;
  return (
    <div className="titelblock">
      <Feld name="tour.termin · tour.status">
        <p className="titel-datum">
          {d.termin ? zeitraumKurz(d.termin.von, d.termin.bis) : "Termin noch offen"}
          {d.status !== "fix" && <span className="titel-status"> · {STATUS[d.status]}</span>}
        </p>
      </Feld>
      <Feld name="tour.titel">
        <h1 className="titel-schrift">{d.titel}</h1>
      </Feld>
      <Feld name="tour.untertitel">
        <p className="lead">{d.untertitel}</p>
      </Feld>
      <Feld name="abgeleitet: Summen, Schwierigkeit, Kondition">
        <p className="titel-summe">
          {s.tage} Tage · {km(s.km)} · ↑ {hm(s.up)}
        </p>
        <dl className="titel-werte">
          <div>
            <dt>Schwierigkeit:</dt>
            <dd title={s.grade ? GRADE_NAME[s.grade] : undefined}>
              {s.grade ?? "T?"}
              {farbe && ` (${farbe})`}
            </dd>
          </div>
          <div>
            <dt>Kondition:</dt>
            <dd>
              <Kondition stufe={tour.kondition.stufe} mitText={false} />
            </dd>
          </div>
        </dl>
      </Feld>
    </div>
  );
}

// The grey overview card: the route drawing and one small profile per day, black only.
// Hovering a day in either highlights it in both; clicking opens the day.
function RundeKarte({ tour }: { tour: TourView }) {
  const navigate = useNavigate();
  const [aktiv, setAktiv] = useState<number | null>(null);
  const hatVarianten = tour.karte.etappen.some((e) => e.varianten.length > 0);
  return (
    <div className="runde-karte">
      <Feld name="abgeleitet: Umriss aus GPX + karte.geojson" className="runde-umriss">
        <RouteOutline
          titel="Übersicht"
          maxHoehe={520}
          karte={tour.karte}
          stil="mono"
          kartenelemente
          aktiv={aktiv}
          onHover={setAktiv}
          onSelect={(tag) => navigate(`/touren/${tour.slug}/etappe/${tag}`)}
        />
      </Feld>
      <ul className="runde-legende" aria-label="Legende">
        <li>
          <svg viewBox="0 0 18 8" aria-hidden="true">
            <line x1="1" y1="4" x2="17" y2="4" className="leg-etappe" />
          </svg>
          Etappe
        </li>
        {hatVarianten && (
          <li>
            <svg viewBox="0 0 18 8" aria-hidden="true">
              <line x1="1" y1="4" x2="17" y2="4" className="leg-variante" />
            </svg>
            Variante
          </li>
        )}
        {tour.karte.fahrten.length > 0 && (
          <li>
            <svg viewBox="0 0 18 8" aria-hidden="true">
              <line x1="1" y1="4" x2="17" y2="4" className="leg-fahrt" />
            </svg>
            {[...new Set(tour.karte.fahrten.map((f) => MITTEL[f.mittel]))].join(" / ")}
          </li>
        )}
        <li>
          <svg viewBox="0 0 18 8" aria-hidden="true">
            <rect x="5.5" y="0.5" width="7" height="7" className="leg-huette" />
          </svg>
          Übernachtung
        </li>
      </ul>
      <Feld name="abgeleitet: Höhenprofil je Tag">
        <Tagesprofile tour={tour} aktiv={aktiv} onAktiv={setAktiv} />
      </Feld>
    </div>
  );
}

function FotoHero({ tour }: { tour: TourView }) {
  const b0 = tour.data.bilder[0];
  return (
    <section className="hero">
      <Feld name="tour.bilder[0]" className="hero-foto">
        {b0?.src ? (
          <img src={b0.src} alt={b0.motiv} />
        ) : (
          <Bild bild={b0} format="hoch" />
        )}
      </Feld>
      <div className="hero-text">
        <TitelBlock tour={tour} />
      </div>
      <div className="hero-runde">
        <RundeKarte tour={tour} />
      </div>
    </section>
  );
}

function AbschnittNav() {
  return (
    <nav className="abschnitt-chips seitenbreite sticky-chips" aria-label="Abschnitte">
      <a href="#darum">Highlights</a>
      <a href="#tag-fuer-tag">Tag für Tag</a>
      <a href="#fuer-mich">Für mich?</a>
      <a href="#huetten">Hütten</a>
      <a href="#praktisches">Praktisches</a>
      <a href="#faq">FAQ</a>
    </nav>
  );
}

// --- Story and highlights
function Darum({ tour }: { tour: TourView }) {
  return (
    <section id="darum" className="abschnitt">
      <div className="seitenbreite">
        <h2>Darum diese Tour</h2>
        <Feld name="tour (Text)">{tour.body ? <Markdown text={tour.body} className="lead-prosa" /> : <Fehlt name="tour (Text)" text="Warum diese Tour?" />}</Feld>
      </div>
      <Feld name="tour.highlights[]">
        <ul className="highlights karussell" aria-label="Highlights">
          {tour.data.highlights.map((h) => (
            <li key={h.titel} className="highlight-karte">
              <Bild bild={h.bild} format="hoch" />
              {h.etappe && (
                <Link className="tag-etikett" to={`/touren/${tour.slug}/etappe/${h.etappe}`}>
                  <span className="tag-badge">{h.etappe}</span>
                  Tag {h.etappe}
                </Link>
              )}
              <h3>{h.titel}</h3>
              <p>{h.text}</p>
            </li>
          ))}
        </ul>
      </Feld>
    </section>
  );
}

// --- Day by day: one row per day, linking to its page
function TagFuerTag({ tour }: { tour: TourView }) {
  return (
    <section id="tag-fuer-tag" className="abschnitt seitenbreite">
      <h2>Tag für Tag</h2>
      {tour.data.plan && (
        <Feld name="tour.plan">
          <PlanListe tour={tour} />
        </Feld>
      )}
      {tour.data.plan && <h3>Die Wandertage</h3>}
      <Feld name="abgeleitet: Kennzahlen je Tag">
        <UeberblickTabelle tour={tour} />
      </Feld>
    </section>
  );
}

// The whole trip from the first to the last day, travel days included.
function PlanListe({ tour }: { tour: TourView }) {
  const plan = tour.data.plan!;
  return (
    <>
      <ol className="plan">
        {plan.tage.map((t, i) => {
          const e = t.etappe != null ? tour.etappen.find((x) => x.tag === t.etappe) : undefined;
          const st = e?.standard.stats;
          const nacht = t.nacht ?? e?.uebernachtung?.ort.name;
          return (
            <li key={i} className={e ? "plan-tag plan-wandern" : "plan-tag"}>
              <span className="plan-wochentag">{t.wochentag}</span>
              <div className="plan-inhalt">
                <p className="plan-titel">
                  {e && <TagNr tag={e.tag} to={`/touren/${tour.slug}/etappe/${e.tag}`} />}
                  {e ? <Link to={`/touren/${tour.slug}/etappe/${e.tag}`}>{t.titel ?? e.data.titel}</Link> : t.titel}
                </p>
                {t.text && <p className="plan-text">{t.text}</p>}
                {st && (
                  <p className="plan-zahlen">
                    {km(st.km)} · ↑ {hm(st.up)} · ↓ {hm(st.down)} · {dauer(st.hours)}
                  </p>
                )}
                {t.link && (
                  <p className="plan-text">
                    <a href={t.link} target="_blank" rel="noreferrer">
                      Route ansehen ↗
                    </a>
                  </p>
                )}
              </div>
              {nacht && <span className="plan-nacht">{nacht}</span>}
            </li>
          );
        })}
      </ol>
      {plan.hinweis && <Markdown text={plan.hinweis} className="plan-hinweis" />}
    </>
  );
}

function UeberblickTabelle({ tour }: { tour: TourView }) {
  const s = tour.summe;
  return (
    <table className="ueberblick">
      <thead>
        <tr>
          <th>Tag</th>
          <th>Strecke</th>
          <th>km</th>
          <th>↑ Hm</th>
          <th>↓ Hm</th>
          <th>Gehzeit</th>
          <th>T</th>
          <th>Übernachtung</th>
        </tr>
      </thead>
      <tbody>
        {tour.etappen.map((e) => {
          const st = e.standard.stats;
          const h = e.uebernachtung?.ort;
          return (
            <tr key={e.tag}>
              <td data-label="Tag">
                <TagNr tag={e.tag} to={`/touren/${tour.slug}/etappe/${e.tag}`} />
              </td>
              <td data-label="Strecke" className="zelle-strecke">
                <Link to={`/touren/${tour.slug}/etappe/${e.tag}`}>{e.data.titel}</Link>
                <StageChips e={e} />
              </td>
              <td data-label="km">{km(st.km).replace(" km", "")}</td>
              <td data-label="↑ Hm">{hm(st.up).replace(" Hm", "")}</td>
              <td data-label="↓ Hm">{hm(st.down).replace(" Hm", "")}</td>
              <td data-label="Gehzeit">{dauer(st.hours)}</td>
              <td data-label="T">
                <GradeBadge grade={st.grade} />
              </td>
              <td data-label="Übernachtung">
                {h ? (
                  <>
                    {h.name}
                    <div className="klein">{h.huette?.versorgung === "selbstversorger" ? "Selbstversorger" : h.huette ? "bewirtschaftet" : ""}</div>
                  </>
                ) : (
                  <span className="klein">Heimreise</span>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
      <tfoot>
        <tr>
          <th colSpan={2}>Gesamt</th>
          <td data-label="km">{km(s.km).replace(" km", "")}</td>
          <td data-label="↑ Hm">{hm(s.up).replace(" Hm", "")}</td>
          <td data-label="↓ Hm">{hm(s.down).replace(" Hm", "")}</td>
          <td data-label="Gehzeit">{dauer(s.hours)}</td>
          <td data-label="T">
            <GradeBadge grade={s.grade} />
          </td>
          <td data-label="Übernachtung">{s.naechte} Nächte</td>
        </tr>
      </tfoot>
    </table>
  );
}

// --- Is this for me?
function FuerMich({ tour }: { tour: TourView }) {
  const s = tour.summe;
  const hart = tour.etappen.find((e) => e.tag === tour.kondition.tag)!;
  const stunden = tour.etappen.map((e) => e.standard.stats.hours);
  const maxH = Math.max(...stunden);
  const gleich = new Set(tour.etappen.map((e) => konditionStufe(e.standard.stats))).size === 1;
  const selbstversorger = tour.huetten.filter((h) => h.ort.huette?.versorgung === "selbstversorger");
  const mitVarianten = tour.etappen.filter((e) => e.varianten.length > 1);
  return (
    <section id="fuer-mich" className="abschnitt seitenbreite">
      <h2>Ist das was für mich?</h2>
      <div className="kacheln">
        <Feld name="abgeleitet: Schwierigkeit aus GPX" className="kachel">
          <h3>Technik</h3>
          <p className="gross">
            bis <GradeBadge grade={s.grade} mitFarbe />
          </p>
          {s.grade && <p>{GRADE_NAME[s.grade]}</p>}
          <GradeMix meters={s.meters} dominant={s.dominant} />
          <InfoLink seite="schwierigkeit">Was bedeuten T1–T6 und die Farben?</InfoLink>
        </Feld>
        <Feld name="abgeleitet: Kondition aus Gehzeit und Hm" className="kachel">
          <h3>Kondition</h3>
          <p className="gross">
            <Kondition stufe={tour.kondition.stufe} />
          </p>
          {gleich ? (
            <p>
              Alle Tage sind ähnlich anstrengend: {dauer(Math.min(...stunden))} bis {dauer(maxH)} reine Gehzeit pro Tag.
            </p>
          ) : (
            <p>
              Anstrengendster Tag: Tag {hart.tag} mit {dauer(hart.standard.stats.hours)} Gehzeit, ↑ {hm(hart.standard.stats.up)} und ↓{" "}
              {hm(hart.standard.stats.down)}.
            </p>
          )}
          <ul className="stunden">
            {tour.etappen.map((e) => (
              <li key={e.tag}>
                <TagNr tag={e.tag} />
                <span className="stunden-balken" style={{ width: `${(e.standard.stats.hours / maxH) * 100}%` }} />
                <span>{dauer(e.standard.stats.hours)}</span>
              </li>
            ))}
          </ul>
          <InfoLink seite="schwierigkeit">Wie wir Kondition einstufen</InfoLink>
        </Feld>
        <Feld name="tour.anforderungen + abgeleitete Hinweise" className="kachel kachel-breit">
          <h3>Darauf solltest du dich einstellen</h3>
          {tour.data.anforderungen ? <Markdown text={tour.data.anforderungen} /> : <Fehlt name="tour.anforderungen" text="Anforderungen" />}
          <ul className="hinweise">
            {selbstversorger.map((h) => (
              <li key={h.ort.id}>
                Nacht {h.nacht} auf der {h.ort.name}: {VERSORGUNG.selbstversorger}.
              </li>
            ))}
            {mitVarianten.map((e) => (
              <li key={e.tag}>
                <Link to={`/touren/${tour.slug}/etappe/${e.tag}`}>Tag {e.tag}</Link>: {e.varianten.length} Wege zur Wahl – {e.varianten.map((v) => `${v.buchstabe} ${v.data.name}`).join(", ")}.
              </li>
            ))}
            {tour.etappen.flatMap((e) =>
              e.data.schluesselstellen.map((k) => (
                <li key={`${e.tag}-${k.titel}`}>
                  <Link to={`/touren/${tour.slug}/etappe/${e.tag}#gut-zu-wissen`}>Tag {e.tag}</Link>: {k.titel} – {k.text}
                </li>
              )),
            )}
          </ul>
        </Feld>
      </div>
    </section>
  );
}

function Huetten({ tour }: { tour: TourView }) {
  return (
    <section id="huetten" className="abschnitt seitenbreite">
      <h2>Übernachtungen</h2>
      <div className="huetten-raster">
        {tour.huetten.map((h) => (
          <HutCard key={h.nacht} ort={h.ort} nacht={h.nacht} datum={tour.etappen[h.tag - 1]?.datum} hinweis={h.hinweis} feld="orte[].huette (global)" />
        ))}
      </div>
    </section>
  );
}

function Praktisches({ tour }: { tour: TourView }) {
  const d = tour.data;
  const items = tour.packliste.flatMap((k) => k.items);
  const extras = items.filter((i) => i.extra);
  return (
    <section id="praktisches" className="abschnitt seitenbreite">
      <h2>Praktisches</h2>
      <dl className="praktisch">
        <div>
          <dt>Termin</dt>
          <dd>
            <Feld name="tour.termin · tour.terminHinweis">
              {d.termin && <strong>{zeitraum(d.termin.von, d.termin.bis)}</strong>}
              {d.terminHinweis && <p>{d.terminHinweis}</p>}
              {!d.termin && !d.terminHinweis && <Fehlt name="tour.termin" text="Termin" />}
            </Feld>
          </dd>
        </div>
        <div>
          <dt>Treffpunkt</dt>
          <dd>
            <Feld name="tour.treffpunkt">
              {tour.treffpunkt ? (
                <>
                  <strong>
                    {tour.treffpunkt.zeit && `${tour.treffpunkt.zeit} Uhr · `}
                    {tour.treffpunkt.ort.name}
                  </strong>
                  {tour.treffpunkt.hinweis && <p>{tour.treffpunkt.hinweis}</p>}
                </>
              ) : (
                <Fehlt name="tour.treffpunkt" text="Treffpunkt" />
              )}
            </Feld>
          </dd>
        </div>
        <div>
          <dt>Anreise</dt>
          <dd>
            <Feld name="tour.anreise">{d.anreise ? <Markdown text={d.anreise} /> : <Fehlt name="tour.anreise" text="Anreise" />}</Feld>
          </dd>
        </div>
        <div>
          <dt>Rückreise</dt>
          <dd>
            <Feld name="tour.rueckreise">{d.rueckreise ? <Markdown text={d.rueckreise} /> : <Fehlt name="tour.rueckreise" text="Rückreise" />}</Feld>
          </dd>
        </div>
      </dl>

      {d.kosten && (
        <Feld name="tour.kosten">
          <div className="kosten">
            <h3>Was es kostet</h3>
            <p>Eine grobe Schätzung pro Person{d.kosten.hinweis ? ` – ${d.kosten.hinweis}` : "."}</p>
            <table className="kosten-tabelle">
              <tbody>
                {d.kosten.posten.map((p) => (
                  <tr key={p.name}>
                    <th scope="row">{p.name}</th>
                    <td>{euro(p.betrag)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <th scope="row">Zusammen etwa</th>
                  <td>{euro(d.kosten.posten.reduce((s, p) => s + p.betrag, 0))}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </Feld>
      )}

      <Feld name="tour.packliste.plus">
        <div className="packliste-teaser">
          <h3>Packliste</h3>
          <p>
            Die Packliste ist für alle Hüttentouren gleich
            {extras.length > 0 ? ". Für diese Tour kommt dazu:" : "."}
          </p>
          {extras.length > 0 && (
            <ul className="punkte">
              {extras.map((i) => (
                <li key={i.id}>
                  <strong>{i.name}</strong>
                  {i.hinweis && ` – ${i.hinweis}`}
                </li>
              ))}
            </ul>
          )}
          <Link className="knopf" to="/packliste">
            Zur Packliste
          </Link>
        </div>
      </Feld>
    </section>
  );
}

function Faq({ tour }: { tour: TourView }) {
  return (
    <section id="faq" className="abschnitt seitenbreite">
      <h2>Häufige Fragen</h2>
      <Feld name="tour.faq[]">
        {tour.data.faq.map((f) => (
          <details key={f.frage} className="faq">
            <summary>{f.frage}</summary>
            <Markdown text={f.antwort} />
          </details>
        ))}
      </Feld>
      <p className="klein">
        Mehr: <InfoLink seite="huettenknigge">Hüttenknigge</InfoLink> · <InfoLink seite="notfall">Notfall</InfoLink>
      </p>
    </section>
  );
}

function Quellen({ tour }: { tour: TourView }) {
  const fotos = [...new Map(tour.bilder.filter((b) => b.bild.src && b.bild.credit).map((b) => [b.bild.src, b.bild])).values()];
  return (
    <section className="abschnitt seitenbreite quellen">
      <h2>Quellen & Stand</h2>
      <p>
        Stand: {datumLang(tour.data.stand)}. Strecken, Höhenmeter und Schwierigkeit sind aus den GPX-Routen berechnet (Wegbewertung aus OpenStreetMap),
        Gehzeiten nach der Faustregel des Alpenvereins (DIN 33466, ohne Pausen).
      </p>
      <ul>
        {tour.quellen.map((q) => (
          <li key={q.url}>
            <a href={q.url} target="_blank" rel="noreferrer">
              {q.titel}
            </a>
          </li>
        ))}
      </ul>
      {fotos.length > 0 && (
        <p className="klein foto-credits">
          Fotos{fotos.every((b) => b.credit?.endsWith("(Wikimedia Commons)")) && " von Wikimedia Commons"}:{" "}
          {fotos.map((b, i) => (
            <span key={b.src}>
              {i > 0 && " · "}
              {b.quelle ? (
                <a href={b.quelle} target="_blank" rel="noreferrer">
                  {b.credit?.replace(/ \(Wikimedia Commons\)$/, "")}
                </a>
              ) : (
                b.credit
              )}
              {b.lizenz && ` (${b.lizenz})`}
            </span>
          ))}
        </p>
      )}
    </section>
  );
}
