import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Container, Section } from "@/components/Container/Container";
import { EditorialBlock } from "@/components/EditorialBlock/EditorialBlock";
import { Hero } from "@/components/Hero/Hero";
import { PhotoBand } from "@/components/PhotoBand/PhotoBand";
import { PullQuote } from "@/components/PullQuote/PullQuote";
import { SectionHead } from "@/components/SectionHead/SectionHead";
import { SpecPlate } from "@/components/SpecPlate/SpecPlate";
import { getCatalogueMeta, getCategories } from "@/lib/catalogue";
import { getDictionary } from "@/lib/i18n";
import { isLocale } from "@/lib/i18n/config";
import { PHOTOS } from "@/lib/imagery";
import { routes } from "@/lib/routes";
import styles from "./about.module.css";
import { canonical } from "@/lib/seo";

export const metadata: Metadata = {
  alternates: canonical(routes.about()),
  title: "About Us",
  description:
    "ELAYA BATH was founded with a vision to revolutionize the sanitary ware industry by merging innovative technology with stunning design.",
};

export default async function AboutPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale = raw;
  const t = getDictionary(locale);
  const [meta, categories] = await Promise.all([getCatalogueMeta(), getCategories()]);

  // Counted from the catalogue, never asserted. The live About page makes no
  // numeric claims at all, so any number here has to be one we can show.
  const stats = [
    {
      n: meta.productsInCatalogue,
      k: t.about.products,
      note: t.about.productsNote,
    },
    {
      n: meta.categoriesInCatalogue,
      k: t.about.categories,
      note: t.about.categoriesNote,
    },
    {
      n: meta.finishesInCatalogue,
      k: t.about.finishesLabel,
      note: t.about.finishesNote,
    },
  ];

  return (
    <main id="main">
      <Hero
        compact
        tagline
        title={t.brand.tagline}
        image={PHOTOS.aboutBanner}
        crumbLabel={t.common.breadcrumb}
        crumbs={[
          { label: t.nav.home, href: routes.home(locale) },
          { label: t.nav.about },
        ]}
      />

      <Section tight>
        <Container>
          {/* The whole of the live About page's copy, verbatim. It is one
              paragraph and a four-item list, and there is nothing else. */}
          <div className={styles.intro}>
            <p className={styles.lede}>{t.home.lede}</p>
            <SpecPlate
              intro={t.home.plateIntro}
              items={t.home.plateItems}
              foot={t.home.plateFoot}
            />
          </div>

          <div className={styles.stats}>
            {stats.map((stat) => (
              <div key={stat.k} className={`card blueprint ${styles.stat}`}>
                <span className={styles.n}>{stat.n}</span>
                <span className={styles.k}>{stat.k}</span>
                <p>{stat.note}</p>
              </div>
            ))}
          </div>
        </Container>
      </Section>

      {/* The flat-lay of samples was sitting on the catalogue page only.
          It is the one image in the archive whose subject is the material
          rather than the fitting, which is what this section is about. */}
      <Section band>
        <Container>
          <EditorialBlock
            image={PHOTOS.materials}
            label={t.about.materialsLabel}
            heading={t.about.materialsHeading}
            flip
            actions={
              <Link className="btn btn-secondary" href={routes.products(locale)}>
                {t.common.browseProducts}
              </Link>
            }
          >
            <p>{t.about.materialsBody}</p>
            <p>{t.about.materialsNote}</p>
          </EditorialBlock>
        </Container>
      </Section>

      <Section>
        <Container>
          <PullQuote
            text={t.brand.tagline}
            attribution={t.brand.name}
            emphasise="Matter"
          />
        </Container>
      </Section>

      <Section band>
        <Container>
          <SectionHead label={t.products.startWithCategory} />
          <div className={styles.chips}>
            {categories.map((category) => (
              <Link
                key={category.slug}
                className="tag tag-outline"
                href={routes.category(category.slug, locale)}
              >
                {category.name}
              </Link>
            ))}
          </div>
        </Container>
      </Section>

      <PhotoBand
        image={PHOTOS.shopBanner}
        label={t.about.bandLabel}
        heading={t.about.bandHeading}
        actions={
          <Link className="btn btn-primary blueprint" href={routes.products(locale)}>
            {t.common.browseProducts}
          </Link>
        }
      />

      <Section>
        <Container>
          <SectionHead label={t.about.workingHeading} />
          <p className={styles.body}>{t.about.workingBody}</p>
          <div className={styles.actions}>
            <Link
              className="btn btn-primary blueprint"
              href={`${routes.contact(locale)}#enquiry`}
            >
              {t.common.requestQuote}
            </Link>
            <Link className="btn btn-secondary" href={routes.faq(locale)}>
              {t.footer.faq}
            </Link>
          </div>
        </Container>
      </Section>
    </main>
  );
}
