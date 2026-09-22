import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Container, Section } from "@/components/Container/Container";
import { Faq } from "@/components/Faq/Faq";
import { JsonLd } from "@/components/JsonLd/JsonLd";
import { Note } from "@/components/Note/Note";
import { PageHead } from "@/components/PageHead/PageHead";
import { SectionHead } from "@/components/SectionHead/SectionHead";
import { getDictionary } from "@/lib/i18n";
import { isLocale } from "@/lib/i18n/config";
import { routes } from "@/lib/routes";
import styles from "./faq.module.css";
import { canonical, faqSchema } from "@/lib/seo";

export const metadata: Metadata = {
  alternates: canonical(routes.faq()),
  title: "FAQ",
  description:
    "Materials, installation and water efficiency: the questions Elaya Bath is asked most.",
};

export default async function FaqPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale = raw;
  const t = getDictionary(locale);

  return (
    <main id="main">
      {/* t.faq.real only. The drafted answers below them are marked on the
          page as unapproved, and structured data would strip that caveat and
          present a proposal as the company's published position. */}
      <JsonLd graph={[faqSchema([...t.faq.real])]} />
      <PageHead
        title={t.faq.title}
        lede={t.faq.lede}
        crumbLabel={t.common.breadcrumb}
        crumbs={[
          { label: t.nav.home, href: routes.home(locale) },
          { label: t.footer.faq },
        ]}
      />

      <Section tight>
        <Container>
          <SectionHead label={t.faq.realHeading} count={t.faq.realNote} />
          <Faq items={t.faq.real} />
        </Container>
      </Section>

      {/* Drafted answers sit in their own section behind a warning, so nobody
          can mistake one for the client's own words. */}
      <Section band>
        <Container>
          <SectionHead label={t.faq.draftHeading} count={t.faq.draftLabel} />
          <Note label={t.draft.needsApproval}>
            <p>{t.faq.draftNote}</p>
          </Note>
          <Faq items={t.faq.drafted} />

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
