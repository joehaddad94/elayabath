import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Container, Section } from "@/components/Container/Container";
import { Note } from "@/components/Note/Note";
import { PageHead } from "@/components/PageHead/PageHead";
import { SectionHead } from "@/components/SectionHead/SectionHead";
import { getCatalogueMeta } from "@/lib/catalogue";
import { getDictionary } from "@/lib/i18n";
import { isLocale } from "@/lib/i18n/config";
import { routes } from "@/lib/routes";
import styles from "./catalogue.module.css";

export const metadata: Metadata = {
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
      <PageHead
        title={t.catalogue.title}
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
              src="/rooms/catalogue-room.webp"
              alt="A flat-lay of bathroom materials: stone and ceramic tiles, timber, plaster and a dried stem on a pale surface"
              width={960}
              height={756}
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
