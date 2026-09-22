import { describe, expect, it } from "vitest";
import {
  PHOTOS,
  categoryBand,
  categoryBanner,
  categoryInset,
} from "./imagery";
import categories from "../../data/categories.json";

const slugs = (categories as Array<{ slug: string }>).map((c) => c.slug);

/** Mirrors FULL_BLEED_MIN_WIDTH in imagery.ts, which is module-local: the
 *  static audit rejects an export that only a test imports. */
const FULL_BLEED_MIN_WIDTH = 1400;

describe("imagery", () => {
  it("covers every category in the built catalogue", () => {
    for (const slug of slugs) {
      expect(categoryBanner(slug), slug).toBeDefined();
      expect(categoryInset(slug), slug).toBeDefined();
    }
  });

  it("only ever runs a wide photograph full-bleed", () => {
    // A narrow image stretched across a 1440px viewport is soft, and nothing
    // in the browser audit reads softness as a failure. This is the guard.
    for (const slug of slugs) {
      expect(categoryBanner(slug).width, `${slug} banner`).toBeGreaterThanOrEqual(
        FULL_BLEED_MIN_WIDTH,
      );
      expect(categoryBand(slug).width, `${slug} band`).toBeGreaterThanOrEqual(
        FULL_BLEED_MIN_WIDTH,
      );
    }
  });

  it("never repeats the banner as the same page's lower band", () => {
    for (const slug of slugs) {
      expect(categoryBand(slug).src, slug).not.toBe(categoryBanner(slug).src);
    }
  });

  it("describes every photograph, since alt text is the point of the record", () => {
    for (const [key, p] of Object.entries(PHOTOS)) {
      expect(p.alt.length, key).toBeGreaterThan(20);
      expect(p.width, key).toBeGreaterThan(0);
      expect(p.height, key).toBeGreaterThan(0);
    }
  });
});
