import Link from "next/link";
import { notFound } from "next/navigation";
import { Container, Section } from "@/components/Container/Container";
import { Faq } from "@/components/Faq/Faq";
import { Hero } from "@/components/Hero/Hero";
import { JsonLd } from "@/components/JsonLd/JsonLd";
import { PhotoBand } from "@/components/PhotoBand/PhotoBand";
import { Note } from "@/components/Note/Note";
import { SectionHead } from "@/components/SectionHead/SectionHead";
import { isLocale } from "@/lib/i18n/config";
import { routes } from "@/lib/routes";
import styles from "./faq.module.css";
import { faqSchema } from "@/lib/seo";
import { faqFor, photoFor } from "@/lib/site-content/fields";
import { getSiteContent, getSiteDictionary, pageMetadata } from "@/lib/site-content/read";

export function generateMetadata() {
  return pageMetadata("faq", routes.faq());
}

export default async function FaqPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale = raw;
  const [t, content] = await Promise.all([getSiteDictionary(locale), getSiteContent()]);
  // Once the questions are edited in Site content they are one list, the
  // visible ones in order; until then, the client's answers and the drafted
  // ones below them, behind their warning.
  const edited = faqFor(content)?.filter((item) => item.visible);

  return (
    <main id="main">
      {/* t.faq.real only. The drafted answers below them are marked on the
          page as unapproved, and structured data would strip that caveat and
          present a proposal as the company's published position. */}
      <JsonLd graph={[faqSchema(edited ?? [...t.faq.real])]} />
      <Hero
        compact
        title={t.faq.title}
        image={photoFor(content, "photo.faq.banner")}
        lede={t.faq.lede}
        crumbLabel={t.common.breadcrumb}
        crumbs={[
          { label: t.nav.home, href: routes.home(locale) },
          { label: t.footer.faq },
        ]}
      />

      <Section tight>
        <Container>
          <SectionHead label={t.faq.realHeading} />
          <Faq items={edited ?? t.faq.real} permalinkLabel={t.faq.permalink} />
        </Container>
      </Section>

      {/* This page was 2200px of unbroken text. The break also does editorial
          work: it separates the client's own three answers from the three
          drafted below, which the warning alone was carrying. */}
      <PhotoBand
        image={photoFor(content, "photo.faq.band")}
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

      {/* Drafted answers sit in their own section behind a warning, so nobody
          can mistake one for the client's own words. */}
      <Section band>
        <Container>
          {!edited && (
            <>
              <SectionHead label={t.faq.draftHeading} count={t.faq.draftLabel} />
              <Note label={t.draft.needsApproval}>
                <p>{t.faq.draftNote}</p>
              </Note>
              <Faq items={t.faq.drafted} permalinkLabel={t.faq.permalink} />
            </>
          )}

          <div className={styles.actions}>
            <Link
              className="btn btn-primary blueprint"
              href={`${routes.contact(locale)}#enquiry`}
            >
              {t.common.requestQuote}
            </Link>
            <Link className="btn btn-secondary" href={routes.products(locale)}>
              {t.common.browseProducts}
            </Link>
          </div>
        </Container>
      </Section>
    </main>
  );
}
