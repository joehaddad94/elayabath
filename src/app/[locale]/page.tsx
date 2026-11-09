import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CategoryBlock } from "@/components/CategoryBlock/CategoryBlock";
import { Container, Section } from "@/components/Container/Container";
import { FinishRail } from "@/components/FinishRail/FinishRail";
import { Hero } from "@/components/Hero/Hero";
import { ProductGrid } from "@/components/ProductGrid/ProductGrid";
import { PhotoBand } from "@/components/PhotoBand/PhotoBand";
import { PullQuote } from "@/components/PullQuote/PullQuote";
import { SectionHead } from "@/components/SectionHead/SectionHead";
import { SpecPlate } from "@/components/SpecPlate/SpecPlate";
import {
  getCatalogueMeta,
  getCategories,
  getHomepageProducts,
  getFinishes,
} from "@/lib/catalogue";
import { format } from "@/lib/i18n";
import { isLocale } from "@/lib/i18n/config";
import { routes } from "@/lib/routes";
import { HOME_HERO_KEY, HOME_PRODUCTS_KEY, photoFor, tileAlt } from "@/lib/site-content/fields";
import { getSiteContent, getSiteDictionary, pageMetadata } from "@/lib/site-content/read";
import styles from "./page.module.css";

export function generateMetadata() {
  return pageMetadata("home", routes.home());
}

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale = raw;
  const [t, content] = await Promise.all([getSiteDictionary(locale), getSiteContent()]);
  const chosen = content[HOME_PRODUCTS_KEY];

  const [meta, categories, picked, finishes] = await Promise.all([
    getCatalogueMeta(),
    getCategories(),
    // Chosen in Site content; until then, the fixed list in src/content/homepage.ts.
    getHomepageProducts(Array.isArray(chosen) ? chosen.filter((id): id is string => typeof id === "string") : null),
    getFinishes(),
  ]);
  const products = picked.map((p) => p.product);

  // Only the categories the client has actually written copy for lead the
  // page. The live homepage leads with four, one of which has no products
  // behind it at all.
  const featured = categories.filter((c) => c.blurb && c.image);
  // The product starred in Site content, if it is still live with a photo;
  // otherwise the first bathtub, as before anyone chose.
  const hero =
    picked.find((p) => p.id === content[HOME_HERO_KEY] && p.product.image)?.product ??
    products.find((p) => p.categorySlug === "bathtubs") ??
    products[0];
  const grid = products.slice(0, 12);
  const rail = finishes.slice(0, 18);

  return (
    <main id="main">
      <Hero
        title={t.brand.tagline}
        tagline
        // The lightest wide photograph in the archive. The brand asks for
        // light grounds and soft, warm light; the dusk forest bathroom that
        // used to open the site is neither.
        image={photoFor(content, "photo.home.hero")}
        lede={t.home.lede}
        actions={
          <>
            <Link className="btn btn-primary blueprint" href={routes.products(locale)}>
              {t.common.shopTheSelection}
            </Link>
            <Link className="btn btn-secondary" href={routes.catalogue(locale)}>
              {t.nav.catalogue}
            </Link>
          </>
        }
      >
        <SpecPlate
          intro={t.home.plateIntro}
          items={t.home.plateItems}
          foot={t.home.plateFoot}
        />

        {hero?.image && (
          <figure className={`${styles.heroProduct} blueprint`}>
            <Image
              src={hero.image.src}
              alt={hero.image.alt}
              width={hero.image.width}
              height={hero.image.height}
              sizes="(max-width: 62rem) 100vw, 30rem"
            />
            <figcaption>
              <span>{hero.name}</span>
              <span>{hero.type.name}</span>
            </figcaption>
          </figure>
        )}
      </Hero>

      <Section band>
        <Container>
          <PullQuote
            text={t.home.quote}
            attribution={t.home.quoteAttribution}
            emphasise="Myth."
          />
        </Container>
      </Section>

      <Section id="products">
        <Container>
          <SectionHead
            index="01"
            label={t.home.productsLabel}
            count={format(t.home.productsMeta, {
              shown: featured.length,
              total: meta.categoriesInCatalogue,
            })}
          />
          {featured.map((category, index) => (
            <CategoryBlock
              key={category.slug}
              category={category}
              caption={tileAlt(content, category.slug, category.name)}
              locale={locale}
              t={t}
              flip={index % 2 === 1}
            />
          ))}
        </Container>
      </Section>

      {/* A photograph between the categories and the grid. Reused from the
          Products page banner: there are four wide images in the recovered
          set and four other placements, so a distinct one has to come from
          the client. Noted rather than quietly duplicated. */}
      <PhotoBand
        image={photoFor(content, "photo.home.band")}
        label={t.home.bandLabel}
        heading={format(t.home.bandHeading, {
          products: meta.productsInCatalogue,
          categories: meta.categoriesInCatalogue,
          finishes: meta.finishesInCatalogue,
        })}
        actions={
          <>
            <Link className="btn btn-primary blueprint" href={routes.products(locale)}>
              {t.common.browseProducts}
            </Link>
            <Link className="btn btn-secondary" href={routes.catalogue(locale)}>
              {t.common.downloadCatalogue}
            </Link>
          </>
        }
      />

      <Section id="detail" band>
        <Container>
          <SectionHead
            index="02"
            label={t.common.products}
            count={`${grid.length} ${t.common.of} ${meta.productsInCatalogue}`}
          />
          <ProductGrid products={grid} locale={locale} t={t} priorityCount={0} />
        </Container>
      </Section>

      <Section id="finishes">
        <Container>
          <SectionHead
            index="03"
            label={t.common.finishes}
            count={`${rail.length} ${t.common.of} ${meta.finishesInCatalogue}`}
          />
          <FinishRail
            finishes={rail}
            note={t.category.swatchNote}
            missingLabel={t.category.noSwatch}
          />
        </Container>
      </Section>

      <Section id="quote" band>
        <Container>
          <SectionHead index="04" label={t.product.quoteHeading} />
          <div className={styles.close}>
            <p className={styles.closeLede}>{t.product.quoteBody}</p>
            <div className={styles.closeActions}>
              <Link
                className="btn btn-primary blueprint"
                href={`${routes.contact(locale)}#enquiry`}
              >
                {t.common.requestQuote}
              </Link>
              <Link className="btn btn-secondary" href={routes.catalogue(locale)}>
                {t.common.downloadCatalogue}
              </Link>
            </div>
          </div>
        </Container>
      </Section>
    </main>
  );
}
