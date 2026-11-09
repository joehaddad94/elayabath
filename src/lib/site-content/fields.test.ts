import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/config", () => ({
  storageUrl: (bucket: string, path: string) => `https://store.test/${bucket}/${path}`,
}));

const { PHOTO_FIELDS, SITE_PAGES, TEXT_FIELDS, WIDE_MIN_WIDTH, applyText, faqFor, originalText, photoFor, schemaFor, seoFor } =
  await import("./fields");
const { PHOTOS } = await import("@/lib/imagery");
const { default: en } = await import("@/lib/i18n/dictionaries/en");

describe("site content fields", () => {
  it("only offers text that exists in the dictionary", () => {
    for (const key of TEXT_FIELDS.keys()) expect(originalText(key), key).toBeDefined();
  });

  it("only offers wide photos where the original is wide", () => {
    for (const field of PHOTO_FIELDS.values()) {
      if (field.wide) expect(PHOTOS[field.fallback].width, field.key).toBeGreaterThanOrEqual(WIDE_MIN_WIDTH);
    }
  });

  it("gives every page a unique slug", () => {
    expect(new Set(SITE_PAGES.map((p) => p.slug)).size).toBe(SITE_PAGES.length);
  });

  it("applies edits and leaves everything else as written", () => {
    const t = applyText(en, { "home.lede": "New intro", "home.plateItems": ["One", "Two"] });
    expect(t.home.lede).toBe("New intro");
    expect(t.home.plateItems).toEqual(["One", "Two"]);
    expect(t.home.quote).toBe(en.home.quote);
    expect(en.home.lede).not.toBe("New intro");
  });

  it("ignores keys that aren't editable and values that don't pass", () => {
    const t = applyText(en, { "nav.home": "Hacked", "home.lede": "", "contactAddresses.general": "not an email" });
    expect(t.nav.home).toBe(en.nav.home);
    expect(t.home.lede).toBe(en.home.lede);
    expect(t.contactAddresses.general).toBe(en.contactAddresses.general);
  });

  it("places an uploaded photo, or the original with an edited description", () => {
    const uploaded = photoFor(
      { "photo.home.hero": { path: "photos/home-hero/a.webp", width: 2000, height: 800, alt: "A room" } },
      "photo.home.hero",
    );
    expect(uploaded).toEqual({ src: "https://store.test/site-media/photos/home-hero/a.webp", width: 2000, height: 800, alt: "A room" });
    const described = photoFor({ "photo.home.band": { path: null, width: null, height: null, alt: "Better" } }, "photo.home.band");
    expect(described).toEqual({ ...PHOTOS.shopBanner, alt: "Better" });
    expect(photoFor({ "photo.home.band": "junk" }, "photo.home.band")).toEqual(PHOTOS.shopBanner);
  });

  it("falls back to the original search title and description", () => {
    expect(seoFor({}, "about").title).toBe("About Us");
    expect(seoFor({ "seo.about.title": "Who we are" }, "about").title).toBe("Who we are");
  });

  it("reads the FAQ only when it is valid", () => {
    expect(faqFor({})).toBeNull();
    expect(faqFor({ "faq.items": [{ q: "Q", a: "A", visible: true }] })).toEqual([{ q: "Q", a: "A", visible: true }]);
    expect(faqFor({ "faq.items": [{ q: "", a: "A", visible: true }] })).toBeNull();
  });

  it("refuses keys it doesn't know", () => {
    expect(schemaFor("nav.home")).toBeUndefined();
    expect(schemaFor("seo.nowhere.title")).toBeUndefined();
    expect(schemaFor("home.tileAlt.toilets")).toBeDefined();
  });
});
