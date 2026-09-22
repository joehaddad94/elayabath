import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/Breadcrumbs/Breadcrumbs";
import { Container, Section } from "@/components/Container/Container";
import { EnquiryForm } from "@/components/EnquiryForm/EnquiryForm";
import { Hero } from "@/components/Hero/Hero";
import { Note } from "@/components/Note/Note";
import { SectionHead } from "@/components/SectionHead/SectionHead";
import { getDictionary } from "@/lib/i18n";
import { isLocale } from "@/lib/i18n/config";
import { routes } from "@/lib/routes";
import styles from "./contact.module.css";

export const metadata: Metadata = {
  title: "Contact Us",
  description:
    "Regional offices for MEA, Africa, Europe and the US, plus technical, design and general enquiries.",
};

export default async function ContactPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale = raw;
  const t = getDictionary(locale);
  const mail = t.contactAddresses;

  // The live site splits these across three places: two regional addresses on
  // the contact page, three department addresses in the footer, and the form
  // on a fourth page that only the footer links to.
  const contacts = [
    {
      region: t.contact.meaRegion,
      heading: t.contact.regionalOffice,
      body: t.contact.meaBody,
      email: mail.mea,
    },
    {
      region: t.contact.europeRegion,
      heading: t.contact.regionalOffice,
      body: t.contact.europeBody,
      email: mail.europe,
    },
    {
      region: t.contact.technicalRegion,
      heading: t.contact.technicalHeading,
      body: t.contact.technicalBody,
      email: mail.technical,
    },
    {
      region: t.contact.designRegion,
      heading: t.contact.designHeading,
      body: t.contact.designBody,
      email: mail.design,
    },
    {
      region: t.contact.generalRegion,
      heading: t.contact.generalHeading,
      body: t.contact.generalBody,
      email: mail.general,
    },
  ];

  return (
    <main id="main">
      <Hero
        compact
        title={t.contact.title}
        image={{
          src: "/rooms/contact-banner.webp",
          alt: "A showroom wall of wall-hung toilets and floor-standing basins in dusty pink, grey and black, set in lit recesses",
          width: 1440,
          height: 600,
        }}
      />

      <Section tight>
        <Container>
          <Breadcrumbs
            label={t.common.breadcrumb}
            items={[
              { label: t.nav.home, href: routes.home(locale) },
              { label: t.nav.contact },
            ]}
          />

          <SectionHead
            label={t.contact.regionalHeading}
            count={t.contact.regionalLabel}
          />
          <p className={styles.body}>{t.contact.regionalBody}</p>

          <div className={styles.grid}>
            {contacts.map((contact) => (
              <div
                key={contact.email + contact.region}
                className={`card blueprint ${styles.card}`}
              >
                <span className={styles.region}>{contact.region}</span>
                <h3 className={styles.heading}>{contact.heading}</h3>
                <p className={styles.note}>{contact.body}</p>
                <a className={styles.mail} href={`mailto:${contact.email}`}>
                  {contact.email}
                </a>
                <a
                  className={`btn btn-secondary ${styles.cta}`}
                  href={`mailto:${contact.email}`}
                >
                  {t.contact.sendEmail}
                </a>
              </div>
            ))}
          </div>
        </Container>
      </Section>

      <Section id="enquiry" band>
        <Container>
          <SectionHead
            label={t.contact.formHeading}
            count={t.contact.formLabel}
          />
          <p className={styles.body}>{t.contact.formBody}</p>

          <Note label={t.contact.prototypeLabel}>
            <p>{t.contact.prototypeBody}</p>
          </Note>

          <EnquiryForm t={t} />
        </Container>
      </Section>
    </main>
  );
}
