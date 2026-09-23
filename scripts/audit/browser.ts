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
 *   - target size, duplicate ids and unlabelled controls
 *   - canonical link, structured data and meta description length
 *   - images served at more pixels than the layout paints
 *   - contrast of text sitting over a photograph, measured by hiding the
 *     text and sampling the backdrop it is composited against
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
  addStyleTag: (o: { content: string }) => Promise<unknown>;
  screenshot: (o: { type: string }) => Promise<Buffer>;
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

const categories = json<
  Array<{ slug: string; productTypes: Array<{ value: string }> }>
>("categories.json");
const products = json<Array<{ slug: string; finishes: string[] }>>("products.json");

// A product with many finishes and one with none: the two ends of the picker.
const richest = [...products].sort((a, b) => b.finishes.length - a.finishes.length)[0];
const firstCategory = categories.find((c) => c.productTypes.length > 0);
const firstType = firstCategory?.productTypes[0]?.value ?? "";
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
  // Stateful pages. Everything above renders in its resting state, so the
  // filtered shelf and the enquiry shortlist were never measured at all,
  // which is where the last contrast failure was hiding.
  ...(firstCategory
    ? [`/products/${firstCategory.slug}?type=${firstType}`]
    : []),
];

const browser = await chromium.launch();
let failures = 0;
const contrast: string[] = [];
let overPhotoChecked = 0;

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
        // A shortlist in progress, so the contact page renders its panel and
        // the header its badge. Neither existed in a resting page.
        localStorage.setItem(
          "elaya-shortlist",
          JSON.stringify([
            { sku: "E02-SW30008", slug: "e02-sw30008", name: "ALCO", finish: "SS04" },
            { sku: "E06-SW10413", slug: "e06-sw10413", name: "AXE C" },
          ]),
        );
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
      targets: string[];
      dupIds: string[];
      unlabelled: string[];
      oversized: string[];
      canonical: string | null;
      descLength: number;
      jsonLd: number;
      overflow: number;
      noAlt: number;
      broken: string[];
      h1: number;
      skips: number;
      landmarks: number;
      hasTitle: boolean;
      hasDesc: boolean;
      contrast: Array<{ key: string; ratio: number; floor: number; size: number; text: string }>;
      controls: Array<{ key: string; ratio: number }>;
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
        // WCAG 1.4.3 exempts inactive controls from the contrast minimum.
        // They still have to be legible, which is a design question, not a
        // measurable one, so it is not asserted here.
        if (el.closest(":disabled, [disabled], [aria-disabled='true']")) continue;
        // Text over a photograph: contrast is governed by the veil and is
        // measured from composited pixels, not from a CSS background.
        if (el.closest("[data-over-photo]")) continue;

        const bg = bgOf(el);
        // `opacity` on an ancestor composites the text toward its backdrop
        // just as surely as a translucent colour does, and reading only the
        // colour's own alpha missed it entirely. A facet dimmed to 45% to
        // mark it empty measured a perfectly healthy ratio here while
        // actually rendering at 2.64:1.
        let alpha = 1;
        for (let a: HTMLElement | null = el; a && a !== document.body; a = a.parentElement) {
          alpha *= Number(getComputedStyle(a).opacity) || 1;
        }
        const own = paint(cs.color, bg);
        const fg = alpha >= 0.999 ? own : own.map((c, i) => c * alpha + bg[i]! * (1 - alpha));
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

      /* WCAG 1.4.11: a control's boundary needs 3:1 against what surrounds
         it, or its shape is not perceivable. The design system borders every
         button with --color-divider, a hairline meant for rules between
         sections, which measured 1.48:1 on stone. */
      const controls: Array<{ key: string; ratio: number }> = [];
      const seenVariants = new Set<string>();
      for (const el of document.querySelectorAll(".btn")) {
        if (el.closest("[data-over-photo]")) continue;
        // WCAG 1.4.11 exempts inactive components, as 1.4.3 does for text.
        if (el.matches(":disabled, [disabled], [aria-disabled='true']")) continue;
        const cs = getComputedStyle(el);
        const variant = [...el.classList].filter((c) => c.startsWith("btn")).sort().join(".");
        if (seenVariants.has(variant)) continue;
        seenVariants.add(variant);
        const under = bgOf(el.parentElement ?? el);
        const fill = paint(cs.backgroundColor, under);
        const isFilled = opacity(cs.backgroundColor) > 0.95;
        const l = (c: number[]) => lum(c);
        const r = (a: number[], bq: number[]) =>
          (Math.max(l(a), l(bq)) + 0.05) / (Math.min(l(a), l(bq)) + 0.05);
        const border = paint(cs.borderTopColor, fill);
        const edge = isFilled
          ? r(fill, under)
          : Math.min(r(border, under), r(border, fill));
        if (edge < 3) controls.push({ key: variant, ratio: Number(edge.toFixed(2)) });
      }

      /* WCAG 2.2 SC 2.5.8: a target is at least 24x24 CSS px. The exception
         for an inline link inside running text does not cover a stacked list
         of links, which is what a footer is, so those are measured. A control
         wrapped in a label inherits the label's target. */
      const targets: string[] = [];
      for (const el of document.querySelectorAll(
        "a[href], button, input[type=checkbox], input[type=radio], summary",
      )) {
        const node = el as HTMLElement;
        if (node.getAttribute("aria-hidden") === "true" || node.tabIndex < 0) continue;
        const rect = node.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) continue;
        if (
          node.tagName === "A" &&
          node.closest("p") &&
          getComputedStyle(node).display === "inline"
        ) {
          continue;
        }
        if (rect.width >= 24 && rect.height >= 24) continue;
        const label = node.closest("label")?.getBoundingClientRect();
        if (label && label.width >= 24 && label.height >= 24) continue;
        targets.push(
          `${node.tagName.toLowerCase()} ${Math.round(rect.width)}x${Math.round(rect.height)} ` +
            `"${(node.textContent ?? "").trim().slice(0, 20)}"`,
        );
      }

      /* An id repeated on a page breaks every label[for], aria-labelledby and
         fragment link that points at it, silently. */
      const idCount = new Map<string, number>();
      for (const el of document.querySelectorAll("[id]")) {
        idCount.set(el.id, (idCount.get(el.id) ?? 0) + 1);
      }
      const dupIds = [...idCount].filter(([, n]) => n > 1).map(([id]) => id);

      /* A form control with no label is unusable with a screen reader and
         loses its click-to-focus target for everyone else. */
      const unlabelled: string[] = [];
      for (const el of document.querySelectorAll("input, select, textarea")) {
        const node = el as HTMLInputElement;
        if (node.type === "hidden") continue;
        const byFor = node.id && document.querySelector(`label[for="${CSS.escape(node.id)}"]`);
        if (byFor || node.closest("label")) continue;
        if (node.getAttribute("aria-label") ?? node.getAttribute("aria-labelledby")) continue;
        unlabelled.push(`${node.tagName.toLowerCase()}[${node.type}]`);
      }

      /* Serving four times the pixels a layout paints is bandwidth spent on
         nothing. Flags a next/image that needs a `sizes` hint. */
      const oversized = imgs
        .filter((i) => {
          const w = i.getBoundingClientRect().width * devicePixelRatio;
          return w > 0 && i.naturalWidth > w * 2;
        })
        .map((i) => `${i.currentSrc.split("/").pop()?.slice(0, 32)} ` +
          `${i.naturalWidth}px served for ${Math.round(i.getBoundingClientRect().width)}px painted`);

      const canonicalHref = document
        .querySelector("link[rel=canonical]")
        ?.getAttribute("href");
      const metaDesc =
        document.querySelector<HTMLMetaElement>('meta[name="description"]')?.content ?? "";

      return {
        targets,
        dupIds,
        unlabelled,
        oversized,
        canonical: canonicalHref ?? null,
        descLength: metaDesc.length,
        jsonLd: document.querySelectorAll('script[type="application/ld+json"]').length,
        controls,
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

    /* Text over a photograph. Every other contrast check reads the CSS
       background behind an element, which over a photograph is the wrong
       answer, so those regions are marked [data-over-photo] and skipped.
       That left the hero headings, the breadcrumbs in the plate and every
       PhotoBand entirely unmeasured.

       The backdrop cannot be sampled from a plain screenshot either: inside
       a text node's box most pixels are the glyphs themselves, and sampling
       those reports a perfect 1:1 for white-on-dark. So the text is hidden
       first, keeping layout, and the exposed photograph is sampled. */
    const overPhoto = await page.evaluate<
      Array<{
        text: string;
        fg: [number, number, number];
        size: number;
        weight: number;
        tag: string;
        box: { x: number; y: number; w: number; h: number };
      }>
    >(() => {
      const cv = document.createElement("canvas");
      cv.width = cv.height = 1;
      const cx = cv.getContext("2d", { willReadFrequently: true })!;
      const resolve = (css: string): [number, number, number] => {
        cx.clearRect(0, 0, 1, 1);
        cx.fillStyle = "#000";
        cx.fillStyle = css;
        cx.fillRect(0, 0, 1, 1);
        const d = cx.getImageData(0, 0, 1, 1).data;
        return [d[0]!, d[1]!, d[2]!];
      };
      const out = [];
      for (const region of document.querySelectorAll("[data-over-photo]")) {
        const walker = document.createTreeWalker(region, NodeFilter.SHOW_TEXT);
        let n: Node | null;
        while ((n = walker.nextNode())) {
          const text = (n.textContent ?? "").trim();
          // The breadcrumb separator is decorative and aria-hidden, so it is
          // outside the text minimum.
          if (!text || text === "/") continue;
          const el = n.parentElement;
          if (!el) continue;
          const cs = getComputedStyle(el);
          const r = el.getBoundingClientRect();
          if (r.width === 0 || r.height === 0) continue;
          out.push({
            text: text.slice(0, 24),
            fg: resolve(cs.color),
            size: parseFloat(cs.fontSize),
            weight: Number(cs.fontWeight) || 400,
            tag: el.tagName.toLowerCase(),
            box: { x: r.x, y: r.y, w: r.width, h: r.height },
          });
        }
      }
      return out;
    });

    if (overPhoto.length > 0) {
      await page.addStyleTag({
        content:
          "[data-over-photo] * { color: transparent !important; text-shadow: none !important; }",
      });
      await page.waitForTimeout(150);
      const shot = await page.screenshot({ type: "png" });
      const samples = await page.evaluate<
        Array<{ text: string; tag: string; size: number; ratio: number; floor: number }>
      >(
        async ({ items, b64 }: { items: typeof overPhoto; b64: string }) => {
          const img = new Image();
          await new Promise((r) => {
            img.onload = r;
            img.src = "data:image/png;base64," + b64;
          });
          const c = document.createElement("canvas");
          c.width = img.width;
          c.height = img.height;
          const x = c.getContext("2d", { willReadFrequently: true })!;
          x.drawImage(img, 0, 0);
          const lum = (p: number[]) => {
            const f = (v: number) => {
              const n = v / 255;
              return n <= 0.03928 ? n / 12.92 : Math.pow((n + 0.055) / 1.055, 2.4);
            };
            return 0.2126 * f(p[0]!) + 0.7152 * f(p[1]!) + 0.0722 * f(p[2]!);
          };
          const out = [];
          for (const it of items) {
            if (it.box.y < 0 || it.box.y + it.box.h > c.height) continue;
            const fgL = lum(it.fg);
            let worst = Infinity;
            for (let a = 0; a < 14; a++) {
              for (let d = 0; d < 5; d++) {
                const sx = Math.round(it.box.x + (it.box.w * (a + 0.5)) / 14);
                const sy = Math.round(it.box.y + (it.box.h * (d + 0.5)) / 5);
                if (sx < 0 || sy < 0 || sx >= c.width || sy >= c.height) continue;
                const p = x.getImageData(sx, sy, 1, 1).data;
                const bgL = lum([p[0]!, p[1]!, p[2]!]);
                const ratio = (Math.max(fgL, bgL) + 0.05) / (Math.min(fgL, bgL) + 0.05);
                if (ratio < worst) worst = ratio;
              }
            }
            if (!isFinite(worst)) continue;
            const large = it.size >= 24 || (it.size >= 18.66 && it.weight >= 700);
            out.push({
              text: it.text,
              tag: it.tag,
              size: Math.round(it.size),
              ratio: Number(worst.toFixed(2)),
              floor: large ? 3 : 4.5,
            });
          }
          return out;
        },
        { items: overPhoto, b64: shot.toString("base64") },
      );
      overPhotoChecked += samples.length;
      for (const s of samples) {
        if (s.ratio < s.floor) {
          contrast.push(
            `${String(s.ratio).padStart(5)}:1 (floor ${s.floor}) ${s.size}px ${theme} ` +
              `over-photo ${s.tag} "${s.text}" ${route}`,
          );
        }
      }
    }

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
    if (page1440.descLength > 160) {
      problems.push(`description ${page1440.descLength} chars (truncates at 160)`);
    }
    if (!page1440.canonical) problems.push("no canonical link");
    if (page1440.jsonLd === 0) problems.push("no structured data");
    if (page1440.dupIds.length > 0) problems.push(`duplicate id: ${page1440.dupIds[0]}`);
    for (const u of new Set(page1440.unlabelled)) problems.push(`unlabelled ${u}`);
    for (const t of new Set(page1440.targets)) problems.push(`target under 24px: ${t}`);
    for (const o of new Set(page1440.oversized)) problems.push(`oversized image: ${o}`);

    for (const c of page1440.controls) {
      problems.push(`control boundary ${c.key} ${c.ratio}:1 (needs 3:1)`);
    }

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
    `${failures} with problems, ${contrast.length} contrast failures ` +
    `(${overPhotoChecked} text nodes measured over photographs)`,
);
process.exit(failures > 0 || contrast.length > 0 ? 1 : 0);
