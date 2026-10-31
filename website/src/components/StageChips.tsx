import type { EtappeView } from "../content/model.ts";

// Small tags that tell at a glance what's special about a day (in the day-by-day table).
export function StageChips({ e }: { e: EtappeView }) {
  const chips: { text: string; art?: string }[] = [];
  if (e.varianten.length > 1) chips.push({ text: `${e.varianten.length} Wege` });
  if (e.abstecher.length) chips.push({ text: `+ ${e.abstecher.length === 1 ? "Abstecher" : `${e.abstecher.length} Abstecher`}` });
  if (e.varianten.some((v) => v.data.art === "schlechtwetter" || v.data.wetter === "schlechtwetter-tauglich")) {
    chips.push({ text: "Schlechtwetter-Route" });
  }
  const limit = e.varianten.flatMap((v) => v.grenzen);
  if (limit.some((g) => g.status === "ueber")) chips.push({ text: "über Limit", art: "ueber" });
  else if (limit.length) chips.push({ text: "am Limit", art: "am" });
  if (e.uebernachtung?.ort.huette?.versorgung === "selbstversorger") chips.push({ text: "Selbstversorger" });
  if (!chips.length) return null;
  return (
    <ul className="etiketten">
      {chips.map((c) => (
        <li key={c.text} className={c.art ? `limit ${c.art}` : undefined}>
          {c.text}
        </li>
      ))}
    </ul>
  );
}
