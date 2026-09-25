import type { MetadataRoute } from "next";
import { SITE_ORIGIN } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    // The dashboard also sends noindex on every page; this keeps well-behaved
    // crawlers from fetching it at all.
    rules: { userAgent: "*", allow: "/", disallow: ["/admin", "/api/"] },
    sitemap: `${SITE_ORIGIN}/sitemap.xml`,
  };
}
