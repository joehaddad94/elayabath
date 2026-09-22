import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Marks } from "@/components/Blueprint/Blueprint";
import { Breadcrumbs } from "@/components/Breadcrumbs/Breadcrumbs";
import { Container, Section } from "@/components/Container/Container";
import { Hero } from "@/components/Hero/Hero";
import { SectionHead } from "@/components/SectionHead/SectionHead";
import { SpecPlate } from "@/components/SpecPlate/SpecPlate";
import { getCatalogueMeta, getCategories } from "@/lib/catalogue";
import { getDictionary } from "@/lib/i18n";
import { isLocale } from "@/lib/i18n/config";
import { routes } from "@/lib/routes";
import styles from "./about.module.css";

export const metadata: Metadata = {
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
  const meta = getCatalogueMeta();
  const categories = getCategories();

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
        title={t.brand.tagline}
        image={{
          src: "/rooms/about-banner.webp",
          alt: "A dark bathroom in bronze tiling, a folded white towel on a ring, a black stone basin and planting, lit warmly from one side",
          width: 2048,
          height: 647,
        }}
      />

      <Section tight>
        <Container>
          <Breadcrumbs
            label={t.common.breadcrumb}
            items={[
              { label: t.nav.home, href: routes.home(locale) },
              { label: t.nav.about },
            ]}
          />

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
                <Marks />
              </div>
            ))}
          </div>
        </Container>
      </Section>

      <Section>
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
              <Marks />
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
