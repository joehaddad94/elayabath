import Link from "next/link";
import { notFound } from "next/navigation";
import { Container, Section } from "@/components/Container/Container";
import { CollectionGrid } from "@/components/CollectionGrid/CollectionGrid";
import { Hero } from "@/components/Hero/Hero";
import { PhotoBand } from "@/components/PhotoBand/PhotoBand";
import { SectionHead } from "@/components/SectionHead/SectionHead";
import { getCatalogueMeta, getCategories, getCollections } from "@/lib/catalogue";
import { format } from "@/lib/i18n";
import { isLocale } from "@/lib/i18n/config";
import { photoFor } from "@/lib/site-content/fields";
import { getSiteContent, getSiteDictionary, pageMetadata } from "@/lib/site-content/read";
import { routes } from "@/lib/routes";
import styles from "./products.module.css";

export function generateMetadata() {
  return pageMetadata("products", routes.products());
}

export default async function ProductsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale = raw;
  const [t, content, categories, collections, meta] = await Promise.all([
    getSiteDictionary(locale),
    getSiteContent(),
    getCategories(),
    getCollections(),
    getCatalogueMeta(),
  ]);

  return (
    <main id="main">
      <Hero
        compact
        title={t.products.title}
        image={photoFor(content, "photo.products.banner")}
        crumbLabel={t.common.breadcrumb}
        crumbs={[
          { label: t.nav.home, href: routes.home(locale) },
          { label: t.products.title },
        ]}
      />

      <Section tight>
        <Container>
          <SectionHead label={t.products.allCollections} count={String(collections.length)} />

          <p className={styles.intro}>{t.products.intro}</p>

          {/* Every collection, grouped under its category in menu order. */}
          {categories.map((category) => {
            const own = collections.filter((c) => c.categorySlug === category.slug);
            if (own.length === 0) return null;
            return (
              <section key={category.slug} className={styles.group} aria-labelledby={`group-${category.slug}`}>
                <h2 id={`group-${category.slug}`} className={styles.groupTitle}>
                  <Link href={routes.category(category.slug, locale)}>{category.name}</Link>
                  <span className={styles.groupCount}>{own.length}</span>
                </h2>
                <CollectionGrid collections={own} locale={locale} t={t} />
              </section>
            );
          })}
        </Container>
      </Section>

      <PhotoBand
        image={photoFor(content, "photo.products.band")}
        label={t.category.finishesHeading}
        heading={format(t.home.bandHeading, {
          products: meta.productsInCatalogue,
          categories: meta.categoriesInCatalogue,
          finishes: meta.finishesInCatalogue,
        })}
        actions={
          <Link className="btn btn-secondary" href={routes.catalogue(locale)}>
            {t.common.downloadCatalogue}
          </Link>
        }
      />

      <Section band>
        <Container>
          <SectionHead label={t.products.knowTheCode} />
          <p className={styles.intro}>{t.products.knowTheCodeBody}</p>
          <p>
            <Link
              className="btn btn-primary blueprint"
              href={`${routes.contact(locale)}#enquiry`}
            >
              {t.common.requestQuote}
            </Link>
          </p>
        </Container>
      </Section>
    </main>
  );
}
