import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Container, Section } from "@/components/Container/Container";
import { EditorialBlock } from "@/components/EditorialBlock/EditorialBlock";
import { FinishRail } from "@/components/FinishRail/FinishRail";
import { Hero } from "@/components/Hero/Hero";
import { JsonLd } from "@/components/JsonLd/JsonLd";
import { PhotoBand } from "@/components/PhotoBand/PhotoBand";
import { ProductBrowser, SHELF_PAGE } from "@/components/ProductBrowser/ProductBrowser";
import { SectionHead } from "@/components/SectionHead/SectionHead";
import {
  getCategories,
  getCategory,
  getFinish,
  getShelf,
} from "@/lib/catalogue";
import { format, getDictionary } from "@/lib/i18n";
import { categoryBand, categoryBanner, categoryInset } from "@/lib/imagery";
import { LOCALES, isLocale } from "@/lib/i18n/config";
import { EMPTY_SELECTION } from "@/lib/product-filters";
import { routes } from "@/lib/routes";
import {
  breadcrumbSchema,
  canonical,
  categorySchema,
  clampDescription,
} from "@/lib/seo";
import type { Finish } from "@/lib/types";
import styles from "./category.module.css";

export async function generateStaticParams() {
  const categories = await getCategories();
  return LOCALES.flatMap((locale) =>
    categories.map((category) => ({ locale, category: category.slug })),
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ category: string }>;
}): Promise<Metadata> {
  const { category: slug } = await params;
  const category = await getCategory(slug);
  if (!category) return {};
  return {
    title: category.name,
    // The client's blurbs run to 270-300 characters, which a result page
    // truncates mid-sentence. Trimmed to a whole sentence under the limit,
    // falling back to a generated line where the blurb has no sentence break.
    description: clampDescription(
      category.blurb?.[0] ??
        `${category.totalInCatalogue} ${category.name.toLowerCase()} from Elaya Bath, with item codes, dimensions and finishes.`,
    ),
    alternates: canonical(routes.category(category.slug)),
  };
}

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ locale: string; category: string }>;
}) {
  const { locale: rawLocale, category: slug } = await params;
  if (!isLocale(rawLocale)) notFound();
  const locale = rawLocale;

  const category = await getCategory(slug);
  if (!category) notFound();

  const t = getDictionary(locale);
  // The first page of the unfiltered shelf comes with the page, which keeps
  // the page static. Filters, sorting and further pages are fetched.
  const initial = await getShelf(slug, EMPTY_SELECTION, "default", SHELF_PAGE, 0);
  const products = initial.products;

  // Only the finishes this category actually contains, so the filter never
  // offers a colour that would return nothing.
  const finishes = (
    await Promise.all(category.finishes.map((finishSlug) => getFinish(finishSlug)))
  ).filter((f): f is Finish => Boolean(f));

  // Only blurb[0] was ever painted. Anything the client wrote beyond it was
  // being carried in the data and never shown.
  const extra = category.blurb?.slice(1) ?? [];
  const others = (await getCategories()).filter((c) => c.slug !== category.slug);

  const crumbs = [
    { name: t.nav.home, href: routes.home(locale) },
    { name: t.products.title, href: routes.products(locale) },
    { name: category.name },
  ];

  return (
    <main id="main">
      <JsonLd
        graph={[
          categorySchema(
            category,
            routes.category(category.slug),
            products.map((p) => routes.product(p.slug)),
          ),
          breadcrumbSchema(crumbs),
        ]}
      />
      {/* A photograph rather than a text band. Three of the six categories
          have no image of their own and borrow one that genuinely contains
          the product; see lib/imagery.ts. */}
      <Hero
        compact
        title={category.name}
        image={categoryBanner(category.slug)}
        crumbLabel={t.common.breadcrumb}
        crumbs={crumbs.map((c) => ({ label: c.name, href: c.href }))}
        lede={
          category.blurb
            ? category.blurb[0]
            : `${category.count} ${category.name.toLowerCase()}, each with an item code, dimensions and finishes.`
        }
      />

      <Section tight>
        <Container>
          <ProductBrowser
            category={category}
            initial={initial}
            finishes={finishes}
            locale={locale}
            t={t}
          />
        </Container>
      </Section>

      {/* The client wrote more than one paragraph for some categories and
          the page was showing only the first. Where the rest exists it goes
          here, beside the narrow photograph that has nowhere else to sit. */}
      <Section band>
        <Container>
          <EditorialBlock
            image={categoryInset(category.slug)}
            label={extra.length > 0 ? t.category.moreLabel : t.category.insetLabel}
            heading={extra.length > 0 ? category.name : t.category.insetHeading}
            actions={
              <Link className="btn btn-secondary" href={routes.catalogue(locale)}>
                {t.common.downloadCatalogue}
              </Link>
            }
          >
            {extra.length > 0 ? (
              extra.map((paragraph) => <p key={paragraph.slice(0, 40)}>{paragraph}</p>)
            ) : (
              <p>{t.category.insetBody}</p>
            )}
          </EditorialBlock>
        </Container>
      </Section>

      {finishes.length > 0 && (
        <Section>
          <Container>
            <SectionHead
              label={t.category.finishesHeading}
              count={format(t.category.finishesLede, { n: finishes.length })}
            />
            <FinishRail
              finishes={finishes}
              note={t.category.swatchNote}
              missingLabel={t.category.noSwatch}
            />
          </Container>
        </Section>
      )}

      <PhotoBand
        image={categoryBand(category.slug)}
        label={t.category.bandLabel}
        heading={t.category.bandHeading}
        actions={
          <Link
            className="btn btn-primary blueprint"
            href={`${routes.contact(locale)}#enquiry`}
          >
            {t.common.requestQuote}
          </Link>
        }
      />

      <Section band>
        <Container>
          <SectionHead label={t.category.otherHeading} />
          <ul className={styles.others}>
            {others.map((other) => (
              <li key={other.slug}>
                <Link href={routes.category(other.slug, locale)}>
                  <span>{other.name}</span>
                  <span className={styles.otherCount}>
                    {other.count} {t.common.products.toLowerCase()}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Container>
      </Section>
    </main>
  );
}
