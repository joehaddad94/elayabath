import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Marks } from "@/components/Blueprint/Blueprint";
import { Breadcrumbs } from "@/components/Breadcrumbs/Breadcrumbs";
import { Container, Section } from "@/components/Container/Container";
import { Hero } from "@/components/Hero/Hero";
import { SectionHead } from "@/components/SectionHead/SectionHead";
import { getCatalogueMeta, getCategories } from "@/lib/catalogue";
import { getDictionary } from "@/lib/i18n";
import { isLocale } from "@/lib/i18n/config";
import { routes } from "@/lib/routes";
import styles from "./products.module.css";

export const metadata: Metadata = {
  title: "Products",
  description:
    "Browse washbasins, toilets, tapware, bathtubs, showers and accessories by category, with item codes and finishes.",
};

export default async function ProductsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale = raw;
  const t = getDictionary(locale);
  const categories = getCategories();
  const meta = getCatalogueMeta();

  return (
    <main id="main">
      <Hero
        compact
        title={t.products.title}
        image={{
          src: "/rooms/shop-banner.webp",
          alt: "A dark timber bathroom with a free-standing bath and a stone vessel basin, forest visible through full-height glass",
          width: 2048,
          height: 797,
        }}
      />

      <Section tight>
        <Container>
          <Breadcrumbs
            label={t.common.breadcrumb}
            items={[
              { label: t.nav.home, href: routes.home(locale) },
              { label: t.products.title },
            ]}
          />

          <SectionHead
            label={t.products.startWithCategory}
            count={`${categories.length} ${t.common.of} ${meta.categoriesInCatalogue}`}
          />

          <p className={styles.intro}>{t.products.intro}</p>

          <div className={styles.grid}>
            {categories.map((category) => (
              <article key={category.slug} className={`card blueprint ${styles.card}`}>
                <Link
                  className={styles.media}
                  href={routes.category(category.slug, locale)}
                  tabIndex={-1}
                  aria-hidden="true"
                >
                  {category.image ? (
                    <Image
                      src={category.image}
                      alt=""
                      width={817}
                      height={670}
                      sizes="(max-width: 48rem) 100vw, 24rem"
                      className={styles.photo}
                    />
                  ) : category.icon ? (
                    <Image
                      src={category.icon}
                      alt=""
                      width={200}
                      height={200}
                      className={`${styles.icon} invert-on-dark`}
                    />
                  ) : null}
                </Link>

                <div className={styles.body}>
                  <span className={styles.kicker}>
                    {category.productTypes
                      .slice(0, 3)
                      .map((type) => type.label)
                      .join(" · ")}
                  </span>
                  <h3 className={styles.title}>
                    <Link href={routes.category(category.slug, locale)}>
                      {category.name}
                    </Link>
                  </h3>
                  <div className={styles.meta}>
                    <span>
                      {category.count} {t.products.inThisBuild}
                    </span>
                    <span>
                      {category.totalInCatalogue} {t.products.inCatalogue}
                    </span>
                  </div>
                  <Link
                    className={`btn btn-quote btn-block ${styles.cta}`}
                    href={routes.category(category.slug, locale)}
                  >
                    {t.common.viewAll}
                  </Link>
                </div>
                <Marks />
              </article>
            ))}
          </div>

          {/* The client's own navigation advertises four categories that have
              no products at all. Named rather than quietly omitted: it is a
              content gap for them to fill, not a design decision for us. */}
          <div className={`${styles.note} blueprint`}>
            <b>Four empty categories</b>
            <p>
              Bathroom Furniture, Shower Trays, Shower Enclosures and
              Installation Systems appear in the live site&rsquo;s navigation
              and on its homepage with no products behind them. They are left
              out here rather than shown as dead ends.
            </p>
            <Marks />
          </div>
        </Container>
      </Section>

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
              <Marks />
            </Link>
          </p>
        </Container>
      </Section>
    </main>
  );
}
