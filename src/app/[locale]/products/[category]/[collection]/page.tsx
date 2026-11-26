import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { collectionCount } from "@/components/CollectionGrid/CollectionGrid";
import { Container, Section } from "@/components/Container/Container";
import { Hero } from "@/components/Hero/Hero";
import { JsonLd } from "@/components/JsonLd/JsonLd";
import { PhotoBand } from "@/components/PhotoBand/PhotoBand";
import { ProductGrid } from "@/components/ProductGrid/ProductGrid";
import { SectionHead } from "@/components/SectionHead/SectionHead";
import { getCollection, getCollections } from "@/lib/catalogue";
import { format } from "@/lib/i18n";
import { LOCALES, isLocale } from "@/lib/i18n/config";
import { categoryBand, categoryBanner } from "@/lib/imagery";
import { routes } from "@/lib/routes";
import { breadcrumbSchema, canonical, categorySchema, clampDescription } from "@/lib/seo";
import { getSiteDictionary } from "@/lib/site-content/read";
import categoryStyles from "../category.module.css";

/** Every collection on the site is built ahead: they are the pages people
 *  browse, and there are a few hundred at most. One published later gets
 *  its page on its first visit. */
export async function generateStaticParams() {
  const collections = await getCollections();
  return LOCALES.flatMap((locale) =>
    collections.map((c) => ({ locale, category: c.categorySlug, collection: c.slug })),
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ category: string; collection: string }>;
}): Promise<Metadata> {
  const { category, collection: slug } = await params;
  const found = await getCollection(category, slug);
  if (!found) return {};
  const { collection } = found;
  return {
    title: `${collection.name} ${collection.categoryName}`,
    description: clampDescription(
      collection.description ||
        `The ${collection.name} collection from Elaya Bath: ${found.products.length} ${collection.categoryName.toLowerCase()} with item codes, dimensions and finishes.`,
    ),
    alternates: canonical(routes.collection(collection.categorySlug, collection.slug)),
    openGraph: collection.image ? { images: [collection.image.src] } : undefined,
  };
}

/**
 * One collection: its products, always as a grid, even when there is only
 * one. Each card opens the product's own page, whose address is unchanged.
 */
export default async function CollectionPage({
  params,
}: {
  params: Promise<{ locale: string; category: string; collection: string }>;
}) {
  const { locale: rawLocale, category, collection: slug } = await params;
  if (!isLocale(rawLocale)) notFound();
  const locale = rawLocale;

  const [found, t, siblings] = await Promise.all([
    getCollection(category, slug),
    getSiteDictionary(locale),
    getCollections(category),
  ]);
  if (!found) notFound();
  const { collection, products } = found;
  const others = siblings.filter((c) => c.slug !== collection.slug);

  const crumbs = [
    { name: t.nav.home, href: routes.home(locale) },
    { name: t.products.title, href: routes.products(locale) },
    { name: collection.categoryName, href: routes.category(collection.categorySlug, locale) },
    { name: collection.name },
  ];

  // The collection's own photo where staff set one; otherwise the
  // category's banner, since a product cut-out does not fill a band.
  const banner =
    collection.image && !collection.image.product
      ? { ...collection.image, alt: collection.name }
      : categoryBanner(collection.categorySlug);

  return (
    <main id="main">
      <JsonLd
        graph={[
          categorySchema(
            { name: `${collection.name} ${collection.categoryName}` },
            routes.collection(collection.categorySlug, collection.slug),
            products.map((p) => routes.product(p.slug)),
          ),
          breadcrumbSchema(crumbs),
        ]}
      />
      <Hero
        compact
        title={collection.name}
        image={banner}
        crumbLabel={t.common.breadcrumb}
        crumbs={crumbs.map((c) => ({ label: c.name, href: c.href }))}
        lede={collection.description || `${collectionCount(t, products.length)} · ${collection.categoryName}`}
      />

      <Section tight>
        <Container>
          <SectionHead label={t.collection.productsHeading} count={String(products.length)} />
          <ProductGrid products={products} locale={locale} t={t} priorityCount={4} />
        </Container>
      </Section>

      <PhotoBand
        image={categoryBand(collection.categorySlug)}
        label={t.category.bandLabel}
        heading={t.category.bandHeading}
        actions={
          <Link className="btn btn-primary blueprint" href={`${routes.contact(locale)}#enquiry`}>
            {t.common.requestQuote}
          </Link>
        }
      />

      {others.length > 0 && (
        <Section band>
          <Container>
            <SectionHead label={format(t.collection.others, { category: collection.categoryName })} />
            <ul className={categoryStyles.others}>
              {others.map((other) => (
                <li key={other.slug}>
                  <Link href={routes.collection(other.categorySlug, other.slug, locale)}>
                    <span>{other.name}</span>
                    <span className={categoryStyles.otherCount}>{collectionCount(t, other.count)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </Container>
        </Section>
      )}
    </main>
  );
}
