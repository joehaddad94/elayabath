import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Container, Section } from "@/components/Container/Container";
import { Note } from "@/components/Note/Note";
import { Hero } from "@/components/Hero/Hero";
import { PhotoBand } from "@/components/PhotoBand/PhotoBand";
import { SectionHead } from "@/components/SectionHead/SectionHead";
import { getCatalogueMeta } from "@/lib/catalogue";
import { getDictionary } from "@/lib/i18n";
import { isLocale } from "@/lib/i18n/config";
import { PHOTOS } from "@/lib/imagery";
import { routes } from "@/lib/routes";
import styles from "./catalogue.module.css";
import { canonical } from "@/lib/seo";

export const metadata: Metadata = {
  alternates: canonical(routes.catalogue()),
  title: "Catalogue",
  description:
    "The full Elaya Bath range as one document, plus per-product technical data sheets.",
};

export default async function CataloguePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale = raw;
  const t = getDictionary(locale);
  const meta = getCatalogueMeta();

  return (
    <main id="main">
      <Hero
        compact
        title={t.catalogue.title}
        image={PHOTOS.heroRoom}
        lede={t.catalogue.lede}
        crumbLabel={t.common.breadcrumb}
        crumbs={[
          { label: t.nav.home, href: routes.home(locale) },
          { label: t.nav.catalogue },
        ]}
      />

      {/* The live Catalogue page is a bare PDF plugin: viewer chrome, an
          embedded file and not one word of copy. A visitor cannot tell what
          is in the document, how big it is, or whether browsing is faster. */}
      <Section tight>
        <Container className={styles.grid}>
          <figure className={`${styles.figure} blueprint`}>
            <Image
              src={PHOTOS.materials.src}
              alt={PHOTOS.materials.alt}
              width={PHOTOS.materials.width}
              height={PHOTOS.materials.height}
              sizes="(max-width: 58rem) 100vw, 32rem"
            />
          </figure>

          <div>
            <SectionHead label={t.catalogue.heading} />
            <p className={styles.body}>{t.catalogue.body}</p>

            <dl className={styles.meta}>
              <div>
                <dt>{t.common.products}</dt>
                <dd>{meta.productsInCatalogue}</dd>
              </div>
              <div>
                <dt>{t.common.categories}</dt>
                <dd>{meta.categoriesInCatalogue}</dd>
              </div>
              <div>
                <dt>{t.common.finishes}</dt>
                <dd>{meta.finishesInCatalogue}</dd>
              </div>
            </dl>

            {/* Disabled rather than pointing at a dead link. The file the
                live site links to is 404 on their own server. */}
            <div className={styles.actions}>
              <button className="btn btn-primary" type="button" disabled>
                {t.catalogue.download}
              </button>
              <Link className="btn btn-secondary" href={routes.products(locale)}>
                {t.catalogue.browseInstead}
              </Link>
            </div>

            <Note label={t.catalogue.missingLabel}>
              <p>{t.catalogue.missingBody}</p>
            </Note>
          </div>
        </Container>
      </Section>

      <PhotoBand
        image={PHOTOS.shopBanner}
        label={t.category.bandLabel}
        heading={t.category.bandHeading}
        actions={
          <Link className="btn btn-primary blueprint" href={routes.products(locale)}>
            {t.common.browseProducts}
          </Link>
        }
      />

      <Section band>
        <Container>
          <SectionHead label={t.catalogue.sheetsHeading} />
          <p className={styles.body}>{t.catalogue.sheetsBody}</p>
          <div className={styles.actions}>
            <Link className="btn btn-secondary" href={routes.products(locale)}>
              {t.catalogue.findProduct}
            </Link>
          </div>
        </Container>
      </Section>
    </main>
  );
}
