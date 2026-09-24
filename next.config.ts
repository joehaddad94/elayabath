import type { NextConfig } from "next";

/**
 * Where Supabase Storage lives, read from the environment so that moving
 * between a local stack, Joe's development project and Elaya's own account
 * changes a setting and not this file.
 */
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL)
  : undefined;

/** Next 16 refuses to optimise images served from a local address, as a
 *  guard against reaching into a private network. A local Supabase stack
 *  serves from 127.0.0.1, so the guard is lifted only when the configured
 *  host is itself local, which can never be true of a deployed site. */
const supabaseIsLocal =
  supabaseUrl !== undefined && ["127.0.0.1", "localhost"].includes(supabaseUrl.hostname);

const nextConfig: NextConfig = {
  // Catalogue photography, swatches and data sheets live in Supabase Storage
  // public buckets; the site's own room photography stays under public/.
  // next/image handles sizing and srcset for both.
  images: {
    remotePatterns: supabaseUrl
      ? [
          {
            protocol: supabaseUrl.protocol.replace(":", "") as "http" | "https",
            hostname: supabaseUrl.hostname,
            port: supabaseUrl.port,
            pathname: "/storage/v1/object/public/**",
          },
        ]
      : [],
    dangerouslyAllowLocalIP: supabaseIsLocal,
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

  /**
   * Hide the default locale from URLs.
   *
   * Routes live under src/app/[locale] so adding Arabic later is a dictionary
   * and a font rather than a routing migration. While there is only English,
   * nobody should have to look at /en/about, so every request that is not
   * already localised, not a Next internal, and not a file with an extension
   * is rewritten into the en tree.
   *
   * Rewrites, not redirects: the canonical URL stays the clean one, which is
   * what sitemap.ts emits and what Link produces.
   */
  async rewrites() {
    return {
      beforeFiles: [
        { source: "/", destination: "/en" },
        {
          // Everything that is not already localised, not a Next internal,
          // and contains no dot. The dot test is what keeps /logo.png,
          // /sitemap.xml, /robots.txt and every image in public/ out of the
          // rewrite: they are files, not routes, and sending them into the
          // locale tree 404s them.
          source: "/:path((?!en$|en/|_next/|api/|admin$|admin/)[^.]*)",
          destination: "/en/:path",
        },
      ],
      afterFiles: [],
      fallback: [],
    };
  },
};

export default nextConfig;
