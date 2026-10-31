// Browser side of the content core: Vite bundles every content file as text, and the GPX files
// also as downloadable assets. Editing a content file reloads the page with the new data.
import { buildSite } from "./model.ts";

const raw = import.meta.glob("/content/**/*.{md,yaml,gpx,geojson}", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;
const assetUrls = import.meta.glob("/content/**/*.gpx", { query: "?url", import: "default", eager: true }) as Record<
  string,
  string
>;

const strip = (p: string) => p.replace(/^\//, "");
const files = Object.fromEntries(Object.entries(raw).map(([p, text]) => [strip(p), text]));
const urls = Object.fromEntries(Object.entries(assetUrls).map(([p, url]) => [strip(p), url]));

export const { site, issues } = buildSite(files, urls);
