/**
 * The site's edited words and photos, read once and cached until a save in
 * Site content clears the tag. Pages ask for the dictionary through here, so
 * an edit shows wherever that text is used.
 */
import "server-only";
import type { Metadata } from "next";
import { cacheLife, cacheTag } from "next/cache";
import { tags } from "@/lib/cache-tags";
import { getDictionary, type Dictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/config";
import { canonical } from "@/lib/seo";
import { publicClient } from "@/lib/supabase/public";
import { applyText, seoFor, type PageSlug, type SiteContent } from "./fields";

export async function getSiteContent(): Promise<SiteContent> {
  "use cache";
  cacheLife("max");
  cacheTag(tags.siteContent);

  const { data, error } = await publicClient().from("site_content").select("key, value");
  // A database without the table yet (the migration not applied) is a site
  // nobody has edited: it shows the original wording rather than failing.
  if (error?.code === "PGRST205" || error?.code === "42P01") return {};
  if (error) throw new Error(`site content: ${error.message}`);
  return Object.fromEntries((data ?? []).map((row) => [row.key, row.value]));
}

/** The dictionary with Site content's edits applied. */
export async function getSiteDictionary(locale: Locale): Promise<Dictionary> {
  return applyText(getDictionary(locale), await getSiteContent());
}

/** A page's title and description for search engines, as edited. */
export async function pageMetadata(page: PageSlug, path: string): Promise<Metadata> {
  const { title, description } = seoFor(await getSiteContent(), page);
  return {
    alternates: canonical(path),
    // The homepage's title is the whole title; every other page's is placed
    // in the site-wide template ("About Us — Elaya Bath").
    title: page === "home" ? { absolute: title } : title,
    description,
  };
}
