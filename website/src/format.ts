// German number, time and date formatting. Everything shown on the site goes through here.
const nf1 = new Intl.NumberFormat("de-DE", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const nf0 = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 0 });
const pad = (n: number) => String(n).padStart(2, "0");

export const km = (n: number) => `${nf1.format(n)} km`;
export const meter = (n: number) => `${nf0.format(Math.round(n))} m`;
export const hm = (n: number) => `${nf0.format(Math.round(n))} Hm`;
export const zahl = (n: number) => nf0.format(n);
export const euro = (n: number) => `${nf0.format(Math.round(n))} €`;

// Walking time in quarter hours: "4:15 h"
export function dauer(hours: number) {
  const q = Math.round(hours * 4) / 4;
  const h = Math.floor(q);
  return `${h}:${pad(Math.round((q - h) * 60))} h`;
}

export function minuten(m: number) {
  if (m < 60) return `${Math.round(m)} min`;
  return `${Math.floor(m / 60)}:${pad(Math.round(m % 60))} h`;
}

// Clock time from minutes since midnight, rounded to 5 minutes: "14:10"
export function uhr(min: number) {
  const m = Math.round(min / 5) * 5;
  return `${pad(Math.floor(m / 60) % 24)}:${pad(m % 60)}`;
}

const d = (iso: string) => new Date(`${iso}T12:00:00`);
export const datumKurz = (iso: string) =>
  new Intl.DateTimeFormat("de-DE", { weekday: "short", day: "numeric", month: "long" }).format(d(iso));
export const datumLang = (iso: string) =>
  new Intl.DateTimeFormat("de-DE", { day: "numeric", month: "long", year: "numeric" }).format(d(iso));

export function zeitraum(von: string, bis: string) {
  const a = d(von);
  const b = d(bis);
  const tagMonat = new Intl.DateTimeFormat("de-DE", { day: "numeric", month: "long" });
  if (a.getFullYear() === b.getFullYear()) return `${tagMonat.format(a)} – ${datumLang(bis)}`;
  return `${datumLang(von)} – ${datumLang(bis)}`;
}

// Short date range for the trip hero: "24.08. – 28.08.2026"
export function zeitraumKurz(von: string, bis: string) {
  const a = d(von);
  const b = d(bis);
  const tm = (x: Date) => `${String(x.getDate()).padStart(2, "0")}.${String(x.getMonth() + 1).padStart(2, "0")}.`;
  return a.getFullYear() === b.getFullYear() ? `${tm(a)} – ${tm(b)}${b.getFullYear()}` : `${tm(a)}${a.getFullYear()} – ${tm(b)}${b.getFullYear()}`;
}
