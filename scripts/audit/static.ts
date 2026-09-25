/**
 * Static audit. No dependencies, no browser, no build required.
 *
 *   npm run audit
 *
 * Every check here exists because the rule it enforces was broken once, and
 * broken silently: nothing failed, nothing looked wrong, and it only surfaced
 * because someone went looking. That is the definition of something that
 * belongs in a script rather than in a reviewer's memory.
 *
 * The deeper rendering checks live in scripts/audit/browser.ts, which needs
 * Playwright and is run on demand.
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "../..");

interface Finding {
  where: string;
  detail: string;
}

interface Check {
  name: string;
  why: string;
  run: () => Finding[];
}

/* ── helpers ────────────────────────────────────────────────────────── */

function walk(dir: string, match: (f: string) => boolean): string[] {
  const out: string[] = [];
  const stack = [dir];
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) continue;
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === "node_modules" || entry.name === ".next") continue;
        stack.push(full);
      } else if (match(full)) {
        out.push(full);
      }
    }
  }
  return out.sort();
}

const rel = (f: string) => path.relative(ROOT, f).replace(/\\/g, "/");
const read = (f: string) => fs.readFileSync(f, "utf8");
const isVendored = (f: string) => rel(f).endsWith("src/styles/system.css");

const cssFiles = () => walk(path.join(ROOT, "src"), (f) => f.endsWith(".css"));
const codeFiles = () =>
  walk(path.join(ROOT, "src"), (f) => f.endsWith(".ts") || f.endsWith(".tsx"))
    .filter((f) => !f.endsWith(".test.ts"));

/* ── checks ─────────────────────────────────────────────────────────── */

/**
 * The floor is set by the darkest ground muted text can land on, and that
 * moves whenever the palette gains a tone.
 *
 * 62.5% was the measured threshold against the page ground, so everything
 * went to 65%. Section banding then introduced a third tone below the ground
 * on the stone palette, and four styles at 65% fell to 4.42:1 on it. Raised
 * to 70%, which clears the band as well as the ground.
 */
const MUTED_FLOOR = 70;

const checks: Check[] = [
  {
    name: "muted text meets the measured contrast floor",
    why: `no text colour below ${MUTED_FLOOR}% of --color-text outside the vendored system`,
    run: () => {
      const found: Finding[] = [];
      for (const file of cssFiles()) {
        if (isVendored(file)) continue;

        // Track which selector each declaration belongs to. A flat line
        // scan cannot tell an active control from a disabled one, and
        // WCAG 1.4.3 exempts inactive controls from the minimum.
        let selector = "";
        read(file).split("\n").forEach((line, i) => {
          const open = /^([^{}]*)\{/.exec(line.trim());
          if (open && open[1]) selector = open[1];
          else if (line.includes("}")) selector = "";
          if (/:disabled|\[disabled\]|aria-disabled/.test(selector)) return;

          // Anchored to `color:` so border-color and accent-color are not
          // mistaken for text colour.
          const m = /^\s*color:\s*color-mix\(in srgb, var\(--color-text\) (\d+)%/.exec(line);
          if (m && Number(m[1]) < MUTED_FLOOR) {
            found.push({ where: `${rel(file)}:${i + 1}`, detail: `${m[1]}% text` });
          }
        });
      }
      return found;
    },
  },

  {
    name: "no hard-coded colours in the page layer",
    why: "every colour resolves to a design-system token; only the theme files name values",
    run: () => {
      const found: Finding[] = [];
      for (const file of cssFiles()) {
        const r = rel(file);
        if (isVendored(file) || r.includes("src/styles/themes/")) continue;
        read(file).split("\n").forEach((line, i) => {
          if (line.trimStart().startsWith("/*") || line.trimStart().startsWith("*")) return;
          const m = /#[0-9a-fA-F]{3,8}\b/.exec(line);
          if (m) found.push({ where: `${r}:${i + 1}`, detail: m[0] });
        });
      }
      return found;
    },
  },

  {
    name: "client components never reach the catalogue",
    why: "lib/catalogue.ts imports every catalogue JSON at module scope; importing it from a client component ships the whole catalogue to the browser",
    run: () => {
      const found: Finding[] = [];
      for (const file of codeFiles()) {
        const src = read(file);
        if (!/^\s*["']use client["']/m.test(src)) continue;
        for (const m of src.matchAll(/^import[^;]*from\s+["']([^"']+)["']/gm)) {
          const spec = m[1] ?? "";
          if (/lib\/catalogue|\.\.\/data\/|@\/\.\.\/data/.test(spec)) {
            found.push({ where: rel(file), detail: `imports ${spec}` });
          }
        }
      }
      return found;
    },
  },

  {
    name: "no unused dictionary keys",
    why: "a string nothing renders is either a missed wiring or dead weight a translator would still pay for",
    run: () => {
      const dict = read(path.join(ROOT, "src/lib/i18n/dictionaries/en.ts"));
      const keys = [...dict.matchAll(/^ {4}([a-zA-Z][a-zA-Z0-9]*):/gm)].map((m) => m[1]);
      const src = codeFiles()
        .filter((f) => !f.includes("dictionaries"))
        .map(read)
        .join("\n");
      return keys
        .filter((k) => k && !src.includes(`.${k}`))
        .map((k) => ({ where: "dictionaries/en.ts", detail: `${k} is never read` }));
    },
  },

  {
    name: "no unused exports",
    why: "an export nothing imports is usually a helper that was duplicated inline somewhere instead",
    run: () => {
      // Generated code is not ours to prune: database.types.ts is rewritten
      // wholesale by `npm run db:types` from the live schema.
      const files = codeFiles().filter(
        (f) => !rel(f).includes("src/app/") && !rel(f).endsWith(".types.ts"),
      );
      const all = [...codeFiles(), ...walk(path.join(ROOT, "scripts"), (f) => f.endsWith(".ts"))]
        .map(read)
        .join("\n");
      const found: Finding[] = [];
      for (const file of files) {
        for (const m of read(file).matchAll(/^export (?:async )?(?:function|const|class) (\w+)/gm)) {
          const name = m[1];
          if (!name) continue;
          const uses = all.split(new RegExp(`\\b${name}\\b`)).length - 1;
          if (uses <= 1) found.push({ where: rel(file), detail: `${name} is never imported` });
        }
      }
      return found;
    },
  },

  {
    name: "every custom property a stylesheet uses is defined",
    why: "an undefined var() makes the whole declaration invalid, so the rule is dropped in silence and the element keeps its initial value",
    run: () => {
      // How this earned its place: `padding: var(--space-4) var(--space-5)`.
      // The scale runs 1, 2, 3, 4, 6, 8 and has no 5, so the declaration was
      // invalid and the padding computed to 0. The border and the grid on
      // the same element applied normally, so the row simply looked tight
      // rather than broken, and it shipped through a passing build, a passing
      // lint and a passing browser audit.
      const defined = new Set<string>();
      const used: Array<{ name: string; where: string }> = [];

      for (const file of cssFiles()) {
        read(file)
          .split("\n")
          .forEach((line, i) => {
            for (const m of line.matchAll(/(--[a-zA-Z0-9-]+)\s*:/g)) {
              defined.add(m[1]!);
            }
            for (const m of line.matchAll(/var\(\s*(--[a-zA-Z0-9-]+)/g)) {
              used.push({ name: m[1]!, where: `${rel(file)}:${i + 1}` });
            }
          });
      }

      // Properties that exist but not in any stylesheet: set inline from
      // TypeScript via style={{ "--x": n }}, or generated by next/font, which
      // emits `--font-barlow` onto a class rather than into a CSS file.
      for (const file of codeFiles()) {
        const src = read(file);
        for (const m of src.matchAll(/"(--[a-zA-Z0-9-]+)"\s*:/g)) defined.add(m[1]!);
        for (const m of src.matchAll(/variable:\s*"(--[a-zA-Z0-9-]+)"/g)) defined.add(m[1]!);
      }

      const seen = new Set<string>();
      const found: Finding[] = [];
      for (const u of used) {
        // A var() with a fallback survives the property being missing.
        if (defined.has(u.name) || seen.has(u.name + u.where)) continue;
        seen.add(u.name + u.where);
        found.push({ where: u.where, detail: `${u.name} is never defined` });
      }
      return found;
    },
  },
  {
    name: "no font weight loaded but never painted",
    why: "each unused weight is a font file downloaded on every page for nothing",
    run: () => {
      const layout = read(path.join(ROOT, "src/lib/fonts.ts"));
      const css = [...cssFiles().map(read)].join("\n");
      const usedWeights = new Set<string>();
      for (const m of css.matchAll(/font-weight:\s*(\d{3})/g)) usedWeights.add(m[1] ?? "");
      for (const m of css.matchAll(/--font-heading-weight:\s*(\d{3})/g)) usedWeights.add(m[1] ?? "");
      // A face declared with no explicit weight is painted at 400.
      usedWeights.add("400");

      const found: Finding[] = [];
      for (const m of layout.matchAll(/(\w+)\(\{[\s\S]*?weight:\s*\[([^\]]*)\]/g)) {
        const family = m[1] ?? "";
        for (const raw of (m[2] ?? "").split(",")) {
          const weight = raw.trim().replace(/["']/g, "");
          if (weight && !usedWeights.has(weight)) {
            found.push({ where: "layout.tsx", detail: `${family} ${weight} is loaded but no CSS paints it` });
          }
        }
      }
      return found;
    },
  },

  {
    name: "data files are in step with the code",
    why: "a page rendering a field the ingest no longer emits fails at build, not in review",
    run: () => {
      const found: Finding[] = [];
      for (const name of ["products", "categories", "finishes", "search", "meta"]) {
        const file = path.join(ROOT, "data", `${name}.json`);
        if (!fs.existsSync(file)) {
          found.push({ where: `data/${name}.json`, detail: "missing; run npm run ingest" });
        }
      }
      const products = JSON.parse(read(path.join(ROOT, "data/products.json"))) as Array<{
        slug: string;
        image: { src: string };
        datasheet: string | null;
      }>;
      for (const p of products) {
        for (const asset of [p.image.src, p.datasheet]) {
          if (asset && !fs.existsSync(path.join(ROOT, "public", asset))) {
            found.push({ where: p.slug, detail: `references missing file ${asset}` });
          }
        }
      }
      return found;
    },
  },
];

/* ── run ────────────────────────────────────────────────────────────── */

let failed = 0;
for (const check of checks) {
  const findings = check.run();
  if (findings.length === 0) {
    console.log(`  ok    ${check.name}`);
    continue;
  }
  failed += 1;
  console.log(`  FAIL  ${check.name}`);
  console.log(`        ${check.why}`);
  for (const f of findings.slice(0, 12)) {
    console.log(`        ${f.where}  ${f.detail}`);
  }
  if (findings.length > 12) console.log(`        ...and ${findings.length - 12} more`);
}

// Informational, not a gate: the client has deferred where documents live, so
// this reports the number rather than enforcing one.
const docs = path.join(ROOT, "public/docs");
if (fs.existsSync(docs)) {
  const files = fs.readdirSync(docs);
  const bytes = files.reduce((sum, f) => sum + fs.statSync(path.join(docs, f)).size, 0);
  const perProduct = bytes / Math.max(files.length, 1);
  console.log(
    `\n  note  data sheets: ${files.length} files, ${(bytes / 1024 / 1024).toFixed(1)} MB ` +
      `(~${((perProduct * 596) / 1024 / 1024).toFixed(0)} MB at the full 596)`,
  );
}

console.log(`\n${checks.length} checks, ${failed} failing`);
process.exit(failed > 0 ? 1 : 0);
