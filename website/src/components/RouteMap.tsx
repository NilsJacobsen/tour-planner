// MapLibre map with OpenTopoMap tiles (desaturated for the wireframe). MapLibre is imported only
// when a map is actually rendered. Modes: "aus" (not draggable, for static previews),
// "kooperativ" (two fingers / Ctrl+scroll, so one-finger page scrolling passes through), "voll".
import { useEffect, useRef, useState } from "react";
import type { GeoJSONSource, LineLayerSpecification, Map as MLMap, Marker, PaddingOptions } from "maplibre-gl";
// MapLibre 6 finds its worker next to its own file at runtime, which breaks once Vite bundles it.
// Shipping the (self-contained) worker as an asset and pointing MapLibre at it works in dev and build.
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?url";

export type MapLinie = {
  id: string;
  coords: [number, number][];
  farbe: string;
  stil?: "solid" | "dashed" | "dotted";
  breite?: number;
  deckkraft?: number;
  z?: number; // drawing order
};
export type MapPunkt = {
  id: string;
  lon: number;
  lat: number;
  label?: string;
  art: "huette" | "start" | "punkt" | "aussicht" | "fahrt";
};

type Props = {
  linien: MapLinie[];
  punkte?: MapPunkt[];
  fit: { key: string; coords: [number, number][] };
  modus: "aus" | "kooperativ" | "voll";
  onLinie?: (id: string) => void;
  hover?: { lon: number; lat: number } | null;
  padding?: number | PaddingOptions; // room around the route, e.g. for overlays
  className?: string;
  label?: string;
};

const LOCALE = {
  "CooperativeGesturesHandler.WindowsHelpText": "Zum Zoomen Strg gedrückt halten und scrollen",
  "CooperativeGesturesHandler.MacHelpText": "Zum Zoomen ⌘ gedrückt halten und scrollen",
  "CooperativeGesturesHandler.MobileHelpText": "Mit zwei Fingern die Karte bewegen",
  "NavigationControl.ZoomIn": "Vergrößern",
  "NavigationControl.ZoomOut": "Verkleinern",
  "NavigationControl.ResetBearing": "Nach Norden ausrichten",
  "AttributionControl.ToggleAttribution": "Quellen anzeigen",
};

function bounds(coords: [number, number][]): [[number, number], [number, number]] {
  let [w, s, e, n] = [180, 90, -180, -90];
  for (const [lon, lat] of coords) {
    w = Math.min(w, lon);
    s = Math.min(s, lat);
    e = Math.max(e, lon);
    n = Math.max(n, lat);
  }
  return [
    [w, s],
    [e, n],
  ];
}

const featureCollection = (linien: MapLinie[]) => ({
  type: "FeatureCollection" as const,
  features: linien.map((l) => ({
    type: "Feature" as const,
    properties: { id: l.id, farbe: l.farbe, stil: l.stil ?? "solid", breite: l.breite ?? 4, deckkraft: l.deckkraft ?? 1, z: l.z ?? 0 },
    geometry: { type: "LineString" as const, coordinates: l.coords },
  })),
});

export function RouteMap({ linien, punkte = [], fit, modus, onLinie, hover = null, padding = 40, className, label }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MLMap | null>(null);
  const lib = useRef<typeof import("maplibre-gl") | null>(null);
  const markers = useRef<Marker[]>([]);
  const hoverMarker = useRef<Marker | null>(null);
  const onLinieRef = useRef(onLinie);
  onLinieRef.current = onLinie;
  const [bereit, setBereit] = useState(false);
  const fitKey = useRef<string | null>(null);

  // Create the map once.
  useEffect(() => {
    let abgebrochen = false;
    let ro: ResizeObserver | null = null;
    (async () => {
      const [mod] = await Promise.all([import("maplibre-gl"), import("maplibre-gl/dist/maplibre-gl.css")]);
      if (abgebrochen || !container.current) return;
      lib.current = mod;
      mod.setWorkerUrl(workerUrl);
      const map = new mod.Map({
        container: container.current,
        style: {
          version: 8,
          sources: {
            topo: {
              type: "raster",
              tiles: ["a", "b", "c"].map((s) => `https://${s}.tile.opentopomap.org/{z}/{x}/{y}.png`),
              tileSize: 256,
              maxzoom: 17,
              attribution:
                'Kartendaten © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>-Mitwirkende, SRTM · Kartendarstellung © <a href="https://opentopomap.org">OpenTopoMap</a> (CC-BY-SA)',
            },
          },
          layers: [{ id: "topo", type: "raster", source: "topo", paint: { "raster-saturation": -1, "raster-contrast": -0.15 } }],
        },
        bounds: bounds(fit.coords),
        fitBoundsOptions: { padding },
        maxZoom: 16,
        interactive: true,
        cooperativeGestures: modus === "kooperativ",
        locale: LOCALE,
        attributionControl: { compact: true },
      });
      map.addControl(new mod.NavigationControl({ showCompass: false }), "top-right");
      mapRef.current = map;
      fitKey.current = fit.key;

      map.on("load", () => {
        map.addSource("linien", { type: "geojson", data: featureCollection([]) });
        // One layer per line style (dash patterns can't come from feature properties).
        const layer = (id: string, stil: string, paint: LineLayerSpecification["paint"]): LineLayerSpecification => ({
          id,
          type: "line",
          source: "linien",
          filter: ["==", ["get", "stil"], stil],
          layout: { "line-join": "round", "line-cap": "round", "line-sort-key": ["get", "z"] },
          paint,
        });
        const farbe: LineLayerSpecification["paint"] = {
          "line-color": ["get", "farbe"],
          "line-width": ["get", "breite"],
          "line-opacity": ["get", "deckkraft"],
        };
        map.addLayer(layer("casing", "solid", { "line-color": "#fff", "line-width": ["+", ["get", "breite"], 3], "line-opacity": ["*", ["get", "deckkraft"], 0.9] }));
        map.addLayer(layer("solid", "solid", farbe));
        map.addLayer(layer("dashed", "dashed", { ...farbe, "line-dasharray": [2, 1.5] }));
        map.addLayer(layer("dotted", "dotted", { ...farbe, "line-dasharray": [0.1, 1.8] }));
        for (const layer of ["solid", "dashed"]) {
          map.on("click", layer, (e) => {
            const id = e.features?.[0]?.properties?.id;
            if (id && onLinieRef.current) onLinieRef.current(String(id));
          });
          map.on("mouseenter", layer, () => onLinieRef.current && (map.getCanvas().style.cursor = "pointer"));
          map.on("mouseleave", layer, () => (map.getCanvas().style.cursor = ""));
        }
        // MapLibre opens the compact attribution at first; on a phone it covers half the map.
        map.getContainer().querySelector(".maplibregl-ctrl-attrib")?.classList.remove("maplibregl-compact-show");
        setBereit(true);
      });

      // The map's container can change size without the window resizing (sticky layouts).
      ro = new ResizeObserver(() => map.resize());
      ro.observe(container.current);
    })();
    return () => {
      abgebrochen = true;
      ro?.disconnect();
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // Created once; later prop changes are applied by the effects below.
  }, []);

  // Lines
  useEffect(() => {
    if (!bereit) return;
    (mapRef.current!.getSource("linien") as GeoJSONSource).setData(featureCollection(linien));
  }, [bereit, linien]);

  // Camera: fit whenever the fit key changes (e.g. another day becomes active)
  useEffect(() => {
    const map = mapRef.current;
    if (!bereit || !map || fitKey.current === fit.key) return;
    fitKey.current = fit.key;
    map.fitBounds(bounds(fit.coords), { padding, maxZoom: 14.5, duration: 900 });
  }, [bereit, fit, padding]);

  // Interaction mode
  useEffect(() => {
    const map = mapRef.current;
    if (!bereit || !map) return;
    const handlers = [map.dragPan, map.scrollZoom, map.boxZoom, map.dragRotate, map.keyboard, map.doubleClickZoom, map.touchZoomRotate];
    for (const h of handlers) (modus === "aus" ? h.disable() : h.enable());
    if (modus === "kooperativ") map.cooperativeGestures.enable();
    else map.cooperativeGestures.disable();
    map.getContainer().classList.toggle("karte-aus", modus === "aus");
  }, [bereit, modus]);

  // Place markers
  useEffect(() => {
    const map = mapRef.current;
    const mod = lib.current;
    if (!bereit || !map || !mod) return;
    for (const m of markers.current) m.remove();
    markers.current = punkte.map((p) => {
      const el = document.createElement("div");
      el.className = `kmarker kmarker-${p.art}`;
      if (p.label) {
        const span = document.createElement("span");
        span.textContent = p.label;
        el.appendChild(span);
      }
      return new mod.Marker({ element: el, anchor: "center" }).setLngLat([p.lon, p.lat]).addTo(map);
    });
    // Labels are plain HTML, so MapLibre doesn't keep them apart. After every move: a label that
    // would cover an earlier one goes to the left of its point, and if that overlaps too, it hides.
    const entwirren = () => {
      const frei: DOMRect[] = [];
      const rand = map.getContainer().getBoundingClientRect().right;
      const ueber = (r: DOMRect) => frei.some((f) => r.left < f.right && r.right > f.left && r.top < f.bottom && r.bottom > f.top);
      for (const m of markers.current) {
        const span = m.getElement().querySelector("span");
        if (!span) continue;
        span.classList.remove("links", "versteckt");
        const r = span.getBoundingClientRect();
        if (ueber(r) || r.right > rand) span.classList.add("links");
        if (ueber(span.getBoundingClientRect())) span.classList.replace("links", "versteckt");
        else frei.push(span.getBoundingClientRect());
      }
    };
    entwirren();
    map.on("moveend", entwirren);
    return () => {
      map.off("moveend", entwirren);
    };
  }, [bereit, punkte]);

  // Marker following the elevation profile
  useEffect(() => {
    const map = mapRef.current;
    const mod = lib.current;
    if (!bereit || !map || !mod) return;
    if (!hover) {
      hoverMarker.current?.remove();
      return;
    }
    hoverMarker.current ??= new mod.Marker({ element: Object.assign(document.createElement("div"), { className: "kmarker-hover" }) });
    hoverMarker.current.setLngLat([hover.lon, hover.lat]).addTo(map);
  }, [bereit, hover]);

  return <div ref={container} className={`karte ${className ?? ""}`} role="region" aria-label={label ?? "Karte"} />;
}
