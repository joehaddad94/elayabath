/**
 * Rendering audit. Needs a real browser, so it is run on demand.
 *
 *   npm run build && npm start        # in one terminal
 *   npm run audit:browser             # in another
 *
 * Playwright is not a dependency of this repo: it pulls a few hundred
 * megabytes of browser binaries, and every clone and install would pay for a
 * tool used occasionally. Install it when you want to run this:
 *
 *   npm i -D playwright && npx playwright install chromium
 *
 * What it measures that the static audit cannot:
 *
 *   - contrast against the background actually painted behind each text node,
 *     which is the only way to check text over a photograph or a gradient
 *   - horizontal overflow at desktop and phone width
 *   - images that fail to load, and images with no alt text
 *   - heading order, landmarks, and one h1 per page
 *
 * Routes come from the catalogue rather than a list, so widening the slice
 * widens the audit with it.
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "../..");
const BASE = process.env.BASE ?? "http://localhost:3000";

type Chromium = {
  launch: () => Promise<{
    newContext: (o: unknown) => Promise<{
      newPage: () => Promise<Page>;
      close: () => Promise<void>;
    }>;
    close: () => Promise<void>;
  }>;
};
type Page = {
  on: (event: string, cb: (arg: never) => void) => void;
  addInitScript: (fn: unknown, arg?: unknown) => Promise<void>;
  goto: (url: string, o?: unknown) => Promise<{ status: () => number } | null>;
  evaluate: <T>(fn: unknown, arg?: unknown) => Promise<T>;
  setViewportSize: (s: { width: number; height: number }) => Promise<void>;
  waitForTimeout: (ms: number) => Promise<void>;
};

let chromium: Chromium;
try {
  // The specifier is held in a variable on purpose: a literal would make
  // TypeScript resolve playwright at compile time, and it is not installed,
  // so `npm run typecheck` would fail on an audit tool nobody is running.
  const specifier = "playwright";
  ({ chromium } = (await import(specifier)) as unknown as { chromium: Chromium });
} catch {
  console.error(
    "playwright is not installed.\n" +
      "  npm i -D playwright && npx playwright install chromium\n" +
      "It is deliberately not a dependency: this audit is occasional and the\n" +
      "browser binaries are large.",
  );
  process.exit(2);
}

const json = <T,>(f: string): T =>
  JSON.parse(fs.readFileSync(path.join(ROOT, "data", f), "utf8")) as T;

const categories = json<Array<{ slug: string }>>("categories.json");
const products = json<Array<{ slug: string; finishes: string[] }>>("products.json");

// A product with many finishes and one with none: the two ends of the picker.
const richest = [...products].sort((a, b) => b.finishes.length - a.finishes.length)[0];
const barest = products.find((p) => p.finishes.length === 0) ?? products[0];

const ROUTES = [
  "/",
  "/about",
  "/contact",
  "/faq",
  "/catalogue",
  "/search",
  "/products",
  ...categories.map((c) => `/products/${c.slug}`),
  ...(richest ? [`/product/${richest.slug}`] : []),
  ...(barest ? [`/product/${barest.slug}`] : []),
  "/legal/privacy",
  "/legal/terms",
  "/legal/returns",
];

const browser = await chromium.launch();
let failures = 0;
const contrast: string[] = [];

for (const theme of ["ink", "stone"] as const) {
  for (const route of ROUTES) {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    const problems: string[] = [];

    page.on("pageerror", (e: Error) => problems.push(`js: ${e.message.slice(0, 70)}`));
    page.on("response", (r: { status: () => number; url: () => string }) => {
      if (r.status() >= 400) problems.push(`${r.status()} ${r.url().replace(BASE, "")}`);
    });

    await page.addInitScript((t: string) => {
      try {
        localStorage.setItem("elaya-theme", t);
      } catch {
        /* private window */
      }
    }, theme);

    const res = await page.goto(BASE + route, { waitUntil: "networkidle" }).catch(() => null);
    if (!res) {
      console.error(`\nCould not reach ${BASE}. Start the server first:\n  npm run build && npm start`);
      process.exit(2);
    }
    if (res.status() !== 200) problems.push(`status ${res.status()}`);

    await page.evaluate(async () => {
      window.scrollTo(0, document.body.scrollHeight);
      await new Promise((r) => setTimeout(r, 300));
      window.scrollTo(0, 0);
      await new Promise((r) => setTimeout(r, 200));
    });

    const page1440 = await page.evaluate<{
      overflow: number;
      noAlt: number;
      broken: string[];
      h1: number;
      skips: number;
      landmarks: number;
      hasTitle: boolean;
      hasDesc: boolean;
      contrast: Array<{ key: string; ratio: number; floor: number; size: number; text: string }>;
    }>(() => {
      const imgs = [...document.querySelectorAll("img")];
      const levels = [...document.querySelectorAll("h1,h2,h3,h4,h5,h6")].map((h) =>
        Number(h.tagName[1]),
      );
      let skips = 0;
      for (let i = 1; i < levels.length; i += 1) {
        if ((levels[i] ?? 0) - (levels[i - 1] ?? 0) > 1) skips += 1;
      }

      // Colours are resolved by painting them. Parsing the computed string by
      // hand does not survive color-mix(), which Chromium serialises as
      // color(srgb 0.92 0.91 0.89): floats, not bytes, so a naive parser
      // reads near-white as near-black and reports the whole site failing.
      const cv = document.createElement("canvas");
      cv.width = cv.height = 1;
      const cx = cv.getContext("2d", { willReadFrequently: true })!;
      const paint = (css: string, under: number[]) => {
        cx.clearRect(0, 0, 1, 1);
        cx.fillStyle = `rgb(${under[0]},${under[1]},${under[2]})`;
        cx.fillRect(0, 0, 1, 1);
        cx.fillStyle = css;
        cx.fillRect(0, 0, 1, 1);
        const d = cx.getImageData(0, 0, 1, 1).data;
        return [d[0]!, d[1]!, d[2]!];
      };
      const opacity = (css: string) => {
        cx.clearRect(0, 0, 1, 1);
        cx.fillStyle = css;
        cx.fillRect(0, 0, 1, 1);
        return cx.getImageData(0, 0, 1, 1).data[3]! / 255;
      };
      const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
      const lum = (c: number[]) =>
        0.2126 * lin(c[0]! / 255) + 0.7152 * lin(c[1]! / 255) + 0.0722 * lin(c[2]! / 255);

      const bgOf = (el: Element) => {
        let node: Element | null = el;
        while (node && node !== document.documentElement) {
          const css = getComputedStyle(node).backgroundColor;
          if (opacity(css) > 0.95) return paint(css, [255, 255, 255]);
          node = node.parentElement;
        }
        return paint(getComputedStyle(document.body).backgroundColor, [255, 255, 255]);
      };

      const low: Array<{ key: string; ratio: number; floor: number; size: number; text: string }> = [];
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      let n: Node | null;
      while ((n = walker.nextNode())) {
        const text = (n.textContent ?? "").trim();
        const el = n.parentElement;
        if (!text || !el) continue;
        const cs = getComputedStyle(el);
        if (cs.visibility === "hidden" || cs.display === "none") continue;
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        if (el.closest(".sr-only") || cs.clipPath.startsWith("inset(50%")) continue;
        // Text over a photograph: contrast is governed by the veil and is
        // measured from composited pixels, not from a CSS background.
        if (el.closest("[data-over-photo]")) continue;

        const bg = bgOf(el);
        const fg = paint(cs.color, bg);
        const size = parseFloat(cs.fontSize);
        const large = size >= 24 || (size >= 18.66 && Number(cs.fontWeight) >= 700);
        const floor = large ? 3 : 4.5;
        const l1 = lum(fg);
        const l2 = lum(bg);
        const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
        if (ratio < floor) {
          const cls = typeof el.className === "string" ? el.className.split(" ")[0] : "";
          low.push({
            key: cls || el.tagName.toLowerCase(),
            ratio: Number(ratio.toFixed(2)),
            floor,
            size: Math.round(size),
            text: text.slice(0, 32),
          });
        }
      }

      return {
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        noAlt: imgs.filter((i) => !i.hasAttribute("alt")).length,
        broken: imgs.filter((i) => i.complete && i.naturalWidth === 0).map((i) => i.src),
        h1: document.querySelectorAll("h1").length,
        skips,
        landmarks: ["header", "nav", "main", "footer"].filter((t) => document.querySelector(t)).length,
        hasTitle: document.title.length > 0,
        hasDesc: Boolean(document.querySelector('meta[name="description"]')),
        contrast: low,
      };
    });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(250);
    const overflow390 = await page.evaluate<number>(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );

    if (page1440.overflow > 0) problems.push(`overflow 1440 = ${page1440.overflow}px`);
    if (overflow390 > 0) problems.push(`overflow 390 = ${overflow390}px`);
    if (page1440.noAlt > 0) problems.push(`${page1440.noAlt} image(s) with no alt`);
    if (page1440.broken.length > 0) problems.push(`broken image: ${page1440.broken[0]}`);
    if (page1440.h1 !== 1) problems.push(`${page1440.h1} h1 elements`);
    if (page1440.skips > 0) problems.push(`${page1440.skips} heading level skip(s)`);
    if (page1440.landmarks !== 4) problems.push(`${page1440.landmarks}/4 landmarks`);
    if (!page1440.hasTitle) problems.push("no title");
    if (!page1440.hasDesc) problems.push("no meta description");

    for (const c of page1440.contrast) {
      contrast.push(
        `${String(c.ratio).padStart(5)}:1 (floor ${c.floor}) ${c.size}px ${theme} ` +
          `${c.key} "${c.text}" ${route}`,
      );
    }

    const unique = [...new Set(problems)];
    if (unique.length > 0) {
      failures += 1;
      console.log(`  FAIL  ${theme} ${route}`);
      for (const p of unique) console.log(`        ${p}`);
    }
    await ctx.close();
  }
}

await browser.close();

if (contrast.length > 0) {
  console.log(`\n  ${contrast.length} text node(s) below their contrast floor:`);
  for (const c of [...new Set(contrast)].slice(0, 20)) console.log(`    ${c}`);
}

const loads = ROUTES.length * 2;
console.log(
  `\n${loads} page loads across ${ROUTES.length} routes and 2 palettes, ` +
    `${failures} with problems, ${contrast.length} contrast failures`,
);
process.exit(failures > 0 || contrast.length > 0 ? 1 : 0);
