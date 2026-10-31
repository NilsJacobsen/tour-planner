// Wireframe tooling: the "Felder anzeigen" annotation mode (localStorage wf-felder=1 or ?felder=1,
// used by scripts/screenshot.mjs --felder), placeholders for missing content, and how smooth the
// route drawing is (localStorage wf-glaettung, default "stark").
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useSearchParams } from "react-router";
import { GLAETTUNG, type GlaettungsStufe } from "./components/glaetten.ts";

const isGlaettung = (s: string | null): s is GlaettungsStufe => s != null && s in GLAETTUNG;

type WF = {
  felder: boolean;
  glaettung: GlaettungsStufe; // how smooth the lines in the route drawing are
};
const Ctx = createContext<WF | null>(null);

// localStorage is only a per-viewer convenience; it may be unavailable (private mode).
const store = {
  get(key: string) {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
};

export function WireframeProvider({ children }: { children: ReactNode }) {
  const [params] = useSearchParams();
  const [felder] = useState(() => store.get("wf-felder") === "1" || params.get("felder") === "1");
  const [glaettung] = useState<GlaettungsStufe>(() => {
    const s = store.get("wf-glaettung");
    return isGlaettung(s) ? s : "stark";
  });

  useEffect(() => {
    document.body.classList.toggle("felder-an", felder);
  }, [felder]);

  return (
    <Ctx.Provider value={{ felder, glaettung }}>
      {children}
    </Ctx.Provider>
  );
}

export function useWireframe() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useWireframe outside WireframeProvider");
  return v;
}

// Labels a block with the schema field it comes from (only visible in "Felder anzeigen" mode).
// With a className it always renders its wrapper (the class is part of the layout);
// without one it only adds a wrapper in annotation mode.
export function Feld({ name, children, className }: { name: string; children: ReactNode; className?: string }) {
  const { felder } = useWireframe();
  if (!felder && !className) return <>{children}</>;
  return (
    <div className={`${felder ? "feld " : ""}${className ?? ""}`} data-feld={felder ? name : undefined}>
      {children}
    </div>
  );
}

// Placeholder for optional content that hasn't been written yet — doubles as a content to-do list.
export function Fehlt({ name, text }: { name: string; text: string }) {
  return (
    <div className="fehlt" title={`Inhalt fehlt: ${name}`}>
      <span className="fehlt-label">fehlt</span> {text} <code>{name}</code>
    </div>
  );
}
