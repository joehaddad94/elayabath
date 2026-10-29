/**
 * The dashboard's rendering audit: the public audit's checks, run on every
 * dashboard screen while signed in.
 *
 *   npm run build && npm start        # in one terminal
 *   npm run audit:admin               # in another
 *
 * Signs in as BOOTSTRAP_STAFF_EMAIL with direct sign-in, so it runs against
 * a stack without an email provider (the local one). Reads ids for the
 * editor screens with the service key from .env.local. Changes nothing.
 *
 * Checked on each screen, in both palettes, at desktop and phone width:
 *   - contrast of every text node against the background painted behind it
 *   - horizontal overflow
 *   - one h1, headings in order
 *   - controls without an accessible name, duplicate ids
 *   - targets under 24px (WCAG 2.5.8), outside dense grids
 *   - failed requests, script errors and console errors
 *
 * Playwright is installed on demand, as for the public audit:
 *   npm i --no-save playwright && npx playwright install chromium
 */
import { createClient } from "@supabase/supabase-js";

const BASE = process.env.BASE ?? "http://localhost:3000";
const EMAIL = process.env.BOOTSTRAP_STAFF_EMAIL;
if (!EMAIL || !process.env.SUPABASE_SECRET_KEY) {
  console.error("Run with the local env: node --env-file=.env.local scripts/audit/admin.ts");
  process.exit(2);
}

type Page = {
  on: (event: string, cb: (arg: never) => void) => void;
  goto: (url: string, o?: unknown) => Promise<{ status: () => number } | null>;
  fill: (sel: string, v: string) => Promise<void>;
  click: (sel: string) => Promise<void>;
  waitForURL: (url: string) => Promise<void>;
  waitForTimeout: (ms: number) => Promise<void>;
  evaluate: <T>(fn: unknown, arg?: unknown) => Promise<T>;
  setViewportSize: (s: { width: number; height: number }) => Promise<void>;
  addInitScript: (fn: unknown, arg?: unknown) => Promise<void>;
};
type Browser = { newContext: (o: unknown) => Promise<{ newPage: () => Promise<Page> }>; close: () => Promise<void> };

let chromium: { launch: () => Promise<Browser> };
try {
  const specifier = "playwright";
  ({ chromium } = (await import(specifier)) as unknown as { chromium: typeof chromium });
} catch {
  console.error("playwright is not installed.\n  npm i --no-save playwright && npx playwright install chromium");
  process.exit(2);
}

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, { auth: { persistSession: false } });
const pick = async (table: string) => (await db.from(table).select("id").limit(1).single()).data?.id as string;
const [product, category, finish] = await Promise.all([pick("products"), pick("categories"), pick("finishes")]);

const ROUTES = [
  "/admin",
  "/admin/products",
  `/admin/products/${product}`,
  "/admin/products/new",
  "/admin/categories",
  `/admin/categories/${category}`,
  `/admin/finishes?finish=${finish}`,
  "/admin/homepage",
  "/admin/imports",
  "/admin/staff",
];

const browser = await chromium.launch();
let failed = 0;
let loads = 0;

for (const theme of ["ink", "stone"] as const) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.addInitScript((t: string) => {
    try {
      localStorage.setItem("elaya-theme", t);
    } catch {
      /* private window */
    }
  }, theme);
  const reached = await page.goto(`${BASE}/admin/sign-in`, { waitUntil: "load" }).catch(() => null);
  if (!reached) {
    console.error(`Could not reach ${BASE}. Start the server first.`);
    process.exit(2);
  }
  await page.fill("#email", EMAIL);
  await Promise.all([page.waitForURL(`${BASE}/admin`), page.click("button[type=submit]")]);

  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: width > 500 ? 900 : 844 });
    for (const route of ROUTES) {
      const problems: string[] = [];
      const onError = (e: Error) => problems.push(`js: ${e.message.slice(0, 80)}`);
      const onConsole = (m: { type: () => string; text: () => string }) => {
        if (m.type() === "error") problems.push(`console: ${m.text().slice(0, 80)}`);
      };
      const onResponse = (r: { status: () => number; url: () => string }) => {
        if (r.status() >= 400) problems.push(`${r.status()} ${r.url().replace(BASE, "").slice(0, 80)}`);
      };
      page.on("pageerror", onError as never);
      page.on("console", onConsole as never);
      page.on("response", onResponse as never);

      const res = await page.goto(BASE + route, { waitUntil: "load" });
      if (res && res.status() !== 200) problems.push(`status ${res.status()}`);
      await page.waitForTimeout(900);
      loads += 1;

      const found = await page.evaluate<string[]>(() => {
        const out: string[] = [];
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
        const lum = (c: number[]) => 0.2126 * lin(c[0]! / 255) + 0.7152 * lin(c[1]! / 255) + 0.0722 * lin(c[2]! / 255);
        const bgOf = (el: Element) => {
          for (let node: Element | null = el; node && node !== document.documentElement; node = node.parentElement) {
            const css = getComputedStyle(node).backgroundColor;
            if (opacity(css) > 0.95) return paint(css, [255, 255, 255]);
          }
          return paint(getComputedStyle(document.body).backgroundColor, [255, 255, 255]);
        };

        // Contrast.
        const seen = new Set<string>();
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        for (let n = walker.nextNode(); n; n = walker.nextNode()) {
          const text = (n.textContent ?? "").trim();
          const el = n.parentElement;
          if (!text || !el) continue;
          const cs = getComputedStyle(el);
          const r = el.getBoundingClientRect();
          if (cs.visibility === "hidden" || r.width === 0 || r.height === 0) continue;
          if (el.closest(".sr-only, :disabled, [disabled], [aria-disabled='true'], option")) continue;
          let alpha = 1;
          for (let a: HTMLElement | null = el; a && a !== document.body; a = a.parentElement) alpha *= Number(getComputedStyle(a).opacity) || 1;
          const bg = bgOf(el);
          const own = paint(cs.color, bg);
          const fg = own.map((c, i) => c * alpha + bg[i]! * (1 - alpha));
          const size = parseFloat(cs.fontSize);
          const floor = size >= 24 || (size >= 18.66 && Number(cs.fontWeight) >= 700) ? 3 : 4.5;
          const l1 = lum(fg);
          const l2 = lum(bg);
          const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
          const key = `${el.tagName.toLowerCase()}.${String(el.className).split(" ")[0]}`;
          if (ratio < floor && !seen.has(key)) {
            seen.add(key);
            out.push(`contrast ${ratio.toFixed(2)} < ${floor}: ${key} "${text.slice(0, 30)}"`);
          }
        }

        // Structure.
        const h1 = document.querySelectorAll("main h1").length;
        if (h1 !== 1) out.push(`${h1} h1 elements`);
        const levels = [...document.querySelectorAll("main h1, main h2, main h3, main h4")].map((h) => Number(h.tagName[1]));
        for (let i = 1; i < levels.length; i++) if (levels[i]! - levels[i - 1]! > 1) out.push(`heading jumps from h${levels[i - 1]} to h${levels[i]}`);
        if (document.documentElement.scrollWidth > window.innerWidth + 1) out.push(`overflows by ${document.documentElement.scrollWidth - window.innerWidth}px`);

        // Names, ids, targets.
        const ids = new Map<string, number>();
        for (const el of document.querySelectorAll("[id]")) ids.set(el.id, (ids.get(el.id) ?? 0) + 1);
        for (const [id, n] of ids) if (n > 1) out.push(`id "${id}" used ${n} times`);
        for (const el of document.querySelectorAll<HTMLElement>("button, a[href], input:not([type=hidden]), select, textarea")) {
          if (el.closest("[hidden], .ag-root-wrapper") || el.getBoundingClientRect().width === 0) continue;
          const labelled =
            el.getAttribute("aria-label") ||
            el.getAttribute("aria-labelledby") ||
            (el as HTMLInputElement).labels?.length ||
            el.getAttribute("title") ||
            (el.tagName !== "INPUT" && el.tagName !== "SELECT" && el.tagName !== "TEXTAREA" && el.textContent?.trim()) ||
            el.getAttribute("placeholder");
          if (!labelled) out.push(`unlabelled ${el.tagName.toLowerCase()}`);
          const box = el.getBoundingClientRect();
          if ((el.tagName === "BUTTON" || el.tagName === "A") && (box.height < 24 || box.width < 24) && getComputedStyle(el).display !== "inline") {
            out.push(`target ${Math.round(box.width)}x${Math.round(box.height)}: ${el.tagName.toLowerCase()} "${(el.textContent ?? "").trim().slice(0, 20)}"`);
          }
        }
        return [...new Set(out)];
      });
      problems.push(...found);

      if (problems.length) {
        failed += 1;
        console.log(`  FAIL  ${theme} ${width}px ${route}`);
        for (const p of [...new Set(problems)].slice(0, 12)) console.log(`        ${p}`);
      }
      // Listeners are per load.
      (page as unknown as { removeListener: (e: string, f: unknown) => void }).removeListener("pageerror", onError);
      (page as unknown as { removeListener: (e: string, f: unknown) => void }).removeListener("console", onConsole);
      (page as unknown as { removeListener: (e: string, f: unknown) => void }).removeListener("response", onResponse);
    }
  }
}

await browser.close();
console.log(`\n${loads} dashboard page loads across ${ROUTES.length} screens, 2 palettes and 2 widths, ${failed} with problems`);
process.exitCode = failed ? 1 : 0;
