// The whole trip on a real map, full screen: opened from the overview card. Scroll or pinch to zoom,
// drag to move, Esc or "Schließen" to close. Clicking a day's line opens that day.
import { useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router";
import type { TourView } from "../content/model.ts";
import { RouteMap, type MapLinie, type MapPunkt } from "./RouteMap.tsx";

const SCHWARZ = "#1c1917";

export function KarteVollbild({ tour, offen, onClose }: { tour: TourView; offen: boolean; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const navigate = useNavigate();

  // Open and close the native dialog; keep the page behind it from scrolling.
  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (offen && !d.open) d.showModal();
    if (!offen && d.open) d.close();
    document.documentElement.classList.toggle("vollbild-offen", offen);
    return () => document.documentElement.classList.remove("vollbild-offen");
  }, [offen]);

  const { linien, punkte, fitCoords } = useMemo(() => {
    const linien: MapLinie[] = [];
    const punkte: MapPunkt[] = [];
    for (const e of tour.karte.etappen) {
      e.linien.forEach((c, i) => linien.push({ id: `tag-${e.tag}-${i}`, coords: c, farbe: SCHWARZ, stil: "solid", breite: 4, z: 2 }));
      for (const v of e.varianten) v.linien.forEach((c, i) => linien.push({ id: `tag-${e.tag}-${v.id}-${i}`, coords: c, farbe: SCHWARZ, stil: "dashed", breite: 3, deckkraft: 0.7, z: 1 }));
      for (const a of e.abstecher) linien.push({ id: `tag-${e.tag}-abstecher-${a.id}`, coords: a.linie, farbe: SCHWARZ, stil: "dotted", breite: 3, z: 1 });
      // Day label halfway along the day's main line.
      const haupt = e.linien.flat();
      const mitte = haupt[Math.floor(haupt.length / 2)];
      if (mitte) punkte.push({ id: `tag-${e.tag}`, lon: mitte[0], lat: mitte[1], label: `Tag ${e.tag}`, art: "punkt" });
    }
    for (const f of tour.karte.fahrten) {
      if (!f.fern) linien.push({ id: `fahrt-${f.von.join()}-${f.nach.join()}`, coords: [f.von, f.nach], farbe: SCHWARZ, stil: "dotted", breite: 2, deckkraft: 0.6, z: 0 });
    }
    for (const { ort, rolle } of tour.karte.orte) {
      punkte.push({ id: `${rolle}-${ort.id}`, lon: ort.lon, lat: ort.lat, label: ort.name.replace(/ \(.*\)$/, ""), art: rolle === "huette" ? "huette" : "start" });
    }
    const fitCoords = tour.karte.etappen.flatMap((e) => e.linien.flat());
    return { linien, punkte, fitCoords };
  }, [tour]);

  return (
    <dialog ref={dialog} className="vollbild" aria-label={`Karte: ${tour.data.titel}`} onClose={onClose} onCancel={onClose}>
      <div className="vollbild-kopf">
        <div>
          <div className="eyebrow">Übersicht</div>
          <div className="vollbild-titel">{tour.data.titel}</div>
        </div>
        <button type="button" className="knopf hell" onClick={onClose}>
          Schließen ✕
        </button>
      </div>
      <div className="karte-rahmen vollbild-karte">
        {offen && (
          <RouteMap
            linien={linien}
            punkte={punkte}
            fit={{ key: tour.slug, coords: fitCoords }}
            modus="voll"
            onLinie={(id) => {
              const tag = /^tag-(\d+)/.exec(id)?.[1];
              if (tag) navigate(`/touren/${tour.slug}/etappe/${tag}`);
            }}
            padding={48}
            label={`Karte der ganzen Tour ${tour.data.titel}`}
          />
        )}
      </div>
      <p className="vollbild-hinweis">Scrollen oder ziehen, um die Karte zu bewegen. Eine Linie antippen öffnet den Tag.</p>
    </dialog>
  );
}
