import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Every route in this site is prerendered from committed JSON, so there is
  // no remote image host to allow and no runtime data source to configure.
  // Images are local files under public/, already converted to WebP by the
  // ingest pipeline; next/image still handles sizing and srcset.
  images: {
    // The catalogue renders at a handful of fixed sizes: a grid card, a
    // category block and the product hero. Narrowing this list keeps the
    // build from generating variants nothing requests.
    imageSizes: [64, 96, 128, 256, 384],
    deviceSizes: [640, 828, 1080, 1200, 1920, 2048],
    formats: ["image/webp"],
  },

  // Fail the production build on a type error rather than shipping it.
  // Next 16 dropped the `eslint` key from next.config: ESLint moved to flat
  // config and no longer runs as part of `next build`. Lint is its own step,
  // wired into `npm run check` so the gate still exists.
  typescript: { ignoreBuildErrors: false },

  poweredByHeader: false,
};

export default nextConfig;
