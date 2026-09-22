/**
 * Every photograph the site places, in one record.
 *
 * Three reasons this is a module rather than an object literal at each call
 * site, which is how it was written before.
 *
 * Dimensions were being retyped from memory. `width` and `height` on a
 * next/image are not decoration: they are the intrinsic size the aspect ratio
 * is computed from, and a wrong pair is a layout shift that nothing catches.
 *
 * Alt text was being rewritten each time the same photograph was placed, so
 * the same image described itself differently on two pages.
 *
 * And the archive is small. Ten photographs have to cover a dozen placements,
 * so which image goes where is a decision that deserves to be visible and
 * argued with, not buried in a page component.
 */
export interface Photo {
  src: string;
  alt: string;
  width: number;
  height: number;
}

/* A photograph shown full-bleed needs to be at least 1400px wide: a 1440px
   viewport asks for more than any of these can give at 2x, but below 1400 the
   upscaling is visible at ordinary desktop widths. Four of the ten qualify.
   The threshold is asserted in imagery.test.ts rather than held as an export
   here, because the static audit rejects an export only a test imports. */

export const PHOTOS = {
  /** Free-standing bath and a stone vessel basin, forest through the glass. */
  heroRoom: {
    src: "/rooms/hero-room.webp",
    alt: "A dark timber bathroom with a free-standing bath and a stone vessel basin on a timber counter, forest visible through full-height glass",
    width: 2048,
    height: 797,
  },
  /** The same scene, framed wider. Carries the bath, so it is what the
   *  bathtub category borrows. */
  shopBanner: {
    src: "/rooms/shop-banner.webp",
    alt: "A free-standing bath beside a timber counter with a stone vessel basin, forest visible through full-height glass",
    width: 2048,
    height: 797,
  },
  /** Warm timber, a vessel basin, a towel rail and wall-mounted tapware. The
   *  towel rail is why accessories borrows this one. */
  aboutBanner: {
    src: "/rooms/about-banner.webp",
    alt: "A warmly lit timber bathroom with a dark stone vessel basin, wall-mounted tap and a towel rail",
    width: 2048,
    height: 647,
  },
  /** Three bays, each a different colourway of the same pedestal basin and
   *  wall-hung WC. The clearest statement of finishes in the archive. */
  contactBanner: {
    src: "/rooms/contact-banner.webp",
    alt: "Three bathroom bays side by side, each pairing a pedestal basin and a wall-hung toilet in a different colourway: charcoal, terracotta and warm grey",
    width: 1440,
    height: 600,
  },
  /** Not a room at all: a flat-lay of material samples. It belongs wherever
   *  the subject is the material rather than the fitting. */
  materials: {
    src: "/rooms/catalogue-room.webp",
    alt: "A flat-lay of material samples: matt black, travertine, concrete, marble and soft ceramic tones",
    width: 960,
    height: 756,
  },
  /** Portrait. A vanity unit under a backlit round mirror, with a shower
   *  column and the edge of a bath at the left. */
  furniture: {
    src: "/rooms/room-furniture.webp",
    alt: "A terrazzo bathroom with a backlit round mirror over a fluted vanity unit, a shower column and bath at the left",
    width: 736,
    height: 911,
  },
  washbasins: {
    src: "/rooms/room-washbasins.webp",
    alt: "A washbasin installed on a counter",
    width: 817,
    height: 670,
  },
  tapware: {
    src: "/rooms/room-tapware.webp",
    alt: "A wall-mounted tap over a basin",
    width: 817,
    height: 670,
  },
  toilets: {
    src: "/rooms/room-toilets.webp",
    alt: "A wall-hung toilet in a tiled bathroom",
    width: 817,
    height: 670,
  },
} as const satisfies Record<string, Photo>;

export type PhotoKey = keyof typeof PHOTOS;

/**
 * The banner a category page opens with.
 *
 * Three of the six categories have no photograph of their own, so they borrow
 * one that genuinely contains the thing being sold: bathtubs takes the frame
 * with the free-standing bath, showers the frame with the shower column,
 * accessories the frame with the towel rail.
 *
 * That is a content gap, not a design decision. It is recorded in
 * MILESTONES.md so it reads as a request to the client rather than a choice.
 */
const CATEGORY_BANNERS: Record<string, PhotoKey> = {
  washbasins: "contactBanner",
  toilets: "contactBanner",
  tapware: "aboutBanner",
  bathtubs: "shopBanner",
  // Nothing in the wide set shows a shower, so this one opens on a room
  // rather than on the product, and the shower column appears further down
  // in the inset below, where a 736px image is painted at 736px or less.
  showers: "heroRoom",
  accessories: "aboutBanner",
};

/** Always a wide photograph: this one runs full-bleed. `imagery.test.ts`
 *  holds that invariant, because the failure is a soft upscaled banner that
 *  no audit reads as an error. */
export function categoryBanner(slug: string): Photo {
  return PHOTOS[CATEGORY_BANNERS[slug] ?? "heroRoom"];
}

/** A contained portrait block, so the narrow images in the archive get a
 *  placement where their size is an asset rather than a limit. */
const CATEGORY_INSETS: Record<string, PhotoKey> = {
  washbasins: "washbasins",
  tapware: "tapware",
  toilets: "toilets",
  showers: "furniture",
  bathtubs: "furniture",
  accessories: "materials",
};

export function categoryInset(slug: string): Photo {
  return PHOTOS[CATEGORY_INSETS[slug] ?? "materials"];
}

/** A second photograph for the same page, chosen so it is never the banner
 *  repeated a screen further down. */
export function categoryBand(slug: string): Photo {
  const banner = CATEGORY_BANNERS[slug];
  return banner === "shopBanner" ? PHOTOS.aboutBanner : PHOTOS.shopBanner;
}
