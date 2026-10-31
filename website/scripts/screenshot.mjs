#!/usr/bin/env node
// Screenshot a page of the local site (dev server on :5174) with the installed Google Chrome,
// after maps and fonts have settled. Prints console errors.
//
// Usage: node scripts/screenshot.mjs <path> <out.png> [--mobile] [--full] [--scroll <y>|#id|#id+N] [--felder] [--wait ms]
//   --mobile   390×844 phone viewport with touch
//   --full     whole page instead of the viewport
//   --scroll   scroll to a y position, an element id, or N px below an element
//   --felder   turn on "Felder anzeigen"
//   --wait     time for lazy maps and tiles before the shot (default 2500)
//   --element  only this element, e.g. ".hero-runde .umriss"
//   --storage  key=value in localStorage before loading, e.g. wf-glaettung=aus

import { chromium } from "playwright-core";

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(name);
  if (i === -1) return false;
  args.splice(i, 1);
  return true;
};
const opt = (name) => {
  const i = args.indexOf(name);
  return i === -1 ? undefined : args.splice(i, 2)[1];
};
const mobile = flag("--mobile");
const full = flag("--full");
const felder = flag("--felder");
const scroll = opt("--scroll");
const wait = Number(opt("--wait") ?? 2500); // ms for lazy maps and tiles
const element = opt("--element");
const storage = opt("--storage");
const base = opt("--base") ?? "http://localhost:5174";
const [pfad = "/", out = "screenshot.png"] = args;

const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const context = await browser.newContext(
  mobile
    ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }
    : { viewport: { width: 1280, height: 800 } },
);
if (felder) await context.addInitScript(() => localStorage.setItem("wf-felder", "1"));
if (storage) {
  const [key, value] = storage.split("=");
  await context.addInitScript(([k, v]) => localStorage.setItem(k, v), [key, value]);
}
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));

await page.goto(base + pfad, { waitUntil: "networkidle" });
// --scroll 900 | #id | #id+600 (offset below the element's top)
if (scroll) {
  await page.evaluate(async (s) => {
    const [, id, off] = s.match(/^(#[\w-]+)?\+?(-?\d+)?$/) ?? [];
    const top = id ? document.querySelector(id).getBoundingClientRect().top + window.scrollY : 0;
    // Scroll in steps so scroll-driven effects (IntersectionObserver) see the movement.
    const target = top + Number(off ?? 0);
    for (let y = window.scrollY; Math.abs(y - target) > 1; ) {
      y += Math.sign(target - y) * Math.min(400, Math.abs(target - y));
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 60));
    }
  }, scroll);
}
// Whole page or one element: load every lazy photo first (they only load near the viewport).
if (full || element) {
  await page.evaluate(() => document.querySelectorAll('img[loading="lazy"]').forEach((img) => (img.loading = "eager")));
  await page.waitForLoadState("networkidle").catch(() => {});
}
// Give lazy maps time to load their tiles and finish camera animations.
await page.waitForTimeout(wait);
await page.waitForLoadState("networkidle").catch(() => {});
if (element) await page.locator(element).first().screenshot({ path: out });
else await page.screenshot({ path: out, fullPage: full });
const height = await page.evaluate(() => document.documentElement.scrollHeight);
const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
await browser.close();

console.log(`Saved ${out} (page height ${height}px${overflow ? ", HORIZONTAL OVERFLOW" : ""})`);
if (errors.length) {
  console.log("Console errors:");
  for (const e of errors) console.log(`  ${e}`);
  process.exitCode = 1;
}
